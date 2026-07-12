import type { FastifyInstance } from "fastify";
import { ApiError, toErrorResponse } from "../http/errors.js";
import { runJob, type JobPayload } from "../jobs/runner.js";
import { jobStore } from "../jobs/store.js";

const getJobOrThrow = (jobId: string | undefined) => {
  if (!jobId) throw new ApiError("jobId is required", 400, "VALIDATION_ERROR");
  const job = jobStore.get(jobId);
  if (!job) throw new ApiError("Job not found", 404, "JOB_NOT_FOUND");
  return job;
};

export const registerJobRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: JobPayload }>("/api/v1/jobs", async (request) => {
    const { job } = jobStore.create(request.body.type);
    runJob(job.id, request.body);
    return {
      jobId: job.id,
      status: job.status,
      links: {
        self: `/api/v1/jobs/${job.id}`,
        events: `/api/v1/jobs/${job.id}/events`,
        result: `/api/v1/jobs/${job.id}/result`,
      },
    };
  });

  app.get<{ Params: { jobId: string } }>("/api/v1/jobs/:jobId", async (request, reply) => {
    try {
      return getJobOrThrow(request.params.jobId);
    } catch (error) {
      const response = toErrorResponse(error);
      reply.code(response.status);
      return response.body;
    }
  });

  app.get<{ Params: { jobId: string } }>("/api/v1/jobs/:jobId/result", async (request, reply) => {
    try {
      const job = getJobOrThrow(request.params.jobId);
      if (job.status !== "succeeded") throw new ApiError(`Job is ${job.status}`, 409, "JOB_NOT_READY");
      return job.result;
    } catch (error) {
      const response = toErrorResponse(error);
      reply.code(response.status);
      return response.body;
    }
  });

  app.post<{ Params: { jobId: string } }>("/api/v1/jobs/:jobId/cancel", async (request, reply) => {
    try {
      getJobOrThrow(request.params.jobId);
      return jobStore.cancel(request.params.jobId);
    } catch (error) {
      const response = toErrorResponse(error);
      reply.code(response.status);
      return response.body;
    }
  });

  app.delete<{ Params: { jobId: string } }>("/api/v1/jobs/:jobId", async (request, reply) => {
    try {
      getJobOrThrow(request.params.jobId);
      return { deleted: jobStore.delete(request.params.jobId) };
    } catch (error) {
      const response = toErrorResponse(error);
      reply.code(response.status);
      return response.body;
    }
  });

  app.get<{ Params: { jobId: string } }>("/api/v1/jobs/:jobId/events", async (request, reply) => {
    const job = getJobOrThrow(request.params.jobId);
    reply.raw.writeHead(200, {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    });
    const write = () => {
      const current = jobStore.get(job.id);
      if (!current) return false;
      reply.raw.write(`event: job.update\ndata: ${JSON.stringify(current)}\n\n`);
      return ["succeeded", "failed", "cancelled"].includes(current.status);
    };
    if (write()) {
      reply.raw.end();
      return reply;
    }
    const interval = setInterval(() => {
      if (write()) {
        clearInterval(interval);
        reply.raw.end();
      }
    }, 1000);
    request.raw.on("close", () => clearInterval(interval));
    return reply;
  });
};
