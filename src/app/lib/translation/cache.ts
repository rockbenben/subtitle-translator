// Translation cache utilities

import SparkMD5 from "spark-md5";
import { DEFAULT_SYS_PROMPT, DEFAULT_USER_PROMPT, LLM_MODELS } from "./config";
import { translationCache } from "@/app/lib/storage/indexedDBStorage";

export const CACHE_PREFIX = "t_";

const normalizePrompt = (value: string | undefined, fallback: string) => (typeof value === "string" && value.trim() ? value : fallback);

export const generateCacheSuffix = (
  sourceLanguage: string,
  targetLanguage: string,
  translationMethod: string,
  params: { model?: string; temperature?: number; sysPrompt?: string; userPrompt?: string } = {}
): string => {
  let cacheSuffix = `${targetLanguage}_${sourceLanguage}_${translationMethod}`;

  if (LLM_MODELS.includes(translationMethod)) {
    const llmConfig = JSON.stringify({
      model: params.model || "",
      temperature: params.temperature || 0,
      sysPrompt: normalizePrompt(params.sysPrompt, DEFAULT_SYS_PROMPT),
      userPrompt: normalizePrompt(params.userPrompt, DEFAULT_USER_PROMPT),
    });
    const llmConfigHash = SparkMD5.hash(llmConfig);
    cacheSuffix = `${cacheSuffix}_${llmConfigHash}`;
  }

  return cacheSuffix;
};

export const generateCacheKey = (text: string, cacheSuffix: string): string => {
  if (text.length > 32) {
    return `${CACHE_PREFIX}${SparkMD5.hash(text)}_${cacheSuffix}`;
  }
  const encoded = encodeURIComponent(text);
  return encoded.length > 50 ? `${CACHE_PREFIX}${SparkMD5.hash(text)}_${cacheSuffix}` : `${CACHE_PREFIX}${encoded}_${cacheSuffix}`;
};

export const getCachedTranslation = async (cacheKey: string): Promise<string | null> => {
  return translationCache.get(cacheKey);
};

export const setCachedTranslation = async (cacheKey: string, translation: string): Promise<void> => {
  return translationCache.set(cacheKey, translation);
};

export const clearTranslationCache = async (): Promise<number> => {
  return translationCache.clear();
};
