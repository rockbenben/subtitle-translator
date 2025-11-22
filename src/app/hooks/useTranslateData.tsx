"use client";

import { useState, useEffect, useCallback } from "react";
import { message } from "antd";
import { loadFromLocalStorage, saveToLocalStorage } from "@/app/utils/localStorageUtils";
import useFileUpload from "@/app/hooks/useFileUpload";
import { downloadFile } from "@/app/utils";
import { generateCacheSuffix, checkLanguageSupport, splitTextIntoChunks, testTranslation, useTranslation, defaultConfigs, isConfigStructureValid, LLM_MODELS } from "@/app/components/translateAPI";
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
  // ["google", "gtxFreeAPI", "webgoogletranslate", "deepseek"] 没有 chunkSize 则逐行翻译
  const [translationConfigs, setTranslationConfigs] = useState(defaultConfigs);
  const [sysPrompt, setSysPrompt] = useState<string>(DEFAULT_SYS_PROMPT);
  const [userPrompt, setUserPrompt] = useState<string>(DEFAULT_USER_PROMPT);

  const [sourceLanguage, setSourceLanguage] = useState<string>("auto");
  const [targetLanguage, setTargetLanguage] = useState<string>("zh");
  const [target_langs, setTarget_langs] = useState<string[]>(["zh"]);
  const [useCache, setUseCache] = useState<boolean>(true);
  const [removeChars, setRemoveChars] = useState<string>(""); // 翻译后移除指定字符

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
      setMultiLanguageMode(loadFromLocalStorage("multiLanguageMode") ?? false);
      setRemoveChars(loadFromLocalStorage("removeChars") || "");

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
      saveToLocalStorage("multiLanguageMode", multiLanguageMode);
      saveToLocalStorage("removeChars", removeChars);
    }
  }, [translationConfigs, sysPrompt, userPrompt, translationMethod, sourceLanguage, targetLanguage, target_langs, multiLanguageMode, removeChars, isClient]);

  const exportSettings = async () => {
    try {
      const settings = {
        translationConfigs: loadFromLocalStorage("translationConfigs"),
        sysPrompt: loadFromLocalStorage("sysPrompt"),
        userPrompt: loadFromLocalStorage("userPrompt"),
        translationMethod: loadFromLocalStorage("translationMethod"),
        sourceLanguage: loadFromLocalStorage("sourceLanguage"),
        targetLanguage: loadFromLocalStorage("targetLanguage"),
        target_langs: loadFromLocalStorage("target_langs"),
        multiLanguageMode: loadFromLocalStorage("multiLanguageMode"),
        exportDate: new Date().toISOString(),
        version: "1.0",
      };

      const jsonString = JSON.stringify(settings, null, 2);
      const fileName = `translation-settings-${new Date().toISOString().split("T")[0]}.json`;

      await downloadFile(jsonString, fileName, "application/json");
      message.success(t("exportSettingSuccess"));
    } catch (error) {
      console.error(t("exportSettingError"), error);
      message.error(t("exportSettingError"));
    }
  };

  const { readFile } = useFileUpload();
  const importSettings = () => {
    return new Promise((resolve, reject) => {
      try {
        // 创建隐藏的文件输入元素
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";

        fileInput.onchange = (event) => {
          const file = (event.target as HTMLInputElement).files?.[0];
          if (!file) {
            message.warning(t("importSettingparseError"));
            reject(new Error(t("importSettingparseError")));
            return;
          }

          // 使用 useFileUpload 的 readFile 方法
          readFile(file, (content) => {
            try {
              const settings = JSON.parse(content);

              // 验证文件格式
              if (!settings || typeof settings !== "object") {
                throw new Error(t("importSettingparseError"));
              }

              // 导入设置到 localStorage 并更新状态
              if (settings.translationConfigs !== undefined) {
                saveToLocalStorage("translationConfigs", settings.translationConfigs);
                setTranslationConfigs(settings.translationConfigs);
              }

              if (settings.sysPrompt !== undefined) {
                saveToLocalStorage("sysPrompt", settings.sysPrompt);
                setSysPrompt(settings.sysPrompt);
              }

              if (settings.userPrompt !== undefined) {
                saveToLocalStorage("userPrompt", settings.userPrompt);
                setUserPrompt(settings.userPrompt);
              }

              if (settings.translationMethod !== undefined) {
                saveToLocalStorage("translationMethod", settings.translationMethod);
                setTranslationMethod(settings.translationMethod);
              }

              if (settings.sourceLanguage !== undefined) {
                saveToLocalStorage("sourceLanguage", settings.sourceLanguage);
                setSourceLanguage(settings.sourceLanguage);
              }

              if (settings.targetLanguage !== undefined) {
                saveToLocalStorage("targetLanguage", settings.targetLanguage);
                setTargetLanguage(settings.targetLanguage);
              }

              if (settings.target_langs !== undefined) {
                saveToLocalStorage("target_langs", settings.target_langs);
                setTarget_langs(settings.target_langs);
              }

              if (settings.multiLanguageMode !== undefined) {
                saveToLocalStorage("multiLanguageMode", settings.multiLanguageMode);
                setMultiLanguageMode(settings.multiLanguageMode);
              }

              message.success(t("importSettingSuccess"));
              resolve(settings);
            } catch (parseError) {
              console.error(t("importSettingparseError"), parseError);
              message.error(t("importSettingparseError"));
              reject(new Error(t("importSettingparseError")));
            }
          });
        };

        fileInput.onerror = () => {
          message.error(t("importSettingreadFileError"));
          reject(new Error(t("importSettingreadFileError")));
        };

        // 添加到 DOM 并触发点击
        document.body.appendChild(fileInput);
        fileInput.click();

        // 清理 DOM 元素
        const cleanup = () => {
          if (document.body.contains(fileInput)) {
            document.body.removeChild(fileInput);
          }
        };

        // 立即清理或超时清理
        setTimeout(cleanup, 100);
        fileInput.addEventListener("change", cleanup, { once: true });
      } catch (error) {
        console.error(t("importSettingError"), error);
        message.error(t("importSettingError"));
        reject(error);
      }
    });
  };

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
    setTranslationConfigs((prevConfigs) => {
      const oldConfig = prevConfigs[key] || {};
      const defaultConfig = defaultConfigs[key];
      // 保留 apiKey，其它字段重置为默认
      return {
        ...prevConfigs,
        [key]: {
          ...defaultConfig,
          ...(oldConfig.apiKey !== undefined ? { apiKey: oldConfig.apiKey } : {}),
        },
      };
    });
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

    if (["deepl", "deeplx", "llm", "gtxFreeAPI"].includes(translationMethod)) {
      setTranslateInProgress(true);
      setProgressPercent(1);
      const tempSysPrompt = translationMethod === "llm" ? sysPrompt : undefined;
      const tempUserPrompt = translationMethod === "llm" ? userPrompt : undefined;
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
        message.open({
          type: "error",
          content: errorMessage,
          duration: 10,
        });

        setTranslateInProgress(false);
        return false;
      }
      setTranslateInProgress(false);
    }

    return true;
  };

  const handleTranslate = async (performTranslation: Function, sourceText: string, isSubtitleMode: boolean = false) => {
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

    await performTranslation(sourceText, undefined, undefined, undefined, isSubtitleMode);
    setTranslateInProgress(false);
    setExtractedText("");
  };

  // 根据翻译方法获取优化的重试配置
  const getRetryConfig = useCallback((translationMethod: string) => {
    const baseConfig = {
      retries: 3,
      factor: 2,
      minTimeout: 1000,
      maxTimeout: 30000,
      randomize: true,
    };

    // 为不同的翻译服务定制重试策略
    switch (translationMethod) {
      case "gtxFreeAPI":
        return {
          ...baseConfig,
          retries: 5, // 免费服务更容易失败，多重试几次
          minTimeout: 2000,
          maxTimeout: 60000,
          shouldRetry: ({ error }) => {
            // 网络错误和服务器错误重试，客户端错误不重试
            const status = error?.status || error?.response?.status;
            return !status || status >= 500 || status === 429;
          },
        };

      case "deeplx":
        return {
          ...baseConfig,
          retries: 4,
          minTimeout: 1500,
          shouldRetry: ({ error }) => {
            const message = error?.message?.toLowerCase() || "";
            const status = error?.status || error?.response?.status;
            // DeepLX 服务不稳定，但不要对认证错误重试
            return !message.includes("unauthorized") && (!status || status >= 500 || status === 429);
          },
        };

      case "deepl":
      case "google":
      case "azure":
        return {
          ...baseConfig,
          retries: 2, // 官方 API 更稳定，少重试
          minTimeout: 500,
          maxTimeout: 10000,
          shouldRetry: ({ error }) => {
            const status = error?.status || error?.response?.status;
            // 只对网络错误和服务器错误重试
            return !status || status >= 500 || status === 429;
          },
        };

      default:
        if (LLM_MODELS.includes(translationMethod)) {
          return {
            ...baseConfig,
            retries: 3,
            minTimeout: 1000,
            maxTimeout: 20000,
            shouldRetry: ({ error }) => {
              const message = error?.message?.toLowerCase() || "";
              const status = error?.status || error?.response?.status;

              // LLM 服务的特殊处理
              if (message.includes("context length") || message.includes("token limit")) {
                return false; // 不要重试上下文长度错误
              }

              return !status || status >= 500 || status === 429;
            },
          };
        }
        return baseConfig;
    }
  }, []);

  async function retryTranslate(text, cacheSuffix, config) {
    const retryConfig = getRetryConfig(config.translationMethod);

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
          ...retryConfig,
          onFailedAttempt: async ({ error, attemptNumber, retriesLeft }) => {
            const textPreview = text.length > 30 ? `${text.substring(0, 30)}...` : text;
            console.warn(`Translation attempt ${attemptNumber} failed for "${textPreview}": ${error.message} (${retriesLeft} retries left)`);

            // 对于速率限制错误，使用动态延迟
            const errorStatus = (error as any)?.status || (error as any)?.response?.status;
            const errorMessage = error?.message?.toLowerCase();

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
      console.warn(`All translation attempts failed for: "${textPreview}". Using original text.`);
      return text; // 返回原文作为兜底
    }
  }

  const translateContent = async (contentLines: string[], translationMethod: string, currentTargetLang: string, fileIndex: number = 0, totalFiles: number = 1, isSubtitleMode: boolean = false) => {
    const config = getCurrentConfig();

    // 直接使用配置中的 limit 作为并发数，添加基础延迟
    const concurrency = Math.max(Number(config?.limit) || 10, 1);
    const baseDelay = config?.delayTime || 200; // 使用配置中的 delayTime
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

      const cacheSuffix = await generateCacheSuffix(sourceLanguage, currentTargetLang, translationMethod, {
        model: config?.model,
        temperature: config?.temperature,
        sysPrompt,
        userPrompt,
      });

      // 对于字幕翻译且使用 AI 模型时，启用上下文感知翻译
      if (isSubtitleMode && LLM_MODELS.includes(translationMethod) && contentLines.length > 1) {
        return await translateWithContext(contentLines, translationConfig, cacheSuffix, updateProgress);
      }

      if (config?.chunkSize === undefined) {
        // 按行并发翻译，使用 p-limit 控制并发数
        const translatedLines = new Array(contentLines.length);
        let completedCount = 0;

        // 使用 Promise.all 与 p-limit 进行并发控制
        const promises = contentLines.map((line, index) =>
          limit(async () => {
            // p-limit 会自动控制并发，p-retry 会处理重试
            translatedLines[index] = await retryTranslate(line, cacheSuffix, translationConfig);

            completedCount++;
            // 去抖动进度更新，每 10 个或完成时更新
            if (completedCount % 10 === 0 || completedCount === contentLines.length) {
              updateProgress(completedCount, contentLines.length);
            }

            // 添加基础延迟以避免过快请求
            if (baseDelay > 0 && completedCount < contentLines.length) {
              await delay(baseDelay);
            }
          })
        );

        await Promise.all(promises);
        // 确保进度达到100%
        updateProgress(contentLines.length, contentLines.length);
        return translatedLines;
      }

      // 对于支持chunkSize的API，使用分块翻译
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
        updateProgress(i + 1, chunks.length);

        // 在分块之间添加延迟
        if (i < chunks.length - 1) {
          await delay(config?.delayTime || 200);
        }
      }

      const result = translatedChunks.join("\n").split("\n");
      return result.map((line, index) => (contentLines[index]?.trim() ? line : contentLines[index] || line));
    } catch (error) {
      console.error("Error translating content:", error);
      throw error;
    }
  };

  const MAX_CONTEXT_PADDING = 25; // 限制纯上下文行数，避免过大

  // 新增：带上下文的翻译函数
  const translateWithContext = async (contentLines: string[], translationConfig: any, cacheSuffix: string, updateProgress: (current: number, total: number) => void) => {
    const contextWindow = Math.min(translationConfig.limit || 20, contentLines.length); // 上下文窗口大小，使用配置中的 limit 值，不超过总行数
    const contextPadding = Math.min(MAX_CONTEXT_PADDING, Math.max(1, Math.floor(contextWindow / 2))); // 额外上下文行数单侧封顶
    const translatedLines = new Array(contentLines.length);

    // 分批处理，每批包含一定的上下文
    for (let i = 0; i < contentLines.length; i += contextWindow) {
      const batchEnd = Math.min(i + contextWindow, contentLines.length);
      const contextStart = Math.max(0, i - contextPadding);
      const contextEnd = Math.min(contentLines.length, batchEnd + contextPadding);

      // 构建包含上下文的内容
      const contextLines = contentLines.slice(contextStart, contextEnd);
      const targetStartIndex = i - contextStart;
      const targetEndIndex = batchEnd - contextStart;

      // 标记需要翻译的行，为每行添加序号以便识别
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
          userPrompt: userPrompt.replace(
            "${content}",
            `Context: This is part of a subtitle file. Only translate the lines marked with [TRANSLATE_X][/TRANSLATE_X] tags (where X is the line number). Use the [CONTEXT][/CONTEXT] lines for understanding but do not translate them. Maintain the natural flow of dialogue and keep the same numbering in your response.

CRITICAL REQUIREMENTS:
1. You MUST translate ALL ${batchEnd - i} lines marked with [TRANSLATE_X] tags
2. Do NOT skip any numbers from 0 to ${batchEnd - i - 1}
3. Keep the exact format: [TRANSLATE_0]translation[/TRANSLATE_0]
4. If a line contains only sounds/exclamations, still translate them appropriately

${contextWithMarkers}`
          ),
        });

        // 解析结果，提取翻译的行
        const translatedBatch = extractTranslatedLinesWithNumbers(result, batchEnd - i);

        // 将翻译结果放入对应位置
        for (let j = 0; j < translatedBatch.length; j++) {
          if (i + j < contentLines.length && translatedBatch[j]) {
            translatedLines[i + j] = translatedBatch[j];
          }
        }

        updateProgress(batchEnd, contentLines.length);

        // 添加延迟以避免API限制
        if (batchEnd < contentLines.length) {
          await delay(translationConfig.delayTime || 500);
        }
      } catch (error) {
        console.warn(`Context translation failed for batch ${i}-${batchEnd}, falling back to individual translation`);
        // 回退到逐行翻译
        for (let j = i; j < batchEnd; j++) {
          try {
            translatedLines[j] = await retryTranslate(contentLines[j], cacheSuffix, translationConfig);
          } catch (lineError) {
            console.error(`Failed to translate line ${j}:`, lineError);
            translatedLines[j] = contentLines[j]; // 保持原文
          }
          updateProgress(j + 1, contentLines.length);

          // 添加延迟避免API限制
          if (j < batchEnd - 1) {
            await delay(translationConfig.delayTime || 200);
          }
        }
      }
    }

    // 填补任何缺失的翻译（使用原文）
    for (let i = 0; i < translatedLines.length; i++) {
      if (!translatedLines[i]) {
        translatedLines[i] = contentLines[i];
      }
    }

    return translatedLines;
  };

  // 辅助函数：清理翻译内容中的标记
  const cleanTranslatedContent = (content: string): string => {
    return (
      content
        // 移除所有 TRANSLATE 标记（带编号和不带编号），支持变形格式
        .replace(/\[TRANSLATE_\d+\]/gi, "")
        .replace(/\[\/TRANSLTranslate_\d+\]/gi, "") // 处理常见错误格式 [/TRANSLTranslate_X]
        .replace(/\[\/TRANSLATE_\d+\]/gi, "")
        .replace(/\[TRANSLATE\]/gi, "")
        .replace(/\[\/TRANSLATE\]/gi, "")
        // 移除 CONTEXT 标记
        .replace(/\[CONTEXT\]/gi, "")
        .replace(/\[\/CONTEXT\]/gi, "")
        .trim()
    );
  };

  // 辅助函数：从 AI 响应中提取带编号的翻译行
  const extractTranslatedLinesWithNumbers = (response: string, expectedCount: number): string[] => {
    const results = new Array(expectedCount);

    // 尝试匹配带编号的翻译标记，使用更宽松的正则表达式
    for (let i = 0; i < expectedCount; i++) {
      // 先尝试正确格式
      let regex = new RegExp(`\\[TRANSLATE_${i}\\]([\\s\\S]*?)\\[/TRANSLATE_${i}\\]`, "i");
      let match = response.match(regex);

      // 如果正确格式没匹配到，尝试常见错误格式
      if (!match) {
        regex = new RegExp(`\\[TRANSLATE_${i}\\]([\\s\\S]*?)\\[/TRANSLTranslate_${i}\\]`, "i");
        match = response.match(regex);
      }

      if (match) {
        // 清理提取的内容，移除可能残留的标记
        results[i] = cleanTranslatedContent(match[1].trim());
      }
    }

    // 如果部分匹配成功，返回结果
    const successCount = results.filter((r) => r).length;
    if (successCount > 0) {
      return results;
    }

    // 回退：尝试无编号的匹配
    return extractTranslatedLines(response, expectedCount);
  };

  // 辅助函数：从 AI 响应中提取翻译的行
  const extractTranslatedLines = (response: string, expectedCount: number): string[] => {
    // 尝试匹配翻译标记之间的内容
    const translateRegex = /\[TRANSLATE\]([\s\S]*?)\[\/TRANSLATE\]/g;
    const matches: string[] = [];
    let match;

    while ((match = translateRegex.exec(response)) !== null) {
      matches.push(cleanTranslatedContent(match[1].trim()));
    }

    // 如果匹配的数量正确，返回匹配结果
    if (matches.length === expectedCount) {
      return matches;
    }

    // 否则，尝试按行分割并取前几行，同时清理每行内容
    const lines = response
      .split("\n")
      .filter((line) => line.trim())
      .slice(0, expectedCount)
      .map((line) => cleanTranslatedContent(line));
    return lines.length === expectedCount ? lines : new Array(expectedCount).fill("");
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
