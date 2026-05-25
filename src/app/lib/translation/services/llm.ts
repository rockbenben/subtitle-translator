// Translation services - LLM APIs (OpenAI, DeepSeek, Gemini, etc.)

import type { ReasoningEffort, TranslateTextParams, TranslationService } from "../types";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../config";
import { defaultConfigs, isThinkingModel, OPENAI_COMPAT_KEYS, OPENAI_COMPAT_PROVIDERS, type OpenAICompatProviderKey, type OpenAICompatProviderSpec } from "../registry";
import { getAIModelPrompt } from "../utils";

import { fetchJSON, normalizeNumber, normalizePrompt, relayUrl, requireApiKey, requireUrl, completeOpenAICompatUrl, PROXY_ENDPOINTS, getOpenAICompatContent, getClaudeContent } from "./shared";

// Prepare prompts common to all LLM services
const preparePrompts = (params: { text: string; targetLanguage: string; sourceLanguage: string; systemPrompt?: string; userPrompt?: string; fullText?: string }) => {
  const effectiveSystemPrompt = normalizePrompt(params.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  const effectiveUserPrompt = normalizePrompt(params.userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(params.text, effectiveUserPrompt, params.targetLanguage, params.sourceLanguage, params.fullText);
  return { effectiveSystemPrompt, prompt };
};

// Common OpenAI-compatible request helper (named-parameter config object)
type OpenAICompatRequestConfig = {
  params: TranslateTextParams;
  serviceName: string;
  endpoint: string;
  defaultModel: string;
  defaultTemperature: number;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

const openAICompatRequest = async (cfg: OpenAICompatRequestConfig): Promise<string> => {
  const { params, serviceName, endpoint, defaultModel, defaultTemperature, extraHeaders, extraBody } = cfg;
  const { apiKey, model, temperature } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const key = requireApiKey(serviceName, apiKey);

  const data = await fetchJSON(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSystemPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultModel,
      temperature: normalizeNumber(temperature, defaultTemperature),
      stream: false,
      // No max_tokens — cloud models don't repeat-loop. Only `llm` Custom exposes it.
      ...extraBody,
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, serviceName);
};

// Resolve the endpoint for a provider with allowCustomUrl / allowRelay priority:
// user-supplied URL > relay (when useRelay toggled) > default endpoint.
// completeOpenAICompatUrl normalizes user-supplied URLs (bare host, /v1, wrong
// /v1/responses or /v1/completions paths) — safety net for settings imported
// from file or hand-edited localStorage that bypass the UI's onBlur fix.
const resolveEndpoint = (key: OpenAICompatProviderKey, spec: OpenAICompatProviderSpec, params: TranslateTextParams): string => {
  const customUrl = params.url?.trim();
  if (spec.allowCustomUrl && customUrl) return completeOpenAICompatUrl(customUrl);
  if (spec.allowRelay && params.useRelay) return relayUrl(key);
  return spec.endpoint;
};

// ═════════════════════════════════════════════════════════════════════════
// Two-tier OpenAI-compat service generation:
//   - TIER 1 (thinking-aware): registered in THINKING_BUILDERS below. Each
//     builder returns the vendor-specific extra-body to inject when the user
//     enables thinking. Factory wires the builder in at service creation.
//   - TIER 2 (base / no builder): providers with no thinking-tagged SKUs in
//     the registry (perplexity, mistral, cohere, qianfan). Factory returns a
//     pass-through service with no extra body.
// Adding a new thinking-capable provider = add a buildXxxExtraBody helper +
// one entry in THINKING_BUILDERS. Service implementation is auto-derived.
// ═════════════════════════════════════════════════════════════════════════

// ── Thinking-extra builders ────────────────────────────────────────────────
// Each builder maps the orchestrator-derived `reasoningEffort` (presence =
// thinking on, undefined = off) to the vendor's wire-level thinking params.
// Server-default-ON vendors (Moonshot, Gemini) re-check isThinkingModel
// internally to distinguish "tagged + effort undefined → send explicit
// disable" from "untagged → send nothing" — the orchestrator-level gate
// collapses both into reasoningEffort=undefined.

// DeepSeek V4: top-level `thinking: {type}` + `reasoning_effort`.
// (Distinct from NVIDIA NIM which nests both inside `chat_template_kwargs`.)
const buildDeepseekExtraBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { thinking: { type: "enabled" }, reasoning_effort: reasoningEffort };
};

// Moonshot K2.6: flat `thinking: {type: "enabled"|"disabled"}`. Server default
// is ON, so effort-undefined must send explicit "disabled" — re-check
// isThinkingModel to skip untagged K2.5 which would reject the param.
const buildMoonshotExtraBody = (model: string | undefined, reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  const effectiveModel = model || OPENAI_COMPAT_PROVIDERS.moonshot.defaultModel;
  if (!isThinkingModel("moonshot", effectiveModel)) return {};
  return { thinking: { type: reasoningEffort ? "enabled" : "disabled" } };
};

// Shared `{reasoning_effort: enum}` shape — OpenAI GPT-5's protocol that the
// aggregators (OpenRouter / Groq / SiliconFlow) inherit and remap to their
// upstream-vendor specifics (Claude budget_tokens, Gemini thinkingLevel,
// DeepSeek thinking, etc.) on their side. Same wire payload, four consumers.
// Docs: developers.openai.com/api/docs/models/gpt-5.4 (source of truth)
const buildReasoningEffortBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { reasoning_effort: reasoningEffort };
};

// Grok 4.3: only accepts "low" | "high" (no "medium" — would 400).
// grok-4.20-* SKUs are thinking-intrinsic and don't accept the param at all.
// Doc: docs.x.ai/docs/api-reference
const buildGrokExtraBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { reasoning_effort: reasoningEffort === "high" ? "high" : "low" };
};

// Qwen3.x: top-level `enable_thinking: bool` + `thinking_budget: int` (DashScope
// OpenAI-compat). Effort mapped to a sensible token budget for translation use.
// Doc: help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions
const QWEN_THINKING_BUDGET: Record<ReasoningEffort, number> = { low: 1024, medium: 4096, high: 8192 };
const buildQwenExtraBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { enable_thinking: true, thinking_budget: QWEN_THINKING_BUDGET[reasoningEffort] };
};

// Shared `{thinking: {type: "enabled"}}` shape — Doubao Seed 2.0 and Zhipu
// GLM-4.6+ both adopt this exact wire payload, no effort dial in either API.
// (Doubao additionally accepts "auto"|"disabled"; Zhipu accepts "disabled" —
// neither needed here since orchestrator gates "off" by omitting the call.)
// Doubao doc: volcengine.com/docs/82379
// Zhipu doc:  docs.bigmodel.cn/cn/guide/start/model-overview
const buildThinkingEnabledBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { thinking: { type: "enabled" } };
};

// MiniMax M2.7: ⚠️ EXPERIMENTAL — best-guess `enable_thinking: true`.
// Protocol under-documented; verify with a 200 from a tagged SKU + thinking on.
// Doc: platform.minimax.io/docs/api-reference/text-chat
const buildMinimaxExtraBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { enable_thinking: true };
};

// Hunyuan (TurboS / T1 / A13B): ⚠️ EXPERIMENTAL — `enable_enhancement: true`.
// T1 / A13B are thinking-intrinsic and may reject this param; TurboS is the
// most likely to honor it. Verify per-SKU.
// Doc: cloud.tencent.com/document/product/1729/111007
const buildHunyuanExtraBody = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { enable_enhancement: true };
};

// ── Builder registry ───────────────────────────────────────────────────────
// One entry per thinking-aware provider. Providers absent from this map go
// through the base factory (no extra body). Type-checked against
// OpenAICompatProviderKey so a renamed/removed provider triggers a compile
// error here, preventing stale builders.
type ExtraBodyBuilder = (params: TranslateTextParams) => Record<string, unknown>;

const reasoningEffortBuilder: ExtraBodyBuilder = (p) => buildReasoningEffortBody(p.reasoningEffort);
const thinkingEnabledBuilder: ExtraBodyBuilder = (p) => buildThinkingEnabledBody(p.reasoningEffort);

const THINKING_BUILDERS: Partial<Record<OpenAICompatProviderKey, ExtraBodyBuilder>> = {
  deepseek: (p) => buildDeepseekExtraBody(p.reasoningEffort),
  moonshot: (p) => buildMoonshotExtraBody(p.model, p.reasoningEffort),
  grok: (p) => buildGrokExtraBody(p.reasoningEffort),
  qwen: (p) => buildQwenExtraBody(p.reasoningEffort),
  minimax: (p) => buildMinimaxExtraBody(p.reasoningEffort),
  hunyuan: (p) => buildHunyuanExtraBody(p.reasoningEffort),
  // {reasoning_effort: enum} — OpenAI GPT-5 + aggregators
  openai: reasoningEffortBuilder,
  openrouter: reasoningEffortBuilder,
  groq: reasoningEffortBuilder,
  siliconflow: reasoningEffortBuilder,
  // {thinking: {type: "enabled"}} — Doubao + Zhipu
  doubao: thinkingEnabledBuilder,
  zhipu: thinkingEnabledBuilder,
};

// Factory: generate a TranslationService from a provider spec key, optionally
// wiring in a thinking extra-body builder.
const makeOpenAICompat = (key: OpenAICompatProviderKey, extraBodyBuilder?: ExtraBodyBuilder): TranslationService => {
  const spec = OPENAI_COMPAT_PROVIDERS[key] as OpenAICompatProviderSpec;
  return async (params) =>
    openAICompatRequest({
      params,
      serviceName: spec.label,
      endpoint: resolveEndpoint(key, spec, params),
      defaultModel: spec.defaultModel,
      defaultTemperature: spec.defaultTemperature,
      extraHeaders: spec.extraHeaders,
      extraBody: extraBodyBuilder?.(params),
    });
};

// Auto-generate every OpenAI-compat service: each provider gets a base service,
// thinking-aware ones additionally pick up their builder from the registry.
const openAICompatServicesBase = Object.fromEntries(OPENAI_COMPAT_KEYS.map((k) => [k, makeOpenAICompat(k, THINKING_BUILDERS[k])])) as Record<OpenAICompatProviderKey, TranslationService>;

// DeepSeek extra wrap: factory call + CORS/403 error rewriting that points
// users at the "API Relay" toggle. The only provider whose direct-call
// failures need user-facing remediation hints; everything else surfaces the
// raw upstream error.
export const deepseek: TranslationService = async (params) => {
  try {
    return await openAICompatServicesBase.deepseek(params);
  } catch (error) {
    if (!params.useRelay && error instanceof Error) {
      if (error instanceof TypeError && error.message.includes("Failed to fetch")) {
        throw new Error("Network error (possibly CORS). Please enable 'API Relay' in API Settings. / 网络错误（可能是 CORS 限制），请在 API 设置中开启「中转 API」。");
      }
      if (error.message.includes("[403]")) {
        throw new Error("DeepSeek API returned 403 Forbidden. Please enable 'API Relay' in API Settings. / DeepSeek API 返回 403 禁止访问，请在 API 设置中开启「中转 API」。");
      }
    }
    throw error;
  }
};

// Direct exports — every provider in OPENAI_COMPAT_KEYS gets one for
// backwards-compatible imports elsewhere. Generated from the factory map so
// adding a provider needs no edit here.
export const openai = openAICompatServicesBase.openai;
export const moonshot = openAICompatServicesBase.moonshot;
export const openrouter = openAICompatServicesBase.openrouter;
export const groq = openAICompatServicesBase.groq;
export const grok = openAICompatServicesBase.grok;
export const siliconflow = openAICompatServicesBase.siliconflow;
export const qwen = openAICompatServicesBase.qwen;
export const doubao = openAICompatServicesBase.doubao;
export const zhipu = openAICompatServicesBase.zhipu;
export const minimax = openAICompatServicesBase.minimax;
export const hunyuan = openAICompatServicesBase.hunyuan;
export const perplexity = openAICompatServicesBase.perplexity;
export const mistral = openAICompatServicesBase.mistral;
export const cohere = openAICompatServicesBase.cohere;
export const qianfan = openAICompatServicesBase.qianfan;

// Dispatch map — base services + deepseek override (with CORS error rewrite).
export const openAICompatServices: Record<OpenAICompatProviderKey, TranslationService> = {
  ...openAICompatServicesBase,
  deepseek,
};

// --- Special-case services that don't fit the OpenAI-compatible pattern ---

export const gemini: TranslationService = async (params) => {
  const { apiKey, model, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const key = requireApiKey("Gemini", apiKey);
  const effectiveModel = model || defaultConfigs.gemini.model!;

  // Gemini 3.x thinking control: `generationConfig.thinkingConfig.thinkingLevel`
  // enum (minimal/low/medium/high). Gemini is the ONLY provider whose server
  // defaults thinking ON, so for thinking-tagged models we MUST send an
  // explicit level even when the user picked Off (otherwise server keeps
  // thinking on). For untagged models (user-supplied custom SKU), we omit
  // thinkingConfig to preserve the server's per-model default behavior.
  const generationConfig: Record<string, unknown> = {
    temperature: normalizeNumber(temperature, defaultConfigs.gemini.temperature),
  };
  if (isThinkingModel("gemini", effectiveModel)) {
    generationConfig.thinkingConfig = { thinkingLevel: reasoningEffort ?? "minimal" };
  }

  const data = (await fetchJSON(`https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
      generationConfig,
    }),
    signal: params.signal,
  })) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } ; finishReason?: string }> };

  const candidate = data.candidates?.[0];
  // Gemini's equivalent of finish_reason==="length". Server default
  // maxOutputTokens (~8192) can overflow on long inputs. Same "max_tokens
  // reached" marker → non-retryable in retry.ts.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response truncated — max_tokens reached. Split input into smaller chunks.");
  }
  const text = candidate?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Invalid response format from Gemini API");
  }
  return text.trim();
};

export const azureopenai: TranslationService = async (params) => {
  const { apiKey, url, model, apiVersion, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const endpoint = requireUrl("Azure OpenAI", url);
  const deployment = model || defaultConfigs.azureopenai.model!;
  const version = apiVersion || defaultConfigs.azureopenai.apiVersion!;
  const requestUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;

  const key = requireApiKey("Azure OpenAI", apiKey);

  // Azure deployment names mirror OpenAI model IDs; GPT-5 family supports
  // `reasoning_effort` per docs.microsoft.com/azure/.../foundry-models-sold-by-azure.
  // Orchestrator gates effort on (thinking-tagged ∧ user picked an effort).
  // No max_tokens passthrough — same rationale as openAICompatRequest above.
  const requestBody: Record<string, unknown> = {
    messages: [
      { role: "system", content: effectiveSystemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: normalizeNumber(temperature, defaultConfigs.azureopenai.temperature),
  };
  if (reasoningEffort) {
    requestBody.reasoning_effort = reasoningEffort;
  }

  const data = await fetchJSON(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": key,
    },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Azure OpenAI");
};

// NVIDIA NIM wraps thinking params in `chat_template_kwargs` (vs native APIs
// which use top-level `reasoning_effort` / `thinking`). Orchestrator-level gate
// in useTranslationState ensures reasoningEffort is only set for thinking-tagged
// models the user picked an effort for.
const buildNvidiaThinkingParams = (reasoningEffort: ReasoningEffort | undefined): Record<string, unknown> => {
  if (!reasoningEffort) return {};
  return { chat_template_kwargs: { thinking: true, reasoning_effort: reasoningEffort } };
};

export const nvidia: TranslationService = async (params) => {
  const { apiKey, url, model, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const effectiveModel = model || defaultConfigs.nvidia.model!;
  const thinkingParams = buildNvidiaThinkingParams(reasoningEffort);

  const requestBody: Record<string, unknown> = {
    messages: [
      { role: "system", content: effectiveSystemPrompt },
      { role: "user", content: prompt },
    ],
    model: effectiveModel,
    temperature: normalizeNumber(temperature, defaultConfigs.nvidia.temperature),
    ...thinkingParams,
  };

  // Direct call (custom URL) vs proxy call (default Nvidia API, avoids CORS)
  const isDirectCall = !!url;
  const fetchUrl = isDirectCall ? completeOpenAICompatUrl(url) : PROXY_ENDPOINTS.nvidia;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown> = requestBody;

  if (isDirectCall) {
    const key = requireApiKey("Nvidia", apiKey);
    headers.Authorization = `Bearer ${key}`;
  } else {
    body = { apiKey, ...requestBody };
  }

  const data = await fetchJSON(fetchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Nvidia");
};

export const llm: TranslationService = async (params) => {
  const { apiKey, url, model, temperature, sendSystemPrompt, maxTokens } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const serviceName = "Custom (OpenAI-compatible)";
  // Belt-and-suspenders: UI auto-completes on blur, but settings imported from
  // file or edited via localStorage may bypass that — re-normalize here.
  const apiEndpoint = completeOpenAICompatUrl(requireUrl(serviceName, url));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  // sendSystemPrompt=false: omit system message for chat templates that reject
  // the system role (Gemma family). Translation guidance survives in the user
  // prompt. undefined defaults to include (preserves pre-toggle configs).
  const messages =
    sendSystemPrompt === false
      ? [{ role: "user", content: prompt }]
      : [
          { role: "system", content: effectiveSystemPrompt },
          { role: "user", content: prompt },
        ];

  // Model optional: single-model endpoints (vLLM / llama.cpp) ignore or reject
  // the field. Send only when user-supplied; let server error if required.
  const requestBody: Record<string, unknown> = {
    messages,
    temperature: normalizeNumber(temperature, defaultConfigs.llm.temperature),
  };
  const effectiveModel = model?.trim();
  if (effectiveModel) {
    requestBody.model = effectiveModel;
  }
  // Opt-in cap, safety net for runaway local-model generation.
  if (maxTokens && maxTokens > 0) {
    requestBody.max_tokens = maxTokens;
  }

  const data = await fetchJSON(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, serviceName);
};

export const claude: TranslationService = async (params) => {
  const { apiKey, model, temperature, reasoningEffort, useRelay } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const key = requireApiKey("Claude", apiKey);
  const effectiveModel = model || defaultConfigs.claude.model!;

  // Anthropic requires budget_tokens < max_tokens. When thinking is on we
  // reserve 10K for reasoning + ~6K for the visible response, so max_tokens
  // must grow. Plain (non-thinking) requests stay at the original 8096 cap.
  //
  // `system` as a block array (not a plain string) is the form that accepts
  // `cache_control` — required since Claude is the ONLY provider where prompt
  // caching is off by default. Anthropic silently no-ops the marker when the
  // prompt is below the cacheable threshold (~1024 tokens for Sonnet/Haiku,
  // 2048 for Opus), so short default prompts cost nothing extra; long custom
  // prompts (glossaries, style guides) get ~90% input discount on cache hits.
  // Doc: docs.anthropic.com/en/docs/build-with-claude/prompt-caching
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    system: [{ type: "text", text: effectiveSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
    max_tokens: reasoningEffort ? 16384 : 8096,
  };

  if (reasoningEffort) {
    // Claude's "thinking level" is a token budget (integer), not enum. Map our
    // user-facing low/medium/high to concrete budgets. Per Anthropic docs
    // budget_tokens must be < max_tokens (we use 16384 above when thinking,
    // so cap budget at ~12000 to leave room for the visible response).
    const CLAUDE_BUDGET: Record<ReasoningEffort, number> = { low: 4096, medium: 10000, high: 12000 };
    requestBody.thinking = { type: "enabled", budget_tokens: CLAUDE_BUDGET[reasoningEffort] };
  } else {
    requestBody.temperature = normalizeNumber(temperature, defaultConfigs.claude.temperature);
  }

  // Direct-to-Anthropic from the browser requires the explicit opt-in CORS
  // header since 2024-08 (bring-your-own-key apps). When proxied through the
  // Cloudflare relay the header is harmless but unnecessary — we keep it
  // unconditionally to avoid branching.
  const endpoint = useRelay ? relayUrl("claude") : "https://api.anthropic.com/v1/messages";

  const data = await fetchJSON(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  return getClaudeContent(data, !!reasoningEffort);
};
