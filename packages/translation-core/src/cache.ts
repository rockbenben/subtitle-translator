import SparkMD5 from "spark-md5";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./config.js";
import { LLM_MODELS, deriveThinkingParams } from "./registry.js";
import type { GlossaryTerm } from "./glossary.js";
import type { TranslationConfig } from "./types.js";
import { normalizePrompt } from "./utils.js";

export interface TranslationCache {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<number>;
}

export const CACHE_PREFIX = "t_";

export type CacheSuffixInput = {
  sourceLanguage: string;
  targetLanguage: string;
  translationMethod: string;
  config?: TranslationConfig;
  systemPrompt?: string;
  userPrompt?: string;
  glossaryTerms?: GlossaryTerm[];
};

const hashableTerms = (terms?: GlossaryTerm[]): string[][] | undefined => {
  const complete = (terms ?? []).filter((t) => t.source.trim() && t.target.trim()).map((t) => [t.source.trim(), t.target.trim()]);
  return complete.length > 0 ? complete : undefined;
};

export const generateCacheSuffix = ({ sourceLanguage, targetLanguage, translationMethod, config, systemPrompt, userPrompt, glossaryTerms }: CacheSuffixInput): string => {
  const base = `${targetLanguage}_${sourceLanguage}_${translationMethod}`;
  const terms = hashableTerms(glossaryTerms);

  if (LLM_MODELS.includes(translationMethod)) {
    const payload = {
      model: config?.model || "",
      temperature: config?.temperature ?? 1.0,
      systemPrompt: normalizePrompt(systemPrompt, DEFAULT_SYSTEM_PROMPT),
      userPrompt: normalizePrompt(userPrompt, DEFAULT_USER_PROMPT),
      reasoningEffort: deriveThinkingParams(translationMethod, config),
      ...(config?.maxTokens && config.maxTokens > 0 && { maxTokens: config.maxTokens }),
      ...(config?.sendSystemPrompt === false && { sendSystemPrompt: false }),
      ...(typeof config?.url === "string" && config.url.trim() && { url: config.url.trim() }),
      ...(terms && { glossaryTerms: terms }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  if (translationMethod === "qwenMt") {
    const payload = {
      model: config?.model || "",
      domains: (config?.domains || "").trim(),
      ...(terms && { glossaryTerms: terms }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  if (translationMethod === "translategemma") {
    const payload = {
      model: config?.model || "",
      ...(typeof config?.url === "string" && config.url.trim() && { url: config.url.trim() }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  return base;
};

export const generateCacheKey = (text: string, cacheSuffix: string): string => {
  const stringWithWellFormed = text as string & { isWellFormed?: () => boolean; toWellFormed?: () => string };
  const safe = stringWithWellFormed.isWellFormed?.() === false ? stringWithWellFormed.toWellFormed?.() ?? text.replace(/[\uD800-\uDFFF]/g, "�") : text;
  const encoded = safe.length <= 32 ? encodeURIComponent(safe) : null;
  const key = encoded && encoded.length <= 50 ? encoded : SparkMD5.hash(safe);
  return `${CACHE_PREFIX}${key}_${cacheSuffix}`;
};
