import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import Fastify from "fastify";
import { registerMetadataRoutes } from "./routes/metadata.js";
import { registerProbeRoutes } from "./routes/probe.js";
import { registerSubtitleRoutes } from "./routes/subtitle.js";
import { registerTranslateRoutes } from "./routes/translate.js";

export const createApp = async () => {
  const app = Fastify({ logger: true });
  await app.register(cors, { origin: true });
  await app.register(multipart, { limits: { fileSize: 20 * 1024 * 1024 } });
  await registerMetadataRoutes(app);
  await registerProbeRoutes(app);
  await registerTranslateRoutes(app);
  await registerSubtitleRoutes(app);
  return app;
};
