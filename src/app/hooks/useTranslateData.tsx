"use client";

import { useState } from "react";
import { App } from "antd";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLlmPresets } from "@/app/hooks/useLlmPresets";
import { useTranslationProgress } from "@/app/hooks/useTranslationProgress";
import {
  generateCacheSuffix,
  checkLanguageSupport,
  splitTextIntoChunks,
  testTranslation,
  useTranslation,
  defaultConfigs,
  getDefaultConfig,
  migrateConfig,
  resetConfigWithCredentials,
  LLM_MODELS,
  DEFAULT_SYS_PROMPT,
  DEFAULT_USER_PROMPT,
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
const MAX_CONTEXT_PADDING = 25;

type TranslationConfigs = Record<string, TranslationConfig>;

type PerformTranslation = (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number, documentType?: "subtitle" | "markdown" | "generic") => Promise<void>;

type TranslationRuntimeConfig = TranslationConfig & {
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  fullText?: string; // Complete text for ${fullText} variable
};

const useTranslateData = () => {
  const { message } = App.useApp();
  const tLanguages = useTranslations("languages");
  const t = useTranslations("common");
  const { translate } = useTranslation();
  const { readFile } = useFileUpload();

  // State
  const [useCache, setUseCache] = useState<boolean>(true);
  const [translationMethod, setTranslationMethod] = useLocalStorage<string>("translationMethod", DEFAULT_API);
  const [translationConfigs, setTranslationConfigs] = useLocalStorage<TranslationConfigs>("translationConfigs", defaultConfigs as TranslationConfigs);
  const [sysPrompt, setSysPrompt] = useLocalStorage<string>("sysPrompt", DEFAULT_SYS_PROMPT);
  const [userPrompt, setUserPrompt] = useLocalStorage<string>("userPrompt", DEFAULT_USER_PROMPT);
  const [sourceLanguage, setSourceLanguage] = useLocalStorage<string>("sourceLanguage", "auto");
  const [targetLanguage, setTargetLanguage] = useLocalStorage<string>("targetLanguage", "zh");
  const [target_langs, setTarget_langs] = useLocalStorage<string[]>("target_langs", ["zh"]);
  const [removeChars, setRemoveChars] = useLocalStorage<string>("removeChars", "");
  const [multiLanguageMode, setMultiLanguageMode] = useLocalStorage<boolean>("multiLanguageMode", false);
  const [retryCount, setRetryCount] = useLocalStorage<number>("translationRetryCount", DEFAULT_RETRY_COUNT);
  const [retryTimeout, setRetryTimeout] = useLocalStorage<number>("translationRetryTimeout", DEFAULT_RETRY_TIMEOUT);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");

  const effectiveSysPrompt = sysPrompt.trim() ? sysPrompt : DEFAULT_SYS_PROMPT;
  const effectiveUserPrompt = userPrompt.trim() ? userPrompt : DEFAULT_USER_PROMPT;

  // Extracted concerns
  const { translateInProgress, setTranslateInProgress, progressPercent, setProgressPercent, progressInfo, abortControllerRef, makeUpdateProgress, resetProgress } = useTranslationProgress();

  const { llmPresets, setLlmPresets, activePresetId, saveLlmPreset, loadLlmPreset, deleteLlmPreset, renameLlmPreset, updateLlmPreset } = useLlmPresets({
    translationConfigs,
    setTranslationConfigs,
    effectiveSysPrompt,
    effectiveUserPrompt,
    setSysPrompt,
    setUserPrompt,
  });

  // Settings export/import
  const exportSettings = async () => {
    try {
      await exportTranslationSettings({
        translationConfigs,
        sysPrompt: effectiveSysPrompt,
        userPrompt: effectiveUserPrompt,
        translationMethod,
        sourceLanguage,
        targetLanguage,
        target_langs,
        multiLanguageMode,
        llmPresets,
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
      if (settings.sysPrompt !== undefined) setSysPrompt(settings.sysPrompt);
      if (settings.userPrompt !== undefined) setUserPrompt(settings.userPrompt);
      if (settings.translationMethod !== undefined) setTranslationMethod(settings.translationMethod);
      if (settings.sourceLanguage !== undefined) setSourceLanguage(settings.sourceLanguage);
      if (settings.targetLanguage !== undefined) setTargetLanguage(settings.targetLanguage);
      if (settings.target_langs !== undefined) setTarget_langs(settings.target_langs);
      if (settings.multiLanguageMode !== undefined) setMultiLanguageMode(settings.multiLanguageMode);
      if (settings.llmPresets !== undefined) setLlmPresets(settings.llmPresets);
      message.success(t("importSettingSuccess"));
    }, readFile).catch((error) => {
      console.error("Import settings error:", error);
      message.error(t("importSettingError"));
    });
  };

  // Config management
  const handleConfigChange = (method: string, field: string, value: string | number | boolean) => {
    setTranslationConfigs((prev) => {
      const currentConfig = prev[method];
      const defaultConfig = getDefaultConfig(method);

      const baseConfig = migrateConfig(currentConfig, defaultConfig);
      return {
        ...prev,
        [method]: { ...baseConfig, [field]: value } as TranslationConfig,
      };
    });
  };

  const resetTranslationConfig = (key: string) => {
    setTranslationConfigs((prevConfigs) => ({
      ...prevConfigs,
      [key]: resetConfigWithCredentials(prevConfigs[key], getDefaultConfig(key)),
    }));
  };

  // Pure function: Returns valid config without calling setState during render
  const getCurrentConfig = (): TranslationConfig => {
    // If selected translationMethod doesn't exist in defaults (e.g. stale key in localStorage like "aliyun" -> "qwenMt")
    let effectiveMethod = translationMethod;
    if (!getDefaultConfig(effectiveMethod)) {
      effectiveMethod = DEFAULT_API;
    }

    const currentConfig = translationConfigs[effectiveMethod];
    const defaultConfig = getDefaultConfig(effectiveMethod);

    // Merge defaults in without resetting user choices. migrateConfig is idempotent
    // and side-effect free — safe to call during render. localStorage gets
    // written back next time the user changes a setting.
    return migrateConfig(currentConfig, defaultConfig);
  };

  // Language management
  const handleLanguageChange = (type: "source" | "target", value: string) => {
    const otherValue = type === "source" ? targetLanguage : sourceLanguage;
    if (value === otherValue) {
      if (type === "source") {
        const newTargetValue = value === "zh" ? "en" : "zh";
        setSourceLanguage(value);
        setTargetLanguage(newTargetValue);
        message.error(`${t("sameLanguageTarget")} ${newTargetValue === "zh" ? tLanguages("chinese") : tLanguages("english")}`);
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

  // Validation
  const validateTranslate = async () => {
    const config = getCurrentConfig();
    if (config && "apiKey" in config && !config.apiKey && translationMethod !== "llm") {
      message.error(t("enterApiKey"));
      return false;
    }

    if (translationMethod === "llm" && !config.url) {
      message.error(t("enterLlmUrl"));
      return false;
    }

    if (!multiLanguageMode) {
      const result = checkLanguageSupport(translationMethod, sourceLanguage, targetLanguage);
      if (!result.supported) {
        if (result.errorMessage) message.error({ content: result.errorMessage, duration: 10 });
        setTranslationMethod(DEFAULT_API);
        return false;
      }
    } else {
      for (const lang of target_langs) {
        const result = checkLanguageSupport(translationMethod, sourceLanguage, lang);
        if (!result.supported) {
          if (result.errorMessage) message.error({ content: result.errorMessage, duration: 10 });
          setTranslationMethod(DEFAULT_API);
          return false;
        }
      }
    }

    if (["deepl", "deeplx", "llm", "gtxFreeAPI"].includes(translationMethod)) {
      setTranslateInProgress(true);
      setProgressPercent(1);
      const tempSysPrompt = translationMethod === "llm" ? effectiveSysPrompt : undefined;
      const tempUserPrompt = translationMethod === "llm" ? effectiveUserPrompt : undefined;
      const testResult = await testTranslation(translationMethod, config, tempSysPrompt, tempUserPrompt);
      if (testResult !== true) {
        const errorMessages: Record<string, string> = {
          deeplx: t("deepLXUnavailable"),
          deepl: t("deeplUnavailable"),
          llm: t("llmUnavailable"),
          gtxFreeAPI: "GTX Free 接口当前不可用，请检查您的网络连接。The free Google Translate API (GTX) is currently unavailable. Please check your network connection.",
        };
        if (translationMethod === "deeplx") setTranslationMethod(DEFAULT_API);
        message.open({ type: "error", content: errorMessages[translationMethod] || t("translationError"), duration: 10 });
        setTranslateInProgress(false);
        return false;
      }
      setTranslateInProgress(false);
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

    const userRetryConfig: UserRetryConfig = { retryCount, retryTimeout };
    const retryConfig = getRetryConfig(config.translationMethod, userRetryConfig);
    const timeoutMs = retryTimeout * 1000;

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
    const optionalFields = ["useCache", "apiKey", "region", "url", "model", "apiVersion", "temperature", "sysPrompt", "userPrompt", "useRelay", "enableThinking", "domains"] as const;
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
    translationConfig: TranslationRuntimeConfig,
    cacheSuffix: string,
    updateProgress: (current: number, total: number) => void,
    documentType: "subtitle" | "markdown" | "generic" = "subtitle",
    fullText?: string,
  ) => {
    const initialContextWindow = Math.min(translationConfig.contextWindow || 20, contentLines.length);
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
            ...translationConfig,
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

      // Reduce context window and retry incomplete sub-batches (up to MAX_CONTEXT_RETRIES times)
      let currentWindow = contextWindow;
      for (let attempt = 0; attempt < MAX_CONTEXT_RETRIES && currentWindow > 5; attempt++) {
        currentWindow = Math.max(5, Math.floor(currentWindow / 2));
        console.warn(`Batch ${batchStart + 1}-${batchEnd} incomplete, reducing context window to ${currentWindow}`);

        for (let subStart = batchStart; subStart < batchEnd; subStart += currentWindow) {
          const subEnd = Math.min(subStart + currentWindow, batchEnd);
          if (translatedLines.slice(subStart, subEnd).includes(undefined)) {
            if (!(await translateSingleBatch(subStart, subEnd, currentWindow))) {
              // Sub-batch still failed at this window size, continue reducing
            }
          }
        }

        if (!translatedLines.slice(batchStart, batchEnd).includes(undefined)) return true;
      }

      return false;
    };

    // Show non-zero progress immediately so users see the modal is alive
    // (a single LLM batch can take 20-60s before the first updateProgress call)
    updateProgress(0.5, contentLines.length);

    // Main loop: process batches
    for (let i = 0; i < contentLines.length; i += initialContextWindow) {
      const batchEnd = Math.min(i + initialContextWindow, contentLines.length);

      const success = await translateBatch(i, batchEnd, initialContextWindow);

      if (!success) {
        // Individual line fallback for any remaining untranslated lines
        console.warn(`Batch ${i + 1}-${batchEnd} requires individual translation fallback`);
        for (let j = i; j < batchEnd; j++) {
          if (translatedLines[j]) continue; // Skip already translated

          try {
            translatedLines[j] = await retryTranslate(contentLines[j], cacheSuffix, translationConfig, fullText);
          } catch (lineError) {
            throw lineError; // Fail-stop
          }
          // Use the monotonic total count across all batches so progress can't
          // regress (j+1 is local to this batch and may lag actual completions).
          updateProgress(translatedLines.filter(Boolean).length, contentLines.length);
          if (j < batchEnd - 1) await delay(translationConfig.delayTime || 200);
        }
      }

      updateProgress(batchEnd, contentLines.length);
      if (batchEnd < contentLines.length) {
        await delay(translationConfig.delayTime || 500);
      }
    }

    // Final validation - this should rarely happen as individual fallback should catch everything
    for (let i = 0; i < translatedLines.length; i++) {
      if (!translatedLines[i]) {
        throw new Error(
          `翻译失败：第 ${i + 1} 行在多次重试后仍未成功翻译，请检查 API 设置或稍后重试。\n` +
            `Translation failed: Line ${i + 1} could not be translated after multiple retries. Please check API settings or retry later.`,
        );
      }
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
    const config = getCurrentConfig();
    const concurrency = Math.max(Number(config?.batchSize) || 10, 1);
    const baseDelay = config?.delayTime || 200;
    const limit = pLimit(concurrency);

    try {
      if (!contentLines.length) return [];

      // Initialize new abort controller for this translation batch
      abortControllerRef.current = new AbortController();

      const updateProgress = makeUpdateProgress(fileIndex, totalFiles);

      const translationConfig: TranslationRuntimeConfig = {
        translationMethod: translationMethodArg,
        targetLanguage: currentTargetLang,
        sourceLanguage,
        useCache,
        ...config,
        sysPrompt: effectiveSysPrompt,
        userPrompt: effectiveUserPrompt,
      };

      // Only create fullText if the prompt uses ${fullText} variable
      const fullText = effectiveUserPrompt.includes("${fullText}") ? contentLines.join("\n") : undefined;

      const cacheSuffix = await generateCacheSuffix(sourceLanguage, currentTargetLang, translationMethodArg, {
        model: config?.model,
        temperature: config?.temperature,
        sysPrompt: effectiveSysPrompt,
        userPrompt: effectiveUserPrompt,
      });

      // Context-aware translation with LLM
      if (documentType && LLM_MODELS.includes(translationMethodArg) && contentLines.length > 1) {
        return await translateWithContext(contentLines, translationConfig, cacheSuffix, updateProgress, documentType, fullText);
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
              translatedLines[index] = await retryTranslate(line, cacheSuffix, translationConfig, fullText);
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
        const translatedContent = await retryTranslate(chunks[i], cacheSuffix, translationConfig, fullText);
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
    if (!sourceText.trim()) {
      message.error("No source text provided.");
      return;
    }

    const isValid = await validateTranslate();
    if (!isValid) return;

    setTranslateInProgress(true);
    resetProgress();
    try {
      await performTranslation(sourceText, undefined, undefined, undefined, documentType);
    } finally {
      setTranslateInProgress(false);
    }
  };

  return {
    exportSettings,
    importSettings,
    translationMethod,
    setTranslationMethod,
    translationConfigs,
    getCurrentConfig,
    handleConfigChange,
    resetTranslationConfig,
    sysPrompt,
    setSysPrompt,
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
    target_langs,
    setTarget_langs,
    multiLanguageMode,
    setMultiLanguageMode,
    translatedText,
    setTranslatedText,
    translateInProgress,
    setTranslateInProgress,
    progressPercent,
    setProgressPercent,
    progressInfo,
    extractedText,
    setExtractedText,
    handleLanguageChange,
    delay,
    retryCount,
    setRetryCount,
    retryTimeout,
    setRetryTimeout,
    validateTranslate,
    llmPresets,
    activePresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    renameLlmPreset,
    updateLlmPreset,
  };
};

export default useTranslateData;
