// Translation services - LLM APIs (OpenAI, DeepSeek, Gemini, etc.)

import type { TranslateTextParams, TranslationService } from "../types";
import { DEFAULT_SYS_PROMPT, DEFAULT_USER_PROMPT } from "../config";
import { defaultConfigs, OPENAI_COMPAT_KEYS, OPENAI_COMPAT_PROVIDERS, type OpenAICompatProviderKey, type OpenAICompatProviderSpec } from "../registry";
import { getAIModelPrompt } from "../utils";

import { fetchJSON, normalizeNumber, normalizePrompt, relayUrl, requireApiKey, requireUrl, PROXY_ENDPOINTS, getOpenAICompatContent, getClaudeContent } from "./shared";

// Prepare prompts common to all LLM services
const preparePrompts = (params: { text: string; targetLanguage: string; sourceLanguage: string; sysPrompt?: string; userPrompt?: string; fullText?: string }) => {
  const effectiveSysPrompt = normalizePrompt(params.sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(params.userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(params.text, effectiveUserPrompt, params.targetLanguage, params.sourceLanguage, params.fullText);
  return { effectiveSysPrompt, prompt };
};

// Common OpenAI-compatible request helper (named-parameter config object)
type OpenAICompatRequestConfig = {
  params: TranslateTextParams;
  serviceName: string;
  endpoint: string;
  defaultModel: string;
  defaultTemperature: number;
  extraHeaders?: Record<string, string>;
};

const openAICompatRequest = async (cfg: OpenAICompatRequestConfig): Promise<string> => {
  const { params, serviceName, endpoint, defaultModel, defaultTemperature, extraHeaders } = cfg;
  const { apiKey, model, temperature } = params;
  const { effectiveSysPrompt, prompt } = preparePrompts(params);
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
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultModel,
      temperature: normalizeNumber(temperature, defaultTemperature),
      stream: false,
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, serviceName);
};

// Resolve the endpoint for a provider with allowCustomUrl / allowRelay priority:
// user-supplied URL > relay (when useRelay toggled) > default endpoint.
const resolveEndpoint = (key: OpenAICompatProviderKey, spec: OpenAICompatProviderSpec, params: TranslateTextParams): string => {
  const customUrl = params.url?.trim();
  if (spec.allowCustomUrl && customUrl) return customUrl;
  if (spec.allowRelay && params.useRelay) return relayUrl(key);
  return spec.endpoint;
};

// Factory: generate a TranslationService from a provider spec key.
// The cast widens `as const` literal types so optional fields (allowCustomUrl,
// allowRelay, extraHeaders) are accessible uniformly across all provider entries.
const makeOpenAICompat = (key: OpenAICompatProviderKey): TranslationService => {
  const spec = OPENAI_COMPAT_PROVIDERS[key] as OpenAICompatProviderSpec;
  return async (params) => {
    return openAICompatRequest({
      params,
      serviceName: spec.label,
      endpoint: resolveEndpoint(key, spec, params),
      defaultModel: spec.defaultModel,
      defaultTemperature: spec.defaultTemperature,
      extraHeaders: spec.extraHeaders,
    });
  };
};

// Auto-generate base services from the provider table
const baseOpenAICompatServices = Object.fromEntries(OPENAI_COMPAT_KEYS.map((k) => [k, makeOpenAICompat(k)])) as Record<OpenAICompatProviderKey, TranslationService>;

// DeepSeek: wraps the factory with CORS/403 error hints that point users at
// the "API Relay" toggle. Applies only on direct-call failures.
export const deepseek: TranslationService = async (params) => {
  try {
    return await baseOpenAICompatServices.deepseek(params);
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

// Named exports for each factory-generated service (backwards-compatible direct imports)
export const openai = baseOpenAICompatServices.openai;
export const perplexity = baseOpenAICompatServices.perplexity;
export const siliconflow = baseOpenAICompatServices.siliconflow;
export const groq = baseOpenAICompatServices.groq;
export const openrouter = baseOpenAICompatServices.openrouter;
export const moonshot = baseOpenAICompatServices.moonshot;
export const zhipu = baseOpenAICompatServices.zhipu;
export const grok = baseOpenAICompatServices.grok;
export const doubao = baseOpenAICompatServices.doubao;
export const qwen = baseOpenAICompatServices.qwen;
export const mistral = baseOpenAICompatServices.mistral;

// Dispatch table — deepseek overrides the base factory with its custom wrapper
export const openAICompatServices: Record<OpenAICompatProviderKey, TranslationService> = {
  ...baseOpenAICompatServices,
  deepseek,
};

// --- Special-case services that don't fit the OpenAI-compatible pattern ---

export const gemini: TranslationService = async (params) => {
  const { apiKey, model, temperature } = params;
  const { effectiveSysPrompt, prompt } = preparePrompts(params);
  const key = requireApiKey("Gemini", apiKey);

  const data = (await fetchJSON(`https://generativelanguage.googleapis.com/v1beta/models/${model || defaultConfigs.gemini.model!}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: effectiveSysPrompt }] },
      generationConfig: { temperature: normalizeNumber(temperature, defaultConfigs.gemini.temperature) },
    }),
    signal: params.signal,
  })) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Invalid response format from Gemini API");
  }
  return text.trim();
};

export const azureopenai: TranslationService = async (params) => {
  const { apiKey, url, model, apiVersion, temperature } = params;
  const { effectiveSysPrompt, prompt } = preparePrompts(params);
  const endpoint = requireUrl("Azure OpenAI", url);
  const deployment = model || defaultConfigs.azureopenai.model!;
  const version = apiVersion || defaultConfigs.azureopenai.apiVersion!;
  const requestUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;

  const key = requireApiKey("Azure OpenAI", apiKey);

  const data = await fetchJSON(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": key,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      temperature: normalizeNumber(temperature, defaultConfigs.azureopenai.temperature),
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Azure OpenAI");
};

// Nvidia thinking parameter rules — data-driven, add new models by appending to the array
const NVIDIA_THINKING_RULES: Array<{ pattern: RegExp; build: (on: boolean) => Record<string, unknown> }> = [
  // GLM4.7: enable_thinking + clear_thinking
  { pattern: /(?:^|\/)glm4\.7$/i, build: (on) => ({ chat_template_kwargs: { enable_thinking: on, ...(on && { clear_thinking: false }) } }) },
  // Kimi-k2.5: thinking, force temperature=1.0, top_p=1.0
  { pattern: /(?:^|\/)kimi-k2\.5$/i, build: (on) => ({ chat_template_kwargs: { thinking: on }, temperature: 1.0, top_p: 1.0 }) },
  // DeepSeek-v3.*: thinking
  { pattern: /(?:^|\/)deepseek-v3\./i, build: (on) => ({ chat_template_kwargs: { thinking: on } }) },
  // GPT-OSS-*: reasoning_effort
  { pattern: /(?:^|\/)gpt-oss-/i, build: (on) => ({ reasoning_effort: on ? "high" : "low" }) },
];

const buildNvidiaThinkingParams = (model: string, enableThinking: boolean): Record<string, unknown> => NVIDIA_THINKING_RULES.find((r) => r.pattern.test(model))?.build(enableThinking) ?? {};

export const nvidia: TranslationService = async (params) => {
  const { apiKey, url, model, temperature, enableThinking } = params;
  const { effectiveSysPrompt, prompt } = preparePrompts(params);

  const effectiveModel = model || defaultConfigs.nvidia.model!;
  const thinkingParams = buildNvidiaThinkingParams(effectiveModel, enableThinking ?? false);

  const requestBody: Record<string, unknown> = {
    messages: [
      { role: "system", content: effectiveSysPrompt },
      { role: "user", content: prompt },
    ],
    model: effectiveModel,
    temperature: normalizeNumber(temperature, defaultConfigs.nvidia.temperature),
    ...thinkingParams,
  };

  // Direct call (custom URL) vs proxy call (default Nvidia API, avoids CORS)
  const isDirectCall = !!url;
  const fetchUrl = isDirectCall ? url : PROXY_ENDPOINTS.nvidia;
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
  const { apiKey, url, model, temperature } = params;
  const { effectiveSysPrompt, prompt } = preparePrompts(params);

  const apiEndpoint = url || defaultConfigs.llm.url!;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const data = await fetchJSON(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.llm.model!,
      temperature: normalizeNumber(temperature, defaultConfigs.llm.temperature),
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Custom LLM");
};

export const claude: TranslationService = async (params) => {
  const { apiKey, model, temperature, enableThinking, useRelay } = params;
  const { effectiveSysPrompt, prompt } = preparePrompts(params);

  const key = requireApiKey("Claude", apiKey);
  const effectiveModel = model || defaultConfigs.claude.model!;
  const isThinking = enableThinking ?? false;

  // Anthropic requires budget_tokens < max_tokens. When thinking is on we
  // reserve 10K for reasoning + ~6K for the visible response, so max_tokens
  // must grow. Plain (non-thinking) requests stay at the original 8096 cap.
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    system: effectiveSysPrompt,
    messages: [{ role: "user", content: prompt }],
    max_tokens: isThinking ? 16384 : 8096,
  };

  if (isThinking) {
    requestBody.thinking = { type: "enabled", budget_tokens: 10000 };
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
  return getClaudeContent(data, isThinking);
};
