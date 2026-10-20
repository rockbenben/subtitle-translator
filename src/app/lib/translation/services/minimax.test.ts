import { afterEach, describe, expect, it, vi } from "vitest";
import { migrateConfig } from "../config";
import { BINARY_EFFORT_VENDORS, canDisableThinkingForModel, deriveThinkingParams, getDefaultConfig, getProviderModels, isCustomModel } from "../registry";
import type { ThinkingDirective, TranslateTextParams, TranslationConfig } from "../types";
import { translationServices } from "./index";

const flash = "MiniMax-M3.1-Flash";
const routerFlash = "minimax/minimax-m3.1-flash:free";

afterEach(() => vi.unstubAllGlobals());

async function request(method = "minimax", saved?: TranslationConfig, raw?: Partial<TranslateTextParams>) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "Translated subtitle", reasoning_content: "Private reasoning" } }] }), { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  const config = migrateConfig(saved, getDefaultConfig(method));
  const result = await translationServices[method]({
    ...config,
    apiKey: "offline-test-key",
    translationMethod: method,
    text: "Original subtitle",
    cacheSuffix: "",
    sourceLanguage: "en",
    targetLanguage: "fr",
    reasoningEffort: deriveThinkingParams(method, config),
    ...raw,
  });
  expect(result).toBe("Translated subtitle");
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
  return { url, body: JSON.parse(init.body as string), config };
}

describe("MiniMax quick picks and outgoing translation requests", () => {
  it("offers only stable Flash then M3 without a false off switch for Flash", () => {
    expect(getProviderModels("minimax").map((m) => m.value)).toEqual([flash, "MiniMax-M3"]);
    expect(getDefaultConfig("minimax")?.model).toBe(flash);
    expect(canDisableThinkingForModel("minimax", flash)).toBe(false);
    expect(canDisableThinkingForModel("minimax", "MiniMax-M3")).toBe(true);
    expect(canDisableThinkingForModel("minimax", "custom-model")).toBe(true);
    expect(isCustomModel("minimax", "MiniMax-M2.7")).toBe(false);
    expect(BINARY_EFFORT_VENDORS.has("minimax")).toBe(false);
  });

  it.each([
    [undefined, "https://api.minimaxi.com/v1/chat/completions"],
    ["https://api.minimax.io/v1", "https://api.minimax.io/v1/chat/completions"],
    ["https://api.minimaxi.com/v1", "https://api.minimaxi.com/v1/chat/completions"],
  ])("sends the default Flash request through %s", async (url, expected) => {
    const { url: actual, body } = await request("minimax", { url });
    expect(actual).toBe(expected);
    expect(body).toMatchObject({ model: flash, thinking: { type: "adaptive" }, reasoning_effort: "low", stream: false });
    expect(body.messages).toHaveLength(2);
    expect(body.messages[1].content).toContain("Original subtitle");
    for (const key of ["service_tier", "reasoning_split", "output_config", "enable_thinking"]) expect(body).not.toHaveProperty(key);
  });

  it("uses Flash at the service fallback when no model is supplied", async () => {
    const { body } = await request("minimax", undefined, { model: undefined });
    expect(body).toMatchObject({ model: flash, thinking: { type: "adaptive" }, reasoning_effort: "low" });
  });

  it.each(["low", "medium", "high"] as const)("serializes Flash's selected %s effort", async (effort) => {
    const { body } = await request("minimax", { model: flash, thinkingEffort: { [flash]: effort } });
    expect(body.thinking).toEqual({ type: "adaptive" });
    expect(body.reasoning_effort).toBe(effort);
  });

  it.each([undefined, "low", "high", "auto"] as const)("preserves saved M3 with %s effort", async (effort) => {
    const { body, config } = await request("minimax", { model: "MiniMax-M3", thinkingEffort: effort ? { "MiniMax-M3": effort } : {} });
    expect(config.model).toBe("MiniMax-M3");
    expect(body.model).toBe("MiniMax-M3");
    expect(body.thinking).toEqual({ type: effort && effort !== "auto" ? "adaptive" : "disabled" });
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it.each([undefined, "high", "auto"] as const)("keeps saved M2.7 requests parameter-free with %s effort", async (effort) => {
    const { body, config } = await request("minimax", { model: "MiniMax-M2.7", thinkingEffort: effort ? { "MiniMax-M2.7": effort } : {} });
    expect(config.model).toBe("MiniMax-M2.7");
    expect(body.model).toBe("MiniMax-M2.7");
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("reasoning_effort");
  });

  it.each([undefined, "high", "auto"] as const)("preserves custom endpoint/model semantics with %s effort", async (effort) => {
    const model = "custom-model";
    const { url, body } = await request("minimax", { model, url: "https://custom.invalid/v1", thinkingEffort: effort ? { [model]: effort } : {} });
    expect(url).toBe("https://custom.invalid/v1/chat/completions");
    expect(body.model).toBe(model);
    if (effort === "auto") expect(body).not.toHaveProperty("thinking");
    else expect(body.thinking).toEqual({ type: effort ? "adaptive" : "disabled" });
  });

  it("preserves explicit legacy IDs rather than replacing them with Flash", async () => {
    const { body } = await request("minimax", { model: "MiniMax-M2.5", thinkingEffort: { "MiniMax-M2.5": "auto" } });
    expect(body.model).toBe("MiniMax-M2.5");
    expect(body).not.toHaveProperty("thinking");
  });

  it.each([undefined, "low", "medium", "high", "auto"] as const)("uses the verified gateway route and reasoning object with %s effort", async (effort: ThinkingDirective | undefined) => {
    const { url, body } = await request("openrouter", { model: routerFlash, thinkingEffort: effort ? { [routerFlash]: effort } : {} });
    expect(url).toBe("https://openrouter.ai/api/v1/chat/completions");
    expect(body.model).toBe(routerFlash);
    expect(body.reasoning).toEqual({ effort: !effort || effort === "auto" ? "low" : effort });
    expect(body).not.toHaveProperty("thinking");
    expect(body).not.toHaveProperty("reasoning_effort");
    expect(canDisableThinkingForModel("openrouter", routerFlash)).toBe(false);
  });

  it("keeps the gateway's M3 off switch and custom auto behavior", async () => {
    const { body } = await request("openrouter", { model: "minimax/minimax-m3" });
    expect(body.reasoning).toEqual({ enabled: false });
    const custom = await request("openrouter", { model: "custom-model", thinkingEffort: { "custom-model": "auto" } });
    expect(custom.body).not.toHaveProperty("reasoning");
    expect(canDisableThinkingForModel("openrouter", "custom-model")).toBe(true);
  });

  it("leaves unrelated provider requests unchanged", async () => {
    const { body } = await request("deepseek");
    expect(body.model).toBe(getDefaultConfig("deepseek")?.model);
    expect(body.thinking).toEqual({ type: "disabled" });
    expect(body).not.toHaveProperty("reasoning_effort");
  });
});
