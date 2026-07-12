import type { FastifyInstance, FastifyRequest } from "fastify";
import { ApiError, toErrorResponse } from "../http/errors.js";
import { runJob, type JobPayload } from "../jobs/runner.js";
import { jobStore } from "../jobs/store.js";
import { inspectSubtitle, parseSubtitle } from "../subtitle.js";

const readMultipartText = async (request: FastifyRequest): Promise<{ filename: string; content: string; fields: Record<string, string> }> => {
  const parts = request.parts();
  const fields: Record<string, string> = {};
  let filename = "subtitle.txt";
  let content: string | undefined;

  for await (const part of parts) {
    if (part.type === "file") {
      filename = part.filename || filename;
      const buffer = await part.toBuffer();
      content = buffer.toString("utf8");
    } else {
      fields[part.fieldname] = String(part.value ?? "");
    }
  }

  if (content === undefined) throw new ApiError("Missing subtitle file", 400, "VALIDATION_ERROR");
  return { filename, content, fields };
};

const buildTranslationPayload = (fields: Record<string, string>, content: string): JobPayload => {
  const config = fields.config ? JSON.parse(fields.config) : undefined;
  const glossaryTerms = fields.glossaryTerms ? JSON.parse(fields.glossaryTerms) : undefined;
  return {
    type: "subtitle.translate",
    content,
    format: fields.format || undefined,
    translationMethod: fields.translationMethod,
    sourceLanguage: fields.sourceLanguage,
    targetLanguage: fields.targetLanguage,
    config,
    glossaryTerms,
  };
};

export const registerFileRoutes = async (app: FastifyInstance) => {
  app.post("/api/v1/files/subtitle/parse", async (request, reply) => {
    try {
      const { filename, content, fields } = await readMultipartText(request);
      return { filename, ...parseSubtitle(content, fields.format || undefined), inspect: inspectSubtitle(content, fields.format || undefined) };
    } catch (error) {
      const response = toErrorResponse(error);
      reply.code(response.status);
      return response.body;
    }
  });

  app.post("/api/v1/files/subtitle/translate", async (request, reply) => {
    try {
      const { filename, content, fields } = await readMultipartText(request);
      const payload = buildTranslationPayload(fields, content);
      const { job } = jobStore.create(payload.type);
      runJob(job.id, payload);
      return {
        filename,
        jobId: job.id,
        status: job.status,
        links: {
          self: `/api/v1/jobs/${job.id}`,
          events: `/api/v1/jobs/${job.id}/events`,
          result: `/api/v1/jobs/${job.id}/result`,
        },
      };
    } catch (error) {
      const response = toErrorResponse(error);
      reply.code(response.status);
      return response.body;
    }
  });
};
