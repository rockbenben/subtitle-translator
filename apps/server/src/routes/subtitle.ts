import type { FastifyInstance } from "fastify";
import { getErrorMessage, type GlossaryTerm, type TranslationConfig } from "@subtitle-translator/translation-core";
import { translationCache } from "../cache.js";
import { inspectSubtitle, parseSubtitle, translateSubtitleContent } from "../subtitle.js";

type SubtitleBody = {
  content: string;
  format?: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  config?: TranslationConfig;
  glossaryTerms?: GlossaryTerm[];
};

export const registerSubtitleRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: { content: string; format?: string } }>("/api/v1/subtitle/parse", async (request) => {
    return parseSubtitle(request.body.content, request.body.format);
  });

  app.post<{ Body: { content: string; format?: string } }>("/api/v1/subtitle/inspect", async (request) => {
    return inspectSubtitle(request.body.content, request.body.format);
  });

  app.post<{ Body: SubtitleBody }>("/api/v1/subtitle/translate", async (request, reply) => {
    try {
      const body = request.body;
      return await translateSubtitleContent({
        ...body,
        cache: translationCache,
      });
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });

  app.post<{ Body: SubtitleBody & { targetLanguages: string[] } }>("/api/v1/subtitle/translate/multi-target", async (request, reply) => {
    try {
      const body = request.body;
      const entries = await Promise.all(
        body.targetLanguages.map(async (targetLanguage) => [
          targetLanguage,
          await translateSubtitleContent({ ...body, targetLanguage, cache: translationCache }),
        ] as const),
      );
      return { results: Object.fromEntries(entries) };
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });
};
