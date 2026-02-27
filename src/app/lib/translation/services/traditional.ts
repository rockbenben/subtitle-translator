// Translation services - Traditional APIs (GTX, Google, DeepL, Azure)

import type { TranslationService } from "../types";
import { defaultConfigs } from "../config";
import { getErrorMessage, requireApiKey, PROXY_ENDPOINTS, THIRD_PARTY_ENDPOINTS, getOpenAICompatContent } from "./shared";

// DeepL source language: Chinese variants → ZH, Portuguese variants → PT, fil → TL
const DEEPL_SOURCE_MAP: Record<string, string> = {
  "zh-hant": "ZH",
  "pt-br": "PT",
  "pt-pt": "PT",
  fil: "TL",
};

// DeepL target language: zh → ZH-HANS, zh-hant → ZH-HANT, fil → TL
const DEEPL_TARGET_MAP: Record<string, string> = {
  en: "EN-US",
  zh: "ZH-HANS",
  "zh-hant": "ZH-HANT",
  fil: "TL",
};

const toDeepLSource = (lang: string): string => DEEPL_SOURCE_MAP[lang] ?? lang.toUpperCase();

const toDeepLTarget = (lang: string): string => DEEPL_TARGET_MAP[lang] ?? lang.toUpperCase();

const getAzureRegion = (region: string | undefined): string => {
  const value = region?.trim();
  if (!value) {
    throw new Error("Azure Translate region is required");
  }
  return value;
};

export const gtxFreeAPI: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage } = params;
  const apiEndpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(apiEndpoint, { signal: params.signal });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  return data[0].map((part: unknown[]) => part[0]).join("");
};

export const google: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey } = params;
  const key = requireApiKey("Google Translate", apiKey);
  const requestBody = {
    q: text,
    target: targetLanguage,
    ...(sourceLanguage !== "auto" && { source: sourceLanguage }),
  };

  const response = await fetch(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return data.data.translations[0].translatedText;
};

export const deepl: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, url, apiKey } = params;
  const key = requireApiKey("DeepL", apiKey);
  const requestBody = {
    text,
    target_lang: toDeepLTarget(targetLanguage),
    authKey: key,
    tag_handling: "html",
    ...(sourceLanguage !== "auto" && { source_lang: toDeepLSource(sourceLanguage) }),
  };

  const apiEndpoint = url || PROXY_ENDPOINTS.deepl;
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data.translations[0].text;
};

export const deeplx: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, url } = params;
  const requestBody = {
    text,
    target_lang: toDeepLTarget(targetLanguage),
    ...(sourceLanguage !== "auto" && { source_lang: toDeepLSource(sourceLanguage) }),
  };

  const apiEndpoint = url || THIRD_PARTY_ENDPOINTS.deeplx;
  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data.data;
};

export const azure: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, region } = params;
  const apiEndpoint = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${targetLanguage}${sourceLanguage !== "auto" ? `&from=${sourceLanguage}` : ""}`;

  const key = requireApiKey("Azure Translate", apiKey);
  const resolvedRegion = getAzureRegion(region);

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": resolvedRegion,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
    signal: params.signal,
  });

  const data = await response.json();

  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }

  return data[0].translations[0].text;
};

export const webgoogletranslate: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage } = params;
  const requestBody = {
    q: text,
    target: targetLanguage,
    ...(sourceLanguage !== "auto" && { source: sourceLanguage }),
  };

  const response = await fetch("api/webgoogletranslate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(getErrorMessage(data, response.status));
  }

  const data = await response.json();
  const translatedText = (data as { translatedText?: string } | null)?.translatedText;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from webgoogletranslate");
  }
  return translatedText;
};

export const qwenMt: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, url, model, domains } = params;

  const key = requireApiKey("Qwen-MT", apiKey);
  const apiUrl = url?.trim() || defaultConfigs.qwenMt.url;

  // Qwen-MT accepts both English names and codes. Using mapped codes is more precise.
  const getQwenMtLangCode = (lang: string) => {
    if (lang === "auto") return "auto";
    const mapping: Record<string, string> = {
      "zh-hant": "zh_tw",
      "pt-br": "pt",
      "pt-pt": "pt",
      fil: "tl",
    };
    return mapping[lang] || lang;
  };

  const sourceLangCode = getQwenMtLangCode(sourceLanguage);
  const targetLangCode = getQwenMtLangCode(targetLanguage);

  const translationOptions: any = {
    source_lang: sourceLangCode,
    target_lang: targetLangCode,
  };

  if (domains && domains.trim()) {
    translationOptions.domains = domains.trim();
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: text }],
      model: model || defaultConfigs.qwenMt.model,
      translation_options: translationOptions,
      stream: false,
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "Qwen-MT");
};
