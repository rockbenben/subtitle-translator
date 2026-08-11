// Platform-agnostic translation pipeline — the engine behind the web UI's
// useTranslationState hook AND any headless consumer (CLI, Node server).
//
// Everything React/browser is injected via PipelineDeps:
//   - cache:     key-value translation cache (browser: IndexedDB via
//                translationCache; CLI: a JSON file; absent: no caching)
//   - onProgress/onRateLimit: UI surfaces (progress bar, antd toast) or stderr
//   - signal:    external cancellation (user cancel button, Ctrl-C)
//   - shouldStop: provider-unmount guard (browser back/nav) — see the
//                disposedRef notes below; headless callers omit it
//   - getGlossaryTerms: run-scoped glossary snapshot lives with the caller
//
// Failures are RETURNED (PipelineOutcome.failures + raw lastError), never
// setState'd; error MESSAGE formatting (describeError + i18n) stays caller-side.
//
// Import discipline: submodules only — never the "@/app/lib/translation"
// barrel ("use client") or "@/app/utils" barrel (file-saver) — this file must
// load in Node.

import pLimit from "p-limit";
import pRetry from "p-retry";
import SparkMD5 from "spark-md5";
import type { RuntimeGlobals, TranslateTextParams, TranslationConfig, TranslationMethod } from "./types";
import { LLM_MODELS, deriveThinkingParams } from "./registry";
import { translationServices } from "./services";
import { generateCacheKey, generateCacheSuffix } from "./cache";
import { cleanTranslatedText, splitTextIntoChunks } from "./utils";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./config";
import { applyGlossaryToText, buildGlossaryPromptBlock, buildStrictGlossaryPromptBlock, filterTermsMatchingText, findGlossaryViolations, type GlossaryTerm } from "./glossary";
import { getRetryConfig, rateLimitGate, abortableSleep, isAuthError, DEFAULT_BATCH_SIZE, DEFAULT_RETRY_COUNT, DEFAULT_RETRY_TIMEOUT, type UserRetryConfig } from "./retry";
import { extractTranslatedLinesWithNumbers, buildContextPrompt, isBlankLine, prefillFromLineCache } from "./contextTranslation";
import { isAbortError, formatErrorWithCause } from "@/app/utils/errorUtils";

// Methods that run against a LOCAL runtime (Ollama / LM Studio / llama.cpp),
// where a per-request timeout most often means the model stalled in a repeat
// loop or is just slow — NOT a network/cloud-service issue. A timeout on these
// gets a method-specific hint (lower max_tokens, check source language) instead
// of the generic "service slow, try another" message. translategemma always
// runs local; `llm` Custom's primary audience is local self-hosters.
const LOCAL_TIMEOUT_HINT_METHODS: ReadonlySet<string> = new Set(["translategemma", "llm"]);
// Caps context window padding around a batch — without this, a large
// contextWindow would request hundreds of neighbor lines per batch and blow
// past the model's context limit on long inputs.
const MAX_CONTEXT_PADDING = 50;

// ─── Public contract ────────────────────────────────────────────────────────

/**
 * Key-value cache the pipeline reads/writes translations through. Shape matches
 * the browser's `translationCache` (indexedDBStorage) exactly — pass it
 * directly. A CLI passes a file-backed impl; omit for no caching.
 */
export interface PipelineCache {
  get(key: string): Promise<string | null>;
  getMany(keys: string[]): Promise<(string | null)[]>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface PipelineDeps {
  cache?: PipelineCache;
  /**
   * The single-request translate (cache lookup + service dispatch + cleanup).
   * Defaults to `translateCore` over `cache`. The web host injects
   * lib/translation's `useTranslation().translate` — that indirection is the
   * network seam its hook tests mock, so it must stay injectable, not be
   * hard-wired here. Headless callers (CLI) omit it and get translateCore.
   */
  translate?: (params: TranslateTextParams) => Promise<string>;
  /** External cancellation (cancel button / Ctrl-C). The pipeline chains its own run controller off it. */
  signal?: AbortSignal;
  /**
   * Provider-unmount guard (browser back/nav mid-run). The web host's unmount
   * also aborts the live run controller, but callers without a run controller
   * (tools driving their own loop) historically relied on this flag alone —
   * keep honoring it at every liveness check. Headless callers omit it.
   */
  shouldStop?: () => boolean;
  onProgress?: (current: number, total: number) => void;
  /** One notice per 429 cooldown burst (rateLimitGate.trip returned true). */
  onRateLimit?: () => void;
  /**
   * Single-line standalone calls only: an auth error must ALSO abort the
   * caller's shared run controller so peer lines in a tool-driven loop die too
   * (inside translateLines the run controller is pipeline-internal and this is
   * not needed).
   */
  onAuthAbort?: () => void;
  /** Run-scoped glossary snapshot (see the hook's glossarySnapshotRef). Absent = no glossary. */
  getGlossaryTerms?: (targetLang: string) => GlossaryTerm[];
  /**
   * True when an EARLIER pipeline call in the same logical run (multi-file /
   * multi-language loop) already hit a 429 — keeps the context path's
   * auto-retry breather long (10s) across per-file calls, matching the old
   * run-scoped rateLimitedThisRunRef semantics.
   */
  rateLimitedEarlier?: boolean;
}

// A line that still failed after retries. `line` is the 1-based PHYSICAL source
// line — callers pass a lineNumbers mapping (translateLines meta) whenever the
// array they translate is filtered/derived (subtitle cue text lines, md segments),
// so the failure modal points at a line the user can actually find; without a
// mapping it falls back to the array ordinal (correct only for full-line callers
// like md raw mode). Absent for units with no line position (JSONTranslator's key
// nodes — the modal falls back to sequential numbering). `lang` tags the target in
// multi-language runs where the same source line can fail under several targets;
// `file` tags the source file in multi-file batches, where failures accumulate
// across files under a single clearFailures.
export interface FailedLine {
  text: string;
  line?: number;
  lang?: string;
  file?: string;
  /**
   * 该行在返回的 `lines` 数组里的下标(不是物理行号,`line` 才是)。
   *
   * 存在的理由:软填的槽位装的是【未翻译的原文】,调用方的译后加工
   * (removeChars 等)绝不能碰它 —— 碰了就产出既非原文也非译文的东西,而
   * 界面和 CLI 都刚刚承诺过"失败的行已保留原文"。此前调用方只能拿 `line`
   * 去【反推】下标,三个调用方里有两个推错了(字幕/Markdown 直接整份套用,
   * 只有 JSON handler 做对),所以由引擎直接给出,别再让每个调用方自己算。
   */
  index?: number;
}

// Failure-panel metadata for translateLines. lineNumbers[i] = 1-based physical
// source line of contentLines[i] — REQUIRED for correct failure locations when
// contentLines is a filtered/derived list (cue text lines, md segments); omitted,
// the ordinal fallback i+1 only holds for full-line arrays. fileName tags each
// failure with its source file so multi-file batches stay attributable.
export type TranslateBatchMeta = {
  lineNumbers?: number[];
  fileName?: string;
  /**
   * 【出参】调用方传一个空 Set,引擎把本次软填(保留原文)的槽位下标写进去。
   *
   * 为什么是出参而不是返回值:translateBatch 返回 string[],被三个工具页和四条
   * 测试直接消费;而调用方【必须】知道哪些槽位装的是原文 —— 译后加工
   * (removeChars)碰了它们就产出既非原文也非译文的东西,而界面同屏正说着
   * "失败的行已保留原文"。Set 出参既不改返回形状,也不引入"必须紧接着读某个
   * ref"的时序耦合。CLI 侧走 cliFormat 的 softFilledIndices(同一份语义)。
   */
  collectSoftFilled?: Set<number>;
};

export type PipelineRuntimeConfig = TranslationConfig & {
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  fullText?: string; // Complete text for ${fullText} variable
  /** Per-line retry budget + per-request timeout (seconds) — the hook's user settings. */
  retryCount?: number;
  requestTimeoutSec?: number;
  /**
   * User's own relay origin (empty = built-in). Same tier as retryCount/
   * requestTimeoutSec — a GLOBAL user setting injected by the hook, not part
   * of any provider's TranslationConfig. Unlike those two it IS forwarded to
   * services (it decides the URL), so it's in optionalFields below.
   */
  relayBase?: string;
  // Internal: set ONLY by enforceGlossaryOnLine's one-shot retry. Replaces the
  // standard per-request glossary block with the STRICT variant listing just
  // the violated terms. Never forwarded to services (not in optionalFields).
  strictGlossaryTerms?: GlossaryTerm[];
  /**
   * 【单元互相独立,必须逐单元往返】—— JSON 值这类调用方设置(经
   * buildRuntimeConfig 的 independent 选项)。它必须压住【两条】批处理路径:
   * chunk(靠 chunkSize:undefined)与 LLM 上下文 marker 批(靠本字段)。
   *
   * 为什么要有这个字段而不是只剥 chunkSize:上下文分支排在 chunkSize 分支
   * 【之前】,只剥 chunkSize 对 LLM provider 完全无效 —— independent 曾经就是
   * 这样一个名不副实的开关,JSON 值被 20 个一组塞进 marker 请求,回显守卫把
   * 合法译文判成回显清空,一次编号错位丢 20 个值。名字承诺逐值,就得真逐值。
   * 不在 optionalFields 里,不会发到服务端。
   */
  independent?: boolean;
};

/**
 * 批量路径的 runtime config 组装 —— 网页壳(useTranslationState translateBatch)
 * 与 CLI 壳(scripts/cli.ts buildConfig)共用。
 *
 * 它【是】PipelineRuntimeConfig 的唯一组装线。这句话曾经不成立:单行路径
 * translateSingleWithGlossary 与 JSONTranslator 的四个手写循环各自手拼 config,
 * 不受 RuntimeGlobals 的必填键约束 —— delayTime 就这么漏过一次且已上线(字幕/
 * Markdown 每行间隔 200ms、JSON 对同一个 provider 满速打)。现在 JSONTranslator
 * 经 translateBatch 走 translateLines,单行入口已删,新增全局旋钮时漏接
 * 【必然】编译失败,不再靠人记得。
 *
 * independent:调用方的翻译单元互相独立且必须逐单元往返(JSON 值 —— 内嵌换行
 * 是值的一部分)时置 true。它压住【两条】批处理路径:这里剥掉 chunkSize 挡住
 * chunk,再由 runTranslateLines 的 `!config.independent` 挡住 LLM 上下文 marker
 * 批(那条分支排在 chunkSize 之前,只剥 chunkSize 对 LLM 完全无效)。chunk 路径的
 * 换行扁平化 + join/split 对齐对连续文档是可接受降级,对独立单元是【静默数据
 * 损坏】(错位后每个值拿到别人的译文)。剥离规则收在组装线这一处 —— 网页壳与
 * CLI 壳(cli.ts buildConfig)同一份,别在调用方手写 `chunkSize: undefined`。
 *
 * 编译期的「别漏旋钮」保证来自 RuntimeGlobals 的全键必填,不是本函数;本函数
 * 唯一固化的不变量是 globals 盖在 config 之上的【次序】。
 *
 * 合并次序即优先级:globals 盖过 config(网页端 effectiveSystemPrompt 压过
 * config 里可能残存的 prompt,与收敛前的字面量逐位一致)。globals 用普通展开、
 * 不过滤 undefined:present-but-undefined 的键在 pipeline 的 optionalFields
 * 检查(!== undefined)下等价于缺席,而 config 里可能被它遮蔽的同名键
 * (prompt/relayBase)要么必然有值(网页端),要么已被 migrateConfig 剥掉
 * (CLI 端 defaults-key-only 合并),两边行为都与收敛前逐位相同。
 */
export const buildRuntimeConfig = (opts: { translationMethod: string; targetLanguage: string; sourceLanguage: string; useCache: boolean; config: TranslationConfig; globals: RuntimeGlobals; independent?: boolean }): PipelineRuntimeConfig => ({
  translationMethod: opts.translationMethod,
  targetLanguage: opts.targetLanguage,
  sourceLanguage: opts.sourceLanguage,
  useCache: opts.useCache,
  ...opts.config,
  // 两条批处理路径都要压住:chunk 靠 chunkSize:undefined(分叉判据是
  // `chunkSize === undefined`,present-but-undefined 即可),LLM 上下文
  // marker 批靠 independent 字段本身 —— 详见 PipelineRuntimeConfig.independent。
  ...(opts.independent ? { chunkSize: undefined, independent: true } : null),
  ...opts.globals,
});

/**
 * 把一个来路不明的配置值收成【正整数】—— 并发数、循环步长都用它(名字不叫
 * concurrency 正因为并非每个调用点都是并发:contextWindow 是步长兼
 * `new Array()` 尺寸)。
 *
 * Math.floor 不可省:小数会让 p-limit 直接抛 TypeError、让 `new Array(20.5)`
 * 抛 RangeError。UI 那侧的入口已经用 precision={0} 关掉了,这里守的是【绕开
 * UI 的三条】:localStorage 里的历史脏值、导入的设置文件与 LLM preset
 * (sanitizeSettings 只清洗前者、不碰已落盘的值)、以及 CLI 的 -s。
 * Math.max(…, 1) 兜住 0 / 负数 / NaN。
 */
export const positiveInt = (value: unknown, fallback: number): number => Math.max(Math.floor(Number(value) || fallback), 1);

/**
 * 失败记录的【物理行号】。有 lineNumbers 就用它;没有时只在【连续文档】上回落
 * 到序数 —— 那里 contentLines 就是整行数组,i+1 恰好【是】行号。
 *
 * independent(JSON 值这类独立单元)一律留空:序数不是行号,pretty-print 的
 * JSON 里第 847 个值大概在 800 多行、但永远不等于 847 —— `line` 这个字段的
 * 契约就是【物理行号】,往里塞序数就是让下游对着它撒谎。
 *
 * 单元序数没有丢,它在 FailedLine.index 里。两个消费方各自决定怎么呈现:
 * CLI 把标签切成「items #」(cli.ts 的 report),网页失败面板经 posOf 回落到
 * index+1 当定位用(TranslateFailurePanel,那里记着这个取舍)。
 * 也就是说:引擎只负责【不编造】,呈现口径由壳自己挑。
 */
const failureLine = (config: PipelineRuntimeConfig, meta: TranslateBatchMeta | undefined, index: number): number | undefined => meta?.lineNumbers?.[index] ?? (config.independent ? undefined : index + 1);

export interface PipelineOutcome {
  lines: string[];
  /** Lines still failed after all retry layers (soft-filled with source in `lines`). */
  failures: FailedLine[];
  /** Representative RAW error from the last real soft-failure — format caller-side (describeError). */
  lastError?: unknown;
  /** True when any request this call (or `rateLimitedEarlier`) hit a 429. */
  rateLimited: boolean;
}

// ─── Internal run context ───────────────────────────────────────────────────

type RunCtx = {
  cache?: PipelineCache;
  /** Resolved from deps.translate, else translateCore over deps.cache. */
  translate: (params: TranslateTextParams) => Promise<string>;
  /** THIS run's abort controller — auth cascade target, chained from deps.signal. */
  run?: AbortController;
  shouldStop: () => boolean;
  onProgress?: (current: number, total: number) => void;
  onRateLimit?: () => void;
  onAuthAbort?: () => void;
  getGlossaryTerms: (targetLang: string) => GlossaryTerm[];
  noteError: (error: unknown) => void;
  noteRateLimited: () => void;
  wasRateLimited: () => boolean;
};

/** Chain an internal run controller off the external signal; returns cleanup. */
const chainSignal = (run: AbortController, external?: AbortSignal): (() => void) => {
  if (!external) return () => {};
  if (external.aborted) {
    run.abort();
    return () => {};
  }
  const onAbort = () => run.abort();
  external.addEventListener("abort", onAbort, { once: true });
  return () => external.removeEventListener("abort", onAbort);
};

// ─── Core single-request translate (was lib/translation/index.ts translateText) ──

// Skip translation if text has no translatable characters
const HAS_TRANSLATABLE_CONTENT = /[a-zA-Z\p{L}]/u;

// Services whose responses HTML-encode characters (Google NMT backends) —
// the only ones whose output should be entity-unescaped. See translateCore.
const HTML_ENCODING_METHODS: ReadonlySet<string> = new Set(["gtxFreeAPI", "google", "webgoogletranslate"]);

/**
 * Translate text using the specified method. Throws on error to allow retry
 * logic to work properly. Cache injected — absent = no read/write.
 */
export const translateCore = async (params: TranslateTextParams, cache?: PipelineCache): Promise<string> => {
  const { text, cacheSuffix, translationMethod, targetLanguage, sourceLanguage, useCache = true } = params;

  if (!HAS_TRANSLATABLE_CONTENT.test(text) || sourceLanguage === targetLanguage) {
    return text;
  }

  // Check cache
  const cacheKey = generateCacheKey(text, cacheSuffix);
  if (useCache && cache) {
    const cachedTranslation = await cache.get(cacheKey);
    if (cachedTranslation) return cachedTranslation;
  }

  // Get translation service
  const service = translationServices[translationMethod];
  if (!service) {
    throw new Error(`Unsupported translation method: ${translationMethod}`);
  }

  const translatedText = await service(params);

  if (!translatedText) {
    throw new Error(`No translation result received for method: ${translationMethod}`);
  }

  // HTML-entity unescape ONLY for Google's NMT-backed services — they encode
  // apostrophes/brackets in their responses. Other providers (LLMs, DeepL)
  // return faithfully escaped content; unescaping it engine-wide changed
  // document semantics (&lt;div&gt; in an HTML-escaped doc became a real tag)
  // and cached the corrupted form.
  const cleanedText = HTML_ENCODING_METHODS.has(translationMethod) ? cleanTranslatedText(translatedText) : translatedText;
  // Fire-and-forget cache write — failures swallowed in the cache impl,
  // and the next read of this key is ≥1s later (retry interval) so the write
  // has plenty of time to settle. Awaiting would add 5-50ms per line for nothing.
  if (useCache && cache) {
    void cache.set(cacheKey, cleanedText);
  }

  return cleanedText;
};

// ─── Single-line engine ─────────────────────────────────────────────────────

const applyGlossary = (ctx: RunCtx, text: string, targetLang: string): string => applyGlossaryToText(text, ctx.getGlossaryTerms(targetLang));

// Retry translation with config - throws on failure (no fallback to original text)
//
// `ctx.run` is the abort controller of the run THIS call belongs to, captured
// by the caller when its run starts — reading a live ref here instead opened
// the ghost-task hole: p-limit never cancels queued tasks, so after an auth
// abort the dead run's queued tasks would dequeue under the NEXT run's fresh
// controller, pass the liveness check, fire real API requests for the
// discarded run, and on re-hitting the auth error abort the HEALTHY new run
// (which then exported blank lines with a success toast).
const translateSingle = async (text: string, cacheSuffix: string, config: PipelineRuntimeConfig, ctx: RunCtx, fullText?: string): Promise<string> => {
  const run = ctx.run;
  // Check if already aborted (e.g., by auth error in another concurrent request).
  // shouldStop:provider 已卸载(浏览器后退)—— 这里是所有翻译路径(含
  // 自带循环的工具,它们不经 translateLines 且常无 run controller)
  // 的咽喉,据此拒绝继续发请求。"Translation aborted" 走既有级联中止链路
  // (isCascadedAbort → 各工具静默)。
  if (ctx.shouldStop() || run?.signal.aborted) {
    throw new Error("Translation aborted");
  }

  const retryCount = config.retryCount ?? DEFAULT_RETRY_COUNT;
  const requestTimeoutSec = config.requestTimeoutSec ?? DEFAULT_RETRY_TIMEOUT;
  const userRetryConfig: UserRetryConfig = { retryCount, requestTimeoutSec };
  const retryConfig = getRetryConfig(config.translationMethod, userRetryConfig);
  const timeoutMs = requestTimeoutSec * 1000;

  // Create per-request abort controller with timeout
  // Links to this RUN's abort controller and auto-cleans up
  const createTimeoutController = () => {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    // If the run's controller aborts, also abort this request
    const onAbort = () => controller.abort();
    run?.signal.addEventListener("abort", onAbort, { once: true });

    return {
      controller,
      cleanup: () => {
        clearTimeout(timeoutId);
        run?.signal.removeEventListener("abort", onAbort);
      },
    };
  };

  // Build translate params - pick defined optional fields from config.
  // reasoningEffort is derived per-call from the thinkingEffort record
  // (presence of entry for current model = effort, absence = thinking off).
  const optionalFields = ["useCache", "apiKey", "region", "url", "model", "apiVersion", "folderId", "temperature", "maxTokens", "systemPrompt", "userPrompt", "sendSystemPrompt", "useRelay", "relayBase", "domains"] as const;
  const extras: Record<string, unknown> = {};
  const configRecord = config as unknown as Record<string, unknown>;
  for (const key of optionalFields) {
    if (configRecord[key] !== undefined) {
      extras[key] = configRecord[key];
    }
  }
  // Single-point gate: deriveThinkingParams checks (a) thinkingEffort entry
  // exists AND (b) model is tagged in registry. Services key off
  // params.reasoningEffort presence (Moonshot K2.6 + Gemini also re-check
  // isThinkingModel internally — they're server-default-ON and need to send
  // explicit "disabled" / "minimal" when tagged-but-effort-undefined).
  const effort = deriveThinkingParams(config.translationMethod, config);
  if (effort) extras.reasoningEffort = effort;
  if (fullText !== undefined) extras.fullText = fullText;

  // Per-request glossary composition. The wire prompt carries ONLY the terms
  // this text actually contains — a 500-term glossary must not ride along on
  // (and dilute) every request. Cache stays correct without a per-request
  // suffix: the block is a deterministic function of {text, full term set},
  // and the cache key already covers both (text via generateCacheKey, full
  // set via the caller's cacheSuffix).
  if (LLM_MODELS.includes(config.translationMethod)) {
    // Appending to an empty base would otherwise drop the default prompt:
    // services treat a non-empty systemPrompt as "user configured" verbatim.
    const base = config.systemPrompt?.trim() ? config.systemPrompt : DEFAULT_SYSTEM_PROMPT;
    if (config.strictGlossaryTerms?.length) {
      extras.systemPrompt = base + buildStrictGlossaryPromptBlock(config.strictGlossaryTerms);
    } else {
      const matched = filterTermsMatchingText(ctx.getGlossaryTerms(config.targetLanguage), text);
      if (matched.length > 0) extras.systemPrompt = base + buildGlossaryPromptBlock(matched);
    }
  } else if (config.translationMethod === "qwenMt") {
    // Qwen-MT: native terminology intervention instead of a prompt block.
    const matched = filterTermsMatchingText(ctx.getGlossaryTerms(config.targetLanguage), text);
    if (matched.length > 0) extras.glossaryTerms = matched.map((t) => ({ source: t.source.trim(), target: t.target.trim() }));
  }

  const translateParams: TranslateTextParams = {
    text,
    cacheSuffix,
    translationMethod: config.translationMethod,
    targetLanguage: config.targetLanguage,
    sourceLanguage: config.sourceLanguage,
    ...extras,
  } as TranslateTextParams;

  try {
    return await pRetry(
      async () => {
        // Check abort before each attempt — against THIS run's controller
        // (a retry interval can span a run boundary).
        // shouldStop:重试间隔(可达 30s)可能跨越 provider 卸载,而自带循环
        // 工具的调用常无 run controller 可被卸载时 abort。
        if (ctx.shouldStop() || run?.signal.aborted) {
          throw new Error("Translation aborted");
        }

        // 共享 429 冷却闸:该服务正被限流时,所有并发行在【发请求前】统一
        // 等冷却结束,而不是各自按 pRetry 独立节奏继续轰炸(重试羊群会让
        // 限流永不解除,直到每行烧光重试预算软失败)。等待先于超时计时器
        // 创建 —— 闸内等待不占用请求超时额度。中途 abort 抛
        // "Translation aborted",走既有级联中止链路。
        await rateLimitGate.wait(config.translationMethod, run?.signal);

        const { controller, cleanup } = createTimeoutController();

        try {
          const result = await ctx.translate({ ...translateParams, signal: controller.signal });
          cleanup();
          return result;
        } catch (error) {
          cleanup();

          // Local-model timeout → attach a method-specific hint via the
          // explicit errorHintKey channel (describeError honors it). Gate on a
          // GENUINE per-request timeout: a run-signal abort (auth cascade /
          // unmount) also surfaces as an AbortError on the in-flight fetch, but
          // run.signal.aborted is set then — that's not a slow-model timeout, so
          // exclude it. Set before the rethrow so the soft-fail catch upstream
          // (noteError → describeError) localizes the right guidance.
          if (isAbortError(error) && !run?.signal.aborted && LOCAL_TIMEOUT_HINT_METHODS.has(config.translationMethod)) {
            (error as { errorHintKey?: string }).errorHintKey = "translationTimeoutLocal";
          }

          // Auth error → abort all concurrent requests OF THIS RUN. Aborting
          // a live ref instead would let a ghost task from a dead run kill
          // a healthy successor run. onAuthAbort additionally trips the
          // caller's SHARED controller on standalone single-line calls
          // (tool-driven loops) — inside translateLines it is not set.
          if (isAuthError(error)) {
            run?.abort();
            ctx.onAuthAbort?.();
          }
          // 429 → 触发该服务的全局冷却(尊重服务器 Retry-After,否则
          // 1s→2s→…→60s 升级)。trip 仅在【开启】一轮冷却时返回 true
          // (同一波并发 429 只第一个生效),据此通知一次降速(onRateLimit)——
          // 用户能看出"为什么变慢了",而不是面对一个静默卡住的进度条。
          if ((error as { status?: number })?.status === 429) {
            // Mark the run rate-limited (even within-burst dups that don't
            // start a cooldown) so the post-pass auto-retry keeps its long
            // breather only when the provider actually throttled us.
            ctx.noteRateLimited();
            const startedCooldown = rateLimitGate.trip(config.translationMethod, (error as { retryAfterMs?: number }).retryAfterMs);
            if (startedCooldown) {
              ctx.onRateLimit?.();
            }
          }
          throw error;
        }
      },
      {
        ...retryConfig,
        // 取消/级联中止要能穿透 pRetry 的退避 sleep(gtx 最长 60s):不接 signal,
        // 取消后这一行还要睡满剩余退避才轮到入口守卫抛出。p-retry 会在 signal
        // abort 时直接 reject 整个重试链。
        signal: run?.signal,
        onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
          const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
          console.warn(`Translation attempt ${attemptNumber} failed for "${textPreview}": ${(error as Error).message} (${retriesLeft} retries left)`);
        },
      },
    );
  } catch (error) {
    // run 已中止(用户取消 / auth 级联)时,把各种形态的中止(fetch 的
    // AbortError、pRetry 退避里被 signal.reason 打醒)规范成级联标记 ——
    // 自带循环的工具的节点 catch 只认 isCascadedAbort,不规范的话一次取消
    // 会被它记成一堆"节点失败"。
    // ⚠ auth 错误例外:第一个触发 abort 的正是它自己,得原样放行让 UI 说清原因
    // (pRetry 的 shouldRetry(auth)=false 会在任何 signal 检查之前 throw 原错误,
    // 所以它一定以原始形态到达这里)。
    if (run?.signal.aborted && !isAuthError(error)) throw new Error("Translation aborted");
    const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
    // 文本带 cause 链(Node/CLI 需要它:console 打 Error 只给 [Error: x]),
    // 同时把【活的 Error 对象】一并传出去 —— 浏览器 devtools 靠它才有可展开的
    // 堆栈,以及引擎挂上去的 .status / .retryAfterMs / .errorHintKey。只留字符串
    // 的话,429(带 Retry-After)、422(拒绝 thinking 参数)、500 在控制台里
    // 长得一模一样,排查时无从下手。
    console.error(`All ${retryCount} translation attempts failed for: "${textPreview}": ${formatErrorWithCause(error)}`, error);
    throw error; // No fallback to original text - fail explicitly
  }
};

// 错译校验 + 一次定向重试(仅 LLM)。Leak-through 只能修「漏翻」(术语原文
// 残留);当源行含术语、而 leak-through 后的译文里仍没有指定译法时,模型把
// 术语译成了别的词 —— 用只列违规术语的 STRICT 块单行重译一次,二者取违规
// 更少的(平手保留首译:它来自带上下文的批次请求)。MT 直接返回 leak-through
// 结果(同请求重发只会得到同样的输出;qwenMt 的防错译靠原生 terms)。
const enforceGlossaryOnLine = async (sourceLine: string, rawTranslated: string, cacheSuffix: string, config: PipelineRuntimeConfig, ctx: RunCtx, fullText?: string): Promise<string> => {
  const first = applyGlossary(ctx, rawTranslated ?? "", config.targetLanguage);
  if (!LLM_MODELS.includes(config.translationMethod)) return first;
  const terms = ctx.getGlossaryTerms(config.targetLanguage);
  if (terms.length === 0) return first;
  const violations = findGlossaryViolations(sourceLine, first, terms);
  if (violations.length === 0) return first;
  try {
    // 重试键按违规集哈希分流:不能与首次请求同键(否则缓存只会重放刚才的
    // 违规响应),不同违规集(首译输出非确定)也不互相串。
    const retrySuffix = `${cacheSuffix}_gv${SparkMD5.hash(JSON.stringify(violations.map((v) => [v.source, v.target])))}`;
    const retried = await translateSingle(sourceLine, retrySuffix, { ...config, strictGlossaryTerms: violations }, ctx, fullText);
    const second = applyGlossary(ctx, retried ?? "", config.targetLanguage);
    if (findGlossaryViolations(sourceLine, second, terms).length < violations.length) return second;
    return first;
  } catch (error) {
    // auth 【必须向上抛】,这是本文件的既定约定(grep `isAuthError(` 可见其余抛出点)。
    // 曾经这里一律吞掉,理由写的是「auth 中止已由 translateSingle 传给本 run 的
    // controller」—— controller 确实被 abort 了,但错误的【身份】丢了:后续批次
    // 全部短路成 `Translation aborted`,而工具层对它是 `if (isCascadedAbort) continue`
    // ——静默。结果是过期的 key 配上开着的术语表,用户点翻译得到零输出、零 toast、
    // 零失败面板,完全不知道 key 已经失效(WAF/CDN 返回 403 也同形)。
    if (isAuthError(error)) throw error;
    // 其余(网络抖动 / 级联中止)不拖垮已成功的首译。
    return first;
  }
};

// translateSingle + leak-through + 错译重试的单行复合入口 —— 各批量路径共用,
// 避免各调用点漏掉 enforcement。
// 【没有】对应的公开单行 API:曾经有过(hook 以 translateSingleWithGlossary
// 暴露给 JSONTranslator 的自带循环),它把并发、节流、进度、失败收集全部还给
// 调用方,调用方于是长成第二个 pipeline 并且真的漂移过(delayTime)。自带循环
// 的工具一律「收集 → translateLines → 回写」,别再开单行口子。
const translateSingleWithGlossary = async (text: string, cacheSuffix: string, config: PipelineRuntimeConfig, ctx: RunCtx, fullText?: string): Promise<string> => {
  const raw = await translateSingle(text, cacheSuffix, config, ctx, fullText);
  return enforceGlossaryOnLine(text, raw ?? "", cacheSuffix, config, ctx, fullText);
};

/** deps.translate wins; otherwise the built-in cache-aware translateCore. */
const resolveTranslate =
  (deps: PipelineDeps) =>
  (params: TranslateTextParams): Promise<string> =>
    deps.translate ? deps.translate(params) : translateCore(params, deps.cache);

// ─── Context-aware batch translation ────────────────────────────────────────

// Context-aware translation with auto-adjustment of context window
const translateWithContext = async (
  contentLines: string[],
  runtimeConfig: PipelineRuntimeConfig,
  cacheSuffix: string,
  ctx: RunCtx,
  documentType: "subtitle" | "markdown" | "generic" = "subtitle",
  fullText?: string,
  meta?: TranslateBatchMeta,
): Promise<{ lines: string[]; failures: FailedLine[] }> => {
  // This run's controller, captured ONCE — every liveness check below must
  // use it, never a live ref (see translateSingle's ghost-task note: a queued
  // task from a dead run must not resurrect under the next run's controller).
  const run = ctx.run;
  const cache = runtimeConfig.useCache !== false ? ctx.cache : undefined;
  const updateProgress = ctx.onProgress ?? (() => {});
  // Clamp to >= 1: `|| 20` only catches 0/null/undefined, not negatives.
  // A negative contextWindow (from corrupted localStorage or bad migration)
  // would make the main loop `i += -5` → infinite loop.
  // 保底 1 在【最外层】:先 min 到行数、再保底,空文件时窗口仍是 1。反过来写
  // (先保底再 min)会在 contentLines 为空时得到步长 0 —— 循环虽不会进入,但
  // 步长为 0 是个不该存在的状态。
  const initialContextWindow = Math.max(1, Math.min(positiveInt(runtimeConfig.contextWindow, 20), contentLines.length));
  const translatedLines = new Array(contentLines.length);
  const MAX_CONTEXT_RETRIES = 2; // Maximum times to reduce context window

  // Blank source lines (markdown paragraph separators in raw mode, ASS
  // tag-only lines stripped to "", invisible-unicode-only lines like ZWSP
  // separators) are not translation targets — pre-fill them with themselves
  // so they never count as missing. Without this, every batch containing one
  // returns "incomplete" forever: the gap-retry chain loops futilely and
  // every run pays the 10s auto-retry penalty. isBlankLine (not bare trim)
  // keeps this definition in lockstep with the extraction's blankSource.
  // Slot-state convention from here on: `undefined` = not yet translated /
  // failed (the retry machinery keys on it), any string (incl. "") = done.
  for (let i = 0; i < contentLines.length; i++) {
    if (isBlankLine(contentLines[i])) translatedLines[i] = contentLines[i];
  }

  // Cross-run skip: pre-fill lines that already succeeded in a previous run
  // (per-line cache below) so "再来一次" only re-translates the still-failed
  // lines instead of re-rolling whole batches whose batch-cache was purged
  // after a partial failure (issue#44 purge). Write-once inside the helper.
  if (cache) {
    // 第四个参数【不能省】:回填的是缓存原样,而 translateCore 存进去的是服务
    // 原始输出(未过术语表)。所有其它读路径都在读之后 enforce 一遍,这里漏掉
    // 就等于用户切一次上下文开关,已缓存的行就悄悄不再守术语表。
    // 但它必须是【同步纯函数】——理由见 prefillFromLineCache 的参数注释。
    await prefillFromLineCache(
      contentLines,
      translatedLines,
      (texts) => cache.getMany(texts.map((text) => generateCacheKey(text, cacheSuffix))),
      // 只做 leak-through(纯替换),【不】走 enforceGlossaryOnLine ——
      // 那里面的严格重译会在这个串行循环里逐条发请求,见 postProcess 的注释。
      (_source, cached) => applyGlossary(ctx, cached, runtimeConfig.targetLanguage),
    );
  }

  const translateSingleBatch = async (batchStart: number, batchEnd: number, contextWindow: number): Promise<boolean> => {
    // Every target slot already decided (pre-filled from cache or an earlier
    // batch) → skip the model call entirely; sending it would re-translate
    // already-good lines and burn tokens for a result the write-once guard
    // would discard anyway.
    let hasPending = false;
    for (let k = batchStart; k < batchEnd; k++) {
      if (translatedLines[k] === undefined) {
        hasPending = true;
        break;
      }
    }
    if (!hasPending) return true;

    const contextPadding = Math.min(MAX_CONTEXT_PADDING, Math.max(1, Math.floor(contextWindow / 2)));
    const contextStart = Math.max(0, batchStart - contextPadding);
    const contextEnd = Math.min(contentLines.length, batchEnd + contextPadding);
    const contextLines = contentLines.slice(contextStart, contextEnd);
    const targetStartIndex = batchStart - contextStart;
    const targetEndIndex = batchEnd - contextStart;

    const contextWithMarkers = contextLines
      .map((line, index) => {
        if (index >= targetStartIndex && index < targetEndIndex) {
          return `[TRANSLATE_${index - targetStartIndex}]${line}[/TRANSLATE_${index - targetStartIndex}]`;
        }
        return `[CONTEXT]${line}[/CONTEXT]`;
      })
      .join("\n");

    try {
      const result = await translateSingle(
        contextWithMarkers,
        cacheSuffix,
        {
          ...runtimeConfig,
          // The built prompt retains the literal ${content} placeholder — the
          // marker block (params.text) is inserted LAST by getAIModelPrompt's
          // function-form replacement, after all template variables resolved.
          userPrompt: buildContextPrompt(runtimeConfig.userPrompt ?? DEFAULT_USER_PROMPT, batchEnd - batchStart, documentType),
        },
        ctx,
        fullText,
      );

      // sourceLines slice lets the extraction's merge guard tell real gaps from
      // blank-source slots (which legitimately come back empty).
      const batchSources = contentLines.slice(batchStart, batchEnd);
      // Pass the full context window (target slice + ±padding) so the echo guard
      // can catch a TRANSLATE slot that copied a forward-[CONTEXT] source line
      // verbatim (the NHK 红白 ≈+9 misalignment), not just within-batch echoes.
      const translatedBatch = extractTranslatedLinesWithNumbers(result || "", batchEnd - batchStart, batchSources, contextLines);

      // A response that failed extraction anywhere is useless to replay, but
      // the cache layer already stored it (every 200 is a "success" there —
      // extraction happens later, here). Purge it so retries with the same
      // batch text (always, for ≤window whole-file batches) and future runs
      // of the same file reach the live service instead of replaying the bad
      // response forever — without this, one marker-dropped reply makes a
      // short file permanently untranslatable until the cache is cleared.
      const hasRealGap = translatedBatch.some((r, j) => r === "" && !isBlankLine(batchSources[j]));
      if (hasRealGap && cache) {
        await cache.delete(generateCacheKey(contextWithMarkers, cacheSuffix));
      }
      for (let j = 0; j < translatedBatch.length; j++) {
        // `!== ""` not truthiness — a line legitimately translated to "0" must
        // count as done. `=== undefined` write-once guard: never overwrite a
        // decided slot (notably pre-filled blank-source lines, which a model
        // may hallucinate content for).
        if (batchStart + j < contentLines.length && translatedBatch[j] !== "" && translatedLines[batchStart + j] === undefined) {
          // Glossary enforcement on SUCCESSFUL translations only: leak-through
          // + mistranslation check with one strict single-line retry. Failed
          // slots get soft-filled with the raw source later (see "Final
          // soft-fail"), so a fully-failed line stays the untouched original
          // instead of a half-localized mix like "斯派克, hi".
          translatedLines[batchStart + j] = await enforceGlossaryOnLine(batchSources[j], translatedBatch[j], cacheSuffix, runtimeConfig, ctx, fullText);
          // Cache the finalized line by its source text so a future run skips
          // it (see prefillFromLineCache above). Survives the batch-level purge
          // because it's keyed by the single line, not the batch window.
          if (cache) void cache.set(generateCacheKey(batchSources[j], cacheSuffix), translatedLines[batchStart + j]);
        }
      }

      // Reflect partial progress as soon as the batch returns, so the bar doesn't
      // sit at 0% for the full duration of each 50-line LLM call.
      const doneSoFar = translatedLines.filter((x) => x !== undefined).length;
      if (doneSoFar > 0) updateProgress(doneSoFar, contentLines.length);

      return !translatedLines.slice(batchStart, batchEnd).includes(undefined);
    } catch (error) {
      if (isAuthError(error)) throw error;
      // Real soft-failure (non-auth) — keep the raw reason so the failure
      // panel can show WHY (caller formats via describeError).
      ctx.noteError(error);
      console.warn(`Batch ${batchStart + 1}-${batchEnd} translation error: ${formatErrorWithCause(error)}`, error);
      return false;
    }
  };

  // Iterative batch translation with context window reduction (replaces recursion)
  const translateBatchWindow = async (batchStart: number, batchEnd: number, contextWindow: number): Promise<boolean> => {
    const success = await translateSingleBatch(batchStart, batchEnd, contextWindow);
    if (success) return true;

    // Halve context window + retry only the still-empty index clusters (not
    // the whole sub-range) — saves tokens and prevents LLM non-determinism
    // from overwriting already-successful lines with slightly different output.
    let currentWindow = contextWindow;
    for (let attempt = 0; attempt < MAX_CONTEXT_RETRIES && currentWindow > 5; attempt++) {
      currentWindow = Math.max(5, Math.floor(currentWindow / 2));

      const missing: number[] = [];
      for (let k = batchStart; k < batchEnd; k++) {
        if (translatedLines[k] === undefined) missing.push(k);
      }
      if (missing.length === 0) return true;

      const gapClusters = clusterAscendingIndices(missing);
      console.warn(`Batch ${batchStart + 1}-${batchEnd} incomplete (${missing.length} line(s) missing in ${gapClusters.length} gap(s)); reducing window to ${currentWindow}`);

      for (const [gs, ge] of gapClusters) {
        if (run?.signal.aborted) return false;
        await translateSingleBatch(gs, ge, currentWindow);
      }

      if (!translatedLines.slice(batchStart, batchEnd).includes(undefined)) return true;
    }

    return false;
  };

  // Helper: group contiguous failed indices into [start, end) clusters
  // (capped so a total blowout doesn't retry as one mega-batch). Reused
  // below by the batch-level fallback and the post-pass auto-retry.
  //
  // BRIDGING: indices separated only by decided-blank lines (pre-filled
  // blank-source slots) count as contiguous. Without this, the merge guard's
  // walk-back discard (sentence fragments around a stripped ASS tag-only
  // line) produces a NON-contiguous failed set {k, k+2} that would retry as
  // two isolated single-target batches — where the guard is structurally
  // inert (its loop needs a following target slot), so a re-merged response
  // would be committed verbatim and the #44 duplication ships after all.
  // Bridged clusters retry the whole sentence in ONE batch (the blank slots
  // ride along as targets; their pre-filled slots are write-once protected),
  // letting the guard re-detect a merge in the retry response.
  const RETRY_MAX_CLUSTER_SIZE = 10;
  const RETRY_CONTEXT_WINDOW = 6; // ±3 neighbor lines wrapped as [CONTEXT]
  const clusterAscendingIndices = (sortedIndices: number[]): Array<[number, number]> => {
    if (sortedIndices.length === 0) return [];
    const allBlankBetween = (from: number, to: number): boolean => {
      for (let k = from; k < to; k++) if (!isBlankLine(contentLines[k])) return false;
      return true;
    };
    const out: Array<[number, number]> = [];
    let s = sortedIndices[0];
    let e = sortedIndices[0];
    for (let k = 1; k < sortedIndices.length; k++) {
      const idx = sortedIndices[k];
      if ((idx === e + 1 || allBlankBetween(e + 1, idx)) && idx - s + 1 <= RETRY_MAX_CLUSTER_SIZE) {
        e = idx;
      } else {
        out.push([s, e + 1]);
        s = idx;
        e = idx;
      }
    }
    out.push([s, e + 1]);
    return out;
  };

  // Helper: retry any still-empty slots in [rangeStart, rangeEnd) by
  // clustering them and feeding each cluster through translateSingleBatch
  // with a small context window. Keeps LLM coherence on fallback and
  // shares the ±3 neighbor context across cluster members — much cheaper
  // than the old line-by-line-without-context fallback.
  const clusterRetryFailures = async (rangeStart: number, rangeEnd: number): Promise<void> => {
    const failed: number[] = [];
    for (let i = rangeStart; i < rangeEnd; i++) {
      if (translatedLines[i] === undefined) failed.push(i);
    }
    if (failed.length === 0) return;

    // Circuit breaker: when the provider is wholesale-down (quota-exhausted
    // 429, sustained outage), every cluster fails identically — without a
    // breaker a 1000-line file would grind through ~100 sequential doomed
    // pRetry cycles (~12-20 extra minutes + a request storm against an
    // already rate-limited API) before the soft-fill finally runs. Three
    // consecutive clusters with ZERO newly-filled slots = systemic failure,
    // bail and let the soft-fill surface the failure panel. A breaker can't
    // misfire on healthy-but-spotty runs: any cluster that fills even one
    // slot resets the strike count.
    const BREAKER_CONSECUTIVE_DRY = 3;
    let consecutiveDry = 0;
    // Indexed loop, NOT slice().filter(): translatedLines is sparse and
    // filter/some skip holes — the exact trap that made the auto-retry gate
    // dead code. Indexed reads see holes as undefined.
    const countUndefined = (from: number, to: number): number => {
      let n = 0;
      for (let i = from; i < to; i++) if (translatedLines[i] === undefined) n++;
      return n;
    };

    for (const [cStart, cEnd] of clusterAscendingIndices(failed)) {
      if (run?.signal.aborted) return;
      const undefinedBefore = countUndefined(cStart, cEnd);
      try {
        await translateSingleBatch(cStart, cEnd, RETRY_CONTEXT_WINDOW);
      } catch (err) {
        if (isAuthError(err)) throw err;
        // non-auth failures leave slots empty; final soft-fill handles them
      }
      const undefinedAfter = countUndefined(cStart, cEnd);
      consecutiveDry = undefinedAfter < undefinedBefore ? 0 : consecutiveDry + 1;
      if (consecutiveDry >= BREAKER_CONSECUTIVE_DRY) {
        console.warn(`Cluster retry circuit breaker: ${consecutiveDry} consecutive clusters filled nothing — provider looks down, skipping remaining retries`);
        return;
      }
      updateProgress(translatedLines.filter((x) => x !== undefined).length, contentLines.length);
    }
  };

  // Show progress immediately so users see the modal is alive (a single LLM
  // batch can take 20-60s before the first in-loop updateProgress). On a
  // cache-heavy re-run, the blank pre-fill + per-line cache prefill have
  // already decided most slots — surface that at once so the bar jumps to
  // near-complete instead of sitting at ~0% through the prefill + first
  // batch (which read as "stuck" even though the work is basically done).
  // Floor at 0.5 so a cold run with nothing prefilled still shows movement.
  const prefilledDone = translatedLines.filter((x) => x !== undefined).length;
  updateProgress(prefilledDone > 0 ? prefilledDone : 0.5, contentLines.length);

  // Main loop: run batches in parallel with user-configurable concurrency.
  // Context mode uses `contextBatchSize` — each task sends ~contextWindow
  // lines to the LLM in a single heavy request, so we cap hard. Non-context
  // line-by-line mode uses the separate `batchSize` (see translateLines)
  // which is safe to run higher since each request is a single short
  // prompt. Defaults per provider:
  //   - Cloud LLMs (claude, gemini, openai-compat, ...): 3 — under every
  //     mainstream provider's concurrent cap (Claude paid 5-10, DeepSeek
  //     30, Gemini generous). Free-tier users hitting 429 get caught by
  //     pRetry + auto-retry.
  //   - Custom LLM (Ollama local): 1 — Ollama runs inference single-threaded
  //     by default, >1 concurrent would queue on the server and our 180s
  //     requestTimeoutSec would fire on queued requests before they run.
  // Power users with proper paid tiers can raise contextBatchSize in
  // Advanced Settings for faster throughput.
  //
  // Rate-limit safety: pRetry already treats 429 as retryable with backoff,
  // auth errors cascade through the run controller's abort() to stop peers
  // immediately. Each task operates on a disjoint [batchStart, batchEnd)
  // slice of translatedLines — no write contention.
  const batchConcurrency = positiveInt(runtimeConfig.contextBatchSize, 3);
  const batchLimit = pLimit(batchConcurrency);
  const interBatchDelay = runtimeConfig.delayTime ?? 0;

  const batchTasks: Promise<void>[] = [];
  for (let i = 0; i < contentLines.length; i += initialContextWindow) {
    const batchStart = i;
    const batchEnd = Math.min(i + initialContextWindow, contentLines.length);

    batchTasks.push(
      batchLimit(async () => {
        if (run?.signal.aborted) return;
        // translateBatchWindow handles context-window halving internally with
        // cluster-aware gap retry. If it still returns false, the post-pass
        // auto-retry (below, after Promise.all) handles it with a 10s
        // breather — the only layer that actually gives rate-limited
        // providers time to reset. translateSingleBatch catches all
        // non-auth errors and returns false, so the only exception that
        // escapes here is isAuthError, which we rethrow so Promise.all
        // rejects and peer tasks abort via the shared signal.
        await translateBatchWindow(batchStart, batchEnd, initialContextWindow);
        // Small gap AFTER each batch — helps severely rate-limited providers.
        // pLimit already throttles concurrency; this adds an optional per-slot
        // pause when users configure delayTime.
        if (interBatchDelay > 0 && !run?.signal.aborted) {
          await abortableSleep(interBatchDelay, run?.signal);
        }
      }),
    );
  }
  await Promise.all(batchTasks);

  // ─── Auto-retry pass ────────────────────────────────────────────────
  // After the main pass (batches + halved-context retry), any slot still
  // empty most likely hit a rate-limit window or a transient service
  // hiccup — not something pRetry's sub-7s backoff would recover. Wait
  // 10s to let rate-limit counters reset / the service stabilize, then
  // retry via the same cluster helper over the entire range.
  // MUST be includes(), not some(): translatedLines is a sparse array — failed
  // slots are HOLES (never assigned), and some()/filter()/map() skip holes
  // entirely, so `some((x) => x === undefined)` is false in every possible
  // state and the whole auto-retry layer becomes dead code. includes() treats
  // holes as undefined (same idiom as the batch-completeness checks above).
  if (translatedLines.includes(undefined) && !run?.signal.aborted) {
    // Adaptive breather. The flat 10s here used to freeze EVERY re-run that
    // still had a couple residual failures at ~99% — even when nothing was
    // rate-limited (the common "再试一次 feels slow despite cache" case). Only
    // a real 429 this run needs the long cool-off so the provider's counter
    // resets; transient blips (5xx / network) recover after a short pause.
    // The shared rateLimitGate already enforces the actual per-request 429
    // cooldown independently of this breather.
    const autoRetryDelayMs = ctx.wasRateLimited() ? 10000 : 1500;
    console.warn(`Auto-retry remaining failed lines after ${autoRetryDelayMs}ms with clustered small-context retry...`);
    await abortableSleep(autoRetryDelayMs, run?.signal);
    try {
      await clusterRetryFailures(0, contentLines.length);
    } catch (err) {
      if (isAuthError(err)) throw err;
      // Non-auth: leave remaining failures for the final soft-fill.
    }
  }

  // Run 已被中止(导航离开的 unmount abort;auth 级联在 Promise.all 处就已
  // reject,到不了这里):不做软填 —— 软填出的「大半是原文」数组会被工具层
  // 当正常结果装配、下载、报成功。规范成级联标记,工具层 isCascadedAbort 静默。
  if (ctx.shouldStop() || run?.signal.aborted) throw new Error("Translation aborted");

  // ─── Final soft-fail ────────────────────────────────────────────────
  // Slots still empty after auto-retry get filled with the original text
  // so the output is usable. Only non-whitespace originals count as real
  // failures — empty/whitespace-only lines (common in subtitle spacing,
  // markdown blank lines) weren't meaningful translations in the first
  // place, so flagging them as failures would just confuse the UI.
  const failedLinesList: FailedLine[] = [];
  for (let i = 0; i < translatedLines.length; i++) {
    if (translatedLines[i] === undefined) {
      const original = contentLines[i];
      translatedLines[i] = original;
      // line = real 1-based source position (meta.lineNumbers maps slot i back to
      // the physical line when contentLines is filtered/derived, else ordinal);
      // lang lets the panel tag which target this line failed under in batch runs.
      if (original && original.trim()) failedLinesList.push({ text: original, line: meta?.lineNumbers?.[i] ?? i + 1, index: i, lang: runtimeConfig.targetLanguage, file: meta?.fileName });
    }
  }

  // Every slot is filled now (soft-fill above), so the run is complete — pin
  // progress to 100% like the line-by-line path does. Without this, a run
  // with any soft-failed line ends below 100% and the completion modal's
  // DONE state (gated on percent >= 100) would never show.
  updateProgress(contentLines.length, contentLines.length);

  return { lines: translatedLines, failures: failedLinesList };
};

// ─── Batch entry (was the hook's translateBatch) ────────────────────────────

/**
 * Translate a document's lines end-to-end: context-aware LLM batching, or
 * line-by-line concurrency, or chunked whole-text MT — chosen exactly like the
 * web UI does. Returns the translated lines plus failure metadata; never
 * throws for per-line soft failures (only for auth errors / cancellation).
 */
export const translateLines = async (
  contentLines: string[],
  config: PipelineRuntimeConfig,
  deps: PipelineDeps,
  documentType?: "subtitle" | "markdown" | "generic",
  meta?: TranslateBatchMeta,
): Promise<PipelineOutcome> => {
  const outcome = await runTranslateLines(contentLines, config, deps, documentType, meta);
  // meta.collectSoftFilled 的填充【只在这里】。内层有五个 return 点,指望每个都
  // 记得填就是迟早漏一个;而这个字段漏填的后果是调用方拿到空 Set → 把软填槽位
  // 当成译好的 → removeChars 去删未翻译的原文。
  // (此前这个字段只有 React 侧的 translateBatch 包装层在填,类型注释却写着
  //  "引擎把下标写进去" —— 直接坐在 translateLines 上的 CLI handler 照着类型用
  //  就会拿到空 Set。接口不能撒谎。)
  if (meta?.collectSoftFilled) {
    for (const f of outcome.failures) if (f.index !== undefined) meta.collectSoftFilled.add(f.index);
  }
  return outcome;
};

const runTranslateLines = async (
  contentLines: string[],
  config: PipelineRuntimeConfig,
  deps: PipelineDeps,
  documentType?: "subtitle" | "markdown" | "generic",
  meta?: TranslateBatchMeta,
): Promise<PipelineOutcome> => {
  const state = { lastError: undefined as unknown, rateLimited: deps.rateLimitedEarlier ?? false };
  const failures: FailedLine[] = [];

  if (!contentLines.length) return { lines: [], failures, lastError: state.lastError, rateLimited: state.rateLimited };

  // This run's abort controller — chained from the external signal; auth
  // errors trip it internally (see translateSingle). Captured per call so
  // queued p-limit tasks from a dead run can't resurrect under a successor
  // run's controller (ghost-task hole).
  const runController = new AbortController();
  const unchain = chainSignal(runController, deps.signal);

  const ctx: RunCtx = {
    cache: deps.cache,
    translate: resolveTranslate(deps),
    run: runController,
    shouldStop: deps.shouldStop ?? (() => false),
    onProgress: deps.onProgress,
    onRateLimit: deps.onRateLimit,
    // NOT deps.onAuthAbort: inside translateLines the run controller is
    // pipeline-internal; aborting it already tears down every peer of THIS run.
    getGlossaryTerms: deps.getGlossaryTerms ?? (() => []),
    noteError: (error) => {
      state.lastError = error;
    },
    noteRateLimited: () => {
      state.rateLimited = true;
    },
    wasRateLimited: () => state.rateLimited,
  };

  // Effective prompts: empty/whitespace input falls back to defaults — same
  // trim-fallback the hook applies before building its runtime config.
  const systemPrompt = config.systemPrompt?.trim() ? config.systemPrompt : DEFAULT_SYSTEM_PROMPT;
  const userPrompt = config.userPrompt?.trim() ? config.userPrompt : DEFAULT_USER_PROMPT;
  // systemPrompt stays the BASE prompt — translateSingle appends the
  // per-request glossary block (filtered to the terms each text contains).
  const runtimeConfig: PipelineRuntimeConfig = { ...config, systemPrompt, userPrompt };

  // floor:同 batchConcurrency —— p-limit 对非整数并发直接抛 TypeError。
  const concurrency = positiveInt(config.batchSize, DEFAULT_BATCH_SIZE);
  const baseDelay = config.delayTime || 200;
  const limit = pLimit(concurrency);
  const cache = runtimeConfig.useCache !== false ? deps.cache : undefined;

  try {
    // Only create fullText if the prompt uses ${fullText} variable
    const fullText = userPrompt.includes("${fullText}") ? contentLines.join("\n") : undefined;

    const cacheSuffix = generateCacheSuffix({
      sourceLanguage: config.sourceLanguage,
      targetLanguage: config.targetLanguage,
      translationMethod: config.translationMethod,
      config,
      systemPrompt,
      userPrompt,
      // Full term set for the target language — the per-request filtered
      // block is a pure function of {text, this set}, so hashing the set
      // keeps the key deterministic while the wire prompt varies per line.
      glossaryTerms: ctx.getGlossaryTerms(config.targetLanguage),
    });

    // Context-aware translation with LLM. Glossary is applied per-line inside
    // translateWithContext (success-only), so no blanket pass here.
    // ⚠ independent 一票否决:上下文批把多个单元拼进一个 marker 请求,对
    // 「必须逐单元往返」的调用方(JSON 值)是静默数据损坏。这条判据【必须】
    // 排在 documentType 之前的位置生效 —— 它比下面的 chunkSize 分支早,
    // 所以只剥 chunkSize 压不住它(见 PipelineRuntimeConfig.independent)。
    if (documentType && !config.independent && LLM_MODELS.includes(config.translationMethod) && contentLines.length > 1) {
      const result = await translateWithContext(contentLines, runtimeConfig, cacheSuffix, ctx, documentType, fullText, meta);
      failures.push(...result.failures);
      return { lines: result.lines, failures, lastError: state.lastError, rateLimited: state.rateLimited };
    }

    if (config.chunkSize === undefined) {
      // Line-by-line concurrent translation. Soft-fail mirrors LLM context
      // mode (translateWithContext above): a single line's failure fills the
      // slot with the original text and tracks it for the TranslateFailurePanel,
      // letting peers finish. Auth errors (and post-abort cascades) still
      // propagate so Promise.all rejects and the caller's catch can route.
      const translatedLines = new Array(contentLines.length);
      let completedCount = 0;

      const progressStep = Math.max(1, Math.floor(contentLines.length / 100));
      ctx.onProgress?.(0.5, contentLines.length);

      // Batched cache probe (ONE transaction) → indices that will hit cache.
      // baseDelay (default 200ms) exists to rate-limit REAL API calls; a cache
      // hit makes none, so throttling it just made a fully-cached re-run crawl
      // (baseDelay × lines / concurrency — ~20s on a 1000-line file). Used
      // only to SKIP the delay below; the translate path is unchanged (the
      // per-line cache check inside translateSingleWithGlossary still runs).
      const cacheHitIndices = new Set<number>();
      if (cache) {
        const hits = await cache.getMany(contentLines.map((line) => generateCacheKey(line, cacheSuffix)));
        // truthy 而非 `!= null` —— 与 translateCore / prefillFromLineCache 的
        // 命中判据【必须一致】(它们都把空串当未命中并真去翻译)。判成命中的话,
        // 这些行会跳过 abortableSleep(baseDelay) 却仍然发出真实请求:整批以满
        // batchSize 并发、零间隔打向那个本来要限速的端点,换来一波 429。
        for (let i = 0; i < contentLines.length; i++) if (hits[i]) cacheHitIndices.add(i);
      }

      const promises = contentLines.map((line, index) =>
        limit(async () => {
          // Run-scoped liveness check — see the runController note above.
          // 必须 throw 级联标记而非裸 return:静默 return 会留下数组空洞,而
          // Promise.all 照样 resolve(排队任务在 abort 后才启动时没有任何任务
          // reject)—— 稀疏数组流回工具层,generateSubtitle 把空洞拼成字面
          // "undefined" 写进自动下载的文件。throw 让 Promise.all reject,
          // 工具层 isCascadedAbort 静默跳过装配/下载。
          if (runController.signal.aborted) throw new Error("Translation aborted");
          try {
            // Glossary on success only; the catch below soft-fills the raw source.
            translatedLines[index] = await translateSingleWithGlossary(line, cacheSuffix, runtimeConfig, ctx, fullText);
          } catch (error) {
            // Auth error already tripped THIS run's controller inside translateSingle.
            // It must propagate raw so Promise.all kills the batch and the caller's
            // catch surfaces the real reason.
            if (isAuthError(error)) throw error;
            // run 已中止(auth 级联 / unmount abort):在飞请求死于裸
            // AbortError —— 原样上抛会被工具层按 isAbortError 当"超时"
            // 弹红 toast(卸载场景还弹在用户切去的页面上)。统一改抛级联标记,
            // isCascadedAbort → 工具层静默;peers 的 "Translation aborted" 本就
            // 是这个形态。
            if (runController.signal.aborted) throw new Error("Translation aborted");
            // Otherwise (network blip, 5xx, 4xx like a 422 thinking-param reject,
            // etc., after pRetry exhausted): soft-fail this line, keep peers running.
            ctx.noteError(error);
            translatedLines[index] = line;
            // line = real 1-based source position via meta.lineNumbers (ordinal
            // fallback for full-line callers); targetLanguage tags the target.
            if (line && line.trim()) failures.push({ text: line, line: failureLine(config, meta, index), index, lang: config.targetLanguage, file: meta?.fileName });
          }
          completedCount++;
          if (completedCount % progressStep === 0 || completedCount === contentLines.length) {
            ctx.onProgress?.(completedCount, contentLines.length);
          }
          // Skip the inter-line throttle for cache hits — they issued no API
          // request, so there's nothing to rate-limit (see cacheHitIndices).
          if (baseDelay > 0 && completedCount < contentLines.length && !cacheHitIndices.has(index)) {
            await abortableSleep(baseDelay, runController.signal);
          }
        }),
      );

      await Promise.all(promises);
      ctx.onProgress?.(contentLines.length, contentLines.length);

      return { lines: translatedLines, failures, lastError: state.lastError, rateLimited: state.rateLimited };
    }

    // Chunk-based translation (DeepL / DeepLX / Azure).
    // 空行不进 wire text —— 只翻非空行,空行按原索引回穿。⚠ 别把空行映射成
    // 分隔符:那会双写分隔符,split 多出一格,每个空行后的译文整体下移一格
    // (ASS 纯标签 cue / md raw 模式的静默 off-by-one)。
    const delimiter = config.translationMethod === "deeplx" ? "<>" : "\n";
    const sourceIdx: number[] = [];
    const nonBlankLines: string[] = [];
    for (let i = 0; i < contentLines.length; i++) {
      if (contentLines[i]?.trim()) {
        sourceIdx.push(i);
        // 内嵌换行扁平化为空格:chunk 路径按行 join/split 对齐 —— 一行变多行会让
        // 其后所有译文逐行错位。MT 路径丢失换行排版是可接受降级,错位不是。
        // (ASS 的 \N 已改走 ###n### 占位符,不再靠这里兜底;见 prepareAssForTranslation。)
        const flat = contentLines[i].replace(/\r?\n/g, " ");
        // deeplx 用 "<>" 作分隔符 —— 源文本里若含字面 "<>"(SQL/Pascal 不等号、
        // Java/C# 菱形 `List<>`),会被当成额外分隔符,split 后槽位多出一格,
        // 其后所有行错位、末行丢失。拆成 "< >" 中和掉(同换行扁平化的降级取舍)。
        nonBlankLines.push(delimiter === "<>" ? flat.replace(/<>/g, "< >") : flat);
      }
    }
    if (nonBlankLines.length === 0) return { lines: [...contentLines], failures, lastError: state.lastError, rateLimited: state.rateLimited };

    const text = nonBlankLines.join(delimiter);
    const chunkSize = config.chunkSize || 5000;
    const chunks = splitTextIntoChunks(text, chunkSize, delimiter);
    const translatedChunks: string[] = [];

    // 进度按【行】累计上报,不按块:块数对用户无意义(30 行字幕 1 块会显示
    // "1 / 1"),且 projection 弹窗把 current/total 渲染为 "CUE x / y"。
    const totalChunkLines = nonBlankLines.length;
    let chunkLinesDone = 0;
    // Soft-fail — auth errors and post-abort cascades propagate (kill the run);
    // everything else degrades locally instead of throwing away the whole file.
    // Without this, one chunk exhausting retries threw away every chunk that
    // had already succeeded (all-or-nothing for the DEFAULT free service).
    //
    // ⚠ 两类故障的降级【粒度不同】(处置为何相反见下面两处分支注释):
    //   · 请求失败(catch)      → 整块保留原文,该块每一行都进 failedK
    //   · 行数不符(mismatch)   → 逐行营救,只有营救仍失败的【单行】进 failedK
    // 所以 failedK 装的是「失败的行」,不是「失败的块」——别再按块去理解它。
    //
    // Real source line numbers ARE recoverable: sourceIdx[k] maps each non-blank
    // wire line k back to its contentLines index. Materialized from failedK AFTER
    // the loop (below) so the modal shows the pristine source text + true line
    // number — same as the LLM/line paths — instead of the newline-flattened
    // wire text.
    const failedChunkLines: FailedLine[] = [];
    // 软填(保留原文)的行号集合 —— 术语表 leak-through 只能套在【成功译文】
    // 上:对软填的源文套术语表会产出 "斯派克, hi" 式半本地化混合体,这正是
    // context/line 路径注释里明令禁止、失败面板又声称"保留了原文"的腐败输出。
    const failedK = new Set<number>();
    let chunkStartK = 0;

    for (let i = 0; i < chunks.length; i++) {
      const chunkLineCount = chunks[i].split(delimiter).length;
      let processed: string;
      try {
        const translatedContent = await translateSingle(chunks[i], cacheSuffix, runtimeConfig, ctx, fullText);
        processed = config.translationMethod === "deeplx" ? (translatedContent || "").replace(/<>/g, "\n") : translatedContent || "";
      } catch (error) {
        if (isAuthError(error)) throw error;
        // 同 line 路径:run 已中止时把裸 AbortError 规范成级联标记,
        // 工具层静默而不是误报"超时"。
        if (runController.signal.aborted) throw new Error("Translation aborted");
        ctx.noteError(error);
        // 软填原文,【不】逐行营救 —— 与下面 mismatch 分支的处置刻意相反,别统一:
        // 走到这里意味着 pRetry 已烧完整个重试预算(含退避与 429 冷却),服务当前
        // 就是不可用;逐行轰回去只是把一次失败放大成几十次注定失败。mismatch 那边
        // 恰好相反:请求【成功】了,服务健康,只是响应并/拆了行 —— 逐行重发大概率
        // 成功。传输层故障不营救,内容层故障才营救。
        // deeplx 的源块含 "<>" 分隔符,同样要还原成 \n 保持行对齐。
        processed = config.translationMethod === "deeplx" ? chunks[i].replace(/<>/g, "\n") : chunks[i];
        for (let k = chunkStartK; k < chunkStartK + chunkLineCount; k++) failedK.add(k);
      }
      // 行数对不上 = 【这一块】的 1:1 映射断了(服务把两条短行合并,或把一条
      // 拆成两条)。从分歧点起每行拿到的都是邻居的译文,而分歧点在哪无从得知。
      //
      // ⚠ 按【块】判定,不是按整份文件。上一版是 join 之后再数,于是 3000 行里
      // 只有第 4 块出问题也会把全部 3000 行退回原文、全部记成失败,把另外四块
      // 已经付过费的正确译文一起丢掉。join 恰恰销毁了这里现成的 chunkLineCount。
      //
      // ⚠ 必须【清掉这一块的缓存】。不清的话重试从缓存重放同一个坏响应:零请求、
      // 同样的失败、同样一份未翻译的文件 —— 这个文件永远翻不出来,只能手动清
      // IndexedDB / 删缓存文件。隔壁上下文路径的 hasRealGap 就是这么做的。
      const produced = processed.split("\n");
      // 服务在整段末尾多给一个换行是常见且无害的,先削掉再比。
      while (produced.length > chunkLineCount && produced.at(-1) === "") produced.pop();
      if (produced.length !== chunkLineCount) {
        // 【逐行营救】,不是整块退回原文。整块退回曾是这里的处置,但一块
        // (默认 5000 字符,几十到上百行)里服务只并/拆了【一处】,其余行本来
        // 译得对 —— 整块作废等于把一次服务抖动放大成一大段未翻译 + 一大串
        // 失败记录。逐行重发的 1:1 是【构造保证】的:一行进一行出,没有可
        // 错位的余地,不需要猜分歧点(分歧点在哪本来就无从得知)。
        // 代价只落在真出问题的这一块上,且刻意【串行 + delayTime 节流】:
        // 服务刚在这段内容上表现异常,满并发轰回去是错误的反射;慢而正确的
        // 营救好过快而粗暴的放弃。
        // 块级缓存仍要清:不清则重跑从缓存重放同一个坏响应,永远走不出来。
        // 营救出的单行由 translateSingle 正常写入【行级】缓存,重跑零请求回放。
        ctx.noteError(new Error(`translation line count mismatch in chunk ${i + 1}: sent ${chunkLineCount} lines, got ${produced.length} — the service merged or split lines; retrying this chunk line by line.`));
        if (cache) await cache.delete(generateCacheKey(chunks[i], cacheSuffix));
        const chunkSourceLines = chunks[i].split(delimiter);
        const rescued: string[] = new Array(chunkLineCount);
        for (let j = 0; j < chunkLineCount; j++) {
          if (runController.signal.aborted) throw new Error("Translation aborted");
          const srcLine = chunkSourceLines[j];
          try {
            const one = await translateSingle(srcLine, cacheSuffix, runtimeConfig, ctx, fullText);
            // 空串按失败处理(与「空串译文记失败」的既有约定一致);
            // 换行替换成空格:本流是 join("\n") 的,单行译文里混进一个换行会把
            // 【这一块其后每一行】整体下移 —— 正是这里要修的那种损坏。
            if (one && one.trim()) {
              rescued[j] = one.replace(/\r?\n/g, " ");
            } else {
              rescued[j] = srcLine;
              failedK.add(chunkStartK + j);
            }
          } catch (err) {
            if (isAuthError(err)) throw err;
            if (runController.signal.aborted) throw new Error("Translation aborted");
            ctx.noteError(err);
            rescued[j] = srcLine;
            failedK.add(chunkStartK + j);
          }
          if (j < chunkLineCount - 1) await abortableSleep(config.delayTime || 200, runController.signal);
        }
        processed = rescued.join("\n");
      } else {
        // ⚠ 削掉的尾部空行【必须写回 processed】。上一版只削了本地副本 produced,
        // 推进 translatedChunks 的仍是原串 —— 于是服务多给的那个换行被判为"对齐"
        // 却仍留在文本里,后面 join("\n").split("\n") 重组时把【其后每一块】整体
        // 下移一行:某一行被抹空、下一行拿到上一行的译文、最后一行的译文丢失,
        // 而且 failures 是空的、进度绿色 100%。
        // 也就是说那个 while 削行不仅没帮上忙,还把本来会被检出的错位变成了静默
        // 损坏 —— 不削的话行数不符会命中上面的分支,走逐行营救。
        processed = produced.join("\n");
      }
      translatedChunks.push(processed);
      chunkStartK += chunkLineCount;
      chunkLinesDone += chunkLineCount;
      ctx.onProgress?.(chunkLinesDone, totalChunkLines);
      if (i < chunks.length - 1) await abortableSleep(config.delayTime || 200, runController.signal);
    }

    // Materialize failures from failedK → pristine source line + real line number
    // (meta.lineNumbers maps the contentLines index to the physical source line
    // when the caller's array is filtered/derived). failedK is ascending (insertion
    // order); the panel re-sorts by (file, lang, line) anyway. Every k indexes a
    // non-blank line by construction, so no blank ever shows up in the panel.
    for (const k of failedK) {
      const i = sourceIdx[k];
      failedChunkLines.push({ text: contentLines[i], line: meta?.lineNumbers?.[i] ?? i + 1, index: i, lang: config.targetLanguage, file: meta?.fileName });
    }
    failures.push(...failedChunkLines);

    // 循环出来时每一块的行数都【已经】等于它发出去的行数 —— 三条路各自保证:
    // 行数正好(原样收下)、请求失败(整块换成源文)、行数不符(逐行营救,
    // rescued 数组长度就是 chunkLineCount)。所以 join 之后的总行数必然对齐
    // sourceIdx,不需要(也不该)再做整份级判定。
    const translatedNonBlank = translatedChunks.join("\n").split("\n");

    // Reassemble: translation k lands at its original index; blank source
    // lines pass through verbatim.
    // Glossary leak-through net (whole-text MT has no in-model glossary
    // channel) applies to SUCCESSFUL translations only — every slot in failedK
    // (a failed chunk's lines, or a single line that even the per-line rescue
    // couldn't translate) plus unmatched slots keep the raw source untouched,
    // same convention as the context/line paths. No-op when no term matches
    // this target language.
    const out = [...contentLines];
    for (let k = 0; k < sourceIdx.length; k++) {
      const translated = translatedNonBlank[k];
      // 空串也算不可用。行数对得上、但某个槽位回来是空的(整段 MT 把纯标点/
      // emoji 行吞掉是常见形态),此前 `=== undefined` 判不到:空串被原样写进
      // 输出且【不记失败】。字幕侧碰巧被 assembleSubtitleOutput 的空译文回退
      // 兜住,Markdown 没有这层网 —— 那一段散文就从导出的 .md 里静默消失,
      // 而进度条是绿色 100%。空源行不会走到这里(sourceIdx 只收非空行)。
      const unusable = failedK.has(k) || translated === undefined || translated.trim() === "";
      out[sourceIdx[k]] = unusable ? contentLines[sourceIdx[k]] : applyGlossary(ctx, translated, config.targetLanguage);
      // 兜底:上面的按块对齐理应让 undefined 不再出现,真出现了也必须记一条
      // 失败 —— 静默保留原文正是上一轮要修掉的东西。failedK 的行已记过。
      if (unusable && !failedK.has(k)) {
        const i = sourceIdx[k];
        failures.push({ text: contentLines[i], line: failureLine(config, meta, i), index: i, lang: config.targetLanguage, file: meta?.fileName });
      }
    }
    return { lines: out, failures, lastError: state.lastError, rateLimited: state.rateLimited };
  } catch (error) {
    console.error(`Error translating content: ${formatErrorWithCause(error)}`, error);
    throw error;
  } finally {
    unchain();
  }
};

/**
 * Core reachability probe: runs one real "Hello, world!" translation and THROWS
 * on failure, so callers can classify the error (transient vs definitive). Used
 * by the translator's smart pre-flight gate (web validate(), CLI pre-flight);
 * testTranslation wraps it for the boolean API the "Test Connection" buttons use.
 * 住在 pipeline(而非 barrel)是为了 Node 可用:barrel 带 "use client" 与
 * IndexedDB,CLI 导不进来。
 */
export const runReachabilityProbe = async (translationMethod: TranslationMethod, config: Partial<TranslateTextParams>, systemPrompt?: string, userPrompt?: string, signal?: AbortSignal): Promise<string> => {
  const params: TranslateTextParams = {
    text: "Hello, world!",
    targetLanguage: "zh",
    sourceLanguage: "en",
    cacheSuffix: "test",
    translationMethod,
    useCache: false,
    ...config,
    ...(systemPrompt && { systemPrompt }),
    ...(userPrompt && { userPrompt }),
    ...(signal && { signal }),
  };
  const result = await translationServices[translationMethod](params);
  if (!result) throw new Error("Translation Test failed, no result received.");
  return result;
};
