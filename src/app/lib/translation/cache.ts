// Translation cache utilities

import SparkMD5 from "spark-md5";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./config";
import { LLM_MODELS } from "./registry";
import type { TranslationConfig } from "./types";
import { normalizePrompt } from "./services/shared";
import { translationCache } from "@/app/lib/storage/indexedDBStorage";

export const CACHE_PREFIX = "t_";

export type CacheSuffixInput = {
  sourceLanguage: string;
  targetLanguage: string;
  translationMethod: string;
  /** Provider config from getSelectedConfig(); cache.ts picks which fields invalidate per method. */
  config?: TranslationConfig;
  systemPrompt?: string;
  /**
   * The prompt TEMPLATE (with `${text}` / `${fullText}` placeholders), not the
   * rendered request body. Hashing the template keeps the cache key stable
   * across inputs sharing the same prompt — passing the rendered string would
   * give every line a unique key and effectively disable caching.
   */
  userPrompt?: string;
};

/**
 * Build the cache-key suffix for a translation request. For methods whose
 * config affects output (LLM-style and Qwen-MT), hashes the relevant fields
 * into the suffix so config changes invalidate stale entries automatically.
 */
export const generateCacheSuffix = ({ sourceLanguage, targetLanguage, translationMethod, config, systemPrompt, userPrompt }: CacheSuffixInput): string => {
  const base = `${targetLanguage}_${sourceLanguage}_${translationMethod}`;

  if (LLM_MODELS.includes(translationMethod)) {
    const payload = {
      model: config?.model || "",
      temperature: config?.temperature ?? 1.0,
      systemPrompt: normalizePrompt(systemPrompt, DEFAULT_SYSTEM_PROMPT),
      userPrompt: normalizePrompt(userPrompt, DEFAULT_USER_PROMPT),
      // enableThinking=undefined and =false hash identically (preserves caches
      // from before the field existed); reasoningEffort only matters when on.
      ...(config?.enableThinking && { enableThinking: true, reasoningEffort: config?.reasoningEffort || "medium" }),
      // Custom OpenAI-compat toggle: when false, no system message is sent
      // (Gemma-family workaround). Hashing as a separate field keeps systemPrompt
      // semantically "what the user configured", so future normalizePrompt
      // tweaks can't collide "user cleared systemPrompt" with "toggle off".
      // undefined and true hash identically — preserves caches from before
      // the toggle existed.
      ...(config?.sendSystemPrompt === false && { sendSystemPrompt: false }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  if (translationMethod === "qwenMt") {
    // Qwen-MT is non-LLM but `model` (flash/turbo) and `domains` (free-form
    // domain hint) both alter upstream output. trim() matches what the service
    // does before sending, so " medical" and "medical" share an entry.
    const payload = {
      model: config?.model || "",
      domains: (config?.domains || "").trim(),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  if (translationMethod === "translategemma") {
    // TranslateGemma is also non-LLM (specialized MT). The `model` name (e.g.
    // translategemma-4b-it vs 9b-it) selects which weights load and is the
    // only knob that varies — temperature is hardcoded to 0 (greedy) so it
    // doesn't affect cache identity.
    const payload = { model: config?.model || "" };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  // Traditional MT (Google, DeepL, Azure ...): output is fully determined by
  // {text, source, target, method}, no extra config to hash.
  return base;
};

export const generateCacheKey = (text: string, cacheSuffix: string): string => {
  const encoded = text.length <= 32 ? encodeURIComponent(text) : null;
  const key = encoded && encoded.length <= 50 ? encoded : SparkMD5.hash(text);
  return `${CACHE_PREFIX}${key}_${cacheSuffix}`;
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
