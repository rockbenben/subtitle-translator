import type { FastifyInstance } from "fastify";
import { generateCacheSuffix, getErrorMessage, type GlossaryTerm, type TranslationConfig } from "@subtitle-translator/translation-core";
import { translationCache } from "../cache.js";
import { translateBatch } from "../pipeline.js";
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

export const registerTranslateRoutes = async (app: FastifyInstance) => {
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
};
