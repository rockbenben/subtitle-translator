import { getErrorMessage, type GlossaryTerm, type TranslationConfig } from "@subtitle-translator/translation-core";
import { translationCache } from "../cache.js";
import { translateBatch, translateTextContent } from "../pipeline.js";
import { translateSubtitleContent } from "../subtitle.js";
import { jobStore } from "./store.js";

type BaseTranslationPayload = {
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  config?: TranslationConfig;
  glossaryTerms?: GlossaryTerm[];
};

type JobPayload =
  | ({ type: "translate.batch"; texts: string[]; documentType?: "subtitle" | "markdown" | "generic" } & BaseTranslationPayload)
  | ({ type: "translate.text"; text: string; documentType?: "subtitle" | "markdown" | "generic" } & BaseTranslationPayload)
  | ({ type: "translate.multiTarget"; texts: string[]; targetLanguages: string[]; documentType?: "subtitle" | "markdown" | "generic" } & Omit<BaseTranslationPayload, "targetLanguage">)
  | ({ type: "subtitle.translate"; content: string; format?: string } & BaseTranslationPayload)
  | ({ type: "subtitle.translate.multiTarget"; content: string; format?: string; targetLanguages: string[] } & Omit<BaseTranslationPayload, "targetLanguage">);

const assertNever = (value: never): never => {
  throw new Error(`Unsupported job type: ${(value as { type?: string }).type}`);
};

export const runJob = (jobId: string, payload: JobPayload): void => {
  void (async () => {
    const signal = jobStore.signal(jobId);
    try {
      jobStore.setStatus(jobId, "running");
      const onProgress = (current: number, total: number) => jobStore.setProgress(jobId, { current, total });
      let result: unknown;
      switch (payload.type) {
        case "translate.batch":
          result = await translateBatch({ ...payload, cache: translationCache, signal, onProgress });
          break;
        case "translate.text":
          result = await translateTextContent(payload.text, { ...payload, cache: translationCache, signal, onProgress });
          break;
        case "translate.multiTarget": {
          const entries = await Promise.all(
            payload.targetLanguages.map(async (targetLanguage, index) => {
              jobStore.setProgress(jobId, { current: index, total: payload.targetLanguages.length, message: targetLanguage });
              return [
                targetLanguage,
                await translateBatch({ ...payload, targetLanguage, cache: translationCache, signal }),
              ] as const;
            }),
          );
          jobStore.setProgress(jobId, { current: payload.targetLanguages.length, total: payload.targetLanguages.length });
          result = { results: Object.fromEntries(entries) };
          break;
        }
        case "subtitle.translate":
          result = await translateSubtitleContent({ ...payload, cache: translationCache, signal, onProgress });
          break;
        case "subtitle.translate.multiTarget": {
          const entries = await Promise.all(
            payload.targetLanguages.map(async (targetLanguage, index) => {
              jobStore.setProgress(jobId, { current: index, total: payload.targetLanguages.length, message: targetLanguage });
              return [
                targetLanguage,
                await translateSubtitleContent({ ...payload, targetLanguage, cache: translationCache, signal }),
              ] as const;
            }),
          );
          jobStore.setProgress(jobId, { current: payload.targetLanguages.length, total: payload.targetLanguages.length });
          result = { results: Object.fromEntries(entries) };
          break;
        }
        default:
          assertNever(payload);
      }
      const maybeStats = (result as { stats?: unknown } | null)?.stats;
      jobStore.complete(jobId, result, maybeStats);
    } catch (error) {
      const current = jobStore.get(jobId);
      if (current?.status === "cancelled" || signal?.aborted) {
        jobStore.cancel(jobId);
        return;
      }
      jobStore.fail(jobId, { message: getErrorMessage(error), status: (error as { status?: number } | null)?.status });
    }
  })();
};

export type { JobPayload };
