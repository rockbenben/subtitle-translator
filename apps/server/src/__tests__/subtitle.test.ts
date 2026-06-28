import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { getApp, closeApp } from "./setup.js";

beforeAll(async () => {
  await getApp();
});

afterAll(async () => {
  await closeApp();
});

const SRT_CONTENT = `1
00:00:01,000 --> 00:00:04,000
Hello, welcome to the show.

2
00:00:05,000 --> 00:00:09,000
Today we are going to learn about translation.

3
00:00:10,000 --> 00:00:14,000
This is a test subtitle file.`;

const VTT_CONTENT = `WEBVTT

00:00:01.000 --> 00:00:04.000
Hello, welcome to the show.

00:00:05.000 --> 00:00:09.000
Today we are going to learn about translation.`;

const ASS_CONTENT = `[Script Info]
Title: Test subtitle
ScriptType: v4.00+

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text
Dialogue: 0,0:00:01.00,0:00:04.00,Default,,0,0,0,,Hello, welcome to the show.{\\N}
Dialogue: 0,0:00:05.00,0:00:09.00,Default,,0,0,0,,Today we are going to learn about translation.`;

describe("POST /api/v1/subtitle/parse", () => {
  it("should parse SRT content and return format + cues", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/parse",
      payload: { content: SRT_CONTENT },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe("srt");
    expect(body).toHaveProperty("cues");
    expect(Array.isArray(body.cues)).toBe(true);
    expect(body.cues.length).toBe(3);
  });

  it("should parse SRT and have correct cue structure", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/parse",
      payload: { content: SRT_CONTENT },
    });
    const { cues } = JSON.parse(res.body);
    expect(cues[0].index).toBe(1);
    expect(cues[0].text).toBe("Hello, welcome to the show.");
    expect(cues[1].index).toBe(2);
    expect(cues[2].index).toBe(3);
  });

  it("should parse VTT content and return format + cues", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/parse",
      payload: { content: VTT_CONTENT },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe("vtt");
    expect(body.cues.length).toBe(2);
  });

  it("should parse ASS content and return format + cues", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/parse",
      payload: { content: ASS_CONTENT },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe("ass");
    expect(body.cues.length).toBe(2);
  });

  it("should accept explicit format parameter", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/parse",
      payload: { content: SRT_CONTENT, format: "srt" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe("srt");
  });

  it("should return error format for invalid subtitle content", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/parse",
      payload: { content: "This is not a subtitle file\nJust some random text" },
    });
    expect(res.statusCode).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.format).toBe("error");
  });
});

describe("POST /api/v1/subtitle/translate", () => {
  it("should return 400 for invalid subtitle format", async () => {
    const app = await getApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/v1/subtitle/translate",
      payload: {
        content: "invalid content",
        translationMethod: "gtxFreeAPI",
        targetLanguage: "zh",
        sourceLanguage: "en",
      },
    });
    expect(res.statusCode).toBe(400);
    const body = JSON.parse(res.body);
    expect(body).toHaveProperty("error");
    expect(body.error.message).toContain("Unsupported or invalid subtitle format");
  });
});
