import type { FastifyInstance } from "fastify";
import { translationCache } from "../cache.js";

export const registerCacheRoutes = async (app: FastifyInstance) => {
  app.get("/api/v1/cache/stats", async () => ({ cache: translationCache.stats() }));

  app.post("/api/v1/cache/clear", async () => {
    const cleared = await translationCache.clear();
    return { cleared, cache: translationCache.stats() };
  });
};
