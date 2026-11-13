import { afterEach, expect, test } from "vitest";
import { CLI_FORMAT_HANDLERS, type CliFormatContext } from "./cliFormat";
import { translateLines, type PipelineCache } from "./pipeline";
import { translationServices } from "./services";
import { extractTaggedSingleLine, wrapTranslateTaggedLine } from "./contextTranslation";

const originalService = translationServices.openai;
afterEach(() => { translationServices.openai = originalService; });

const makeCache = () => {
  const store = new Map<string, string>();
  const cache: PipelineCache = {
    get: async (key) => store.get(key) ?? null,
    getMany: async (keys) => keys.map((key) => store.get(key) ?? null),
    set: async (key, value) => { store.set(key, value); },
    delete: async (key) => { store.delete(key); },
  };
  return { cache, store };
};

const context = (cache: PipelineCache, flags: CliFormatContext["flags"] = {}): CliFormatContext => ({
  flags: { "no-context": true, ...flags },
  isLlmMethod: true, sourceLanguage: "en", targetLanguage: "zh",
  fileName: "source", firstLangForFile: true,
  removeChars: "", applyRemoveChars: (lines) => lines,
  translate: (texts, documentType, meta, opts) => translateLines(texts, {
    translationMethod: "openai", sourceLanguage: "en", targetLanguage: "zh",
    delayTime: 0, retryCount: 0, independent: opts?.independent,
  }, {
    cache,
    getGlossaryTerms: () => [{ source: "Commander", target: "指挥官", targetLang: "zh" }],
  }, documentType, meta),
});

const run = async (format: string, input: string, ctx: CliFormatContext) =>
  (await CLI_FORMAT_HANDLERS.find((handler) => handler.id === format)!.run(input, ctx))!.content;

test.each(["\n", "\r\n", "\r"])("single JSON value preserves %j through strict retry and cache replay", async (newline) => {
  const { cache, store } = makeCache();
  const expected = "你好，指挥官" + newline + "准备好";
  let calls = 0;
  translationServices.openai = async (params) => {
    calls++;
    return params.glossaryBlock?.includes("STRICT GLOSSARY")
      ? wrapTranslateTaggedLine(expected) : "你好，司令" + newline + "准备好";
  };
  const input = JSON.stringify({ nested: [{ text: "Hello Commander" + newline + "Ready" }], count: 42, enabled: false });
  const ctx = context(cache);
  const cold = await run("json", input, ctx);
  expect(JSON.parse(cold)).toEqual({ nested: [{ text: expected }], count: 42, enabled: false });
  expect(calls).toBe(2);
  // #87 caches the raw response. Replay must recover its newline using the same key.
  expect([...store.values()]).toContain(wrapTranslateTaggedLine(expected));
  expect(await run("json", input, ctx)).toBe(cold);
  expect(calls).toBe(2);
  expect(extractTaggedSingleLine(wrapTranslateTaggedLine(expected), "Commander")).toBe(expected);
});

test.each([false, true])("Markdown retry retains newlines and protected syntax, raw=%s", async (raw) => {
  const { cache } = makeCache();
  let calls = 0;
  translationServices.openai = async (params) => {
    calls++;
    return params.glossaryBlock?.includes("STRICT GLOSSARY")
      ? wrapTranslateTaggedLine("指挥官\n准备好") : "司令";
  };
  const ctx = context(cache, { "md-raw": raw });
  const input = raw ? "Commander" : "## Commander `code`\n\n```js\nconst untouched = 1;\n```";
  const expected = raw ? "指挥官\n准备好" : "## 指挥官\n准备好 `code`\n\n```js\nconst untouched = 1;\n```";
  expect(await run("markdown", input, ctx)).toBe(expected);
  const coldCalls = calls;
  expect(await run("markdown", input, ctx)).toBe(expected);
  expect(calls).toBe(coldCalls);
});

test.each([
  ["lrc", "[00:01.00]Commander", "[00:01.00] 指挥官 准备好"],
  ["srt", "1\n00:00:01,000 --> 00:00:03,000\nCommander", "1\n00:00:01,000 --> 00:00:03,000\n指挥官 准备好"],
  ["vtt", "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\nCommander", "WEBVTT\n\n00:00:01.000 --> 00:00:03.000\n指挥官 准备好"],
])("%s assembly keeps a strict-retry translation in its physical slot", async (_ext, input, expected) => {
  const { cache } = makeCache();
  let calls = 0;
  translationServices.openai = async (params) => {
    calls++;
    return params.glossaryBlock?.includes("STRICT GLOSSARY")
      ? wrapTranslateTaggedLine("指挥官\r\n准备好") : "司令";
  };
  const ctx = context(cache);
  expect((await run("subtitle", input, ctx)).trim()).toBe(expected);
  expect((await run("subtitle", input, ctx)).trim()).toBe(expected);
  expect(calls).toBe(2);
});

test.each(["\n", "\r\n", "\r"])("ASS retains model %j as hard breaks, styling, and cache replay", async (newline) => {
  const { cache } = makeCache();
  let calls = 0;
  translationServices.openai = async (params) => {
    calls++;
    return params.text.replace("Hello", "你好" + newline + "继续").replace("Ready", "准备好");
  };
  const input = "[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,Alice,0,0,0,,{\\an8}Hello\\N{\\c&H00FF00&}Ready";
  const ctx = context(cache);
  const cold = await run("subtitle", input, ctx);
  expect(cold).toContain("Dialogue: 0,0:00:01.00,0:00:03.00,Default,Alice,0,0,0,,{\\an8}你好\\N继续\\N{\\c&H00FF00&}准备好");
  expect(cold).not.toContain("\r");
  expect(cold).not.toContain("###");
  expect(await run("subtitle", input, ctx)).toBe(cold);
  expect(calls).toBe(1);
});

test("ASS strict retry preserves real newlines as hard breaks", async () => {
  const { cache } = makeCache();
  let calls = 0;
  translationServices.openai = async (params) => {
    calls++;
    return params.glossaryBlock?.includes("STRICT GLOSSARY")
      ? wrapTranslateTaggedLine("指挥官\n准备好") : "司令";
  };
  const input = "[Script Info]\nScriptType: v4.00+\n[Events]\nFormat: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text\nDialogue: 0,0:00:01.00,0:00:03.00,Default,,0,0,0,,Commander";
  const ctx = context(cache);
  const cold = await run("subtitle", input, ctx);
  expect(cold).toContain("Default,,0,0,0,,指挥官\\N准备好");
  expect(await run("subtitle", input, ctx)).toBe(cold);
  expect(calls).toBe(2);
});

test.each(["json", "markdown"])("subtitle output does not flatten shared %s cache entries", async (format) => {
  const { cache } = makeCache();
  let calls = 0;
  translationServices.openai = async () => { calls++; return "你好\n准备好"; };
  const ctx = context(cache, { "md-raw": true });
  expect((await run("subtitle", "[00:01.00]Hello", ctx)).trim()).toBe("[00:01.00] 你好 准备好");
  const output = await run(format, format === "json" ? '{"text":"Hello"}' : "Hello", ctx);
  expect(format === "json" ? JSON.parse(output).text : output).toBe("你好\n准备好");
  expect(calls).toBe(1);
});

test("context duplicate rescue keeps subtitle slots aligned on cached replay", async () => {
  const { cache } = makeCache();
  let calls = 0;
  translationServices.openai = async (params) => {
    calls++;
    if (params.text.includes("[TRANSLATE_1]")) {
      return "[TRANSLATE_0]同句[/TRANSLATE_0][TRANSLATE_1]同句[/TRANSLATE_1]";
    }
    return wrapTranslateTaggedLine(params.text.includes("Hello") ? "你好\n朋友" : "准备\n出发");
  };
  const ctx = context(cache, { context: true, "no-context": false });
  const input = "1\n00:00:01,000 --> 00:00:02,000\nHello\n\n2\n00:00:03,000 --> 00:00:04,000\nReady";
  const expected = "1\n00:00:01,000 --> 00:00:02,000\n你好 朋友\n\n2\n00:00:03,000 --> 00:00:04,000\n准备 出发";
  expect((await run("subtitle", input, ctx)).trim()).toBe(expected);
  expect(calls).toBe(3);
  expect((await run("subtitle", input, ctx)).trim()).toBe(expected);
  expect(calls).toBe(3);
});
