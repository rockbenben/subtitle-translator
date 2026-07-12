import { createApp } from "../app.js";
import type { FastifyInstance } from "fastify";

let app: FastifyInstance;

export const getApp = async (): Promise<FastifyInstance> => {
  if (!app) {
    app = await createApp();
    await app.ready();
  }
  return app;
};

export const closeApp = async (): Promise<void> => {
  if (app) {
    await app.close();
  }
};
