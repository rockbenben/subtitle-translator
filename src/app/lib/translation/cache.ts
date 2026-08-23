import SparkMD5 from "spark-md5";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "./config";
import { LLM_MODELS, deriveThinkingParams } from "./registry";
import type { GlossaryTerm } from "./glossary";
import type { TranslationConfig } from "./types";
import { normalizePrompt } from "./services/shared";

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
  /**
   * Active glossary terms for the run's target language. They alter upstream
   * output two ways: LLMs get a per-request prompt block (a deterministic
   * function of {text, full term set} — hashing the FULL set keeps the key
   * stable while the wire prompt varies per line), qwenMt gets native
   * translation_options.terms. Incomplete terms never reach the wire, so they
   * don't enter the hash; absent/empty hashes identical to pre-glossary keys.
   */
  glossaryTerms?: GlossaryTerm[];
};

// Stable, trimmed wire-relevant projection of the term list for hashing.
const hashableTerms = (terms?: GlossaryTerm[]): string[][] | undefined => {
  const complete = (terms ?? []).filter((t) => t.source.trim() && t.target.trim()).map((t) => [t.source.trim(), t.target.trim()]);
  return complete.length > 0 ? complete : undefined;
};

/**
 * Build the cache-key suffix for a translation request. For methods whose
 * config affects output (LLM-style and Qwen-MT), hashes the relevant fields
 * into the suffix so config changes invalidate stale entries automatically.
 */
export const generateCacheSuffix = ({ sourceLanguage, targetLanguage, translationMethod, config, systemPrompt, userPrompt, glossaryTerms }: CacheSuffixInput): string => {
  const base = `${targetLanguage}_${sourceLanguage}_${translationMethod}`;
  const terms = hashableTerms(glossaryTerms);

  if (LLM_MODELS.includes(translationMethod)) {
    const payload = {
      model: config?.model || "",
      temperature: config?.temperature ?? 1.0,
      systemPrompt: normalizePrompt(systemPrompt, DEFAULT_SYSTEM_PROMPT),
      userPrompt: normalizePrompt(userPrompt, DEFAULT_USER_PROMPT),
      // Effort goes into the hash only when deriveThinkingParams says it'll
      // actually be sent (tagged model + user picked an effort). Stale entries
      // for untagged SKUs don't bloat the cache key. JSON.stringify drops the
      // key when value is undefined, so cache-on vs cache-off shapes diverge.
      reasoningEffort: deriveThinkingParams(translationMethod, config),
      // maxTokens: truncated output is a different translation than uncapped;
      // hash it when set. undefined and 0 hash identically (both = no cap)
      // — preserves caches from before this knob existed.
      ...(config?.maxTokens && config.maxTokens > 0 && { maxTokens: config.maxTokens }),
      // Custom OpenAI-compat toggle: when false, no system message is sent
      // (Gemma-family workaround). Hashing as a separate field keeps systemPrompt
      // semantically "what the user configured", so future normalizePrompt
      // tweaks can't collide "user cleared systemPrompt" with "toggle off".
      // undefined and true hash identically — preserves caches from before
      // the toggle existed.
      ...(config?.sendSystemPrompt === false && { sendSystemPrompt: false }),
      // URL = the backend selector for Custom (llm) and any url-carrying
      // provider (universal on openai-compat). The Custom model field is DESIGNED to stay empty for
      // single-model servers (LM Studio / llama.cpp), so without hashing the
      // URL, pointing at a completely different backend replayed the old
      // model's translations from cache with zero wire traffic. Hashed only
      // when set — url-less providers keep their existing cache entries.
      ...(typeof config?.url === "string" && config.url.trim() && { url: config.url.trim() }),
      // Glossary terms steer the per-request prompt block. Key absent when no
      // complete terms — pre-glossary cache entries stay valid.
      ...(terms && { glossaryTerms: terms }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  if (translationMethod === "qwenMt") {
    // Qwen-MT is non-LLM but `model` (flash/turbo) and `domains` (free-form
    // domain hint) both alter upstream output. trim() matches what the service
    // does before sending, so " medical" and "medical" share an entry.
    // Glossary terms ride translation_options.terms (native terminology
    // intervention) — same key-absent-when-empty contract as the LLM branch.
    const payload = {
      model: config?.model || "",
      domains: (config?.domains || "").trim(),
      ...(terms && { glossaryTerms: terms }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  if (translationMethod === "translategemma" || translationMethod === "milmmt") {
    // Both are self-hosted specialized MT (non-LLM). The `model` name (e.g.
    // translategemma-4b-it vs 12b-it, MiLMMT-46-4B vs 12B) selects which
    // weights load; temperature is hardcoded to 0 (greedy) so it doesn't affect
    // cache identity. URL is hashed because it's the backend selector
    // (URL_IS_PRIMARY_CRED) — two hosts can serve different weights under the
    // same model string.
    // ⚠ 已知且【有意接受】的残留洞：模型名留空时语义是“用运行时当前
    // 加载的那个”，而这里只能把它当成 ""，于是同一个 URL 上换了权重
    // （1B → 12B）会全量命中旧缓存、零请求返回旧模型的译文。与 Custom (llm)
    // 完全同形（见上方 url 字段的注释：那里解决的是“换了地址”半边，
    // “同地址换了模型”这半边同样无法从客户端察觉）。三家保持同一种
    // 处理，别只给其中一家打补丁。用户切模型后想重跑：把模型名填上
    // （不同名字 ⇒ 不同缓存键），或在高级设置里关掉缓存。
    const payload = {
      model: config?.model || "",
      ...(typeof config?.url === "string" && config.url.trim() && { url: config.url.trim() }),
    };
    return `${base}_${SparkMD5.hash(JSON.stringify(payload))}`;
  }

  // Traditional MT (Google, DeepL, Azure ...): output is fully determined by
  // {text, source, target, method}, no extra config to hash.
  return base;
};

export const generateCacheKey = (text: string, cacheSuffix: string): string => {
  // 孤立代理项(JSON 转义残留的半个 emoji,如 "\ud83d")会让 encodeURIComponent
  // 和 spark-md5(内部 unescape(encodeURIComponent)) 双双抛 URIError —— 该行
  // 永久翻译失败且白烧全部重试预算。toWellFormed 把孤立代理换成 U+FFFD 后取键。
  // 键不再唯一区分 "a\ud83db" 与 "a�b"(两者上游产出一致,碰撞无害)。
  const safe = text.isWellFormed() ? text : text.toWellFormed();
  const encoded = safe.length <= 32 ? encodeURIComponent(safe) : null;
  const key = encoded && encoded.length <= 50 ? encoded : SparkMD5.hash(safe);
  return `${CACHE_PREFIX}${key}_${cacheSuffix}`;
};
