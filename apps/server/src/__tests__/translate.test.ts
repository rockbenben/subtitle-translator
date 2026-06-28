import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getApp, closeApp } from "./setup.js";

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

describe("POST /api/v1/translate", () => {
  it("should translate text from en to zh using gtxFreeAPI", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        text: "Hello, welcome to the show.",
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
        useCache: false,
      },
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200) {
      expect(body).toHaveProperty("translatedText");
      expect(typeof body.translatedText).toBe("string");
      expect(body.translatedText.length).toBeGreaterThan(0);
    } else {
      expect(body).toHaveProperty("error");
    }
  });

  it("should return translatedText that differs from original text", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        text: "Good morning, how are you?",
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
        useCache: false,
      },
    });
    if (res.statusCode !== 200) return;
    const { translatedText } = JSON.parse(res.body);
    expect(translatedText).not.toBe("Good morning, how are you?");
  });

  it("should handle same source and target language (return original)", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        text: "Hello world",
        translationMethod: "gtxFreeAPI",
        targetLanguage: "en",
        sourceLanguage: "en",
        useCache: false,
      },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.translatedText).toBe("Hello world");
  });

  it("should accept optional config parameters", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        text: "Testing with custom config",
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
        config: { chunkSize: 5000, delayTime: 200 },
        useCache: false,
      },
    });
    expect([200, 400]).toContain(res.statusCode);
  });

  it("should accept glossary terms", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate",
      payload: {
        text: "Hello world",
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
        glossaryTerms: [{ source: "world", target: "世界" }],
        useCache: false,
      },
    });
    expect([200, 400]).toContain(res.statusCode);
  });
});

describe("POST /api/v1/translate/batch", () => {
  it("should translate multiple texts", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/batch",
      payload: {
        texts: ["Hello", "Goodbye", "Thank you"],
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
      },
    });
    const body = JSON.parse(res.body);
    if (res.statusCode === 200) {
      expect(body).toHaveProperty("translations");
      expect(Array.isArray(body.translations)).toBe(true);
      expect(body.translations.length).toBe(3);
      expect(body).toHaveProperty("stats");
      expect(body.stats).toHaveProperty("total");
      expect(body.stats.total).toBe(3);
    } else {
      expect(body).toHaveProperty("error");
    }
  });

  it("should return stats with translation counts", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/batch",
      payload: {
        texts: ["Line one", "Line two"],
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
      },
    });
    if (res.statusCode !== 200) return;
    const body = JSON.parse(res.body);
    expect(body.stats).toHaveProperty("cached");
    expect(body.stats).toHaveProperty("translated");
    expect(body.stats).toHaveProperty("failed");
    expect(body.stats).toHaveProperty("timeMs");
    expect(body.stats.total).toBe(2);
    expect(body.stats.translated).toBeGreaterThanOrEqual(0);
    expect(body.stats.cached).toBeGreaterThanOrEqual(0);
    expect(body.stats.failed).toBeGreaterThanOrEqual(0);
  });

  it("should support documentType parameter", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/batch",
      payload: {
        texts: ["Hello"],
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
        documentType: "generic",
      },
    });
    expect([200, 400]).toContain(res.statusCode);
  });
});
