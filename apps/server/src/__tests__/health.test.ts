import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeApp, getApp } from "./setup.js";

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

describe("health routes", () => {
  it("returns liveness", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/healthz" });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body)).toEqual({ ok: true });
  });

  it("returns readiness details", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/readyz" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.ok).toBe(true);
    expect(body.cache).toHaveProperty("size");
    expect(body.jobs).toHaveProperty("total");
  });

  it("returns version metadata", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/version" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.name).toBe("@subtitle-translator/server");
    expect(body.limits).toHaveProperty("maxFileSize");
  });
});
