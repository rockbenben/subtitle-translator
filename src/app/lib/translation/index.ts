// Translation barrel: re-exports submodules + top-level testTranslation /
// translateText / useTranslation orchestration.

"use client";

import type { TranslateTextParams, TranslationConfig, TranslationMethod } from "./types";
import { deriveThinkingParams } from "./registry";
import { translationServices } from "./services";
import { generateCacheKey, getCachedTranslation, setCachedTranslation } from "./cache";
import { cleanTranslatedText } from "./utils";

// Re-export everything for backwards compatibility
export * from "./types";
export * from "./registry";
export * from "./config";
export * from "./cache";
export * from "./languages-data";
export * from "./utils";
export { translationServices } from "./services";
export { completeOpenAICompatUrl } from "./services/shared";

/**
 * Core reachability probe: runs one real "Hello, world!" translation and THROWS
 * on failure, so callers can classify the error (transient vs definitive). Used
 * by the translator's smart pre-flight gate (validate()); testTranslation wraps
 * it for the boolean API the manual "Test Connection" buttons use.
 */
export const runReachabilityProbe = async (translationMethod: TranslationMethod, config: Partial<TranslateTextParams>, systemPrompt?: string, userPrompt?: string, signal?: AbortSignal): Promise<string> => {
  const params: TranslateTextParams = {
    text: "Hello, world!",
    targetLanguage: "zh",
    sourceLanguage: "en",
    cacheSuffix: "test",
    translationMethod,
    useCache: false,
    ...config,
    ...(systemPrompt && { systemPrompt }),
    ...(userPrompt && { userPrompt }),
    ...(signal && { signal }),
  };
  const result = await translationServices[translationMethod](params);
  if (!result) throw new Error("Translation Test failed, no result received.");
  return result;
};

/**
 * Test translation with a given method and config for the manual "Test Connection"
 * UI. Returns `null` on success, or the caught ERROR OBJECT \u2014 callers render it
 * via describeError(error, t), which keeps the raw reason ("[403] \u2026", "Failed to
 * fetch") AND appends the status-mapped localized hint (common.errorHint*). \u8fd4\u56de
 * \u5bf9\u8c61\u800c\u975e message \u5b57\u7b26\u4e32,\u662f\u4e3a\u4e86\u628a .status \u5e26\u5230\u5c55\u793a\u5c42 \u2014\u2014 i18n \u63d0\u793a\u6309\u5b83\u67e5\u952e\u3002
 */
export const testTranslation = async (translationMethod: TranslationMethod, config: Partial<TranslateTextParams>, systemPrompt?: string, userPrompt?: string, signal?: AbortSignal): Promise<unknown | null> => {
  try {
    const result = await runReachabilityProbe(translationMethod, config, systemPrompt, userPrompt, signal);
    // Probe target is zh, so result should contain Chinese \u2014 warn (not fail) if not.
    if (!/[\u4e00-\u9fa5]/.test(result)) {
      console.warn("Translation result does not contain Chinese characters, may not have actually translated:", result);
    }
    // Warn if result is identical to source (possible translation failure)
    if (result === "Hello, world!") {
      console.warn("Translation returned original text unchanged, may indicate translation service issue");
    }
    return null;
  } catch (error) {
    console.error("Translation Test failed", error);
    return error ?? new Error("Unknown test failure");
  }
};

/**
 * 两个「测试连接」按钮(ApiStatusBlock / TranslationSettings)的共用入口:
 * testTranslation + 超时控制 + thinking 参数派生,一处实现。
 *
 * 超时取调用方传入的 requestTimeoutSec —— 与正式翻译同源。原则(同
 * retry.ts 的 preflight gate):Test 不得比它守护的翻译更严格;30s 硬编码
 * 曾让"慢速本地思考模型"(思考半分钟才出首字)测试假阴性、翻译却能跑。
 *
 * 返回 { error, timedOut }:timedOut 让调用方把中止归类为"测试超时",
 * 而不是裸 abort 文案;error 为原始错误对象(展示层经 describeError 渲染)。
 */
export const testTranslationWithTimeout = async (
  translationMethod: TranslationMethod,
  config: TranslationConfig | undefined,
  timeoutSec: number,
  systemPrompt?: string,
  userPrompt?: string,
): Promise<{ error: unknown; timedOut: boolean }> => {
  // Mirror the orchestrator's gate so the Test exercises the same wire payload
  // as actual translation (effort level — undefined = thinking off).
  const testParams: Partial<TranslateTextParams> = {
    ...(config as Partial<TranslateTextParams>),
    reasoningEffort: deriveThinkingParams(translationMethod, config),
  };
  const controller = new AbortController();
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutSec * 1000);
  try {
    const error = await testTranslation(translationMethod, testParams, systemPrompt, userPrompt, controller.signal);
    return { error, timedOut };
  } finally {
    clearTimeout(timeout);
  }
};

// Skip translation if text has no translatable characters
const HAS_TRANSLATABLE_CONTENT = /[a-zA-Z\p{L}]/u;

// Services whose responses HTML-encode characters (Google NMT backends) —
// the only ones whose output should be entity-unescaped. See translateText.
const HTML_ENCODING_METHODS: ReadonlySet<string> = new Set(["gtxFreeAPI", "google", "webgoogletranslate"]);

/**
 * Translate text using the specified method
 * Throws on error to allow retry logic to work properly
 */
const translateText = async (params: TranslateTextParams): Promise<string> => {
  const { text, cacheSuffix, translationMethod, targetLanguage, sourceLanguage, useCache = true } = params;

  if (!HAS_TRANSLATABLE_CONTENT.test(text) || sourceLanguage === targetLanguage) {
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

  // HTML-entity unescape ONLY for Google's NMT-backed services — they encode
  // apostrophes/brackets in their responses. Other providers (LLMs, DeepL)
  // return faithfully escaped content; unescaping it engine-wide changed
  // document semantics (&lt;div&gt; in an HTML-escaped doc became a real tag)
  // and cached the corrupted form.
  const cleanedText = HTML_ENCODING_METHODS.has(translationMethod) ? cleanTranslatedText(translatedText) : translatedText;
  // Fire-and-forget cache write — failures swallowed in indexedDBStorage.set,
  // and the next read of this key is ≥1s later (retry interval) so the write
  // has plenty of time to settle. Awaiting would add 5-50ms per line for nothing.
  if (useCache) {
    void setCachedTranslation(cacheKey, cleanedText);
  }

  return cleanedText;
};

/**
 * React hook for translation
 */
export const useTranslation = () => ({
  translate: translateText,
});
