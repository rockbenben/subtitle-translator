import {
  detectSubtitleFormat,
  filterSubLines,
  parseCues,
  prepareAssForTranslation,
  restoreAssAfterTranslation,
  splitTextIntoLines,
  type GlossaryTerm,
  type TranslationConfig,
} from "@subtitle-translator/translation-core";
import type { TranslationCache } from "@subtitle-translator/translation-core";
import { translateBatch, type TranslateBatchResult } from "./pipeline.js";

export type SubtitleFormat = "ass" | "ssa" | "vtt" | "srt" | "lrc" | "sbv" | "error";

export type SubtitleTranslateOptions = {
  content: string;
  format?: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  config?: TranslationConfig;
  glossaryTerms?: GlossaryTerm[];
  cache?: TranslationCache;
  signal?: AbortSignal;
  onProgress?: (current: number, total: number) => void;
};

export const inspectSubtitle = (content: string, explicitFormat?: string) => {
  const lines = splitTextIntoLines(content);
  const format = (explicitFormat || detectSubtitleFormat(lines)) as SubtitleFormat;
  const normalizedFormat = format === "ssa" ? "ass" : format;
  const extracted = normalizedFormat !== "error" ? filterSubLines(lines, normalizedFormat) : { contentLines: [], contentIndices: [] };
  return {
    format,
    lineCount: lines.length,
    cueCount: format === "error" ? 0 : parseCues(content, format).length,
    translatableLineCount: extracted.contentLines.length,
    supported: format !== "error",
  };
};

export const parseSubtitle = (content: string, explicitFormat?: string) => {
  const lines = splitTextIntoLines(content);
  const format = explicitFormat || detectSubtitleFormat(lines);
  return { format, cues: parseCues(content, format) };
};

export const translateSubtitleContent = async (opts: SubtitleTranslateOptions): Promise<{ content: string; format: string; stats: TranslateBatchResult["stats"] }> => {
  const lines = splitTextIntoLines(opts.content);
  const format = opts.format || detectSubtitleFormat(lines);
  if (format === "error") throw new Error("Unsupported or invalid subtitle format");

  const extracted = filterSubLines(lines, format === "ssa" ? "ass" : format);
  const prepared = format === "ass" || format === "ssa" ? prepareAssForTranslation(extracted.contentLines) : null;
  const filtered = prepared ? { contentLines: prepared.cleanLines, contentIndices: extracted.contentIndices } : extracted;
  const result = await translateBatch({
    texts: filtered.contentLines,
    translationMethod: opts.translationMethod,
    targetLanguage: opts.targetLanguage,
    sourceLanguage: opts.sourceLanguage,
    config: opts.config,
    glossaryTerms: opts.glossaryTerms,
    documentType: "subtitle",
    cache: opts.cache,
    signal: opts.signal,
    onProgress: opts.onProgress,
  });
  const finalLines = prepared ? restoreAssAfterTranslation(result.translations, prepared.tagMaps) : result.translations;
  const outLines = [...lines];
  filtered.contentIndices.forEach((lineIndex, i) => {
    outLines[lineIndex] = finalLines[i] ?? outLines[lineIndex];
  });
  return { content: outLines.join("\n"), format, stats: result.stats };
};
