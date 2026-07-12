import type { FastifyInstance } from "fastify";
import { generateCacheSuffix, getErrorMessage, validateTranslationInputs, type GlossaryTerm, type TranslationConfig } from "@subtitle-translator/translation-core";
import { translationCache } from "../cache.js";
import { translateBatch, translateTextContent } from "../pipeline.js";
import { buildTranslateParams, translateText } from "../translate.js";

type TranslateBody = {
  text: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  config?: TranslationConfig;
  glossaryTerms?: GlossaryTerm[];
  useCache?: boolean;
};

type BatchBody = Omit<TranslateBody, "text"> & {
  texts: string[];
  documentType?: "subtitle" | "markdown" | "generic";
};

type ValidateBody = Omit<TranslateBody, "text"> & {
  targetLanguages?: string[];
  multiLanguageMode?: boolean;
};

export const registerTranslateRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: ValidateBody }>("/api/v1/translate/validate", async (request) => {
    const body = request.body;
    const result = validateTranslationInputs({
      config: body.config ?? {},
      method: body.translationMethod,
      sourceLanguage: body.sourceLanguage,
      targetLanguage: body.targetLanguage,
      multiLanguageMode: body.multiLanguageMode ?? false,
      targetLanguages: body.targetLanguages ?? [],
    });
    if (result.ok) return { ok: true };
    const { ok: _ok, ...failure } = result;
    return { ok: false, ...failure };
  });

  app.post<{ Body: TranslateBody }>("/api/v1/translate", async (request, reply) => {
    try {
      const body = request.body;
      const config = body.config ?? {};
      const cacheSuffix = generateCacheSuffix({
        sourceLanguage: body.sourceLanguage,
        targetLanguage: body.targetLanguage,
        translationMethod: body.translationMethod,
        config,
        systemPrompt: config.systemPrompt,
        userPrompt: config.userPrompt,
        glossaryTerms: body.glossaryTerms,
      });
      const params = buildTranslateParams({ ...body, config, cacheSuffix });
      const translatedText = await translateText({ ...params, cache: translationCache, useCache: body.useCache ?? true });
      return { translatedText };
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });

  app.post<{ Body: BatchBody }>("/api/v1/translate/batch", async (request, reply) => {
    try {
      const body = request.body;
      return await translateBatch({
        texts: body.texts,
        translationMethod: body.translationMethod,
        targetLanguage: body.targetLanguage,
        sourceLanguage: body.sourceLanguage,
        config: body.config,
        glossaryTerms: body.glossaryTerms,
        documentType: body.documentType,
        cache: translationCache,
      });
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });

  app.post<{ Body: TranslateBody }>("/api/v1/translate/text", async (request, reply) => {
    try {
      const body = request.body;
      return await translateTextContent(body.text, {
        translationMethod: body.translationMethod,
        targetLanguage: body.targetLanguage,
        sourceLanguage: body.sourceLanguage,
        config: body.config,
        glossaryTerms: body.glossaryTerms,
        documentType: "generic",
        cache: translationCache,
      });
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });

  app.post<{ Body: BatchBody & { targetLanguages: string[] } }>("/api/v1/translate/multi-target", async (request, reply) => {
    try {
      const body = request.body;
      const entries = await Promise.all(
        body.targetLanguages.map(async (targetLanguage) => [
          targetLanguage,
          await translateBatch({
            texts: body.texts,
            translationMethod: body.translationMethod,
            targetLanguage,
            sourceLanguage: body.sourceLanguage,
            config: body.config,
            glossaryTerms: body.glossaryTerms,
            documentType: body.documentType,
            cache: translationCache,
          }),
        ] as const),
      );
      return { results: Object.fromEntries(entries) };
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });
};
