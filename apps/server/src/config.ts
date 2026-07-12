export const serverConfig = {
  version: "0.1.0",
  port: Number(process.env.PORT || 8787),
  host: process.env.HOST || "0.0.0.0",
  cacheMaxSize: Number(process.env.TRANSLATION_CACHE_MAX_SIZE || 10_000),
  cacheTtlMs: Number(process.env.TRANSLATION_CACHE_TTL_MS || 24 * 60 * 60 * 1000),
  maxConcurrentJobs: Math.max(1, Number(process.env.JOBS_MAX_CONCURRENT || 2)),
  maxQueuedJobs: Math.max(1, Number(process.env.JOBS_MAX_QUEUED || 100)),
  jobResultTtlMs: Number(process.env.JOBS_RESULT_TTL_MS || 24 * 60 * 60 * 1000),
  maxFileSize: Number(process.env.SERVER_MAX_FILE_SIZE || 20 * 1024 * 1024),
} as const;
