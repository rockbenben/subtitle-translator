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
  runReachabilityProbe,
  useTranslation,
  buildRuntimeConfig,
  defaultConfigs,
  findMethodLabel,
  getDefaultConfig,
  migrateConfig,
  resetConfigWithCredentials,
  PREFLIGHT_PROBE_METHODS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  translateLines,
  type PipelineRuntimeConfig,
  type FailedLine,
  type TranslateBatchMeta,
  type TranslationConfig,
} from "@/app/lib/translation";
import { type GlossaryTerm } from "@/app/lib/translation/glossary";
import { translationCache } from "@/app/lib/storage/indexedDBStorage";
// 浏览器专属的那几个(文件下载 / <input type=file> / 依赖 UI 文案的校验)
import { exportTranslationSettings, createSettingsFileInput, validateTranslationInputs, pingSignature } from "@/app/hooks/translation";
// 引擎侧:平台无关,与 CLI 共用同一份,一律从 lib/translation 取
import { DEFAULT_RETRY_COUNT, DEFAULT_RETRY_TIMEOUT, isRetryableError, isDefiniteAuthFailure } from "@/app/lib/translation/retry";
import { type TranslationSettings } from "@/app/lib/translation/settingsSchema";
import { describeError, isNetworkError } from "@/app/utils/errorUtils";
import { useTranslations } from "next-intl";

const DEFAULT_API = "gtxFreeAPI";

type TranslationConfigs = Record<string, TranslationConfig>;

type PerformTranslation = (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number, documentType?: "subtitle" | "markdown" | "generic") => Promise<void>;

// Engine types moved to lib/translation/pipeline.ts — re-exported here so
// existing importers (TranslateFailurePanel, tools) keep working unchanged.
// (曾经在这里转发 FailedLine / TranslateBatchMeta —— 引擎类型不该有两条活的
// 导入路径,消费方直接从 @/app/lib/translation 拿。见 translationLayerBoundary.test.ts)

type TranslationRuntimeConfig = PipelineRuntimeConfig;

const useTranslationState = () => {
  const { message } = App.useApp();
  const tLanguages = useTranslations("languages");
  const t = useTranslations("common");
  // The network seam: every wire request the pipeline makes goes through this,
  // so hook tests can swap the whole transport with one vi.mock of
  // "@/app/lib/translation". Passed down as PipelineDeps.translate.
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
  // User's own relay origin; empty = the built-in one. Global rather than
  // per-provider: one self-hosted Worker (scripts/llm-proxy-worker.js) serves
  // every provider under /api/{provider}, so setting it once redirects them
  // all. Rides the same path as retryCount/requestTimeoutSec — a hook-level
  // setting merged into runtimeConfig at translate time, which is what keeps
  // it under the run-snapshot rule (mid-run edits can't affect the live run).
  const [relayBase, setRelayBase] = useLocalStorage<string>("translation-relayBase", "");
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
  // 同一事实的【可渲染副本】。ref 改动不触发 render,而进度条要靠它决定打绿色
  // 「翻译完成」还是琥珀「INCOMPLETE」—— 在 render 里读 ref 也不行:本仓开着
  // React Compiler,未被追踪的 ref 读会被错误记忆化。两者永远一起改。
  const [runHadFailures, setRunHadFailures] = useState(false);
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

  // Extracted concerns
  const { isTranslating, setIsTranslating, progressPercent, setProgressPercent, progressInfo, abortControllerRef, disposedRef, makeUpdateProgress, resetProgress } = useTranslationProgress();

  // ─── 取消 ────────────────────────────────────────────────────────────────
  // 取消【完全复用】既有的级联中止链路:abort 本轮 controller → 在飞请求与
  // pRetry 的退避被当场叫醒 → 各处 signal 检查抛 "Translation aborted" →
  // 工具层 isCascadedAbort 静默。不新增任何"取消后的记账":
  //
  //   继续翻译 = 用户再点一次「翻译」,逐行缓存就是断点 —— 已译的行全部缓存
  //   命中、零请求回放;没译的行未命中、真正去翻。哪些要补由缓存未命中集合
  //   自动定义,所以取消时【没有】需要写对的状态,也就没有能写错的状态。
  //   (改了进缓存键的设置再继续 → 缓存失效 → 按新设置重翻,同样是对的。)
  //
  // cancelRequestedRef 存在的唯一理由:多语言/多文件循环每轮【新建】controller,
  // 光 abort 当前那个拦不住下一轮 —— 入口守卫要一个跨 controller 的旗标。
  const cancelRequestedRef = useRef(false);
  // 【凭据失败快停】—— 与 cancelRequestedRef 同构,理由也同构:一把坏 key 会让
  // 之后【每一个】语言/文件以同样方式死掉,而每轮 translateBatch 新建 controller,
  // pipeline 内部的 auth abort 只掐得断本轮(runTranslateLines 有意不接
  // deps.onAuthAbort),拦不住下一轮 —— 入口守卫同样需要一个跨 controller 的旗标。
  //
  // 没有它:过期 key + 5 个目标语言 = 5 轮注定失败的满并发请求,用户看着进度条把
  // 同一个错误重演五遍。CLI 早就有这条(cli.ts「凭据失败快停」),网页端三个工具
  // 此前都没有。
  //
  // ⚠ 存的是【原始错误】而不是布尔,因为入口守卫要把它原样抛出去。绝不能像
  // 取消那样抛级联标记("Translation aborted"):工具层对级联标记是【静默
  // continue】,而那条路径同时跳过了记账 —— hasFailedLang / setFailedLangs /
  // noteFileFailure 全都不会执行。后果是快停比不快停更糟:
  //   · 批量 10 个文件坏 key → 文件 1 记一次失败,2-10 静默跳过 → 末尾弹
  //     「已导出 (9/10)」而实际零下载;
  //   · 多语言 [zh,ja,ko] → ja/ko 既不进 failedLangs 又已被标记"已尝试",
  //     用户改好 key 点重试,scope 塌成 [zh],ja/ko 永远不会被翻译还弹绿色成功。
  // 抛原始 auth 错误则一切照旧记账,而"快"体现在【零请求】上 —— 这才是快停的
  // 本意。per-lang 的 toast 用的是 shared key,N 个语言只会显示一条。
  //
  // ⚠ 触发器是 isDefiniteAuthFailure(只认数值 401/403),【不是】isAuthError ——
  // 后者为兜住不返回 status 的 provider 还匹配消息子串("forbidden" 等),用它
  // 决定整轮生死太宽:一段含 "Forbidden" 的代理/挑战页 HTML 就能掐掉整个批量
  // 任务。宽判据只用于「这一行不重试」。两种错误代价不对称:该停没停 = 多打
  // 几轮无用请求(且现在会被正确记账);不该停停了 = 整批提前结束、用户从头再来。
  const authFailedRef = useRef<unknown>(null);
  // 预检探测有自己的 controller(validate 里),且发生在本轮 controller 建立之前;
  // 不挂进来的话,取消在探测期间(最长 requestTimeoutSec)是个空按钮。
  const preflightControllerRef = useRef<AbortController | null>(null);
  const isCancelRequested = () => cancelRequestedRef.current;
  const requestCancel = () => {
    cancelRequestedRef.current = true;
    abortControllerRef.current?.abort();
    preflightControllerRef.current?.abort();
    // toast 只确认"动作发生了"这一件事。"停在哪、还能不能续"由进度条的
    // STOPPED 态常驻着说 —— 那句话该留在屏幕上,而不是闪一下就没。
    message.info(t("translationCancelled"));
  };

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
        relayBase,
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
      // sanitizeSettings 已经把非 http(s) 的 relayBase 丢掉了(它决定 apiKey
      // 发到哪台机器),到这里的值要么合法要么不存在。
      if (settings.relayBase !== undefined) setRelayBase(settings.relayBase);
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
  //
  // relayBase(全局设置)在这里并入 —— 这是「wire 会打到哪」的唯一咽喉:
  // 状态徽章 identity、Test、探测、翻译主链路全部从本函数取 config,合并放在
  // 消费端曾漏掉三处(bcbc7e579),放在这里则未来消费者天然拿到。写回无污染:
  // preset 保存读的是裸 translationConfigs,且 migrateConfig 的 defaults-key-only
  // 合并会把误入存储的 relayBase 剥掉(它不在任何 defaults 里)。
  const getSelectedConfig = (): TranslationConfig & { relayBase: string } => {
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
    return { ...migrateConfig(existingConfig, defaultConfig), relayBase };
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
    // 每轮 run 的唯一共用入口(runTranslation 与三个工具的自有循环都先走这里):
    // 上一轮的取消旗标在此复位,新一轮才起得来。
    cancelRequestedRef.current = false;
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
          // 挂给 requestCancel:探测发生在本轮 controller 建立之前,是整条链路里
          // 唯一不受 abortControllerRef 管辖的等待。
          preflightControllerRef.current = probeController;
          try {
            await runReachabilityProbe(translationMethod, config, tempSystemPrompt, tempUserPrompt, probeController.signal);
          } catch (error) {
            // 用户在探测中途点了取消:这个 AbortError 是取消【造成的】,不是服务
            // 不可达 —— 走下面的硬阻断会弹"服务不可用"红条,把用户自己的动作说成
            // 一次故障(requestCancel 已弹过取消提示)。静默收工。
            if (cancelRequestedRef.current || disposedRef.current) return false;
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
              // 这一分支【会替用户改 provider】—— 唯一会自动切换的是 deeplx
              // (公共代理不稳,安全网就是回落免费 GTX)。
              const autoSwitched = translationMethod === "deeplx";
              if (autoSwitched) setTranslationMethod(DEFAULT_API);
              // ⚠ Footgun: setState is async; below this line `translationMethod` in
              // this scope still reads the old value (deeplx). Safe because we
              // immediately `return false`.
              //
              // 一条通用文案 + findMethodLabel(registry 单一事实源)替代曾经的
              // per-service 映射表:新方法进 PREFLIGHT_PROBE_METHODS 自动拿到带
              // 自己名字的提示,不存在"忘了加 opencode"这类漏项(上一版真漏过)。
              //
              // ⚠ 但【发生了自动切换】必须说出来,否则就是替用户改了 provider
              // 却让他以为还在用原来那个:下一次翻译会把整份文档发往 GTX 的公共
              // 免费端点 —— 一次他从未被告知的 provider/隐私变更。收敛成通用
              // 文案时丢过这句(旧的 deepLXUnavailable 里写着「已自动切换至
              // GTX API (Free)」),这里补回。判据绑在【切换动作】上而不是服务名,
              // 所以将来任何服务加了自动回落都会自动拿到正确文案。
              const content = autoSwitched
                ? t("serviceUnavailableSwitched", { service: findMethodLabel(translationMethod), fallback: findMethodLabel(DEFAULT_API) })
                : t("serviceUnavailable", { service: findMethodLabel(translationMethod) });
              message.open({ type: "error", content, duration: 10 });
              return false;
            }
            // Transient → don't block, don't cache; the per-line retry handles it
            // and the next run re-probes for a clean pass.
            console.warn(`Reachability probe for ${translationMethod} hit a retryable error; proceeding (per-line retry will handle it).`, error);
            return true;
          } finally {
            clearTimeout(probeTimeout);
            preflightControllerRef.current = null;
          }
        }
        // Clean success → remember for this session (skip re-probe on repeat runs).
        validatedProbes.current.add(sig);
      }
    }

    return true;
  };

  // ─── Engine delegation ───────────────────────────────────────────────────
  // The actual translation machinery (per-line retry/backoff, 429 gate,
  // context-aware batching, cluster retry, soft-fail) lives in
  // lib/translation/pipeline.ts — platform-agnostic, shared with the CLI.
  // The wrappers below only wire browser concerns in: IndexedDB cache,
  // progress state, antd toasts, failure-panel state, unmount/cancel refs.

  // 429 冷却提示 —— keyed toast:同一波并发只弹一次(pipeline 侧 startedCooldown 已去重)。
  const notifyRateLimit = () => {
    rateLimitedThisRunRef.current = true;
    message.warning({ content: t("rateLimitCooldown"), key: "rate-limit-cooldown", duration: 5 });
  };

  // Main translation function.
  // 这是【所有】工具的唯一翻译入口 —— 包括自带遍历逻辑的 JSONTranslator
  // (收集 values+回写器 → 本函数 → 逐槽位写回)。曾经存在的单行入口
  // (translateSingleWithGlossary)把并发/节流/进度/失败收集还给调用方,
  // 调用方长成第二个 pipeline 并真的漂移过(delayTime),已随 JSONTranslator
  // 迁移一并删除。别再为"就翻一行"开新口子。
  const translateBatch = async (
    contentLines: string[],
    translationMethodArg: string,
    currentTargetLang: string,
    fileIndex: number = 0,
    totalFiles: number = 1,
    documentType?: "subtitle" | "markdown" | "generic",
    meta?: TranslateBatchMeta,
    // 翻译单元互相独立、必须逐单元往返(JSON 值)时置 true。它压住【两条】批处理
    // 路径,不止一条:组装线剥 chunkSize 挡住 chunk,引擎的 `!config.independent`
    // 挡住 LLM 上下文 marker 批 —— 后者的分支排在 chunkSize 之前,只剥 chunkSize
    // 对 LLM provider 完全无效(上线过的那个 bug 就是这个心智模型的产物)。
    // chunk 的 join/split 对齐对独立单元是静默数据损坏。CLI 壳同一开关,
    // 细节见 PipelineRuntimeConfig.independent。
    independent: boolean = false,
  ) => {
    const config = getSelectedConfig();

    try {
      if (!contentLines.length) return [];

      // Provider 已卸载 / 用户已取消:不再开启新 run(多语言/多文件循环每轮都会
      // 走到这里【新建】controller,单靠 abort 旧 controller 拦不住后续轮次 ——
      // 这正是 cancelRequestedRef 存在的理由)。这两种是用户/环境主动终止,
      // 工具层静默 continue 是对的。
      if (disposedRef.current || cancelRequestedRef.current) throw new Error("Translation aborted");
      // 本轮已确认凭据失效:抛【原始 auth 错误】,不是级联标记 —— 理由见
      // authFailedRef 的注释(级联标记那条路径连带跳过了失败记账)。
      if (authFailedRef.current) throw authFailedRef.current;

      // Initialize new abort controller for this translation batch. The
      // pipeline chains its own run controller off this signal — auth errors
      // cascade inside the pipeline; requestCancel aborts this one.
      const runController = new AbortController();
      abortControllerRef.current = runController;

      // systemPrompt stays the BASE prompt — the pipeline appends the
      // per-request glossary block (filtered to the terms each text contains).
      // 组装线与 CLI 共用 buildRuntimeConfig;globals 的键由 RuntimeGlobals
      // 强制列全 —— 新增全局旋钮时这里不改就编译不过。
      const runtimeConfig: TranslationRuntimeConfig = buildRuntimeConfig({
        translationMethod: translationMethodArg,
        targetLanguage: currentTargetLang,
        sourceLanguage,
        useCache,
        config,
        globals: { systemPrompt: effectiveSystemPrompt, userPrompt: effectiveUserPrompt, retryCount, requestTimeoutSec, relayBase },
        independent,
      });

      const outcome = await translateLines(
        contentLines,
        runtimeConfig,
        {
          cache: translationCache,
          translate,
          signal: runController.signal,
          shouldStop: () => disposedRef.current,
          onProgress: makeUpdateProgress(fileIndex, totalFiles),
          onRateLimit: notifyRateLimit,
          getGlossaryTerms,
          // Carry the run-scoped 429 memory across per-file/per-lang pipeline
          // calls (reset by clearFailures) — keeps the context path's breather
          // long only when this RUN actually got throttled.
          rateLimitedEarlier: rateLimitedThisRunRef.current,
        },
        documentType,
        meta,
      );

      if (outcome.rateLimited) rateLimitedThisRunRef.current = true;
      // 原因记忆是【run 级】的,不是单次调用级:记在出错当刻,与本次调用是否
      // 留下失败行无关。多语言运行里 zh 的 422 可能被半窗 gap-retry 救回(该
      // 次调用零失败),而后面 ja 撞的是「200 但标记被丢」的抽取缺口 —— 那条
      // 路径根本不抛异常,lastError 为空。只在「本次有失败」时才记原因的话,
      // 失败面板就会显示「N 行失败」却没有 WHY,而这一轮唯一可诊断的错误
      // (422)已经被丢掉了。
      if (outcome.lastError !== undefined) {
        // Raw error → localized reason at the UI boundary (single i18n home).
        lastErrorRef.current = describeError(outcome.lastError, t);
      }
      // Surface failures via the failure-panel state (same channel all paths used).
      if (outcome.failures.length > 0) {
        runHadFailuresRef.current = true;
        setRunHadFailures(true);
        setFailedCount((prev) => prev + outcome.failures.length);
        setFailedLines((prev) => [...prev, ...outcome.failures]);
        if (lastErrorRef.current) setFailedReason(lastErrorRef.current);
      }

      // collectSoftFilled 由 translateLines 自己填(见 pipeline 的薄包装),
      // 这里不再重复一份 —— 两处填同一个 Set 只会让"谁负责"变模糊。
      return outcome.lines;
    } catch (error) {
      console.error("Error translating content:", error);
      // 记在【抛出去之前】:调用方的 per-lang catch 会把它记进 failedLangs 并
      // 弹一次 toast(那是对的,用户要知道原因),下一个语言在入口就死掉、零请求,
      // 但同样会被记账 —— 存错误本身,入口守卫原样抛它。
      // ⚠ 判据是 isDefiniteAuthFailure(只认 401/403)而【不是】isAuthError:
      // 后者为兜住不返回 status 的 provider 还匹配消息子串,用它决定整轮生死
      // 会让一段含 "Forbidden" 的代理/挑战页 HTML 提前终止整个批量任务。
      // 单行不重试仍走宽判据 —— 两种代价不对称,详见 isDefiniteAuthFailure。
      if (isDefiniteAuthFailure(error)) authFailedRef.current = error;
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
    setRunHadFailures(false);
    rateLimitedThisRunRef.current = false;
    // 凭据失败记忆是【本轮】的:用户改完 key 再点翻译,新一轮从干净状态开始
    // (三个工具都在开跑时清失败面板)。不清的话改对了 key 也永远跑不动。
    authFailedRef.current = null;
    // Fresh (non-retry) run: also reset the attempted-lang memory backing retry
    // scoping. A scoped retry keeps it — that's what lets the NEXT retry tell
    // "succeeded earlier this cycle" (attempted, no failures) from "never ran"
    // (added by the user after the failed run).
    if (!retryTargetLangsRef.current) attemptedLangsRef.current = new Set();
  };

  // Let a component-level performTranslation flag a HARD failure it handled itself
  // (e.g. a whole target language threw — see MD/Subtitle per-lang catch). The hook's
  // line-level soft-fail sites set runHadFailuresRef directly; this covers the rest so
  // runTranslation's return value reflects ALL failures, not just line failures.
  const markRunHadFailures = () => {
    runHadFailuresRef.current = true;
    setRunHadFailures(true);
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
      // 与三个工具的【批量】路径同一个钉(见 SubtitleTranslator 那处的长注释):
      // 单文件多语言里某个语种硬失败时,per-lang catch 吞掉错误后 progressPercent
      // 停在中途 —— 进度条据 percent<100 判为 STOPPED,对着一次用户【没有】取消
      // 的运行打「已停止 / 可从中断处继续」,而 zh 的完整文件其实已经下载了;
      // 同时 doneWithFailures 以 done 为前提,failed / lineFailures 两个信号被
      // 整个丢掉。批量路径当初补了钉,单文件路径漏了。
      //
      // 位置在 performTranslation 之后、不能挪进 finally:validate 不通过时
      // 上面已经 return,那条路径进度是 0,钉成 100% 就是纯撒谎。
      // 取消/离开不钉,理由同批量路径(DONE 态派生自 percent>=100,替一次主动
      // 喊停亮绿灯)。
      //
      // `p > 0 ? 100 : p` —— 光守 validate 那条路径【不够】:performTranslation
      // 自己也有配置错误早退(多语言模式下一个目标语言都没选:validate 的
      // for 循环在空数组上是 no-op 所以放行,工具层弹 noTargetLanguage 后立刻
      // return,但 noteFileFailure 已把 runHadFailures 置上)。无条件钉会让一次
      // 【一个请求都没发】的运行显示 100% 的琥珀色「INCOMPLETE」,失败面板还是
      // 空的、没有重试入口。改用「进度动过才钉」:配置错误早退时 percent 恒为 0。
      // 函数式更新顺带避开闭包里的陈旧 progressPercent。
      if (!cancelRequestedRef.current && !disposedRef.current) setProgressPercent((p) => (p > 0 ? 100 : p));
      // disposed = 用户翻译中途导航离开:级联标记被工具层静默 continue 后
      // 这里会正常走到 —— 不挡的话调用方在用户已切去的页面上弹"成功"toast
      // (antd message 挂在应用根上,跨页面可见)。
      // 取消的 run 不算成功:调用方拿 true 去弹绿色成功 toast(MD 单文件),
      // 对着一次用户主动喊停报「完成」是撒谎。
      return !runHadFailuresRef.current && !disposedRef.current && !cancelRequestedRef.current;
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
    runHadFailures,
    requestCancel,
    isCancelRequested,
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
    relayBase,
    setRelayBase,
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
  };
};

export default useTranslationState;
