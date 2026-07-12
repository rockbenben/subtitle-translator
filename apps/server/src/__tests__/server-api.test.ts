import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { closeApp, getApp } from "./setup.js";

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

describe("extended API routes", () => {
  it("validates translation inputs without probing", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/translate/validate",
      payload: {
        translationMethod: "gtxFreeAPI",
        sourceLanguage: "en",
        targetLanguage: "zh",
        config: {},
      },
    });
    expect(res.statusCode).toBe(200);
    expect(JSON.parse(res.body).ok).toBe(true);
  });

  it("inspects subtitle content", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/inspect",
      payload: { content: "1\n00:00:01,000 --> 00:00:02,000\nHello\n" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe("srt");
    expect(body.translatableLineCount).toBe(1);
  });

  it("exposes cache stats and clear", async () => {
    const app = await getApp();
    const stats = await app.inject({ method: "GET", url: "/api/v1/cache/stats" });
    expect(stats.statusCode).toBe(200);
    expect(JSON.parse(stats.body).cache).toHaveProperty("hits");

    const clear = await app.inject({ method: "POST", url: "/api/v1/cache/clear" });
    expect(clear.statusCode).toBe(200);
    expect(JSON.parse(clear.body)).toHaveProperty("cleared");
  });

  it("creates and reads a same-language text job", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/jobs",
      payload: {
        type: "translate.text",
        text: "Hello\nWorld",
        translationMethod: "gtxFreeAPI",
        sourceLanguage: "en",
        targetLanguage: "en",
        config: {},
      },
    });
    expect(res.statusCode).toBe(200);
    const created = JSON.parse(res.body);
    expect(created.jobId).toMatch(/^job_/);

    await new Promise((resolve) => setTimeout(resolve, 25));
    const job = await app.inject({ method: "GET", url: `/api/v1/jobs/${created.jobId}` });
    expect(job.statusCode).toBe(200);
    expect(["running", "succeeded"]).toContain(JSON.parse(job.body).status);
  });
});
