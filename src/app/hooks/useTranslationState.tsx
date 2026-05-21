"use client";

import { useState } from "react";
import { App } from "antd";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLlmPresets } from "@/app/hooks/useLlmPresets";
import { usePromptPresets } from "@/app/hooks/usePromptPresets";
import { useTranslationProgress } from "@/app/hooks/useTranslationProgress";
import {
  generateCacheSuffix,
  checkLanguageSupport,
  splitTextIntoChunks,
  testTranslation,
  useTranslation,
  defaultConfigs,
  getDefaultConfig,
  getThinkingModelPattern,
  migrateConfig,
  resetConfigWithCredentials,
  LLM_MODELS,
  URL_IS_PRIMARY_CRED,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  translategemmaHealthCheck,
  type TranslateTextParams,
  type TranslationConfig,
} from "@/app/lib/translation";
import {
  getRetryConfig,
  delay,
  extractTranslatedLinesWithNumbers,
  buildContextPrompt,
  exportTranslationSettings,
  createSettingsFileInput,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_TIMEOUT,
  isAuthError,
  type TranslationSettings,
  type UserRetryConfig,
} from "@/app/hooks/translation";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { useTranslations } from "next-intl";

const DEFAULT_API = "gtxFreeAPI";
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
  const [translationMethod, setTranslationMethod] = useLocalStorage<string>("translation-method", DEFAULT_API);
  const [translationConfigs, setTranslationConfigs] = useLocalStorage<TranslationConfigs>("translation-configs", defaultConfigs as TranslationConfigs);
  const [systemPrompt, setSystemPrompt] = useLocalStorage<string>("translation-systemPrompt", DEFAULT_SYSTEM_PROMPT);
  const [userPrompt, setUserPrompt] = useLocalStorage<string>("translation-userPrompt", DEFAULT_USER_PROMPT);
  const [sourceLanguage, setSourceLanguage] = useLocalStorage<string>("translation-sourceLanguage", "auto");
  const [targetLanguage, setTargetLanguage] = useLocalStorage<string>("translation-targetLanguage", "zh");
  const [targetLanguages, setTargetLanguages] = useLocalStorage<string[]>("translation-targetLanguages", ["zh"]);
  const [removeChars, setRemoveChars] = useLocalStorage<string>("translation-removeChars", "");
  const [multiLanguageMode, setMultiLanguageMode] = useLocalStorage<boolean>("translation-multiLanguageMode", false);
  const [retryCount, setRetryCount] = useLocalStorage<number>("translation-retryCount", DEFAULT_RETRY_COUNT);
  // Per-request timeout in seconds (fetch signal setTimeout).
  const [requestTimeoutSec, setRequestTimeoutSec] = useLocalStorage<number>("translation-requestTimeoutSec", DEFAULT_RETRY_TIMEOUT);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  // Soft-failure telemetry: count and original text of lines that failed
  // even after the 10s auto-retry pass. UI uses these to show an Alert
  // with a retry button; re-clicking Translate hits the IndexedDB cache
  // for successful lines, only re-requesting the failed ones.
  const [translateFailedCount, setTranslateFailedCount] = useState<number>(0);
  const [translateFailedLines, setTranslateFailedLines] = useState<string[]>([]);

  const effectiveSystemPrompt = systemPrompt.trim() ? systemPrompt : DEFAULT_SYSTEM_PROMPT;
  const effectiveUserPrompt = userPrompt.trim() ? userPrompt : DEFAULT_USER_PROMPT;

  // Extracted concerns
  const { isTranslating, setIsTranslating, progressPercent, setProgressPercent, progressInfo, abortControllerRef, makeUpdateProgress, resetProgress } = useTranslationProgress();

  const { llmPresets, setLlmPresets, activeLlmPresetId, saveLlmPreset, loadLlmPreset, deleteLlmPreset, renameLlmPreset, updateLlmPreset } = useLlmPresets({
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
        promptPresets,
        activePromptPresetId,
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
      if (settings.promptPresets !== undefined) setPromptPresets(settings.promptPresets);
      if (settings.activePromptPresetId !== undefined) setActivePromptPresetId(settings.activePromptPresetId);
      message.success(t("importSettingSuccess"));
    }, readFile).catch((error) => {
      console.error("Import settings error:", error);
      message.error(t("importSettingError"));
    });
  };

  // Config management
  const handleConfigChange = (method: string, field: string, value: string | number | boolean) => {
    setTranslationConfigs((prev) => {
      const existingConfig = prev[method];
      const defaultConfig = getDefaultConfig(method);

      const baseConfig = migrateConfig(existingConfig, defaultConfig);
      const next = { ...baseConfig, [field]: value } as TranslationConfig;

      // When the model field changes on a service with model-conditional thinking
      // (e.g. DeepSeek: only deepseek-v4-pro supports thinking), strip stale
      // enableThinking + reasoningEffort so they don't ghost-activate after
      // switching back later.
      if (field === "model") {
        const pattern = getThinkingModelPattern(method);
        if (pattern && !pattern.test(String(value))) {
          if (next.enableThinking !== undefined) delete next.enableThinking;
          if (next.reasoningEffort !== undefined) delete next.reasoningEffort;
        }
      }

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
      return;
    }
    if (type === "source" && value !== sourceLanguage) {
      setSourceLanguage(value);
    } else if (type === "target" && value !== targetLanguage) {
      setTargetLanguage(value);
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
  };

  // Validation
  const validateTranslate = async () => {
    const config = getSelectedConfig();
    // URL_IS_PRIMARY_CRED services treat URL as the credential — apiKey can be
    // empty (local LM Studio / llama.cpp typically don't require a key).
    if (config && "apiKey" in config && !config.apiKey && !URL_IS_PRIMARY_CRED.has(translationMethod)) {
      message.error(t("enterApiKey"));
      return false;
    }

    if (URL_IS_PRIMARY_CRED.has(translationMethod) && !(config.url as string | undefined)?.trim()) {
      message.error(t("enterApiUrl"));
      return false;
    }

    if (!multiLanguageMode) {
      const result = checkLanguageSupport(translationMethod, sourceLanguage, targetLanguage);
      if (!result.supported) {
        if (result.errorMessage) message.error({ content: result.errorMessage, duration: 10 });
        // preserveMethod=true means the user just needs to fix their input
        // (e.g. pick an explicit source language) — keep their chosen method
        // instead of silently falling back to GTX.
        if (!result.preserveMethod) setTranslationMethod(DEFAULT_API);
        return false;
      }
    } else {
      for (const lang of targetLanguages) {
        const result = checkLanguageSupport(translationMethod, sourceLanguage, lang);
        if (!result.supported) {
          if (result.errorMessage) message.error({ content: result.errorMessage, duration: 10 });
          if (!result.preserveMethod) setTranslationMethod(DEFAULT_API);
          return false;
        }
      }
    }

    if (["deepl", "deeplx", "llm", "gtxFreeAPI", "translategemma"].includes(translationMethod)) {
      setIsTranslating(true);
      setProgressPercent(1);
      // translategemma uses a lightweight reachability check (GET /v1/models)
      // instead of full inference — avoids the 5-30s wait for cold-start model
      // loading on LM Studio. Catches the common "server not running" case fast.
      let testResult: boolean;
      if (translationMethod === "translategemma") {
        testResult = await translategemmaHealthCheck(config.url as string);
      } else {
        const tempSystemPrompt = translationMethod === "llm" ? effectiveSystemPrompt : undefined;
        const tempUserPrompt = translationMethod === "llm" ? effectiveUserPrompt : undefined;
        testResult = await testTranslation(translationMethod, config, tempSystemPrompt, tempUserPrompt);
      }
      if (testResult !== true) {
        const errorMessages: Record<string, string> = {
          deeplx: t("deepLXUnavailable"),
          deepl: t("deeplUnavailable"),
          llm: t("llmUnavailable"),
          gtxFreeAPI: t("gtxFreeAPIUnavailable"),
          translategemma: t("translategemmaUnavailable"),
        };
        if (translationMethod === "deeplx") setTranslationMethod(DEFAULT_API);
        message.open({ type: "error", content: errorMessages[translationMethod] || t("translationError"), duration: 10 });
        setIsTranslating(false);
        return false;
      }
      setIsTranslating(false);
    }

    return true;
  };

  // Retry translation with config - throws on failure (no fallback to original text)
  // Uses shared abortControllerRef to allow cancellation across concurrent requests
  const retryTranslate = async (text: string, cacheSuffix: string, config: TranslationRuntimeConfig, fullText?: string) => {
    // Check if already aborted (e.g., by auth error in another concurrent request)
    if (abortControllerRef.current?.signal.aborted) {
      throw new Error("Translation aborted");
    }

    const userRetryConfig: UserRetryConfig = { retryCount, requestTimeoutSec };
    const retryConfig = getRetryConfig(config.translationMethod, userRetryConfig);
    const timeoutMs = requestTimeoutSec * 1000;

    // Create per-request abort controller with timeout
    // Links to shared abort controller and auto-cleans up
    const createTimeoutController = () => {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

      // If shared controller aborts, also abort this request
      const onAbort = () => controller.abort();
      abortControllerRef.current?.signal.addEventListener("abort", onAbort, { once: true });

      return {
        controller,
        cleanup: () => {
          clearTimeout(timeoutId);
          abortControllerRef.current?.signal.removeEventListener("abort", onAbort);
        },
      };
    };

    // Build translate params - pick defined optional fields from config
    const optionalFields = ["useCache", "apiKey", "region", "url", "model", "apiVersion", "temperature", "systemPrompt", "userPrompt", "sendSystemPrompt", "useRelay", "enableThinking", "reasoningEffort", "domains"] as const;
    const extras: Record<string, unknown> = {};
    const configRecord = config as unknown as Record<string, unknown>;
    for (const key of optionalFields) {
      if (configRecord[key] !== undefined) {
        extras[key] = configRecord[key];
      }
    }
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
          // Check abort before each attempt
          if (abortControllerRef.current?.signal.aborted) {
            throw new Error("Translation aborted");
          }

          const { controller, cleanup } = createTimeoutController();

          try {
            const result = await translate({ ...translateParams, signal: controller.signal });
            cleanup();
            return result;
          } catch (error) {
            cleanup();

            // Check if this is an auth error - abort all concurrent requests
            if (isAuthError(error)) {
              abortControllerRef.current?.abort();
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
  ) => {
    // Clamp to >= 1: `|| 20` only catches 0/null/undefined, not negatives.
    // A negative contextWindow (from corrupted localStorage or bad migration)
    // would make the main loop `i += -5` → infinite loop.
    const initialContextWindow = Math.max(1, Math.min(runtimeConfig.contextWindow || 20, contentLines.length));
    const translatedLines = new Array(contentLines.length);
    const MAX_CONTEXT_RETRIES = 2; // Maximum times to reduce context window

    // Inner function to translate a batch with a specific context window size
    // Translate a single batch with context markers, returns true if all lines translated
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
        const result = await retryTranslate(
          contextWithMarkers,
          cacheSuffix,
          {
            ...runtimeConfig,
            userPrompt: buildContextPrompt(contextWithMarkers, effectiveUserPrompt, batchEnd - batchStart, documentType),
          },
          fullText,
        );

        const translatedBatch = extractTranslatedLinesWithNumbers(result || "", batchEnd - batchStart);
        for (let j = 0; j < translatedBatch.length; j++) {
          if (batchStart + j < contentLines.length && translatedBatch[j]) {
            translatedLines[batchStart + j] = translatedBatch[j];
          }
        }

        // Reflect partial progress as soon as the batch returns, so the bar doesn't
        // sit at 0% for the full duration of each 50-line LLM call.
        const doneSoFar = translatedLines.filter(Boolean).length;
        if (doneSoFar > 0) updateProgress(doneSoFar, contentLines.length);

        return !translatedLines.slice(batchStart, batchEnd).includes(undefined);
      } catch (error) {
        if (isAuthError(error)) throw error;
        console.warn(`Batch ${batchStart + 1}-${batchEnd} translation error:`, error);
        return false;
      }
    };

    // Iterative batch translation with context window reduction (replaces recursion)
    const translateBatch = async (batchStart: number, batchEnd: number, contextWindow: number): Promise<boolean> => {
      const success = await translateSingleBatch(batchStart, batchEnd, contextWindow);
      if (success) return true;

      // Reduce context window and retry ONLY the contiguous gaps (up to MAX_CONTEXT_RETRIES times)
      // Old behavior stepped through fixed-size sub-ranges and re-translated the whole sub-range
      // if any line in it was still missing — wasting tokens on already-successful neighbors and
      // risking LLM non-determinism overwriting them with slightly different translations.
      // New behavior finds the still-empty indices, clusters them into contiguous [s, e) ranges
      // (capped at RETRY_MAX_CLUSTER_SIZE), and retranslates only those — fewer tokens, stable
      // results for the lines that already succeeded.
      let currentWindow = contextWindow;
      for (let attempt = 0; attempt < MAX_CONTEXT_RETRIES && currentWindow > 5; attempt++) {
        currentWindow = Math.max(5, Math.floor(currentWindow / 2));

        const missing: number[] = [];
        for (let k = batchStart; k < batchEnd; k++) {
          if (!translatedLines[k]) missing.push(k);
        }
        if (missing.length === 0) return true;

        const gapClusters = clusterAscendingIndices(missing);
        console.warn(`Batch ${batchStart + 1}-${batchEnd} incomplete (${missing.length} line(s) missing in ${gapClusters.length} gap(s)); reducing window to ${currentWindow}`);

        for (const [gs, ge] of gapClusters) {
          if (abortControllerRef.current?.signal.aborted) return false;
          await translateSingleBatch(gs, ge, currentWindow);
        }

        if (!translatedLines.slice(batchStart, batchEnd).includes(undefined)) return true;
      }

      return false;
    };

    // Helper: group contiguous failed indices into [start, end) clusters
    // (capped so a total blowout doesn't retry as one mega-batch). Reused
    // below by the batch-level fallback and the post-pass auto-retry.
    const RETRY_MAX_CLUSTER_SIZE = 10;
    const RETRY_CONTEXT_WINDOW = 6; // ±3 neighbor lines wrapped as [CONTEXT]
    const clusterAscendingIndices = (sortedIndices: number[]): Array<[number, number]> => {
      if (sortedIndices.length === 0) return [];
      const out: Array<[number, number]> = [];
      let s = sortedIndices[0];
      let e = sortedIndices[0];
      for (let k = 1; k < sortedIndices.length; k++) {
        const idx = sortedIndices[k];
        if (idx === e + 1 && e - s + 1 < RETRY_MAX_CLUSTER_SIZE) {
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
        if (!translatedLines[i]) failed.push(i);
      }
      if (failed.length === 0) return;

      for (const [cStart, cEnd] of clusterAscendingIndices(failed)) {
        if (abortControllerRef.current?.signal.aborted) return;
        try {
          await translateSingleBatch(cStart, cEnd, RETRY_CONTEXT_WINDOW);
        } catch (err) {
          if (isAuthError(err)) throw err;
          // non-auth failures leave slots empty; final soft-fill handles them
        }
        updateProgress(translatedLines.filter(Boolean).length, contentLines.length);
      }
    };

    // Show non-zero progress immediately so users see the modal is alive
    // (a single LLM batch can take 20-60s before the first updateProgress call)
    updateProgress(0.5, contentLines.length);

    // Main loop: run batches in parallel with user-configurable concurrency.
    // Context mode uses `contextBatchSize` — each task sends ~contextWindow
    // lines to the LLM in a single heavy request, so we cap hard. Non-context
    // line-by-line mode uses the separate `batchSize` (see translateContent
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
          if (abortControllerRef.current?.signal.aborted) return;
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
          if (interBatchDelay > 0 && !abortControllerRef.current?.signal.aborted) {
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
    if (translatedLines.some((x) => !x) && !abortControllerRef.current?.signal.aborted) {
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
      if (!translatedLines[i]) {
        const original = contentLines[i];
        translatedLines[i] = original;
        if (original && original.trim()) failedLinesList.push(original);
      }
    }
    if (failedLinesList.length > 0) {
      setTranslateFailedCount((prev) => prev + failedLinesList.length);
      setTranslateFailedLines((prev) => [...prev, ...failedLinesList]);
    }

    return translatedLines;
  };

  // Main translation function
  const translateContent = async (
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

      // Initialize new abort controller for this translation batch
      abortControllerRef.current = new AbortController();

      const updateProgress = makeUpdateProgress(fileIndex, totalFiles);

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
      });

      // Context-aware translation with LLM
      if (documentType && LLM_MODELS.includes(translationMethodArg) && contentLines.length > 1) {
        return await translateWithContext(contentLines, runtimeConfig, cacheSuffix, updateProgress, documentType, fullText);
      }

      if (config?.chunkSize === undefined) {
        // Line-by-line concurrent translation
        // Note: abort logic is now handled centrally in retryTranslate via shared abortControllerRef
        const translatedLines = new Array(contentLines.length);
        let completedCount = 0;
        let aborted = false;

        // Throttle progress updates for large batches to reduce re-renders,
        // but update every item when the total is small so the bar isn't stuck at 0%.
        const progressStep = Math.max(1, Math.floor(contentLines.length / 100));
        updateProgress(0.5, contentLines.length);

        const promises = contentLines.map((line, index) =>
          limit(async () => {
            if (aborted) return;
            try {
              translatedLines[index] = await retryTranslate(line, cacheSuffix, runtimeConfig, fullText);
            } catch (error) {
              aborted = true;
              throw error;
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
        return translatedLines;
      }

      // Chunk-based translation
      const delimiter = translationMethodArg === "deeplx" ? "<>" : "\n";
      const nonEmptyLines = contentLines.map((line) => (line.trim() ? line : delimiter));
      const text = nonEmptyLines.join(delimiter);
      const chunkSize = config?.chunkSize || 5000;
      const chunks = splitTextIntoChunks(text, chunkSize, delimiter);
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const translatedContent = await retryTranslate(chunks[i], cacheSuffix, runtimeConfig, fullText);
        translatedChunks.push(translationMethodArg === "deeplx" ? (translatedContent || "").replace(/<>/g, "\n") : translatedContent || "");
        updateProgress(i + 1, chunks.length);
        if (i < chunks.length - 1) await delay(config?.delayTime || 200);
      }

      const result = translatedChunks.join("\n").split("\n");
      return result.map((line, index) => (contentLines[index]?.trim() ? line : contentLines[index] || line));
    } catch (error) {
      console.error("Error translating content:", error);
      throw error;
    }
  };

  // Translation handlers
  const handleTranslate = async (performTranslation: PerformTranslation, sourceText: string, documentType?: "subtitle" | "markdown" | "generic") => {
    setTranslatedText("");
    // Reset soft-failure state for this run — the UI Alert is driven by these.
    setTranslateFailedCount(0);
    setTranslateFailedLines([]);
    if (!sourceText.trim()) {
      message.error("No source text provided.");
      return;
    }

    const isValid = await validateTranslate();
    if (!isValid) return;

    setIsTranslating(true);
    resetProgress();
    try {
      await performTranslation(sourceText, undefined, undefined, undefined, documentType);
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
    retryTranslate,
    translateContent,
    handleTranslate,
    sourceLanguage,
    targetLanguage,
    targetLanguages,
    setTargetLanguages,
    multiLanguageMode,
    setMultiLanguageMode,
    translatedText,
    setTranslatedText,
    translateFailedCount,
    translateFailedLines,
    isTranslating,
    setIsTranslating,
    progressPercent,
    setProgressPercent,
    progressInfo,
    extractedText,
    setExtractedText,
    handleLanguageChange,
    handleSwapLanguages,
    retryCount,
    setRetryCount,
    requestTimeoutSec,
    setRequestTimeoutSec,
    validateTranslate,
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
  };
};

export default useTranslationState;
