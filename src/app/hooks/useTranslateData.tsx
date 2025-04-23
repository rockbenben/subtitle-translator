"use client";

import { useState, useEffect } from "react";
import { message } from "antd";
import { loadFromLocalStorage, saveToLocalStorage } from "@/app/utils/localStorageUtils";
import { generateCacheSuffix, checkLanguageSupport, splitTextIntoChunks, testTranslation, useTranslation, defaultConfigs, isConfigStructureValid } from "@/app/components/translateAPI";
import pLimit from "p-limit";
import pRetry from "p-retry";
import { useTranslations } from "next-intl";

const DEFAULT_SYS_PROMPT = "You are a professional translator. Respond only with the content, either translated or rewritten. Do not add explanations, comments, or any extra text.";
const DEFAULT_USER_PROMPT = "Please respect the original meaning, maintain the original format, and rewrite the following content in ${targetLanguage}.\n\n${content}";
const DEFAULT_API = "gtxFreeAPI";

const useTranslateData = () => {
  const tLanguages = useTranslations("languages");
  const t = useTranslations("common");
  const { translate } = useTranslation();
  const [translationMethod, setTranslationMethod] = useState<string>(DEFAULT_API);
  // ["google", "gtxFreeAPI", "webgoogletranslate", "deepseek"] 没有 chuckSize 则逐行翻译
  const [translationConfigs, setTranslationConfigs] = useState(defaultConfigs);
  const [sysPrompt, setSysPrompt] = useState<string>(DEFAULT_SYS_PROMPT);
  const [userPrompt, setUserPrompt] = useState<string>(DEFAULT_USER_PROMPT);

  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("zh");
  const [target_langs, setTarget_langs] = useState<string[]>(["zh"]);
  const [useCache, setUseCache] = useState<boolean>(true);

  const [translatedText, setTranslatedText] = useState<string>("");
  const [extractedText, setExtractedText] = useState<string>("");

  const [isClient, setIsClient] = useState(false);
  const [translateInProgress, setTranslateInProgress] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [multiLanguageMode, setMultiLanguageMode] = useState<boolean>(false);

  // Load from localStorage
  useEffect(() => {
    const loadState = () => {
      const savedConfigs = loadFromLocalStorage("translationConfigs");
      if (savedConfigs) {
        setTranslationConfigs(savedConfigs);
      }
      setSysPrompt(loadFromLocalStorage("sysPrompt") || DEFAULT_SYS_PROMPT);
      setUserPrompt(loadFromLocalStorage("userPrompt") || DEFAULT_USER_PROMPT);

      setTranslationMethod(loadFromLocalStorage("translationMethod") || DEFAULT_API);
      setSourceLanguage(loadFromLocalStorage("sourceLanguage") || "auto");
      setTargetLanguage(loadFromLocalStorage("targetLanguage") || "zh");
      setTarget_langs(loadFromLocalStorage("target_langs") || ["zh"]);
      setIsClient(true);
    };
    loadState();
  }, []);

  // Save to localStorage
  useEffect(() => {
    if (isClient) {
      saveToLocalStorage("translationConfigs", translationConfigs);
      saveToLocalStorage("sysPrompt", sysPrompt);
      saveToLocalStorage("userPrompt", userPrompt);
      saveToLocalStorage("translationMethod", translationMethod);
      saveToLocalStorage("sourceLanguage", sourceLanguage);
      saveToLocalStorage("targetLanguage", targetLanguage);
      saveToLocalStorage("target_langs", target_langs);
    }
  }, [translationConfigs, sysPrompt, userPrompt, translationMethod, sourceLanguage, targetLanguage, target_langs, isClient]);

  const handleConfigChange = (method: string, field: string, value: string | number) => {
    setTranslationConfigs((prev) => {
      const currentConfig = prev[method];
      if (!currentConfig) return prev; // 确保 method 存在，防止 undefined 赋值时报错
      return {
        ...prev,
        [method]: {
          ...currentConfig,
          [field]: value,
        },
      };
    });
  };

  const getCurrentConfig = () => {
    let effectiveMethod = translationMethod;
    if (!translationConfigs[effectiveMethod] && !defaultConfigs[effectiveMethod]) {
      setTranslationMethod(DEFAULT_API);
      effectiveMethod = DEFAULT_API;
    }

    const currentConfig = translationConfigs[effectiveMethod];
    const defaultConfig = defaultConfigs[effectiveMethod];

    // 如果 currentConfig 不存在或结构与默认配置不一致，则重置配置并返回默认配置
    if (!currentConfig || !isConfigStructureValid(currentConfig, defaultConfig)) {
      resetTranslationConfig(effectiveMethod);
      return defaultConfig;
    }

    return currentConfig;
  };

  const resetTranslationConfig = (key: string) => {
    setTranslationConfigs((prevConfigs) => ({
      ...prevConfigs,
      [key]: defaultConfigs[key],
    }));
  };

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

  const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

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
      if (!checkLanguageSupport(translationMethod, sourceLanguage, targetLanguage)) {
        setTranslationMethod(DEFAULT_API);
        return false;
      }
    } else {
      for (let lang of target_langs) {
        if (!checkLanguageSupport(translationMethod, sourceLanguage, lang)) {
          setTranslationMethod(DEFAULT_API);
          return false;
        }
      }
    }

    if (translationMethod === "deepl" || translationMethod === "deeplx" || translationMethod === "llm") {
      setTranslateInProgress(true);
      setProgressPercent(1);
      const tempSysPrompt = translationMethod === "llm" ? sysPrompt : undefined;
      const tempUserPrompt = translationMethod === "llm" ? userPrompt : undefined;
      const testResult = await testTranslation(translationMethod, config, tempSysPrompt, tempUserPrompt);
      if (testResult !== true) {
        const errorMessage = translationMethod === "deeplx" ? t("deepLXUnavailable") : translationMethod === "deepl" ? t("deeplUnavailable") : t("llmUnavailable");
        message.open({
          type: "error",
          content: errorMessage,
          duration: 10,
        });
        // Switch translation method based on the current one
        if (translationMethod === "deeplx") {
          setTranslationMethod(DEFAULT_API);
        }
        setTranslateInProgress(false);
        return false;
      }
      setTranslateInProgress(false);
    }

    return true;
  };

  const handleTranslate = async (performTranslation: Function, sourceText: string) => {
    setTranslatedText("");
    if (!sourceText.trim()) {
      message.error("No source text provided.");
      return;
    }

    const isValid = await validateTranslate();
    if (!isValid) {
      return;
    }

    setTranslateInProgress(true);
    setProgressPercent(0);

    await performTranslation(sourceText);
    setTranslateInProgress(false);
    setExtractedText("");
  };

  async function retryTranslate(text, cacheSuffix, config) {
    try {
      return await pRetry(
        async () => {
          return translate({
            text,
            cacheSuffix,
            ...config,
          });
        },
        {
          retries: 3,
          onFailedAttempt: (error) => {
            console.log(`${text.substring(0, 30)} ... Translation failed：${error.message}`);
          },
        }
      );
    } catch (error) {
      console.log(`${text.substring(0, 30)} ... All translation attempts failed. Using original text.`);
      return text; // 返回原文作为兜底
    }
  }

  const translateContent = async (contentLines: string[], translationMethod: string, currentTargetLang: string, fileIndex: number = 0, totalFiles: number = 1) => {
    const config = getCurrentConfig();
    // 限制并发数，确保至少为 1
    const concurrency = Math.max(Number(config?.limit) || 10, 1);
    const limit = pLimit(concurrency);

    try {
      if (!contentLines.length) {
        return [];
      }

      const updateProgress = (current: number, total: number) => {
        const progress = ((fileIndex + current / total) / totalFiles) * 100;
        setProgressPercent(progress);
      };

      const translationConfig = {
        translationMethod,
        targetLanguage: currentTargetLang,
        sourceLanguage,
        useCache: useCache,
        sysPrompt: sysPrompt,
        userPrompt: userPrompt,
        ...config,
      };

      const cacheSuffix = await generateCacheSuffix(sourceLanguage, currentTargetLang, translationMethod, { model: config?.model, temperature: config?.temperature, sysPrompt, userPrompt });

      if (config?.chunkSize === undefined) {
        // 按行并发翻译，每一行翻译出错时通过 p-retry 进行重试
        const translatedLines = new Array(contentLines.length);
        const promises = contentLines.map((line, index) =>
          limit(async () => {
            translatedLines[index] = await retryTranslate(line, cacheSuffix, translationConfig);
            updateProgress(index, contentLines.length);
          })
        );

        await Promise.all(promises);
        return translatedLines;
      }

      const delimiter = translationMethod === "deeplx" ? "<>" : "\n";
      // 将空行替换为 delimiter，保证分块时不丢失空行
      const nonEmptyLines = contentLines.map((line) => (line.trim() ? line : delimiter));
      const text = nonEmptyLines.join(delimiter);
      const chunkSize = config?.chunkSize || 5000;
      const chunks = splitTextIntoChunks(text, chunkSize, delimiter);
      const translatedChunks: string[] = [];

      for (let i = 0; i < chunks.length; i++) {
        const translatedContent = await retryTranslate(chunks[i], cacheSuffix, translationConfig);
        // 如果是 deeplx 翻译方法，需要将特殊换行符号替换回来
        translatedChunks.push(translationMethod === "deeplx" ? translatedContent?.replace(/<>/g, "\n") : translatedContent);
        updateProgress(i, chunks.length);
        if (i < chunks.length - 1) {
          await delay(config?.delayTime || 200);
        }
      }

      const result = translatedChunks.join("\n").split("\n");
      return result.map((line, index) => (contentLines[index].trim() ? line : contentLines[index]));
    } catch (error) {
      console.error("Error translating content:", error);
      throw error;
    }
  };

  return {
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
    isClient,
    setIsClient,
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
