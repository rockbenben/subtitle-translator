import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { serverConfig } from "./config.js";
import { registerCacheRoutes } from "./routes/cache.js";
import { registerFileRoutes } from "./routes/files.js";
import { registerHealthRoutes } from "./routes/health.js";
import { registerJobRoutes } from "./routes/jobs.js";
import { registerMetadataRoutes } from "./routes/metadata.js";
import { registerProbeRoutes } from "./routes/probe.js";
import { registerSubtitleRoutes } from "./routes/subtitle.js";
import { registerTranslateRoutes } from "./routes/translate.js";

export const createApp = async () => {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: serverConfig.maxFileSize } });
  await registerHealthRoutes(app);
  await registerMetadataRoutes(app);
  await registerProbeRoutes(app);
  await registerTranslateRoutes(app);
  await registerSubtitleRoutes(app);
  await registerCacheRoutes(app);
  await registerJobRoutes(app);
  await registerFileRoutes(app);
  return app;
};
