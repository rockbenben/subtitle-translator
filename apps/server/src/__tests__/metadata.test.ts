import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getApp, closeApp } from "./setup.js";

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

describe("GET /api/v1/languages", () => {
  it("should return 200 with languages array", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/languages" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("languages");
    expect(Array.isArray(body.languages)).toBe(true);
    expect(body.languages.length).toBeGreaterThan(100);
  });

  it("should include common languages like en, zh, ja", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/languages" });
    const { languages } = JSON.parse(res.body);
    const codes = languages.map((l: { value: string }) => l.value);
    expect(codes).toContain("en");
    expect(codes).toContain("zh");
    expect(codes).toContain("ja");
    expect(codes).toContain("ko");
    expect(codes).toContain("auto");
  });

  it("should have correct structure for each language entry", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/languages" });
    const { languages } = JSON.parse(res.body);
    for (const lang of languages) {
      expect(lang).toHaveProperty("value");
      expect(lang).toHaveProperty("name");
      expect(typeof lang.value).toBe("string");
      expect(typeof lang.name).toBe("string");
    }
  });
});

describe("GET /api/v1/providers", () => {
  it("should return 200 with providers array", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/providers" });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("providers");
    expect(Array.isArray(body.providers)).toBe(true);
    expect(body.providers.length).toBeGreaterThan(20);
  });

  it("should include common providers like gtxFreeAPI, deepseek, openai", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/providers" });
    const { providers } = JSON.parse(res.body);
    const values = providers.map((p: { value: string }) => p.value);
    expect(values).toContain("gtxFreeAPI");
    expect(values).toContain("deepseek");
    expect(values).toContain("openai");
    expect(values).toContain("claude");
    expect(values).toContain("gemini");
  });

  it("should have correct structure for each provider entry", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/providers" });
    const { providers } = JSON.parse(res.body);
    for (const p of providers) {
      expect(p).toHaveProperty("value");
      expect(p).toHaveProperty("label");
      expect(p).toHaveProperty("defaultConfig");
      expect(typeof p.value).toBe("string");
      expect(typeof p.label).toBe("string");
    }
  });

  it("should provide defaultConfig for each provider", async () => {
    const app = await getApp();
    const res = await app.inject({ method: "GET", url: "/api/v1/providers" });
    const { providers } = JSON.parse(res.body);
    for (const p of providers) {
      expect(p.defaultConfig).toBeTypeOf("object");
    }
  });
});
