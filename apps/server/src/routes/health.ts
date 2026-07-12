import type { FastifyInstance } from "fastify";
import { serverConfig } from "../config.js";
import { jobStore } from "../jobs/store.js";
import { translationCache } from "../cache.js";

export const registerHealthRoutes = async (app: FastifyInstance) => {
  app.get("/healthz", async () => ({ ok: true }));

  app.get("/readyz", async () => ({
    ok: true,
    cache: translationCache.stats(),
    jobs: jobStore.summary(),
  }));

  app.get("/api/v1/version", async () => ({
    name: "@subtitle-translator/server",
    version: serverConfig.version,
    nodeVersion: process.version,
    limits: {
      maxFileSize: serverConfig.maxFileSize,
      maxConcurrentJobs: serverConfig.maxConcurrentJobs,
      maxQueuedJobs: serverConfig.maxQueuedJobs,
      jobResultTtlMs: serverConfig.jobResultTtlMs,
    },
  }));
};
