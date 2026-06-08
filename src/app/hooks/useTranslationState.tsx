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
  translategemmaHealthCheck,
  deleteCachedTranslation,
  type TranslateTextParams,
  type TranslationConfig,
} from "@/app/lib/translation";
import {
  getRetryConfig,
  delay,
  extractTranslatedLinesWithNumbers,
  buildContextPrompt,
  isBlankLine,
  exportTranslationSettings,
  createSettingsFileInput,
  validateTranslationInputs,
  pingSignature,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_TIMEOUT,
  isAuthError,
  isRetryableError,
  type TranslationSettings,
  type UserRetryConfig,
} from "@/app/hooks/translation";
import { isNetworkError } from "@/app/utils/errorUtils";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { useTranslations } from "next-intl";

const DEFAULT_API = "gtxFreeAPI";
// Caps context window padding around a batch — without this, a large
// contextWindow would request hundreds of neighbor lines per batch and blow
// past the model's context limit on long inputs.
const MAX_CONTEXT_PADDING = 50;

type TranslationConfigs = Record<string, TranslationConfig>;

type PerformTranslation = (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number, documentType?: "subtitle" | "markdown" | "generic") => Promise<void>;

type TranslationRuntimeConfig = TranslationConfig & {
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  fullText?: string; // Complete text for ${fullText} variable
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
  // 当 storedMethod 不是当前构建已知的 provider(getDefaultConfig 返回 undefined)时,
  // 仅本次渲染回退到 DEFAULT_API 用于显示/翻译 —— 绝不写回 localStorage。
  //
  // ⚠ 为什么不能落盘纠偏(旧做法 setTranslationMethod(DEFAULT_API) 的坑):
  // 用户选了某 provider(如 mimo)落盘后,若之后加载到一份"缺少该 provider 的旧 bundle"
  // (浏览器/CDN 缓存、灰度发布中途、回滚),旧做法会立刻把 gtx 落盘,**永久覆盖**用户的
  // 真实选择 —— 即使之后正确 bundle 回来了也回不去。纯派生则让真实选择安然留在 localStorage,
  // 正确 bundle 一加载就自动恢复;旧/已删 key(如 "aliyun")也只是显示成 gtx,不破坏数据。
  // 只有用户主动改选(setTranslationMethod)才写盘。
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
  const [failedLines, setFailedLines] = useState<string[]>([]);
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
    buildTranslationSystemPrompt,
    applyGlossary,
  } = useGlossaryPresets(effectiveSystemPrompt);

  // Extracted concerns
  const { isTranslating, setIsTranslating, progressPercent, setProgressPercent, progressInfo, abortControllerRef, makeUpdateProgress, resetProgress } = useTranslationProgress();

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

  // Validation
  //
  // 设计要点 (踩坑后留的注释,改之前先理解):
  //
  // 1. 不在此处碰 isTranslating —— 该 flag 由调用方 (runTranslation /
  //    handleMultipleTranslate) 的 try/finally 统一管。validate 内部自己开关
  //    会跟外层 set 冲突,触发 progress modal 闪烁,职责也乱。
  //
  // 2. 语言不支持时不再自动改 translationMethod —— 早期版本会偷偷 fallback
  //    到 DEFAULT_API,用户察觉不到 method 被换。现在只报错,让用户自己决定
  //    换语言还是换 method。
  //
  // 3. test ping 只对这 5 个服务执行 (deepl/deeplx/llm/gtxFreeAPI/translategemma):
  //    它们是"免费/自托管/本地"类,可用性不稳定 (GFW 墙、自架挂了、模型没启动)
  //    需要提前探测。付费 API (DeepSeek/Claude/Gemini 等) 假定 API key 给了就能
  //    用,出错让翻译请求本身去报。
  //
  // 4. test ping 失败时只有 deeplx 自动 fallback —— deeplx 是自托管代理,
  //    URL 配错 / 服务挂了的概率最高;其他 4 个失败通常是真实问题 (key 错、
  //    服务真不可用),fallback 没意义。
  const validate = async () => {
    const config = getSelectedConfig();

    // Sync validation: creds + language support. Extracted to a pure function
    // (hooks/translation/validation.ts) so it's unit-testable without React.
    const syncResult = validateTranslationInputs({
      config,
      method: translationMethod,
      sourceLanguage,
      targetLanguage,
      multiLanguageMode,
      targetLanguages,
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
        if (translationMethod === "translategemma") {
          // Local LM Studio reachability (GET /v1/models) — has its own built-in
          // 5s timeout for a fast fail when the server isn't running. Failure =
          // hard-block (a local health check has no transient nuance).
          if ((await translategemmaHealthCheck(String(config.url ?? ""))) !== true) {
            message.open({ type: "error", content: t("translategemmaUnavailable"), duration: 10 });
            return false;
          }
        } else {
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
                gtxFreeAPI: t("gtxFreeAPIUnavailable"),
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
    // Check if already aborted (e.g., by auth error in another concurrent request)
    if (run?.signal.aborted) {
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
          if (run?.signal.aborted) {
            throw new Error("Translation aborted");
          }

          const { controller, cleanup } = createTimeoutController();

          try {
            const result = await translate({ ...translateParams, signal: controller.signal });
            cleanup();
            return result;
          } catch (error) {
            cleanup();

            // Auth error → abort all concurrent requests OF THIS RUN. Aborting
            // the live ref instead would let a ghost task from a dead run kill
            // a healthy successor run.
            if (isAuthError(error)) {
              run?.abort();
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

  // Context-aware translation with auto-adjustment of context window
  const translateWithContext = async (
    contentLines: string[],
    runtimeConfig: TranslationRuntimeConfig,
    cacheSuffix: string,
    updateProgress: (current: number, total: number) => void,
    documentType: "subtitle" | "markdown" | "generic" = "subtitle",
    fullText?: string,
    runController?: AbortController,
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

    const translateSingleBatch = async (batchStart: number, batchEnd: number, contextWindow: number): Promise<boolean> => {
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
        const translatedBatch = extractTranslatedLinesWithNumbers(result || "", batchEnd - batchStart, batchSources);

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
            // Apply the glossary leak-through to SUCCESSFUL translations only.
            // Failed slots get soft-filled with the raw source later (see "Final
            // soft-fail"), so a fully-failed line stays the untouched original
            // instead of a half-localized mix like "斯派克, hi".
            translatedLines[batchStart + j] = applyGlossary(translatedBatch[j], runtimeConfig.targetLanguage);
          }
        }

        // Reflect partial progress as soon as the batch returns, so the bar doesn't
        // sit at 0% for the full duration of each 50-line LLM call.
        const doneSoFar = translatedLines.filter((x) => x !== undefined).length;
        if (doneSoFar > 0) updateProgress(doneSoFar, contentLines.length);

        return !translatedLines.slice(batchStart, batchEnd).includes(undefined);
      } catch (error) {
        if (isAuthError(error)) throw error;
        // Real soft-failure (non-auth) — keep the message so the panel can show WHY.
        lastErrorRef.current = (error as Error)?.message || String(error);
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

    // Show non-zero progress immediately so users see the modal is alive
    // (a single LLM batch can take 20-60s before the first updateProgress call)
    updateProgress(0.5, contentLines.length);

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
      console.log("Auto-retry remaining failed lines after 10s with clustered small-context retry...");
      await delay(10000);
      try {
        await clusterRetryFailures(0, contentLines.length);
      } catch (err) {
        if (isAuthError(err)) throw err;
        // Non-auth: leave remaining failures for the final soft-fill.
      }
    }

    // ─── Final soft-fail ────────────────────────────────────────────────
    // Slots still empty after auto-retry get filled with the original text
    // so the output is usable. Only non-whitespace originals count as real
    // failures — empty/whitespace-only lines (common in subtitle spacing,
    // markdown blank lines) weren't meaningful translations in the first
    // place, so flagging them as failures would just confuse the UI.
    const failedLinesList: string[] = [];
    for (let i = 0; i < translatedLines.length; i++) {
      if (translatedLines[i] === undefined) {
        const original = contentLines[i];
        translatedLines[i] = original;
        if (original && original.trim()) failedLinesList.push(original);
      }
    }
    if (failedLinesList.length > 0) {
      runHadFailuresRef.current = true;
      setFailedCount((prev) => prev + failedLinesList.length);
      setFailedLines((prev) => [...prev, ...failedLinesList]);
      if (lastErrorRef.current) setFailedReason(lastErrorRef.current);
    }

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
  ) => {
    const config = getSelectedConfig();
    const concurrency = Math.max(Number(config?.batchSize) || 10, 1);
    const baseDelay = config?.delayTime || 200;
    const limit = pLimit(concurrency);

    try {
      if (!contentLines.length) return [];

      // Initialize new abort controller for this translation batch. Capture it
      // as THIS run's controller — every task closure below checks/aborts the
      // captured controller, never the live ref, so queued p-limit tasks from a
      // dead (auth-aborted) run can't resurrect under a successor run's fresh
      // controller and a ghost's auth error can't kill the healthy new run.
      const runController = new AbortController();
      abortControllerRef.current = runController;

      const updateProgress = makeUpdateProgress(fileIndex, totalFiles);

      const glossarySystemPrompt = buildTranslationSystemPrompt(currentTargetLang);
      // Leak-through net for the chunk path (whole-text MT — no per-line soft-fill,
      // so every line is a real translation). The context + line-by-line paths
      // apply the glossary per successful line instead, so a failed-then-soft-filled
      // line keeps the raw source. No-op when no term matches this target language.
      const applyGlossaryToLines = (lines: string[]) => lines.map((line) => applyGlossary(line ?? "", currentTargetLang));

      const runtimeConfig: TranslationRuntimeConfig = {
        translationMethod: translationMethodArg,
        targetLanguage: currentTargetLang,
        sourceLanguage,
        useCache,
        ...config,
        systemPrompt: glossarySystemPrompt,
        userPrompt: effectiveUserPrompt,
      };

      // Only create fullText if the prompt uses ${fullText} variable
      const fullText = effectiveUserPrompt.includes("${fullText}") ? contentLines.join("\n") : undefined;

      const cacheSuffix = generateCacheSuffix({
        sourceLanguage,
        targetLanguage: currentTargetLang,
        translationMethod: translationMethodArg,
        config,
        systemPrompt: glossarySystemPrompt,
        userPrompt: effectiveUserPrompt,
      });

      // Context-aware translation with LLM. Glossary is applied per-line inside
      // translateWithContext (success-only), so no blanket pass here.
      if (documentType && LLM_MODELS.includes(translationMethodArg) && contentLines.length > 1) {
        return await translateWithContext(contentLines, runtimeConfig, cacheSuffix, updateProgress, documentType, fullText, runController);
      }

      if (config?.chunkSize === undefined) {
        // Line-by-line concurrent translation. Soft-fail mirrors LLM context
        // mode (translateWithContext below): a single line's failure fills the
        // slot with the original text and tracks it for the TranslateFailurePanel,
        // letting peers finish. Auth errors (and post-abort cascades) still
        // propagate so Promise.all rejects and the translator catch can route.
        const translatedLines = new Array(contentLines.length);
        const failedLinesList: string[] = [];
        let completedCount = 0;

        const progressStep = Math.max(1, Math.floor(contentLines.length / 100));
        updateProgress(0.5, contentLines.length);

        const promises = contentLines.map((line, index) =>
          limit(async () => {
            // Run-scoped liveness check (not the live ref) — see runController note.
            if (runController.signal.aborted) return;
            try {
              // Glossary on success only; the catch below soft-fills the raw source.
              translatedLines[index] = applyGlossary(await translateSingle(line, cacheSuffix, runtimeConfig, fullText, runController), currentTargetLang);
            } catch (error) {
              // Auth error already tripped THIS run's controller inside translateSingle.
              // After-abort throws ("Translation aborted") come from peers' pre-attempt
              // guard. Both must propagate so Promise.all kills the batch — translator
              // catch surfaces the real auth error / handles cascade silently.
              if (isAuthError(error) || runController.signal.aborted) throw error;
              // Otherwise (network blip, 5xx, 4xx like a 422 thinking-param reject,
              // etc., after pRetry exhausted): soft-fail this line, keep peers running.
              lastErrorRef.current = (error as Error)?.message || String(error);
              translatedLines[index] = line;
              if (line && line.trim()) failedLinesList.push(line);
            }
            completedCount++;
            if (completedCount % progressStep === 0 || completedCount === contentLines.length) {
              updateProgress(completedCount, contentLines.length);
            }
            if (baseDelay > 0 && completedCount < contentLines.length) {
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
      // Blank lines must NOT enter the wire text: the old code mapped each
      // blank line to the delimiter itself AND joined with the delimiter, so
      // one blank source line became TWO delimiters — the translated split
      // gained an extra slot per blank line, the first non-blank line after
      // each blank got "", and every later translation shifted down one slot
      // (silent off-by-one corruption for ASS tag-only cues and md raw mode).
      // Translate only non-blank lines; re-thread blanks by original index.
      const delimiter = translationMethodArg === "deeplx" ? "<>" : "\n";
      const sourceIdx: number[] = [];
      const nonBlankLines: string[] = [];
      for (let i = 0; i < contentLines.length; i++) {
        if (contentLines[i]?.trim()) {
          sourceIdx.push(i);
          // 内嵌换行扁平化为空格:ASS 的 \N 在 prepareAssForTranslation 中被转成
          // 真实 \n,而 chunk 路径按行 join/split 对齐 —— 一行变多行会让其后
          // 所有译文逐行错位。MT 路径丢失换行排版是可接受降级,错位不是。
          nonBlankLines.push(contentLines[i].replace(/\r?\n/g, " "));
        }
      }
      if (nonBlankLines.length === 0) return [...contentLines];

      const text = nonBlankLines.join(delimiter);
      const chunkSize = config?.chunkSize || 5000;
      const chunks = splitTextIntoChunks(text, chunkSize, delimiter);
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const translatedContent = await translateSingle(chunks[i], cacheSuffix, runtimeConfig, fullText, runController);
        translatedChunks.push(translationMethodArg === "deeplx" ? (translatedContent || "").replace(/<>/g, "\n") : translatedContent || "");
        updateProgress(i + 1, chunks.length);
        if (i < chunks.length - 1) await delay(config?.delayTime || 200);
      }

      const translatedNonBlank = translatedChunks.join("\n").split("\n");
      // Reassemble: translation k lands at its original index; blank source
      // lines pass through verbatim. If the service changed the line count
      // (merged/split lines), unmatched slots keep the source text — degraded
      // but never SHIFTED against the original structure.
      const out = [...contentLines];
      for (let k = 0; k < sourceIdx.length; k++) {
        out[sourceIdx[k]] = translatedNonBlank[k] ?? contentLines[sourceIdx[k]];
      }
      return applyGlossaryToLines(out);
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
  };

  // 行级软失败上报 —— 供自带翻译循环的工具(JSONTranslator)使用:计入失败
  // 面板 + 标记本轮失败,与 hook 内部软失败路径走同一通道。没有它,JSON 工具
  // 的单节点瞬时失败只能 abort 整个语言(丢弃全部已完成节点)或静默吞掉。
  const recordLineFailure = (line: string, reason?: string) => {
    runHadFailuresRef.current = true;
    setFailedCount((prev) => prev + 1);
    setFailedLines((prev) => [...prev, line]);
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

  // Translation handlers
  // Returns true when the run fully succeeded (no line- OR lang-level failures), so a
  // caller that owns its own success messaging (e.g. MD single-file) can show a
  // completion toast WITHOUT contradicting the failure panel/error toasts.
  const runTranslation = async (performTranslation: PerformTranslation, sourceText: string, documentType?: "subtitle" | "markdown" | "generic"): Promise<boolean> => {
    setTranslatedText("");
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
    try {
      const isValid = await validate();
      if (!isValid) return false;
      await performTranslation(sourceText, undefined, undefined, undefined, documentType);
      return !runHadFailuresRef.current;
    } finally {
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
    isTranslating,
    setIsTranslating,
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
    buildTranslationSystemPrompt,
    applyGlossary,
  };
};

export default useTranslationState;
