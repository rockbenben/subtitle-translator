"use client";

import { useState } from "react";
import { App } from "antd";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import useFileUpload from "@/app/hooks/useFileUpload";
import {
  generateCacheSuffix,
  checkLanguageSupport,
  splitTextIntoChunks,
  testTranslation,
  useTranslation,
  defaultConfigs,
  isConfigStructureValid,
  LLM_MODELS,
  DEFAULT_SYS_PROMPT,
  DEFAULT_USER_PROMPT,
  type TranslateTextParams,
  type TranslationConfig,
} from "@/app/lib/translation";
import { getRetryConfig, delay, extractTranslatedLinesWithNumbers, buildContextPrompt, exportTranslationSettings, createSettingsFileInput, type TranslationSettings } from "@/app/hooks/translation";
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
  const [translationConfigs, setTranslationConfigs] = useLocalStorage<TranslationConfigs>("translationConfigs", defaultConfigs as unknown as TranslationConfigs);
  const [sysPrompt, setSysPrompt] = useLocalStorage<string>("sysPrompt", DEFAULT_SYS_PROMPT);
  const [userPrompt, setUserPrompt] = useLocalStorage<string>("userPrompt", DEFAULT_USER_PROMPT);
  const [sourceLanguage, setSourceLanguage] = useLocalStorage<string>("sourceLanguage", "auto");
  const [targetLanguage, setTargetLanguage] = useLocalStorage<string>("targetLanguage", "zh");
  const [target_langs, setTarget_langs] = useLocalStorage<string[]>("target_langs", ["zh"]);
  const [removeChars, setRemoveChars] = useLocalStorage<string>("removeChars", "");
  const [multiLanguageMode, setMultiLanguageMode] = useLocalStorage<boolean>("multiLanguageMode", false);
  const [translatedText, setTranslatedText] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");
  const [translateInProgress, setTranslateInProgress] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);

  const effectiveSysPrompt = sysPrompt.trim() ? sysPrompt : DEFAULT_SYS_PROMPT;
  const effectiveUserPrompt = userPrompt.trim() ? userPrompt : DEFAULT_USER_PROMPT;

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
      if (!currentConfig) return prev;
      return {
        ...prev,
        [method]: { ...currentConfig, [field]: value } as TranslationConfig,
      };
    });
  };

  const resetTranslationConfig = (key: string) => {
    setTranslationConfigs((prevConfigs) => {
      const oldConfig = prevConfigs[key] || {};
      const defaultConfig = (defaultConfigs as unknown as TranslationConfigs)[key];
      return {
        ...prevConfigs,
        [key]: {
          ...defaultConfig,
          ...(oldConfig.apiKey !== undefined ? { apiKey: oldConfig.apiKey } : {}),
        },
      };
    });
  };

  const getCurrentConfig = (): TranslationConfig => {
    let effectiveMethod = translationMethod;
    if (!translationConfigs[effectiveMethod] && !(defaultConfigs as unknown as TranslationConfigs)[effectiveMethod]) {
      setTranslationMethod(DEFAULT_API);
      effectiveMethod = DEFAULT_API;
    }

    const currentConfig = translationConfigs[effectiveMethod];
    const defaultConfig = (defaultConfigs as unknown as TranslationConfigs)[effectiveMethod];

    if (!currentConfig || !isConfigStructureValid(currentConfig as Record<string, unknown>, defaultConfig as Record<string, unknown>)) {
      resetTranslationConfig(effectiveMethod);
      return defaultConfig;
    }

    return currentConfig;
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
        let errorMessage;
        switch (translationMethod) {
          case "deeplx":
            errorMessage = t("deepLXUnavailable");
            setTranslationMethod(DEFAULT_API);
            break;
          case "deepl":
            errorMessage = t("deeplUnavailable");
            break;
          case "llm":
            errorMessage = t("llmUnavailable");
            break;
          case "gtxFreeAPI":
            errorMessage = "GTX Free 接口当前不可用，请检查您的网络连接。The free Google Translate API (GTX) is currently unavailable. Please check your network connection.";
            break;
          default:
            errorMessage = t("translationError");
        }
        message.open({ type: "error", content: errorMessage, duration: 10 });
        setTranslateInProgress(false);
        return false;
      }
      setTranslateInProgress(false);
    }

    return true;
  };

  // Retry translation with config
  const retryTranslate = async (text: string, cacheSuffix: string, config: TranslationRuntimeConfig) => {
    const retryConfig = getRetryConfig(config.translationMethod);

    const translateParams: TranslateTextParams = {
      text,
      cacheSuffix,
      translationMethod: config.translationMethod,
      targetLanguage: config.targetLanguage,
      sourceLanguage: config.sourceLanguage,
      ...(config.useCache !== undefined ? { useCache: config.useCache } : {}),
      ...(config.apiKey !== undefined ? { apiKey: config.apiKey } : {}),
      ...(config.region !== undefined ? { region: config.region } : {}),
      ...(config.url !== undefined ? { url: config.url } : {}),
      ...(config.model !== undefined ? { model: config.model } : {}),
      ...(config.apiVersion !== undefined ? { apiVersion: config.apiVersion } : {}),
      ...(config.temperature !== undefined ? { temperature: config.temperature } : {}),
      ...(config.sysPrompt !== undefined ? { sysPrompt: config.sysPrompt } : {}),
      ...(config.userPrompt !== undefined ? { userPrompt: config.userPrompt } : {}),
      ...(config.translationMethod === "deepseek" && config.useRelay !== undefined ? { useRelay: config.useRelay } : {}),
    };

    try {
      return await pRetry(
        async () => {
          return translate(translateParams);
        },
        {
          ...retryConfig,
          onFailedAttempt: async ({ error, attemptNumber, retriesLeft }) => {
            const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
            console.warn(`Translation attempt ${attemptNumber} failed for "${textPreview}": ${(error as Error).message} (${retriesLeft} retries left)`);

            const errorStatus = (error as { status?: number })?.status;
            const errorMessage = (error as Error)?.message?.toLowerCase();

            if (errorStatus === 429 || errorMessage?.includes("rate limit")) {
              const delayMs = Math.min(1000 * Math.pow(2, attemptNumber), 30000);
              console.log(`Rate limit detected, waiting ${delayMs}ms before retry...`);
              await delay(delayMs);
            }
          },
        }
      );
    } catch (error) {
      const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
      console.warn(`All translation attempts failed for: "${textPreview}". Using original text.`, error);
      return text;
    }
  };

  // Context-aware translation
  const translateWithContext = async (
    contentLines: string[],
    translationConfig: TranslationRuntimeConfig,
    cacheSuffix: string,
    updateProgress: (current: number, total: number) => void,
    documentType: "subtitle" | "markdown" | "generic" = "subtitle"
  ) => {
    const contextWindow = Math.min(translationConfig.contextWindow || 20, contentLines.length);
    const contextPadding = Math.min(MAX_CONTEXT_PADDING, Math.max(1, Math.floor(contextWindow / 2)));
    const translatedLines = new Array(contentLines.length);

    for (let i = 0; i < contentLines.length; i += contextWindow) {
      const batchEnd = Math.min(i + contextWindow, contentLines.length);
      const contextStart = Math.max(0, i - contextPadding);
      const contextEnd = Math.min(contentLines.length, batchEnd + contextPadding);
      const contextLines = contentLines.slice(contextStart, contextEnd);
      const targetStartIndex = i - contextStart;
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
        const result = await retryTranslate(contextWithMarkers, cacheSuffix, {
          ...translationConfig,
          userPrompt: buildContextPrompt(contextWithMarkers, effectiveUserPrompt, batchEnd - i, documentType),
        });

        const translatedBatch = extractTranslatedLinesWithNumbers(result || "", batchEnd - i);

        for (let j = 0; j < translatedBatch.length; j++) {
          if (i + j < contentLines.length && translatedBatch[j]) {
            translatedLines[i + j] = translatedBatch[j];
          }
        }

        updateProgress(batchEnd, contentLines.length);
        if (batchEnd < contentLines.length) {
          await delay(translationConfig.delayTime || 500);
        }
      } catch (error) {
        console.warn(`Context translation failed for batch ${i}-${batchEnd}, falling back to individual translation`, error);
        for (let j = i; j < batchEnd; j++) {
          try {
            translatedLines[j] = await retryTranslate(contentLines[j], cacheSuffix, translationConfig);
          } catch (lineError) {
            console.error(`Failed to translate line ${j}:`, lineError);
            translatedLines[j] = contentLines[j];
          }
          updateProgress(j + 1, contentLines.length);
          if (j < batchEnd - 1) await delay(translationConfig.delayTime || 200);
        }
      }
    }

    // Fill missing translations with original text
    for (let i = 0; i < translatedLines.length; i++) {
      if (!translatedLines[i]) translatedLines[i] = contentLines[i];
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
    documentType?: "subtitle" | "markdown" | "generic"
  ) => {
    const config = getCurrentConfig();
    const concurrency = Math.max(Number(config?.batchSize) || 10, 1);
    const baseDelay = config?.delayTime || 200;
    const limit = pLimit(concurrency);

    try {
      if (!contentLines.length) return [];

      const updateProgress = (current: number, total: number) => {
        const progress = ((fileIndex + current / total) / totalFiles) * 100;
        setProgressPercent(progress);
      };

      const translationConfig: TranslationRuntimeConfig = {
        translationMethod: translationMethodArg,
        targetLanguage: currentTargetLang,
        sourceLanguage,
        useCache,
        ...config,
        sysPrompt: effectiveSysPrompt,
        userPrompt: effectiveUserPrompt,
      };

      const cacheSuffix = await generateCacheSuffix(sourceLanguage, currentTargetLang, translationMethodArg, {
        model: config?.model,
        temperature: config?.temperature,
        sysPrompt: effectiveSysPrompt,
        userPrompt: effectiveUserPrompt,
      });

      // Context-aware translation with LLM
      if (documentType && LLM_MODELS.includes(translationMethodArg) && contentLines.length > 1) {
        return await translateWithContext(contentLines, translationConfig, cacheSuffix, updateProgress, documentType);
      }

      if (config?.chunkSize === undefined) {
        // Line-by-line concurrent translation
        const translatedLines = new Array(contentLines.length);
        let completedCount = 0;

        const promises = contentLines.map((line, index) =>
          limit(async () => {
            translatedLines[index] = await retryTranslate(line, cacheSuffix, translationConfig);
            completedCount++;
            if (completedCount % 10 === 0 || completedCount === contentLines.length) {
              updateProgress(completedCount, contentLines.length);
            }
            if (baseDelay > 0 && completedCount < contentLines.length) {
              await delay(baseDelay);
            }
          })
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
        const translatedContent = await retryTranslate(chunks[i], cacheSuffix, translationConfig);
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
    setProgressPercent(0);
    await performTranslation(sourceText, undefined, undefined, undefined, documentType);
    setTranslateInProgress(false);
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
    extractedText,
    setExtractedText,
    handleLanguageChange,
    delay,
    validateTranslate,
  };
};

export default useTranslateData;
