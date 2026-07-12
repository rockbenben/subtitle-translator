import type { FastifyInstance } from "fastify";
import { defaultConfigs, getProviderModels, languages, TRANSLATION_PROVIDERS } from "@subtitle-translator/translation-core";

export const registerMetadataRoutes = async (app: FastifyInstance) => {
  app.get("/api/v1/languages", async () => ({ languages }));

  app.get("/api/v1/providers", async () => ({
    providers: TRANSLATION_PROVIDERS.map((provider) => ({
      ...provider,
      defaultConfig: defaultConfigs[provider.value as keyof typeof defaultConfigs],
      models: getProviderModels(provider.value),
    })),
  }));
};
