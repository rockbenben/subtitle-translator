"use client";

import { useState, useRef } from "react";
import { App } from "antd";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLlmPresets } from "@/app/hooks/useLlmPresets";
import { usePromptPresets } from "@/app/hooks/usePromptPresets";
import { useGlossaryPresets } from "@/app/hooks/useGlossaryPresets";
import { useTranslationProgress } from "@/app/hooks/useTranslationProgress";
import {
  generateCacheSuffix,
  splitTextIntoChunks,
  runReachabilityProbe,
  useTranslation,
  defaultConfigs,
  deriveThinkingParams,
  getDefaultConfig,
  migrateConfig,
  resetConfigWithCredentials,
  LLM_MODELS,
  PREFLIGHT_PROBE_METHODS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  deleteCachedTranslation,
  getCachedTranslations,
  setCachedTranslation,
  generateCacheKey,
  type TranslateTextParams,
  type TranslationConfig,
} from "@/app/lib/translation";
import { applyGlossaryToText, buildGlossaryPromptBlock, buildStrictGlossaryPromptBlock, filterTermsMatchingText, findGlossaryViolations, type GlossaryTerm } from "@/app/lib/translation/glossary";
import SparkMD5 from "spark-md5";
import {
  getRetryConfig,
  delay,
  extractTranslatedLinesWithNumbers,
  buildContextPrompt,
  isBlankLine,
  prefillFromLineCache,
  exportTranslationSettings,
  createSettingsFileInput,
  validateTranslationInputs,
  pingSignature,
  rateLimitGate,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_TIMEOUT,
  isAuthError,
  isRetryableError,
  type TranslationSettings,
  type UserRetryConfig,
} from "@/app/hooks/translation";
import { describeError, isAbortError, isNetworkError } from "@/app/utils/errorUtils";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { useTranslations } from "next-intl";

const DEFAULT_API = "gtxFreeAPI";
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

type TranslationConfigs = Record<string, TranslationConfig>;

type PerformTranslation = (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number, documentType?: "subtitle" | "markdown" | "generic") => Promise<void>;

// A line that still failed after retries. `line` is the 1-based PHYSICAL source
// line — callers pass a lineNumbers mapping (translateBatch meta) whenever the
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
}

// Failure-panel metadata for translateBatch. lineNumbers[i] = 1-based physical
// source line of contentLines[i] — REQUIRED for correct failure locations when
// contentLines is a filtered/derived list (cue text lines, md segments); omitted,
// the ordinal fallback i+1 only holds for full-line arrays. fileName tags each
// failure with its source file so multi-file batches stay attributable.
export type TranslateBatchMeta = { lineNumbers?: number[]; fileName?: string };

type TranslationRuntimeConfig = TranslationConfig & {
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  fullText?: string; // Complete text for ${fullText} variable
  // Internal: set ONLY by enforceGlossaryOnLine's one-shot retry. Replaces the
  // standard per-request glossary block with the STRICT variant listing just
  // the violated terms. Never forwarded to services (not in optionalFields).
  strictGlossaryTerms?: GlossaryTerm[];
};

const useTranslationState = () => {
  const { message } = App.useApp();
  const tLanguages = useTranslations("languages");
  const t = useTranslations("common");
  const { translate } = useTranslation();
  const { readFile } = useFileUpload();

  // State
  const [useCache, setUseCache] = useState<boolean>(true);
  // Drawer for the full provider/model/prompt config surface. Replaces the
  // previous "Advanced" Tab; sits per-translator inside TranslationProvider.
  const [apiSettingsOpen, setApiSettingsOpen] = useState<boolean>(false);
  // storedMethod = 用户真实选择(落盘);translationMethod = 当前生效值(派生)。
  const [storedMethod, setTranslationMethod] = useLocalStorage<string>("translation-method", DEFAULT_API);
  // storedMethod 不是当前 bundle 已知的 provider 时,仅本次渲染回退 DEFAULT_API,
  // 绝不写回 localStorage。⚠ 别落盘纠偏(旧做法 setTranslationMethod(DEFAULT_API)):
  // 遇到缺该 provider 的旧 bundle(缓存/灰度/回滚)会用 gtx **永久覆盖**用户的真实
  // 选择,正确 bundle 回来也回不去。纯派生让选择留在盘上,bundle 一对就恢复;已删
  // key 也只是显示成 gtx,不破坏数据。只有用户主动改选才写盘。
  const translationMethod = getDefaultConfig(storedMethod) ? storedMethod : DEFAULT_API;
  const [translationConfigs, setTranslationConfigs] = useLocalStorage<TranslationConfigs>("translation-configs", defaultConfigs as TranslationConfigs);
  const [systemPrompt, setSystemPrompt] = useLocalStorage<string>("translation-systemPrompt", DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useLocalStorage<string>("translation-userPrompt", DEFAULT_USER_PROMPT);
  const [sourceLanguage, setSourceLanguage] = useLocalStorage<string>("translation-sourceLanguage", "auto");
  const [targetLanguage, setTargetLanguage] = useLocalStorage<string>("translation-targetLanguage", "zh");
  const [targetLanguages, setTargetLanguages] = useLocalStorage<string[]>("translation-targetLanguages", ["zh"]);
  const [removeChars, setRemoveChars] = useLocalStorage<string>("translation-removeChars", "");
  const [multiLanguageMode, setMultiLanguageMode] = useLocalStorage<boolean>("translation-multiLanguageMode", false);
  const [retryCount, setRetryCount] = useLocalStorage<number>("translation-retryCount", DEFAULT_RETRY_COUNT);
  // Session memo of probe-validated config signatures (pingSignature). Lets
  // validate() skip re-probing a config it already reachability-checked this
  // session; a changed signature (new key/url/model/relay) re-probes at once.
  // useRef (not state) — no re-render needed; cleared on page refresh, which
  // re-validates once per session (so an endpoint that died gets re-checked).
  const validatedProbes = useRef<Set<string>>(new Set());
  // Per-request timeout in seconds (fetch signal setTimeout).
  const [requestTimeoutSec, setRequestTimeoutSec] = useLocalStorage<number>("translation-requestTimeoutSec", DEFAULT_RETRY_TIMEOUT);
  const [translatedText, setTranslatedText] = useState<string>("");
  // Line-level soft-failure: lines still failing after retries exhaust.
  // UI shows Alert with retry button; cache hits skip re-translation.
  const [failedCount, setFailedCount] = useState<number>(0);
  const [failedLines, setFailedLines] = useState<FailedLine[]>([]);
  // Lang-level failures: in multi-language batch mode, codes of langs that
  // errored out entirely. Replaces noisy per-lang toasts. See md-translator #7.
  const [failedLangs, setFailedLangs] = useState<string[]>([]);
  // Representative raw API error from the last REAL soft-failure this run (e.g.
  // "[422] reasoning_effort is not supported with this model") — surfaced in the
  // failure panel so the user sees WHY, not just how many lines failed. Most
  // useful when a user opts into thinking on an unsupported custom model. Captured
  // at the soft-fail catch sites (auth/abort already filtered there); reset per run.
  const [failedReason, setFailedReason] = useState<string>("");
  const lastErrorRef = useRef<string | null>(null);
  // True once the current run records any soft line-failure — gates the single-file
  // success toast so we never say "完成" when the failure panel/warning is also showing.
  const runHadFailuresRef = useRef(false);
  // True once ANY request in the current run hit a 429. Drives the context-path
  // auto-retry breather: a real rate-limit needs the long cool-off (the
  // provider's counter must reset), but a transient blip (5xx / network) does
  // not — so a cache-heavy re-run with a couple residual failures no longer
  // freezes at ~99% for a flat 10s when nothing was actually rate-limited.
  // Reset per run by clearFailures().
  const rateLimitedThisRunRef = useRef(false);

  const effectiveSystemPrompt = systemPrompt.trim() ? systemPrompt : DEFAULT_SYSTEM_PROMPT;
  const effectiveUserPrompt = userPrompt.trim() ? userPrompt : DEFAULT_USER_PROMPT;

  const {
    glossaryEnabled,
    setGlossaryEnabled,
    glossaryPresets,
    setGlossaryPresets,
    activeGlossaryPresetId,
    setActiveGlossaryPresetId,
    activeGlossaryPreset,
    createGlossaryPreset,
    deleteGlossaryPreset,
    renameGlossaryPreset,
    updateGlossaryPreset,
    getGlossaryTerms: getLiveGlossaryTerms,
  } = useGlossaryPresets();

  // run 内词汇表快照:cacheSuffix 在批次开始把词表哈希进缓存键,而 wire prompt
  // /违规检测/leak-through 逐请求实时读 —— 运行中切换或编辑词汇表会把【新词表
  // 引导的译文】缓存进【旧词表哈希】的键,切回旧词表后命中缓存重放错误术语
  // (IndexedDB 持久污染,只能清缓存解除)。runTranslation 开始建快照、结束
  // 失效:run 内首次读取某语言即固化,同一 run 里 prompt、违规检测、
  // leak-through 与缓存键看到同一份词表。非 run 路径(JSON 工具自带循环,
  // 不走 runTranslation)保持实时读,行为同前。
  const glossarySnapshotRef = useRef<Map<string, GlossaryTerm[]> | null>(null);
  const getGlossaryTerms = (targetLang: string): GlossaryTerm[] => {
    const snap = glossarySnapshotRef.current;
    if (!snap) return getLiveGlossaryTerms(targetLang);
    let terms = snap.get(targetLang);
    if (terms === undefined) {
      terms = getLiveGlossaryTerms(targetLang);
      snap.set(targetLang, terms);
    }
    return terms;
  };
  const applyGlossary = (text: string, targetLang: string): string => applyGlossaryToText(text, getGlossaryTerms(targetLang));

  // Extracted concerns
  const { isTranslating, setIsTranslating, progressPercent, setProgressPercent, progressInfo, abortControllerRef, disposedRef, makeUpdateProgress, resetProgress } = useTranslationProgress();

  const { llmPresets, setLlmPresets, activeLlmPresetId, setActiveLlmPresetId, saveLlmPreset, loadLlmPreset, deleteLlmPreset, renameLlmPreset, updateLlmPreset } = useLlmPresets({
    translationConfigs,
    setTranslationConfigs,
  });

  const {
    promptPresets,
    setPromptPresets,
    activePromptPresetId,
    setActivePromptPresetId,
    savePromptPreset,
    loadPromptPreset,
    deletePromptPreset,
    renamePromptPreset,
    updatePromptPreset,
  } = usePromptPresets({
    effectiveSystemPrompt,
    effectiveUserPrompt,
    setSystemPrompt,
    setUserPrompt,
  });

  // Settings export/import
  const exportSettings = async () => {
    try {
      await exportTranslationSettings({
        translationConfigs,
        systemPrompt: effectiveSystemPrompt,
        userPrompt: effectiveUserPrompt,
        translationMethod,
        sourceLanguage,
        targetLanguage,
        targetLanguages,
        multiLanguageMode,
        llmPresets,
        activeLlmPresetId,
        promptPresets,
        activePromptPresetId,
        glossaryPresets,
        activeGlossaryPresetId,
        glossaryEnabled,
        retryCount,
        requestTimeoutSec,
        removeChars,
      });
      message.success(t("exportSettingSuccess"));
    } catch (error) {
      console.error("Export settings error:", error);
      message.error(t("exportSettingError"));
    }
  };

  const importSettings = () => {
    return createSettingsFileInput((settings: TranslationSettings) => {
      if (settings.translationConfigs !== undefined) setTranslationConfigs(settings.translationConfigs as TranslationConfigs);
      if (settings.systemPrompt !== undefined) setSystemPrompt(settings.systemPrompt);
      if (settings.userPrompt !== undefined) setUserPrompt(settings.userPrompt);
      if (settings.translationMethod !== undefined) setTranslationMethod(settings.translationMethod);
      if (settings.sourceLanguage !== undefined) setSourceLanguage(settings.sourceLanguage);
      if (settings.targetLanguage !== undefined) setTargetLanguage(settings.targetLanguage);
      if (settings.targetLanguages !== undefined) setTargetLanguages(settings.targetLanguages);
      if (settings.multiLanguageMode !== undefined) setMultiLanguageMode(settings.multiLanguageMode);
      if (settings.llmPresets !== undefined) setLlmPresets(settings.llmPresets);
      if (settings.activeLlmPresetId !== undefined) setActiveLlmPresetId(settings.activeLlmPresetId);
      if (settings.promptPresets !== undefined) setPromptPresets(settings.promptPresets);
      if (settings.activePromptPresetId !== undefined) setActivePromptPresetId(settings.activePromptPresetId);
      if (settings.glossaryPresets !== undefined) setGlossaryPresets(settings.glossaryPresets);
      if (settings.activeGlossaryPresetId !== undefined) setActiveGlossaryPresetId(settings.activeGlossaryPresetId);
      if (settings.glossaryEnabled !== undefined) setGlossaryEnabled(settings.glossaryEnabled);
      if (settings.retryCount !== undefined) setRetryCount(settings.retryCount);
      if (settings.requestTimeoutSec !== undefined) setRequestTimeoutSec(settings.requestTimeoutSec);
      if (settings.removeChars !== undefined) setRemoveChars(settings.removeChars);
      message.success(t("importSettingSuccess"));
    }, readFile).catch((error) => {
      console.error("Import settings error:", error);
      message.error(t("importSettingError"));
    });
  };

  // Config management
  // Value covers all TranslationConfig leaf types: primitives for scalar fields
  // (apiKey/temperature/useRelay/...) and Record<string, string> for thinkingEffort
  // (per-model effort level — entry presence = thinking on).
  const handleConfigChange = (method: string, field: string, value: string | number | boolean | Record<string, string>) => {
    setTranslationConfigs((prev) => {
      const existingConfig = prev[method];
      const defaultConfig = getDefaultConfig(method);

      const baseConfig = migrateConfig(existingConfig, defaultConfig);
      const next = { ...baseConfig, [field]: value } as TranslationConfig;

      // No need to strip thinking state on model switch — thinking is now
      // per-model (config.thinkingEffort record keyed by SKU), so each model's
      // state is independently preserved when switching back.

      return { ...prev, [method]: next };
    });
  };

  const resetTranslationConfig = (method: string) => {
    setTranslationConfigs((prevConfigs) => ({
      ...prevConfigs,
      [method]: resetConfigWithCredentials(prevConfigs[method], getDefaultConfig(method)),
    }));
  };

  // Pure function: Returns valid config without calling setState during render
  const getSelectedConfig = (): TranslationConfig => {
    // If selected translationMethod doesn't exist in defaults (e.g. stale key in localStorage like "aliyun" -> "qwenMt")
    let effectiveMethod = translationMethod;
    if (!getDefaultConfig(effectiveMethod)) {
      effectiveMethod = DEFAULT_API;
    }

    const existingConfig = translationConfigs[effectiveMethod];
    const defaultConfig = getDefaultConfig(effectiveMethod);

    // Merge defaults in without resetting user choices. migrateConfig is idempotent
    // and side-effect free — safe to call during render. localStorage gets
    // written back next time the user changes a setting.
    return migrateConfig(existingConfig, defaultConfig);
  };

  // Language management
  // 任何 source/target 变化都会让 translatedText invalidate——避免用户改了语言
  // 但屏幕上还显示旧译文,误以为切换没生效。
  const handleLanguageChange = (type: "source" | "target", value: string) => {
    const otherValue = type === "source" ? targetLanguage : sourceLanguage;
    if (value === otherValue) {
      if (type === "source") {
        const newTargetValue = value === "zh" ? "en" : "zh";
        setSourceLanguage(value);
        setTargetLanguage(newTargetValue);
        message.error(`${t("sameLanguageTarget")} ${newTargetValue === "zh" ? tLanguages("zh") : tLanguages("en")}`);
      } else {
        setTargetLanguage(value);
        setSourceLanguage("auto");
        message.error(`${t("sameLanguageSource")} ${tLanguages("auto")}`);
      }
      setTranslatedText("");
      return;
    }
    if (type === "source" && value !== sourceLanguage) {
      setSourceLanguage(value);
      setTranslatedText("");
    } else if (type === "target" && value !== targetLanguage) {
      setTargetLanguage(value);
      setTranslatedText("");
    }
  };

  // Swap source <-> target. Bypasses handleLanguageChange's same-language
  // guard because a swap never lands on a same-language state. Disabled by
  // the UI when sourceLanguage === "auto" (can't move "detect" to target) or
  // multiLanguageMode === true (no single target to swap against).
  const handleSwapLanguages = () => {
    const previousSource = sourceLanguage;
    setSourceLanguage(targetLanguage);
    setTargetLanguage(previousSource);
    setTranslatedText("");
  };

  // Validation — 设计要点(踩坑后留,改之前先理解):
  // 1. 不碰 isTranslating:由调用方(runTranslation/handleMultipleTranslate)的
  //    try/finally 统一管;这里自己开关会与外层冲突,触发 progress modal 闪烁。
  // 2. 语言不支持只报错,不自动改 translationMethod(旧版偷偷 fallback 到
  //    DEFAULT_API,用户察觉不到 method 被换);换语言还是换 method 交给用户。
  // 3. test ping 只对 deepl/deeplx/llm/gtxFreeAPI/translategemma(免费/自托管/
  //    本地,可用性不稳)提前探测;付费 API 假定 key 可用,出错让翻译请求自己报。
  // 4. ping 失败只有 deeplx 自动 fallback(自托管代理最易配错/挂);其余 4 个
  //    失败通常是真问题(key 错、服务真不可用),fallback 没意义。
  const validate = async () => {
    const config = getSelectedConfig();

    // Sync validation: creds + language support. Extracted to a pure function
    // (hooks/translation/validation.ts) so it's unit-testable without React.
    // targetLanguages is retry-scoped: a failure-panel retry only runs its scoped
    // subset (failed + newly-added langs), so a lang excluded from the retry (e.g.
    // an already-succeeded lang unsupported by a newly selected method) must not
    // hard-block it. No-op on a normal run.
    const syncResult = validateTranslationInputs({
      config,
      method: translationMethod,
      sourceLanguage,
      targetLanguage,
      multiLanguageMode,
      targetLanguages: scopeTargetLangs(targetLanguages),
    });
    if (!syncResult.ok) {
      if ("errorKey" in syncResult) {
        message.error(t(syncResult.errorKey));
      } else if (syncResult.errorMessage) {
        message.error({ content: syncResult.errorMessage, duration: 10 });
      }
      return false;
    }

    if (PREFLIGHT_PROBE_METHODS.has(translationMethod)) {
      // Pre-flight reachability gate, skipped when THIS exact config was already
      // probe-validated this session — keyed by credential signature (changing
      // key/url/model/relay re-probes at once). validate() runs only on translate,
      // so editing the key never probes mid-typing.
      const sig = pingSignature(translationMethod, config);
      if (!validatedProbes.current.has(sig)) {
        {
          // translategemma 不再有专属健康检查(曾 GET {base}/models):部分
          // LM Studio 版本根本不路由该端点("Unexpected endpoint... Returning
          // 200 anyway",且 fallback 响应无 CORS 头),服务器明明活着、Test
          // 也通过,翻译却被探测硬阻断 —— "Test 与翻译走不同请求"的分裂
          // 已经第二次咬人(第一次是 URL 规范化不一致)。现在与其它方法
          // 一样走真实翻译探测(runReachabilityProbe → /v1/completions),
          // 和 Test 按钮完全同一条 wire 路径,超时同样吃 requestTimeoutSec
          // (兼容 JIT 装载模型的慢冷启)。
          //
          // Bound the probe: unlike per-line translation it has no timeout of its
          // own, so a hanging / black-hole endpoint (esp. a user-typed llm URL)
          // could stall the whole run at "validating" forever. Use the user's
          // per-request timeout as the ceiling; an abort is non-retryable → blocks.
          const tempSystemPrompt = translationMethod === "llm" ? effectiveSystemPrompt : undefined;
          const tempUserPrompt = translationMethod === "llm" ? effectiveUserPrompt : undefined;
          const probeController = new AbortController();
          const probeTimeout = setTimeout(() => probeController.abort(), requestTimeoutSec * 1000);
          try {
            await runReachabilityProbe(translationMethod, config, tempSystemPrompt, tempUserPrompt, probeController.signal);
          } catch (error) {
            // Smart gate: HARD-BLOCK when retrying wouldn't help — the same
            // errors the per-line translation gives up on (auth / CORS-needs-relay
            // / abort/timeout, via isRetryableError), PLUS status-less network
            // errors (connection refused / unreachable, via isNetworkError).
            // The network case is the probe's PRIMARY documented scenario
            // ("server not running / wrong URL" per PREFLIGHT_PROBE_METHODS) but
            // isRetryableError classifies status-less errors as retryable, so
            // without the explicit check a dead LM Studio/Ollama or a blocked
            // gtx endpoint sailed through to a fully doomed multi-minute run.
            // Transient reachable-but-busy failures (429 / 5xx) still PROCEED:
            // a single-shot probe must not be stricter than the per-line
            // pRetry + soft-fail.
            //
            // deeplx is the exception — it's a flaky public proxy whose safety net
            // IS the auto-switch to the free GTX default, so ANY probe failure
            // (even transient) should fall back rather than proceed-and-soft-fail.
            if (!isRetryableError(error) || isNetworkError(error) || translationMethod === "deeplx") {
              const errorMessages: Record<string, string> = {
                deeplx: t("deepLXUnavailable"),
                deepl: t("deeplUnavailable"),
                llm: t("llmUnavailable"),
                litellm: t("llmUnavailable"),
                gtxFreeAPI: t("gtxFreeAPIUnavailable"),
                edgeFreeAPI: t("edgeFreeAPIUnavailable"),
                translategemma: t("translategemmaUnavailable"),
              };
              if (translationMethod === "deeplx") setTranslationMethod(DEFAULT_API);
              // ⚠ Footgun: setState is async; below this line `translationMethod` in
              // this scope still reads the old value (deeplx). Safe because we
              // immediately `return false`.
              message.open({ type: "error", content: errorMessages[translationMethod] || t("translationError"), duration: 10 });
              return false;
            }
            // Transient → don't block, don't cache; the per-line retry handles it
            // and the next run re-probes for a clean pass.
            console.warn(`Reachability probe for ${translationMethod} hit a retryable error; proceeding (per-line retry will handle it).`, error);
            return true;
          } finally {
            clearTimeout(probeTimeout);
          }
        }
        // Clean success → remember for this session (skip re-probe on repeat runs).
        validatedProbes.current.add(sig);
      }
    }

    return true;
  };

  // Retry translation with config - throws on failure (no fallback to original text)
  //
  // `runController` is the abort controller of the run THIS call belongs to.
  // It must be captured by the caller when its run starts and passed down —
  // reading the live abortControllerRef here instead opened the ghost-task
  // hole: p-limit never cancels queued tasks, so after an auth abort the dead
  // run's queued tasks would dequeue under the NEXT run's fresh controller,
  // pass the liveness check, fire real API requests for the discarded run,
  // and on re-hitting the auth error abort the HEALTHY new run (which then
  // exported blank lines with a success toast). Falls back to the live ref
  // only for legacy callers that have no run scope.
  const translateSingle = async (text: string, cacheSuffix: string, config: TranslationRuntimeConfig, fullText?: string, runController?: AbortController) => {
    const run = runController ?? abortControllerRef.current;
    // Check if already aborted (e.g., by auth error in another concurrent request).
    // disposedRef:provider 已卸载(浏览器后退)—— 这里是所有翻译路径(含
    // JSONTranslator 自带循环,它不经 translateBatch 且常无 run controller)
    // 的咽喉,据此拒绝继续发请求。"Translation aborted" 走既有级联中止链路
    // (isCascadedAbort → 各工具静默 continue)。
    if (disposedRef.current || run?.signal.aborted) {
      throw new Error("Translation aborted");
    }

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
    const optionalFields = ["useCache", "apiKey", "region", "url", "model", "apiVersion", "folderId", "temperature", "maxTokens", "systemPrompt", "userPrompt", "sendSystemPrompt", "useRelay", "domains"] as const;
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
        const matched = filterTermsMatchingText(getGlossaryTerms(config.targetLanguage), text);
        if (matched.length > 0) extras.systemPrompt = base + buildGlossaryPromptBlock(matched);
      }
    } else if (config.translationMethod === "qwenMt") {
      // Qwen-MT: native terminology intervention instead of a prompt block.
      const matched = filterTermsMatchingText(getGlossaryTerms(config.targetLanguage), text);
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
          // Check abort before each attempt — against THIS run's controller,
          // not the live ref (a retry interval can span a run boundary).
          // disposedRef:重试间隔(可达 30s)可能跨越 provider 卸载,而
          // JSON 工具的调用常无 run controller 可被卸载时 abort。
          if (disposedRef.current || run?.signal.aborted) {
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
            const result = await translate({ ...translateParams, signal: controller.signal });
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
            // (lastErrorRef = describeError) localizes the right guidance.
            if (isAbortError(error) && !run?.signal.aborted && LOCAL_TIMEOUT_HINT_METHODS.has(config.translationMethod)) {
              (error as { errorHintKey?: string }).errorHintKey = "translationTimeoutLocal";
            }

            // Auth error → abort all concurrent requests OF THIS RUN. Aborting
            // the live ref instead would let a ghost task from a dead run kill
            // a healthy successor run.
            if (isAuthError(error)) {
              run?.abort();
            }
            // 429 → 触发该服务的全局冷却(尊重服务器 Retry-After,否则
            // 1s→2s→…→60s 升级)。trip 仅在【开启】一轮冷却时返回 true
            // (同一波并发 429 只第一个生效),据此弹一次降速提示 —— 用户
            // 能看出"为什么变慢了",而不是面对一个静默卡住的进度条。
            if ((error as { status?: number })?.status === 429) {
              // Mark the run rate-limited (even within-burst dups that don't
              // start a cooldown) so the post-pass auto-retry keeps its long
              // breather only when the provider actually throttled us.
              rateLimitedThisRunRef.current = true;
              const startedCooldown = rateLimitGate.trip(config.translationMethod, (error as { retryAfterMs?: number }).retryAfterMs);
              if (startedCooldown) {
                message.warning({ content: t("rateLimitCooldown"), key: "rate-limit-cooldown", duration: 5 });
              }
            }
            throw error;
          }
        },
        {
          ...retryConfig,
          onFailedAttempt: ({ error, attemptNumber, retriesLeft }) => {
            const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
            console.warn(`Translation attempt ${attemptNumber} failed for "${textPreview}": ${(error as Error).message} (${retriesLeft} retries left)`);
          },
        },
      );
    } catch (error) {
      const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
      console.error(`All ${retryCount} translation attempts failed for: "${textPreview}".`, error);
      throw error; // No fallback to original text - fail explicitly
    }
  };

  // 错译校验 + 一次定向重试(仅 LLM)。Leak-through 只能修「漏翻」(术语原文
  // 残留);当源行含术语、而 leak-through 后的译文里仍没有指定译法时,模型把
  // 术语译成了别的词 —— 用只列违规术语的 STRICT 块单行重译一次,二者取违规
  // 更少的(平手保留首译:它来自带上下文的批次请求)。MT 直接返回 leak-through
  // 结果(同请求重发只会得到同样的输出;qwenMt 的防错译靠原生 terms)。
  const enforceGlossaryOnLine = async (
    sourceLine: string,
    rawTranslated: string,
    cacheSuffix: string,
    config: TranslationRuntimeConfig,
    fullText?: string,
    runController?: AbortController,
  ): Promise<string> => {
    const first = applyGlossary(rawTranslated ?? "", config.targetLanguage);
    if (!LLM_MODELS.includes(config.translationMethod)) return first;
    const terms = getGlossaryTerms(config.targetLanguage);
    if (terms.length === 0) return first;
    const violations = findGlossaryViolations(sourceLine, first, terms);
    if (violations.length === 0) return first;
    try {
      // 重试键按违规集哈希分流:不能与首次请求同键(否则缓存只会重放刚才的
      // 违规响应),不同违规集(首译输出非确定)也不互相串。
      const retrySuffix = `${cacheSuffix}_gv${SparkMD5.hash(JSON.stringify(violations.map((v) => [v.source, v.target])))}`;
      const retried = await translateSingle(sourceLine, retrySuffix, { ...config, strictGlossaryTerms: violations }, fullText, runController);
      const second = applyGlossary(retried ?? "", config.targetLanguage);
      if (findGlossaryViolations(sourceLine, second, terms).length < violations.length) return second;
      return first;
    } catch {
      // 重试失败(网络/abort/auth 级联)绝不拖垮已成功的首译 —— 保留首译,
      // auth 中止由 translateSingle 内部已传播给本 run 的 controller。
      return first;
    }
  };

  // translateSingle + leak-through + 错译重试的单行复合入口 —— 自带翻译循环的
  // 工具(JSONTranslator)与 hook 内逐行路径共用,避免各调用点漏掉 enforcement。
  const translateSingleWithGlossary = async (text: string, cacheSuffix: string, config: TranslationRuntimeConfig, fullText?: string, runController?: AbortController): Promise<string> => {
    const raw = await translateSingle(text, cacheSuffix, config, fullText, runController);
    return enforceGlossaryOnLine(text, raw ?? "", cacheSuffix, config, fullText, runController);
  };

  // Context-aware translation with auto-adjustment of context window
  const translateWithContext = async (
    contentLines: string[],
    runtimeConfig: TranslationRuntimeConfig,
    cacheSuffix: string,
    updateProgress: (current: number, total: number) => void,
    documentType: "subtitle" | "markdown" | "generic" = "subtitle",
    fullText?: string,
    runController?: AbortController,
    meta?: TranslateBatchMeta,
  ) => {
    // This run's controller, captured ONCE — every liveness check below must
    // use it, never the live abortControllerRef (see translateSingle's ghost-
    // task note: a queued task from a dead run must not resurrect under the
    // next run's fresh controller).
    const run = runController ?? abortControllerRef.current ?? undefined;
    // Clamp to >= 1: `|| 20` only catches 0/null/undefined, not negatives.
    // A negative contextWindow (from corrupted localStorage or bad migration)
    // would make the main loop `i += -5` → infinite loop.
    const initialContextWindow = Math.max(1, Math.min(runtimeConfig.contextWindow || 20, contentLines.length));
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
    if (runtimeConfig.useCache !== false) {
      await prefillFromLineCache(contentLines, translatedLines, (texts) => getCachedTranslations(texts.map((text) => generateCacheKey(text, cacheSuffix))));
    }

    const translateSingleBatch = async (batchStart: number, batchEnd: number, contextWindow: number): Promise<boolean> => {
      // Every target slot already decided (pre-filled from cache or an earlier
      // batch) → skip the model call entirely; sending it would re-translate
      // already-good lines and burn tokens for a result the write-once guard
      // would discard anyway.
      let hasPending = false;
      for (let k = batchStart; k < batchEnd; k++) {
        if (translatedLines[k] === undefined) { hasPending = true; break; }
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
            userPrompt: buildContextPrompt(effectiveUserPrompt, batchEnd - batchStart, documentType),
          },
          fullText,
          run,
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
        if (hasRealGap && runtimeConfig.useCache !== false) {
          await deleteCachedTranslation(contextWithMarkers, cacheSuffix);
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
            translatedLines[batchStart + j] = await enforceGlossaryOnLine(batchSources[j], translatedBatch[j], cacheSuffix, runtimeConfig, fullText, run);
            // Cache the finalized line by its source text so a future run skips
            // it (see prefillFromLineCache above). Survives the batch-level purge
            // because it's keyed by the single line, not the batch window.
            if (runtimeConfig.useCache !== false) void setCachedTranslation(generateCacheKey(batchSources[j], cacheSuffix), translatedLines[batchStart + j]);
          }
        }

        // Reflect partial progress as soon as the batch returns, so the bar doesn't
        // sit at 0% for the full duration of each 50-line LLM call.
        const doneSoFar = translatedLines.filter((x) => x !== undefined).length;
        if (doneSoFar > 0) updateProgress(doneSoFar, contentLines.length);

        return !translatedLines.slice(batchStart, batchEnd).includes(undefined);
      } catch (error) {
        if (isAuthError(error)) throw error;
        // Real soft-failure (non-auth) — keep the reason (+ status-mapped i18n
        // hint) so the failure panel can show WHY in the user's language.
        lastErrorRef.current = describeError(error, t);
        console.warn(`Batch ${batchStart + 1}-${batchEnd} translation error:`, error);
        return false;
      }
    };

    // Iterative batch translation with context window reduction (replaces recursion)
    const translateBatch = async (batchStart: number, batchEnd: number, contextWindow: number): Promise<boolean> => {
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
    // line-by-line mode uses the separate `batchSize` (see translateBatch
    // below) which is safe to run higher since each request is a single short
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
    // auth errors cascade through abortControllerRef.abort() to stop peers
    // immediately. Each task operates on a disjoint [batchStart, batchEnd)
    // slice of translatedLines — no write contention.
    const batchConcurrency = Math.max(Number(runtimeConfig.contextBatchSize) || 3, 1);
    const batchLimit = pLimit(batchConcurrency);
    const interBatchDelay = runtimeConfig.delayTime ?? 0;

    const batchTasks: Promise<void>[] = [];
    for (let i = 0; i < contentLines.length; i += initialContextWindow) {
      const batchStart = i;
      const batchEnd = Math.min(i + initialContextWindow, contentLines.length);

      batchTasks.push(
        batchLimit(async () => {
          if (run?.signal.aborted) return;
          // translateBatch handles context-window halving internally with
          // cluster-aware gap retry. If it still returns false, the post-pass
          // auto-retry (below, after Promise.all) handles it with a 10s
          // breather — the only layer that actually gives rate-limited
          // providers time to reset. translateSingleBatch catches all
          // non-auth errors and returns false, so the only exception that
          // escapes here is isAuthError, which we rethrow so Promise.all
          // rejects and peer tasks abort via the shared signal.
          await translateBatch(batchStart, batchEnd, initialContextWindow);
          // Small gap AFTER each batch — helps severely rate-limited providers.
          // pLimit already throttles concurrency; this adds an optional per-slot
          // pause when users configure delayTime.
          if (interBatchDelay > 0 && !run?.signal.aborted) {
            await delay(interBatchDelay);
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
      const autoRetryDelayMs = rateLimitedThisRunRef.current ? 10000 : 1500;
      console.log(`Auto-retry remaining failed lines after ${autoRetryDelayMs}ms with clustered small-context retry...`);
      await delay(autoRetryDelayMs);
      try {
        await clusterRetryFailures(0, contentLines.length);
      } catch (err) {
        if (isAuthError(err)) throw err;
        // Non-auth: leave remaining failures for the final soft-fill.
      }
    }

    // Run 已被 unmount 中止(导航离开;auth 级联在 Promise.all 处就已 reject,
    // 到不了这里):不做软填 —— 软填出的「大半是原文」数组会被工具层当正常
    // 结果装配、下载、报成功。规范成级联标记,工具层 isCascadedAbort 静默。
    if (disposedRef.current || run?.signal.aborted) throw new Error("Translation aborted");

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
        if (original && original.trim()) failedLinesList.push({ text: original, line: meta?.lineNumbers?.[i] ?? i + 1, lang: runtimeConfig.targetLanguage, file: meta?.fileName });
      }
    }
    if (failedLinesList.length > 0) {
      runHadFailuresRef.current = true;
      setFailedCount((prev) => prev + failedLinesList.length);
      setFailedLines((prev) => [...prev, ...failedLinesList]);
      if (lastErrorRef.current) setFailedReason(lastErrorRef.current);
    }

    // Every slot is filled now (soft-fill above), so the run is complete — pin
    // progress to 100% like the line-by-line path (translateBatch) does. Without
    // this, a run with any soft-failed line ends below 100% and the completion
    // modal's DONE state (gated on percent >= 100) would never show.
    updateProgress(contentLines.length, contentLines.length);

    return translatedLines;
  };

  // Main translation function
  const translateBatch = async (
    contentLines: string[],
    translationMethodArg: string,
    currentTargetLang: string,
    fileIndex: number = 0,
    totalFiles: number = 1,
    documentType?: "subtitle" | "markdown" | "generic",
    meta?: TranslateBatchMeta,
  ) => {
    const config = getSelectedConfig();
    const concurrency = Math.max(Number(config?.batchSize) || 10, 1);
    const baseDelay = config?.delayTime || 200;
    const limit = pLimit(concurrency);

    try {
      if (!contentLines.length) return [];

      // Provider 已卸载:不再开启新 run(多语言/多文件循环每轮都会走到这里
      // 新建 controller,单靠卸载时 abort 旧 controller 拦不住后续轮次)。
      if (disposedRef.current) throw new Error("Translation aborted");

      // Initialize new abort controller for this translation batch. Capture it
      // as THIS run's controller — every task closure below checks/aborts the
      // captured controller, never the live ref, so queued p-limit tasks from a
      // dead (auth-aborted) run can't resurrect under a successor run's fresh
      // controller and a ghost's auth error can't kill the healthy new run.
      const runController = new AbortController();
      abortControllerRef.current = runController;

      const updateProgress = makeUpdateProgress(fileIndex, totalFiles);

      // systemPrompt stays the BASE prompt — translateSingle appends the
      // per-request glossary block (filtered to the terms each text contains).
      const runtimeConfig: TranslationRuntimeConfig = {
        translationMethod: translationMethodArg,
        targetLanguage: currentTargetLang,
        sourceLanguage,
        useCache,
        ...config,
        systemPrompt: effectiveSystemPrompt,
        userPrompt: effectiveUserPrompt,
      };

      // Only create fullText if the prompt uses ${fullText} variable
      const fullText = effectiveUserPrompt.includes("${fullText}") ? contentLines.join("\n") : undefined;

      const cacheSuffix = generateCacheSuffix({
        sourceLanguage,
        targetLanguage: currentTargetLang,
        translationMethod: translationMethodArg,
        config,
        systemPrompt: effectiveSystemPrompt,
        userPrompt: effectiveUserPrompt,
        // Full term set for the target language — the per-request filtered
        // block is a pure function of {text, this set}, so hashing the set
        // keeps the key deterministic while the wire prompt varies per line.
        glossaryTerms: getGlossaryTerms(currentTargetLang),
      });

      // Context-aware translation with LLM. Glossary is applied per-line inside
      // translateWithContext (success-only), so no blanket pass here.
      if (documentType && LLM_MODELS.includes(translationMethodArg) && contentLines.length > 1) {
        return await translateWithContext(contentLines, runtimeConfig, cacheSuffix, updateProgress, documentType, fullText, runController, meta);
      }

      if (config?.chunkSize === undefined) {
        // Line-by-line concurrent translation. Soft-fail mirrors LLM context
        // mode (translateWithContext below): a single line's failure fills the
        // slot with the original text and tracks it for the TranslateFailurePanel,
        // letting peers finish. Auth errors (and post-abort cascades) still
        // propagate so Promise.all rejects and the translator catch can route.
        const translatedLines = new Array(contentLines.length);
        const failedLinesList: FailedLine[] = [];
        let completedCount = 0;

        const progressStep = Math.max(1, Math.floor(contentLines.length / 100));
        updateProgress(0.5, contentLines.length);

        // Batched cache probe (ONE transaction) → indices that will hit cache.
        // baseDelay (default 200ms) exists to rate-limit REAL API calls; a cache
        // hit makes none, so throttling it just made a fully-cached re-run crawl
        // (baseDelay × lines / concurrency — ~20s on a 1000-line file). Used
        // only to SKIP the delay below; the translate path is unchanged (the
        // per-line cache check inside translateSingleWithGlossary still runs).
        const cacheHitIndices = new Set<number>();
        if (runtimeConfig.useCache !== false) {
          const hits = await getCachedTranslations(contentLines.map((line) => generateCacheKey(line, cacheSuffix)));
          for (let i = 0; i < contentLines.length; i++) if (hits[i] != null) cacheHitIndices.add(i);
        }

        const promises = contentLines.map((line, index) =>
          limit(async () => {
            // Run-scoped liveness check (not the live ref) — see runController note.
            // 必须 throw 级联标记而非裸 return:静默 return 会留下数组空洞,而
            // Promise.all 照样 resolve(排队任务在 abort 后才启动时没有任何任务
            // reject)—— 稀疏数组流回工具层,generateSubtitle 把空洞拼成字面
            // "undefined" 写进自动下载的文件。throw 让 Promise.all reject,
            // 工具层 isCascadedAbort 静默跳过装配/下载。
            if (runController.signal.aborted) throw new Error("Translation aborted");
            try {
              // Glossary on success only; the catch below soft-fills the raw source.
              translatedLines[index] = await translateSingleWithGlossary(line, cacheSuffix, runtimeConfig, fullText, runController);
            } catch (error) {
              // Auth error already tripped THIS run's controller inside translateSingle.
              // It must propagate raw so Promise.all kills the batch and the translator
              // catch surfaces the real reason.
              if (isAuthError(error)) throw error;
              // run 已中止(auth 级联 / provider 卸载的 unmount abort):在飞请求
              // 死于裸 AbortError —— 原样上抛会被工具层按 isAbortError 当"超时"
              // 弹红 toast(卸载场景还弹在用户切去的页面上)。统一改抛级联标记,
              // isCascadedAbort → 工具层静默;peers 的 "Translation aborted" 本就
              // 是这个形态。
              if (runController.signal.aborted) throw new Error("Translation aborted");
              // Otherwise (network blip, 5xx, 4xx like a 422 thinking-param reject,
              // etc., after pRetry exhausted): soft-fail this line, keep peers running.
              lastErrorRef.current = describeError(error, t);
              translatedLines[index] = line;
              // line = real 1-based source position via meta.lineNumbers (ordinal
              // fallback for full-line callers); currentTargetLang tags the target.
              if (line && line.trim()) failedLinesList.push({ text: line, line: meta?.lineNumbers?.[index] ?? index + 1, lang: currentTargetLang, file: meta?.fileName });
            }
            completedCount++;
            if (completedCount % progressStep === 0 || completedCount === contentLines.length) {
              updateProgress(completedCount, contentLines.length);
            }
            // Skip the inter-line throttle for cache hits — they issued no API
            // request, so there's nothing to rate-limit (see cacheHitIndices).
            if (baseDelay > 0 && completedCount < contentLines.length && !cacheHitIndices.has(index)) {
              await delay(baseDelay);
            }
          }),
        );

        await Promise.all(promises);
        updateProgress(contentLines.length, contentLines.length);

        // Surface failures via the same channel as context-mode (TranslateFailurePanel).
        if (failedLinesList.length > 0) {
          runHadFailuresRef.current = true;
          setFailedCount((prev) => prev + failedLinesList.length);
          setFailedLines((prev) => [...prev, ...failedLinesList]);
          if (lastErrorRef.current) setFailedReason(lastErrorRef.current);
        }

        return translatedLines;
      }

      // Chunk-based translation (DeepL / DeepLX / Azure).
      // 空行不进 wire text —— 只翻非空行,空行按原索引回穿。⚠ 别把空行映射成
      // 分隔符:那会双写分隔符,split 多出一格,每个空行后的译文整体下移一格
      // (ASS 纯标签 cue / md raw 模式的静默 off-by-one)。
      const delimiter = translationMethodArg === "deeplx" ? "<>" : "\n";
      const sourceIdx: number[] = [];
      const nonBlankLines: string[] = [];
      for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i]?.trim()) {
          sourceIdx.push(i);
          // 内嵌换行扁平化为空格:ASS 的 \N 在 prepareAssForTranslation 中被转成
          // 真实 \n,而 chunk 路径按行 join/split 对齐 —— 一行变多行会让其后
          // 所有译文逐行错位。MT 路径丢失换行排版是可接受降级,错位不是。
          const flat = contentLines[i].replace(/\r?\n/g, " ");
          // deeplx 用 "<>" 作分隔符 —— 源文本里若含字面 "<>"(SQL/Pascal 不等号、
          // Java/C# 菱形 `List<>`),会被当成额外分隔符,split 后槽位多出一格,
          // 其后所有行错位、末行丢失。拆成 "< >" 中和掉(同换行扁平化的降级取舍)。
          nonBlankLines.push(delimiter === "<>" ? flat.replace(/<>/g, "< >") : flat);
        }
      }
      if (nonBlankLines.length === 0) return [...contentLines];

      const text = nonBlankLines.join(delimiter);
      const chunkSize = config?.chunkSize || 5000;
      const chunks = splitTextIntoChunks(text, chunkSize, delimiter);
      const translatedChunks: string[] = [];

      // 进度按【行】累计上报,不按块:块数对用户无意义(30 行字幕 1 块会显示
      // "1 / 1"),且 projection 弹窗把 current/total 渲染为 "CUE x / y"。
      const totalChunkLines = nonBlankLines.length;
      let chunkLinesDone = 0;
      // Soft-fail per chunk — mirror the line path's semantics exactly: auth
      // errors and post-abort cascades propagate (kill the run), anything else
      // keeps that chunk's SOURCE text and rolls into TranslateFailurePanel.
      // Without this, one chunk exhausting retries threw away every chunk that
      // had already succeeded (all-or-nothing for the DEFAULT free service).
      // Real source line numbers ARE recoverable: sourceIdx[k] maps each non-blank
      // wire line k back to its contentLines index, and failedK collects the k's of
      // every failed chunk. Materialized from failedK AFTER the loop (below) so the
      // modal shows the pristine source text + true line number — same as the
      // LLM/line paths — instead of the newline-flattened wire text.
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
          const translatedContent = await translateSingle(chunks[i], cacheSuffix, runtimeConfig, fullText, runController);
          processed = translationMethodArg === "deeplx" ? (translatedContent || "").replace(/<>/g, "\n") : translatedContent || "";
        } catch (error) {
          if (isAuthError(error)) throw error;
          // 同 line 路径:run 已中止时把裸 AbortError 规范成级联标记,
          // 工具层静默而不是误报"超时"。
          if (runController.signal.aborted) throw new Error("Translation aborted");
          lastErrorRef.current = describeError(error, t);
          // 软填原文 —— deeplx 的源块含 "<>" 分隔符,同样要还原成 \n 保持行对齐
          processed = translationMethodArg === "deeplx" ? chunks[i].replace(/<>/g, "\n") : chunks[i];
          for (let k = chunkStartK; k < chunkStartK + chunkLineCount; k++) failedK.add(k);
        }
        translatedChunks.push(processed);
        chunkStartK += chunkLineCount;
        chunkLinesDone += chunkLineCount;
        updateProgress(chunkLinesDone, totalChunkLines);
        if (i < chunks.length - 1) await delay(config?.delayTime || 200);
      }

      // Materialize failures from failedK → pristine source line + real line number
      // (meta.lineNumbers maps the contentLines index to the physical source line
      // when the caller's array is filtered/derived). failedK is ascending (insertion
      // order); the panel re-sorts by (file, lang, line) anyway. Every k indexes a
      // non-blank line by construction, so the count here equals the old per-chunk
      // split-count (no blanks were ever pushed).
      for (const k of failedK) {
        const i = sourceIdx[k];
        failedChunkLines.push({ text: contentLines[i], line: meta?.lineNumbers?.[i] ?? i + 1, lang: currentTargetLang, file: meta?.fileName });
      }

      if (failedChunkLines.length > 0) {
        runHadFailuresRef.current = true;
        setFailedCount((prev) => prev + failedChunkLines.length);
        setFailedLines((prev) => [...prev, ...failedChunkLines]);
        if (lastErrorRef.current) setFailedReason(lastErrorRef.current);
      }

      const translatedNonBlank = translatedChunks.join("\n").split("\n");
      // Reassemble: translation k lands at its original index; blank source
      // lines pass through verbatim. If the service changed the line count
      // (merged/split lines), unmatched slots keep the source text — degraded
      // but never SHIFTED against the original structure.
      // Glossary leak-through net (whole-text MT has no in-model glossary
      // channel) applies to SUCCESSFUL translations only — failed-chunk and
      // unmatched slots keep the raw source untouched, same convention as the
      // context/line paths. No-op when no term matches this target language.
      const out = [...contentLines];
      for (let k = 0; k < sourceIdx.length; k++) {
        const translated = translatedNonBlank[k];
        out[sourceIdx[k]] = failedK.has(k) || translated === undefined ? contentLines[sourceIdx[k]] : applyGlossary(translated, currentTargetLang);
      }
      return out;
    } catch (error) {
      console.error("Error translating content:", error);
      throw error;
    }
  };

  // Reset all soft-failure state. Used at the start of every run, and exposed so the
  // failure panel's close button lets the user dismiss a handled failure outright.
  const clearFailures = () => {
    setFailedCount(0);
    setFailedLines([]);
    setFailedLangs([]);
    setFailedReason("");
    lastErrorRef.current = null;
    runHadFailuresRef.current = false;
    rateLimitedThisRunRef.current = false;
    // Fresh (non-retry) run: also reset the attempted-lang memory backing retry
    // scoping. A scoped retry keeps it — that's what lets the NEXT retry tell
    // "succeeded earlier this cycle" (attempted, no failures) from "never ran"
    // (added by the user after the failed run).
    if (!retryTargetLangsRef.current) attemptedLangsRef.current = new Set();
  };

  // 行级软失败上报 —— 供自带翻译循环的工具(JSONTranslator)使用:计入失败
  // 面板 + 标记本轮失败,与 hook 内部软失败路径走同一通道。没有它,JSON 工具
  // 的单节点瞬时失败只能 abort 整个语言(丢弃全部已完成节点)或静默吞掉。
  // meta.lang tags the target in batch runs; meta.line is the 1-based source
  // position when the caller has one. JSONTranslator works on key nodes with no
  // line position, so it omits both and the modal falls back to sequential
  // numbering for those records.
  const recordLineFailure = (line: string, reason?: string, meta?: { line?: number; lang?: string }) => {
    runHadFailuresRef.current = true;
    setFailedCount((prev) => prev + 1);
    setFailedLines((prev) => [...prev, { text: line, line: meta?.line, lang: meta?.lang }]);
    if (reason) {
      lastErrorRef.current = reason;
      setFailedReason(reason);
    }
  };

  // Let a component-level performTranslation flag a HARD failure it handled itself
  // (e.g. a whole target language threw — see MD/Subtitle per-lang catch). The hook's
  // line-level soft-fail sites set runHadFailuresRef directly; this covers the rest so
  // runTranslation's return value reflects ALL failures, not just line failures.
  const markRunHadFailures = () => {
    runHadFailuresRef.current = true;
  };

  // Synchronous read of the run's failure flag. Tools that drive their OWN translation
  // loop (e.g. JSONTranslator) can't use runTranslation's boolean return, so they read
  // this directly after the loop to gate their success toast against the failure panel.
  const hadRunFailures = () => runHadFailuresRef.current;

  // ─── Retry scoping ──────────────────────────────────────────────────────
  // When set, a tool's target-language loop is restricted to these langs so the
  // failure panel's "再试一次" only re-processes languages that still need work.
  // Successful langs are otherwise re-walked from cache AND (in batch export)
  // re-downloaded on every retry — pure waste when a single lang's few lines are
  // all that's left. Null outside a runRetry()-wrapped retry, so the normal
  // translate button is completely unaffected.
  const retryTargetLangsRef = useRef<string[] | null>(null);

  // Langs actually dispatched since the last fresh (non-retry) run — recorded by
  // getActiveTargetLangs, reset by clearFailures. Distinguishes "succeeded" (was
  // attempted, not in the failed set) from "never ran" (added by the user between
  // the failed run and the retry): without it a scoped retry silently drops
  // newly added languages.
  const attemptedLangsRef = useRef<Set<string>>(new Set());

  // The languages that FAILED this cycle: union of lang-level failures (a whole
  // lang errored) and the per-line failures' tagged langs. runRetry augments this
  // with never-attempted langs to form the full retry scope. Read at retry time,
  // BEFORE the wrapped run clears failure state.
  const failedTargetLangs = (): string[] => Array.from(new Set<string>([...failedLangs, ...failedLines.map((l) => l.lang).filter((l): l is string => !!l)]));

  // Narrow a run's target languages to the active retry set. No-op on a first run.
  // Falls back to the full list if the filter would empty it — never turns a real
  // run into a no-op. Internal — tools go through getActiveTargetLangs (validate
  // also applies it so a retry is validated against the langs it will actually run).
  const scopeTargetLangs = (langs: string[]): string[] => {
    if (!retryTargetLangsRef.current) return langs;
    const scoped = langs.filter((l) => retryTargetLangsRef.current!.includes(l));
    return scoped.length > 0 ? scoped : langs;
  };

  // Single home for "the languages this run should process": the mode branch reads
  // hook-owned state, so it lives here instead of being re-derived in every tool.
  // During a failure-panel retry (runRetry) the list is narrowed to the langs that
  // still need work; on a normal run scoping is a no-op. Opting out of scoping =
  // not wrapping the rerun in runRetry (JSONTranslator's i18nMode iterates raw
  // targetLanguages instead — its combined artifact needs every lang each run).
  // Side effect: records the returned langs as attempted (see attemptedLangsRef).
  const getActiveTargetLangs = (): string[] => {
    const langs = scopeTargetLangs(multiLanguageMode ? targetLanguages : [targetLanguage]);
    for (const lang of langs) attemptedLangsRef.current.add(lang);
    return langs;
  };

  // True while a runRetry-wrapped rerun is in flight. Tools use it to preserve
  // instead of reset their previous results (result preview, per-lang exports) so
  // a scoped retry only overwrites what it actually re-translates.
  const isScopedRetry = () => retryTargetLangsRef.current !== null;

  // Wrap the failure panel's retry so only languages that still need work re-run:
  // the failed set plus anything never attempted this cycle (langs the user added
  // after the failed run — filtering to failed alone would silently drop them).
  // The scope is PINNED here rather than derived per file, because the run itself
  // marks langs attempted (a multi-file retry would otherwise narrow after file 1).
  // Captured up front (the wrapped run clears failure state via clearFailures),
  // then always cleared — a throwing retry can't leave it stuck on.
  const runRetry = async (retryFn: () => Promise<unknown> | unknown): Promise<void> => {
    const failed = failedTargetLangs();
    const base = multiLanguageMode ? targetLanguages : [targetLanguage];
    const scope = base.filter((lang) => failed.includes(lang) || !attemptedLangsRef.current.has(lang));
    retryTargetLangsRef.current = scope.length > 0 ? scope : null;
    try {
      await retryFn();
    } finally {
      retryTargetLangsRef.current = null;
    }
  };

  // 翻译进行中组件被卸载(用户导航离开)—— 工具层的批量循环靠它跳过失效的
  // 汇总 toast(antd message 挂在应用根上,会弹在用户切去的页面)和后续文件。
  const isDisposed = () => disposedRef.current;

  // Translation handlers
  // Returns true when the run fully succeeded (no line- OR lang-level failures), so a
  // caller that owns its own success messaging (e.g. MD single-file) can show a
  // completion toast WITHOUT contradicting the failure panel/error toasts.
  const runTranslation = async (performTranslation: PerformTranslation, sourceText: string, documentType?: "subtitle" | "markdown" | "generic"): Promise<boolean> => {
    // Scoped retry keeps the existing result on screen: the retry excludes the
    // already-successful langs, so clearing here would blank the preview with
    // nothing to repopulate it (tool-side previewLang only refreshes the previewed
    // lang if it re-runs). Fresh runs still start clean.
    if (!isScopedRetry()) setTranslatedText("");
    // Reset soft-failure state for this run — the UI Alert is driven by these.
    clearFailures();
    if (!sourceText.trim()) {
      message.warning(t("noSourceText"));
      return false;
    }

    // isTranslating 现在统一在 runTranslation 这一层管,validate 内部不再
    // 自行开关。Progress modal 在 validate 的 test ping 阶段也保持可见,体验连续。
    setIsTranslating(true);
    resetProgress();
    glossarySnapshotRef.current = new Map();
    try {
      const isValid = await validate();
      if (!isValid) return false;
      await performTranslation(sourceText, undefined, undefined, undefined, documentType);
      // disposed = 用户翻译中途导航离开:级联标记被工具层静默 continue 后
      // 这里会正常走到 —— 不挡的话调用方在用户已切去的页面上弹"成功"toast
      // (antd message 挂在应用根上,跨页面可见)。
      return !runHadFailuresRef.current && !disposedRef.current;
    } finally {
      glossarySnapshotRef.current = null;
      setIsTranslating(false);
    }
  };

  return {
    exportSettings,
    importSettings,
    translationMethod,
    setTranslationMethod,
    translationConfigs,
    getSelectedConfig,
    handleConfigChange,
    resetTranslationConfig,
    systemPrompt,
    setSystemPrompt,
    userPrompt,
    setUserPrompt,
    useCache,
    setUseCache,
    removeChars,
    setRemoveChars,
    translateSingle,
    translateBatch,
    runTranslation,
    sourceLanguage,
    targetLanguage,
    targetLanguages,
    setTargetLanguages,
    multiLanguageMode,
    setMultiLanguageMode,
    translatedText,
    setTranslatedText,
    failedCount,
    failedLines,
    failedLangs,
    setFailedLangs,
    failedReason,
    clearFailures,
    markRunHadFailures,
    recordLineFailure,
    hadRunFailures,
    runRetry,
    isScopedRetry,
    getActiveTargetLangs,
    isDisposed,
    isTranslating,
    setIsTranslating,
    resetProgress,
    apiSettingsOpen,
    setApiSettingsOpen,
    progressPercent,
    setProgressPercent,
    progressInfo,
    handleLanguageChange,
    handleSwapLanguages,
    retryCount,
    setRetryCount,
    requestTimeoutSec,
    setRequestTimeoutSec,
    validate,
    llmPresets,
    activeLlmPresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    renameLlmPreset,
    updateLlmPreset,
    promptPresets,
    setPromptPresets,
    activePromptPresetId,
    setActivePromptPresetId,
    savePromptPreset,
    loadPromptPreset,
    deletePromptPreset,
    renamePromptPreset,
    updatePromptPreset,
    glossaryEnabled,
    setGlossaryEnabled,
    glossaryPresets,
    setGlossaryPresets,
    activeGlossaryPresetId,
    setActiveGlossaryPresetId,
    activeGlossaryPreset,
    createGlossaryPreset,
    deleteGlossaryPreset,
    renameGlossaryPreset,
    updateGlossaryPreset,
    getGlossaryTerms,
    translateSingleWithGlossary,
  };
};

export default useTranslationState;
