import { cleanTranslatedText, generateCacheKey, type TranslateTextParams, type TranslationCache, type TranslationConfig, type TranslationMethod, deriveThinkingParams } from "@subtitle-translator/translation-core";
import { translationServices } from "./services/index.js";

const HAS_TRANSLATABLE_CONTENT = /[a-zA-Z\p{L}]/u;
const HTML_ENCODING_METHODS: ReadonlySet<string> = new Set(["gtxFreeAPI", "google", "webgoogletranslate"]);

export type ServerTranslateTextParams = TranslateTextParams & { cache?: TranslationCache };

export const translateText = async (params: ServerTranslateTextParams): Promise<string> => {
  const { text, cacheSuffix, translationMethod, targetLanguage, sourceLanguage, useCache = true, cache } = params;

  if (!HAS_TRANSLATABLE_CONTENT.test(text) || sourceLanguage === targetLanguage) return text;

  const cacheKey = generateCacheKey(text, cacheSuffix);
  if (useCache && cache) {
    const cached = await cache.get(cacheKey);
    if (cached) return cached;
  }

  const service = translationServices[translationMethod as TranslationMethod];
  if (!service) throw new Error(`Unsupported translation method: ${translationMethod}`);

  const translatedText = await service(params);
  if (!translatedText) throw new Error(`No translation result received for method: ${translationMethod}`);

  const cleanedText = HTML_ENCODING_METHODS.has(translationMethod) ? cleanTranslatedText(translatedText) : translatedText;
  if (useCache && cache) await cache.set(cacheKey, cleanedText);
  return cleanedText;
};

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

export const testTranslation = async (translationMethod: TranslationMethod, config: Partial<TranslateTextParams>, systemPrompt?: string, userPrompt?: string, signal?: AbortSignal): Promise<unknown | null> => {
  try {
    await runReachabilityProbe(translationMethod, config, systemPrompt, userPrompt, signal);
    return null;
  } catch (error) {
    return error ?? new Error("Unknown test failure");
  }
};

export const buildTranslateParams = (args: {
  text: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  cacheSuffix: string;
  config?: TranslationConfig;
  signal?: AbortSignal;
}): TranslateTextParams => ({
  text: args.text,
  translationMethod: args.translationMethod,
  targetLanguage: args.targetLanguage,
  sourceLanguage: args.sourceLanguage,
  cacheSuffix: args.cacheSuffix,
  useCache: true,
  ...(args.config ?? {}),
  reasoningEffort: deriveThinkingParams(args.translationMethod, args.config),
  ...(args.signal && { signal: args.signal }),
});
