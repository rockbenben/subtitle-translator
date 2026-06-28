import pLimit from "p-limit";
import pRetry from "p-retry";
import {
  applyGlossaryToText,
  buildGlossaryPromptBlock,
  buildStrictGlossaryPromptBlock,
  DEFAULT_RETRY_COUNT,
  DEFAULT_RETRY_TIMEOUT,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  filterTermsMatchingText,
  findGlossaryViolations,
  generateCacheSuffix,
  getRetryConfig,
  getErrorMessage,
  isBlankLine,
  rateLimitGate,
  splitTextIntoChunks,
  type GlossaryTerm,
  type TranslationCache,
  type TranslationConfig,
} from "@subtitle-translator/translation-core";
import { buildTranslateParams, translateText } from "./translate.js";

export interface TranslateBatchOptions {
  texts: string[];
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  config?: TranslationConfig;
  cache?: TranslationCache;
  signal?: AbortSignal;
  glossaryTerms?: GlossaryTerm[];
  documentType?: "subtitle" | "markdown" | "generic";
  onProgress?: (current: number, total: number) => void;
}

type ServerTranslationConfig = TranslationConfig & { requestTimeoutSec?: number };

export interface TranslateBatchResult {
  translations: string[];
  stats: { total: number; cached: number; translated: number; failed: number; errors: Array<{ index: number; error: string }>; timeMs: number };
}

const withTimeoutSignal = (parent: AbortSignal | undefined, timeoutMs: number): AbortSignal => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  parent?.addEventListener("abort", abort, { once: true });
  controller.signal.addEventListener(
    "abort",
    () => {
      clearTimeout(timeout);
      parent?.removeEventListener("abort", abort);
    },
    { once: true },
  );
  return controller.signal;
};

export const translateBatch = async (opts: TranslateBatchOptions): Promise<TranslateBatchResult> => {
  const start = Date.now();
  const config: ServerTranslationConfig = opts.config ?? {};
  const total = opts.texts.length;
  const translations = new Array<string>(total);
  const errors: Array<{ index: number; error: string }> = [];
  let completed = 0;
  let translated = 0;
  let cached = 0;

  const cacheSuffix = generateCacheSuffix({
    sourceLanguage: opts.sourceLanguage,
    targetLanguage: opts.targetLanguage,
    translationMethod: opts.translationMethod,
    config,
    systemPrompt: config.systemPrompt,
    userPrompt: config.userPrompt,
    glossaryTerms: opts.glossaryTerms,
  });

  const concurrency = Math.max(1, Number(config.batchSize || 10));
  const limit = pLimit(concurrency);
  const retryConfig = getRetryConfig(opts.translationMethod, { retryCount: DEFAULT_RETRY_COUNT, requestTimeoutSec: DEFAULT_RETRY_TIMEOUT });

  await Promise.all(
    opts.texts.map((source, index) =>
      limit(async () => {
        try {
          if (isBlankLine(source)) {
            translations[index] = source;
            return;
          }
          const matchingTerms = filterTermsMatchingText(opts.glossaryTerms ?? [], source);
          const glossaryPrompt = buildGlossaryPromptBlock(matchingTerms);
          const translateOnce = async (strictTerms?: GlossaryTerm[]) => {
            await rateLimitGate.wait(opts.translationMethod, opts.signal);
            const signal = withTimeoutSignal(opts.signal, Number(config.requestTimeoutSec || DEFAULT_RETRY_TIMEOUT) * 1000);
            const params = buildTranslateParams({
              text: source,
              translationMethod: opts.translationMethod,
              targetLanguage: opts.targetLanguage,
              sourceLanguage: opts.sourceLanguage,
              cacheSuffix,
              config: {
                ...config,
                systemPrompt: `${config.systemPrompt || DEFAULT_SYSTEM_PROMPT}${strictTerms?.length ? buildStrictGlossaryPromptBlock(strictTerms) : glossaryPrompt}`,
                userPrompt: config.userPrompt || DEFAULT_USER_PROMPT,
              },
              signal,
            });
            return translateText({ ...params, cache: opts.cache });
          };

          let result = await pRetry(() => translateOnce(), retryConfig);
          const beforeGlossary = result;
          result = applyGlossaryToText(result, matchingTerms);
          const violations = findGlossaryViolations(source, result, matchingTerms);
          if (violations.length > 0) {
            result = applyGlossaryToText(await pRetry(() => translateOnce(violations), retryConfig), matchingTerms);
          }
          translations[index] = result;
          if (beforeGlossary === result) translated += 1;
          else translated += 1;
        } catch (error) {
          translations[index] = source;
          errors.push({ index, error: getErrorMessage(error) });
          const retryAfterMs = (error as { retryAfterMs?: number })?.retryAfterMs;
          if ((error as { status?: number })?.status === 429) rateLimitGate.trip(opts.translationMethod, retryAfterMs);
        } finally {
          completed += 1;
          opts.onProgress?.(completed, total);
        }
      }),
    ),
  );

  return { translations, stats: { total, cached, translated, failed: errors.length, errors, timeMs: Date.now() - start } };
};

export const translateTextContent = async (text: string, opts: Omit<TranslateBatchOptions, "texts">): Promise<TranslateBatchResult> => {
  const delimiter = "\n";
  const chunkSize = opts.config?.chunkSize;
  const texts = chunkSize && chunkSize > 0 ? splitTextIntoChunks(text, chunkSize, delimiter) : text.split(delimiter);
  return translateBatch({ ...opts, texts });
};
