// Translation services - Traditional APIs (GTX, Google, DeepL, Azure)

import type { TranslationService } from "../types";

import { getErrorMessage, requireApiKey } from "./shared";

const isLocalDevelopment = process.env.NODE_ENV === "development";
const deeplEndpoint = isLocalDevelopment ? "/api/deepl" : "https://api-edgeone.newzone.top/api/deepl";
const deeplxEndpoint = "https://deeplx.aishort.top/translate";

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
    target_lang: targetLanguage,
    authKey: key,
    ...(sourceLanguage !== "auto" && { source_lang: sourceLanguage }),
  };

  const apiEndpoint = url || deeplEndpoint;
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
    target_lang: targetLanguage,
    ...(sourceLanguage !== "auto" && { source_lang: sourceLanguage }),
  };

  const apiEndpoint = url || deeplxEndpoint;
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
