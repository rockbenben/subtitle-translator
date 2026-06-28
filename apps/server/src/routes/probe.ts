import type { FastifyInstance } from "fastify";
import { getErrorMessage, type TranslateTextParams, type TranslationMethod } from "@subtitle-translator/translation-core";
import { runReachabilityProbe } from "../translate.js";

type ProbeBody = Partial<TranslateTextParams> & { translationMethod: TranslationMethod };

export const registerProbeRoutes = async (app: FastifyInstance) => {
  app.post<{ Body: ProbeBody }>("/api/v1/translate/probe", async (request, reply) => {
    try {
      const { translationMethod, systemPrompt, userPrompt, ...config } = request.body;
      const result = await runReachabilityProbe(translationMethod, config, systemPrompt, userPrompt);
      return { ok: true, result };
    } catch (error) {
      reply.code(400);
      return { ok: false, error: { message: getErrorMessage(error), status: (error as { status?: number })?.status } };
    }
  });
};
