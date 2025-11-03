import { useCallback } from "react";
import { message } from "antd";
import SparkMD5 from "spark-md5";
import { languages } from "./languages";

export const TRANSLATION_SERVICES = [
  { value: "gtxFreeAPI", label: "GTX API (Free)" },
  {
    value: "google",
    label: "Google Translate",
    docs: "https://cloud.google.com/translate/docs/basic/translate-text-basic",
  },
  { value: "deepl", label: "DeepL", docs: "https://developers.deepl.com/docs/api-reference/translate" },
  { value: "azure", label: "Azure Translate", docs: "https://learn.microsoft.com/zh-cn/azure/ai-services/translator/reference/v3-0-translate" },
  { value: "deeplx", label: "DeepLX (Free)", docs: "https://deeplx.owo.network/endpoints/free.html" },
  { value: "deepseek", label: "DeepSeek", docs: "https://api-docs.deepseek.com/zh-cn/" },
  { value: "openai", label: "OpenAI", docs: "https://platform.openai.com/docs/api-reference/chat" },
  { value: "gemini", label: "Gemini", docs: "https://ai.google.dev/gemini-api/docs/text-generation" },
  {
    value: "azureopenai",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/zh-cn/azure/ai-services/openai/concepts/models",
  },
  { value: "siliconflow", label: "SiliconFlow", docs: "https://docs.siliconflow.cn/api-reference/chat-completions/chat-completions" },
  { value: "groq", label: "Groq", docs: "https://console.groq.com/docs/text-chat" },
  { value: "llm", label: "Custom LLM" },
  //{ value: "webgoogletranslate", label: "GTX Web (Free&Slow)" },
];

export const findMethodLabel = (method) => {
  const service = TRANSLATION_SERVICES.find((s) => s.value === method);
  return service ? service.label : method;
};

type TranslationMethod = (typeof TRANSLATION_SERVICES)[number]["value"];

export const LLM_MODELS = ["deepseek", "openai", "gemini", "azureopenai", "siliconflow", "groq", "llm"];

export const categorizedOptions = [
  ...TRANSLATION_SERVICES.filter((s) => !LLM_MODELS.includes(s.value)),
  {
    label: "AI LLM Models",
    options: TRANSLATION_SERVICES.filter((s) => LLM_MODELS.includes(s.value)),
  },
];

export const defaultConfigs = {
  gtxFreeAPI: {
    limit: 100,
  },
  deeplx: {
    url: "",
    chunkSize: 1000,
    delayTime: 200,
    limit: 10,
  },
  deepl: {
    url: "",
    apiKey: "",
    chunkSize: 5000,
    delayTime: 200,
    limit: 20,
  },
  deepseek: {
    apiKey: "",
    model: "deepseek-chat",
    temperature: 0.7,
    limit: 30,
  },
  openai: {
    apiKey: "",
    model: "gpt-5-mini",
    temperature: 1,
    limit: 30,
  },
  gemini: {
    apiKey: "",
    model: "gemini-2.5-flash",
    temperature: 0.7,
    limit: 30,
  },
  azureopenai: {
    url: "",
    apiKey: "",
    model: "gpt-5-mini",
    apiVersion: "2025-08-07",
    temperature: 0.7,
    limit: 30,
  },
  siliconflow: {
    apiKey: "",
    model: "deepseek-ai/DeepSeek-V3",
    temperature: 0.7,
    limit: 30,
  },
  groq: {
    apiKey: "",
    model: "openai/gpt-oss-20b",
    temperature: 0.7,
    limit: 30,
  },
  llm: {
    url: "http://127.0.0.1:11434/v1/chat/completions",
    apiKey: "",
    model: "llama3.2",
    temperature: 0.7,
    limit: 20,
  },
  azure: {
    apiKey: "",
    chunkSize: 10000,
    delayTime: 200,
    region: "eastasia",
    limit: 100,
  },
  google: {
    apiKey: "",
    delayTime: 200,
    limit: 100,
  },
  webgoogletranslate: {
    limit: 1,
  },
} as const;

// 判断当前配置的结构是否匹配默认配置
export const isConfigStructureValid = (config, defaultConfig) => {
  const configKeys = Object.keys(config).sort();
  const defaultKeys = Object.keys(defaultConfig).sort();
  return JSON.stringify(configKeys) === JSON.stringify(defaultKeys);
};

const isLocalDevelopment = process.env.NODE_ENV === "development";
const deeplEndpoint = isLocalDevelopment ? "/api/deepl" : "https://api-edgeone.newzone.top/api/deepl";
const deeplxEndpoint = "https://deeplx.aishort.top/translate";

interface TranslateTextParams {
  text: string;
  cacheSuffix: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  apiKey?: string;
  region?: string;
  url?: string;
  model?: string;
  apiVersion?: string;
  temperature?: number;
  sysPrompt?: string;
  userPrompt?: string;
}

// 定义翻译缓存前缀
export const CACHE_PREFIX = "t_";

const getLanguageName = (value: string) => {
  const language = languages.find((lang) => lang.value === value);
  return language ? language.name : value; // 如果找不到匹配的语言，则返回 value 本身
};

// 用于 aishort-translate 中，判断其中的语言变量是否是有效的 language value
const validLanguageCodes = new Set(languages.map((lang) => lang.value));
export const isValidLanguageValue = (testValue: string): boolean => validLanguageCodes.has(testValue);

export const checkLanguageSupport = (translationMethod: TranslationMethod, sourceLanguage: string, targetLanguage: string): boolean => {
  const sourceLang = languages.find((lang) => lang.value === sourceLanguage);
  const targetLang = languages.find((lang) => lang.value === targetLanguage);

  if (!sourceLang || !targetLang) {
    console.error("Invalid language code provided");
    return false;
  }

  // 检查源语言和目标语言是否支持当前翻译方法
  const isSourceUnsupported = sourceLang.unsupportedMethods?.includes(translationMethod);
  const isTargetUnsupported = targetLang.unsupportedMethods?.includes(translationMethod);

  if (isSourceUnsupported || isTargetUnsupported) {
    if (isSourceUnsupported) {
      message.error({
        content: `${translationMethod.toUpperCase()} doesn't support ${sourceLang.name}. Switching to free GTX API now.`,
        duration: 10,
      });
    }
    if (isTargetUnsupported) {
      message.error({
        content: `${translationMethod.toUpperCase()} doesn't support ${targetLang.name}. Switching to free GTX API now.`,
        duration: 10,
      });
    }
    return false;
  }
  return true;
};

export const splitTextIntoChunks = (text: string, maxLength: number, delimiter: string) => {
  const chunks = [];
  let currentChunk = "";

  text.split(delimiter).forEach((line) => {
    if (currentChunk.length + line.length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += currentChunk ? delimiter + line : line;
    }
  });

  if (currentChunk) {
    chunks.push(currentChunk);
  }

  return chunks;
};

export const generateCacheSuffix = (
  sourceLanguage: string,
  targetLanguage: string,
  translationMethod: string,
  params: { model?: string; temperature?: number; sysPrompt?: string; userPrompt?: string } = {}
): string => {
  // 基础缓存后缀
  let cacheSuffix = `${targetLanguage}_${sourceLanguage}_${translationMethod}`;
  if (LLM_MODELS.includes(translationMethod)) {
    const llmConfig = JSON.stringify({
      model: params.model || "",
      temperature: params.temperature || 0,
      sysPrompt: params.sysPrompt || "",
      userPrompt: params.userPrompt || "",
    });
    const llmConfigHash = SparkMD5.hash(llmConfig);
    cacheSuffix = `${cacheSuffix}_${llmConfigHash}`;
  }

  return cacheSuffix;
};

const generateCacheKey = (text: string, cacheSuffix: string): string => {
  if (text.length > 32) {
    return `${CACHE_PREFIX}${SparkMD5.hash(text)}_${cacheSuffix}`;
  }
  const encoded = encodeURIComponent(text);
  return encoded.length > 50 ? `${CACHE_PREFIX}${SparkMD5.hash(text)}_${cacheSuffix}` : `${CACHE_PREFIX}${encoded}_${cacheSuffix}`;
};

const getAIModelPrompt = (content: string, userPrompt: string, targetLanguage: string, sourceLanguage: string): string => {
  let prompt = userPrompt;
  if (sourceLanguage === "auto") {
    prompt = prompt.replace(/from \${sourceLanguage} (to|into)/g, "into");
  }
  prompt = prompt.replace("${sourceLanguage}", getLanguageName(sourceLanguage)).replace("${targetLanguage}", getLanguageName(targetLanguage)).replace("${content}", content);
  return prompt;
};

const translationServices = {
  gtxFreeAPI: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage } = params;
    const apiEndpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
    const response = await fetch(apiEndpoint);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return data[0].map((part: any) => part[0]).join("");
  },

  google: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey } = params;
    const requestBody = {
      q: text,
      target: targetLanguage,
      ...(sourceLanguage !== "auto" && { source: sourceLanguage }),
    };

    const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    const data = await response.json();
    return data.data.translations[0].translatedText;
  },

  deepl: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, url, apiKey } = params;
    const requestBody = {
      text,
      target_lang: targetLanguage,
      authKey: apiKey,
      ...(sourceLanguage !== "auto" && { source_lang: sourceLanguage }),
    };

    const apiEndpoint = url || deeplEndpoint;
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data.translations[0].text;
  },

  deeplx: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, url } = params;
    const requestBody = {
      text,
      target_lang: targetLanguage,
      ...(sourceLanguage !== "auto" && { source_lang: sourceLanguage }),
    };

    const apiEndpoint = url || deeplxEndpoint;
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data.data;
  },

  azure: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, region } = params;
    const apiEndpoint = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguage}${sourceLanguage !== "auto" ? `&from=${sourceLanguage}` : ""}`;
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: {
        "Ocp-Apim-Subscription-Key": apiKey,
        "Ocp-Apim-Subscription-Region": region,
        "Content-Type": "application/json",
      },
      body: JSON.stringify([{ Text: text }]),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    return data[0].translations[0].text;
  },

  deepseek: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);

    const response = await fetch("https://api.deepseek.com/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        model: model,
        temperature: Number(temperature),
        stream: false,
        timeout: 600000,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  },

  openai: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        model: model,
        temperature: 1,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  },

  gemini: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);

    const requestBody = {
      contents: [
        {
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      systemInstruction: {
        parts: [
          {
            text: sysPrompt,
          },
        ],
      },
      generationConfig: {
        temperature: Number(temperature),
      },
    };

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    const data = await response.json();

    if (!response.ok) {
      const errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
      throw new Error(errorMessage);
    }

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      throw new Error("Invalid response format from Gemini API");
    }

    return data.candidates[0].content.parts[0].text.trim();
  },

  azureopenai: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, url, model, apiVersion, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);
    const endpoint = url.replace(/\/+$/, "");
    const requestUrl = `${endpoint}/openai/deployments/${model}/chat/completions?api-version=${apiVersion}`;
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": apiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        temperature: Number(temperature),
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  },

  siliconflow: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);

    const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        model: model,
        temperature: Number(temperature),
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  },

  groq: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);

    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        model: model,
        temperature: Number(temperature),
        stream: false,
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  },

  llm: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage, apiKey, url, model, temperature, sysPrompt, userPrompt } = params;
    const prompt = getAIModelPrompt(text, userPrompt, targetLanguage, sourceLanguage);

    const apiEndpoint = url || `http://127.0.0.1:61234/v1/chat/completions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey?.trim()) {
      headers.Authorization = `Bearer ${apiKey}`;
    }
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        messages: [
          { role: "system", content: sysPrompt },
          { role: "user", content: prompt },
        ],
        model: model,
        temperature: Number(temperature),
      }),
    });

    const data = await response.json();
    return data.choices[0].message.content.trim();
  },

  webgoogletranslate: async (params: TranslateTextParams) => {
    const { text, targetLanguage, sourceLanguage } = params;
    const requestBody = {
      q: text,
      target: targetLanguage,
      ...(sourceLanguage !== "auto" && { source: sourceLanguage }),
    };
    // 对服务后端要求较高，仅限本地运行使用 api/webgoogletranslate
    const response = await fetch("api/webgoogletranslate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
    });
    if (!response.ok) {
      throw new Error("Failed to translate text");
    }
    const data = await response.json();
    return data.translatedText;
  },
};

export const testTranslation = async (translationMethod, config, sysPrompt, userPrompt) => {
  try {
    const params = {
      text: "Hello, world!",
      targetLanguage: "zh",
      sourceLanguage: "en",
      ...config,
      ...(sysPrompt && { sysPrompt }),
      ...(userPrompt && { userPrompt }),
    };

    const result = await translationServices[translationMethod](params);

    if (!result) throw new Error("Translation Test failed, no result received.");

    return true;
  } catch (error) {
    console.error("Translation Test failed", error);
    return false;
  }
};

const translateText = async (params: TranslateTextParams): Promise<string | null> => {
  try {
    const { text, cacheSuffix, translationMethod, targetLanguage, sourceLanguage, useCache = true, apiKey, region = "eastasia", url, model, apiVersion, temperature, sysPrompt, userPrompt } = params;

    if (!/[a-zA-Z\p{L}]/u.test(text) || sourceLanguage === targetLanguage) {
      return text;
    }

    const cacheKey = generateCacheKey(text, cacheSuffix);
    if (useCache) {
      const cachedTranslation = localStorage.getItem(cacheKey);
      if (cachedTranslation) return cachedTranslation;
    }

    // Get translation service
    const service = translationServices[translationMethod];
    if (!service) {
      throw new Error(`Unsupported translation method: ${translationMethod}`);
    }

    const translatedText = await service(params);

    if (!translatedText) {
      console.warn(`No translation result received for method: ${translationMethod}`);
      return null;
    }

    // 清理和缓存结果
    const cleanedText = translatedText
      .replace(/&#39;/g, "'") //法语字符
      .replace(/&quot;/g, '"') // html 字符
      .replace(/&apos;/g, "'")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">");

    localStorage.setItem(cacheKey, cleanedText);
    return cleanedText;
  } catch (error) {
    console.error(`Translation failed:`, error);
    return null;
  }
};

export const useTranslation = () => {
  const translate = useCallback(async (params: TranslateTextParams) => {
    return await translateText(params);
  }, []);

  return {
    translate,
  };
};
