import type { FastifyInstance } from "fastify";
import {
  detectSubtitleFormat,
  filterSubLines,
  getErrorMessage,
  parseCues,
  restoreAssAfterTranslation,
  prepareAssForTranslation,
  splitTextIntoLines,
  type GlossaryTerm,
  type TranslationConfig,
} from "@subtitle-translator/translation-core";
import { translationCache } from "../cache.js";
import { translateBatch } from "../pipeline.js";

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
    const lines = splitTextIntoLines(request.body.content);
    const format = request.body.format || detectSubtitleFormat(lines);
    return { format, cues: parseCues(request.body.content, format) };
  });

  app.post<{ Body: SubtitleBody }>("/api/v1/subtitle/translate", async (request, reply) => {
    try {
      const body = request.body;
      const lines = splitTextIntoLines(body.content);
      const format = body.format || detectSubtitleFormat(lines);
      if (format === "error") {
        reply.code(400);
        return { error: { message: "Unsupported or invalid subtitle format" } };
      }
      const extracted = filterSubLines(lines, format === "ssa" ? "ass" : format);
      const prepared = format === "ass" || format === "ssa" ? prepareAssForTranslation(extracted.contentLines) : null;
      const filtered = prepared ? { contentLines: prepared.cleanLines, contentIndices: extracted.contentIndices } : extracted;
      const result = await translateBatch({
        texts: filtered.contentLines,
        translationMethod: body.translationMethod,
        targetLanguage: body.targetLanguage,
        sourceLanguage: body.sourceLanguage,
        config: body.config,
        glossaryTerms: body.glossaryTerms,
        documentType: "subtitle",
        cache: translationCache,
      });
      const finalLines = prepared ? restoreAssAfterTranslation(result.translations, prepared.tagMaps) : result.translations;
      const outLines = [...lines];
      filtered.contentIndices.forEach((lineIndex, i) => {
        outLines[lineIndex] = finalLines[i] ?? outLines[lineIndex];
      });
      return { content: outLines.join("\n"), format, stats: result.stats };
    } catch (error) {
      reply.code(400);
      return { error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });
};
