// Main translation module
// Re-exports all translation functionality from modular files

"use client";

import type { TranslateTextParams, TranslationMethod } from "./types";
import { translationServices } from "./services";
import { generateCacheKey, getCachedTranslation, setCachedTranslation } from "./cache";
import { cleanTranslatedText } from "./utils";

// Re-export everything for backwards compatibility
export * from "./types";
export * from "./config";
export * from "./cache";
export * from "./languages-data";
export * from "./utils";
export { translationServices } from "./services";

/**
 * Test translation with a given method and config
 */
export const testTranslation = async (translationMethod: TranslationMethod, config: Partial<TranslateTextParams>, sysPrompt?: string, userPrompt?: string): Promise<boolean> => {
  try {
    const params: TranslateTextParams = {
      text: "Hello, world!",
      targetLanguage: "zh",
      sourceLanguage: "en",
      cacheSuffix: "test",
      translationMethod,
      useCache: false,
      ...config,
      ...(sysPrompt && { sysPrompt }),
      ...(userPrompt && { userPrompt }),
    };

    const result = await translationServices[translationMethod](params);

    if (!result) throw new Error("Translation Test failed, no result received.");

    // Validate that translation actually occurred
    // For Chinese target language, result should contain Chinese characters
    if (params.targetLanguage === "zh" && !/[\u4e00-\u9fa5]/.test(result)) {
      console.warn("Translation result does not contain Chinese characters, may not have actually translated:", result);
    }

    // Warn if result is identical to source (possible translation failure)
    if (result === params.text) {
      console.warn("Translation returned original text unchanged, may indicate translation service issue");
    }

    return true;
  } catch (error) {
    console.error("Translation Test failed", error);
    return false;
  }
};

/**
 * Translate text using the specified method
 * Throws on error to allow retry logic to work properly
 */
const translateText = async (params: TranslateTextParams): Promise<string> => {
  const { text, cacheSuffix, translationMethod, targetLanguage, sourceLanguage, useCache = true } = params;

  // Skip translation if no translatable content
  if (!/[a-zA-Z\p{L}]/u.test(text) || sourceLanguage === targetLanguage) {
    return text;
  }

  // Check cache
  const cacheKey = generateCacheKey(text, cacheSuffix);
  if (useCache) {
    const cachedTranslation = await getCachedTranslation(cacheKey);
    if (cachedTranslation) return cachedTranslation;
  }

  // Get translation service
  const service = translationServices[translationMethod];
  if (!service) {
    throw new Error(`Unsupported translation method: ${translationMethod}`);
  }

  const translatedText = await service(params);

  if (!translatedText) {
    throw new Error(`No translation result received for method: ${translationMethod}`);
  }

  // Clean and cache result
  const cleanedText = cleanTranslatedText(translatedText);
  await setCachedTranslation(cacheKey, cleanedText);

  return cleanedText;
};

/**
 * React hook for translation
 */
export const useTranslation = () => {
  const translate = async (params: TranslateTextParams) => {
    return await translateText(params);
  };

  return {
    translate,
  };
};
