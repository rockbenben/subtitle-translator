// Translation services - LLM APIs (OpenAI, DeepSeek, Gemini, etc.)

import type { TranslationService } from "../types";
import { DEFAULT_SYS_PROMPT, DEFAULT_USER_PROMPT, defaultConfigs } from "../config";
import { getAIModelPrompt } from "../utils";

import { getErrorMessage, normalizeNumber, requireApiKey, requireUrl } from "./shared";

const normalizePrompt = (value: string | undefined, fallback: string) => (typeof value === "string" && value.trim() ? value : fallback);

const getOpenAICompatContent = (data: unknown, serviceName: string): string => {
  const content = (data as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`Invalid response format from ${serviceName} API`);
  }
  return content.trim();
};

export const deepseek: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt, useRelay } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("DeepSeek", apiKey);

  // 根据 useRelay 选择直连或中转 API
  const apiUrl = useRelay ? "https://llm-proxy.aishort.top/api/deepseek" : "https://api.deepseek.com/chat/completions";

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        messages: [
          { role: "system", content: effectiveSysPrompt },
          { role: "user", content: prompt },
        ],
        model: model || defaultConfigs.deepseek.model,
        temperature: normalizeNumber(temperature, defaultConfigs.deepseek.temperature),
        stream: false,
      }),
      signal: params.signal,
    });

    const data = await response.json();
    if (!response.ok) {
      // 检测 403 错误，提示开启中转 API
      if (response.status === 403 && !useRelay) {
        throw new Error("DeepSeek API returned 403 Forbidden. Please enable 'API Relay' in API Settings. / DeepSeek API 返回 403 禁止访问，请在 API 设置中开启「中转 API」。");
      }
      throw new Error(getErrorMessage(data, response.status));
    }
    return getOpenAICompatContent(data, "DeepSeek");
  } catch (error) {
    // 检测 CORS 错误，提示开启中转 API
    if (error instanceof TypeError && error.message.includes("Failed to fetch") && !useRelay) {
      throw new Error("Network error (possibly CORS). Please enable 'API Relay' in API Settings. / 网络错误（可能是 CORS 限制），请在 API 设置中开启「中转 API」。");
    }
    throw error;
  }
};

export const openai: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("OpenAI", apiKey);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.openai.model,
      temperature: 1,
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "OpenAI");
};

export const gemini: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("Gemini", apiKey);

  const requestBody = {
    contents: [
      {
        parts: [{ text: prompt }],
      },
    ],
    systemInstruction: {
      parts: [{ text: effectiveSysPrompt }],
    },
    generationConfig: {
      temperature: normalizeNumber(temperature, defaultConfigs.gemini.temperature),
    },
  };

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model || defaultConfigs.gemini.model}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  const data = await response.json();

  if (!response.ok) {
    const errorMessage = data.error?.message || `HTTP error! status: ${response.status}`;
    throw new Error(errorMessage);
  }

  if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
    throw new Error("Invalid response format from Gemini API");
  }

  return data.candidates[0].content.parts[0].text.trim();
};

export const perplexity: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("Perplexity", apiKey);

  const response = await fetch("https://api.perplexity.ai/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.perplexity.model,
      temperature: normalizeNumber(temperature, defaultConfigs.perplexity.temperature),
      stream: false,
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "Perplexity");
};

export const azureopenai: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, url, model, apiVersion, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);
  const endpoint = requireUrl("Azure OpenAI", url);
  const deployment = model || defaultConfigs.azureopenai.model;
  const version = apiVersion || defaultConfigs.azureopenai.apiVersion;
  const requestUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;

  const key = requireApiKey("Azure OpenAI", apiKey);

  const response = await fetch(requestUrl, {
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

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "Azure OpenAI");
};

export const siliconflow: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("SiliconFlow", apiKey);

  const response = await fetch("https://api.siliconflow.cn/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.siliconflow.model,
      temperature: normalizeNumber(temperature, defaultConfigs.siliconflow.temperature),
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "SiliconFlow");
};

export const groq: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("Groq", apiKey);

  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.groq.model,
      temperature: normalizeNumber(temperature, defaultConfigs.groq.temperature),
      stream: false,
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "Groq");
};

export const openrouter: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, model, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const key = requireApiKey("OpenRouter", apiKey);

  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      "HTTP-Referer": "https://aishort.top",
      "X-Title": "AIShort",
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.openrouter.model,
      temperature: normalizeNumber(temperature, defaultConfigs.openrouter.temperature),
      stream: false,
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "OpenRouter");
};

// Use local API for: dev mode OR Docker (USE_LOCAL_API=true)
// Use remote API for: static export (production without USE_LOCAL_API)
const useLocalApi = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_LOCAL_API === "true";

// Helper function to build thinking parameters based on model
// Matches exact model names: glm4.7, kimi-k2.5, deepseek-v3.*, gpt-oss-*
const buildNvidiaThinkingParams = (model: string, enableThinking: boolean): Record<string, unknown> => {
  // GLM4.7: use enable_thinking and clear_thinking
  // Matches: glm4.7, z-ai/glm4.7
  if (/(?:^|\/)glm4\.7$/i.test(model)) {
    return enableThinking
      ? { chat_template_kwargs: { enable_thinking: true, clear_thinking: false } }
      : { chat_template_kwargs: { enable_thinking: false } };
  }

  // Kimi-k2.5: use thinking, and force temperature=1.0, top_p=1.0
  // Matches: kimi-k2.5, moonshotai/kimi-k2.5
  if (/(?:^|\/)kimi-k2\.5$/i.test(model)) {
    return enableThinking
      ? { chat_template_kwargs: { thinking: true }, temperature: 1.0, top_p: 1.0 }
      : { chat_template_kwargs: { thinking: false }, temperature: 1.0, top_p: 1.0 };
  }

  // DeepSeek-v3.*: use thinking
  // Matches: deepseek-v3.1, deepseek-v3.1-terminus, deepseek-v3.2, deepseek-ai/deepseek-v3.1, etc.
  if (/(?:^|\/)deepseek-v3\./i.test(model)) {
    return enableThinking
      ? { chat_template_kwargs: { thinking: true } }
      : { chat_template_kwargs: { thinking: false } };
  }

  // GPT-OSS-*: use reasoning_effort
  // Matches: gpt-oss-120b, gpt-oss-20b, openai/gpt-oss-120b, etc.
  if (/(?:^|\/)gpt-oss-/i.test(model)) {
    return { reasoning_effort: enableThinking ? "high" : "low" };
  }

  return {};
};

export const nvidia: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, url, model, temperature, sysPrompt, userPrompt, enableThinking } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const apiEndpoint = url || defaultConfigs.nvidia.url;
  const effectiveModel = model || defaultConfigs.nvidia.model;

  // Build thinking parameters based on model
  const thinkingParams = buildNvidiaThinkingParams(effectiveModel, enableThinking ?? false);

  // Prepare request body - thinking params may override temperature for certain models
  const requestBody: Record<string, unknown> = {
    messages: [
      { role: "system", content: effectiveSysPrompt },
      { role: "user", content: prompt },
    ],
    model: effectiveModel,
    temperature: normalizeNumber(temperature, defaultConfigs.nvidia.temperature),
    ...thinkingParams,
  };

  let response;

  if (useLocalApi) {
    // Route through local proxy to avoid CORS
    response = await fetch("/api/nvidia", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        url: apiEndpoint,
        apiKey,
        ...requestBody,
      }),
      signal: params.signal,
    });
  } else {
    // Direct call (for static exports)
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey?.trim()) {
      headers.Authorization = `Bearer ${apiKey}`;
    }

    response = await fetch(apiEndpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: params.signal,
    });
  }

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "Nvidia");
};

export const llm: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, url, model, temperature, sysPrompt, userPrompt } = params;
  const effectiveSysPrompt = normalizePrompt(sysPrompt, DEFAULT_SYS_PROMPT);
  const effectiveUserPrompt = normalizePrompt(userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(text, effectiveUserPrompt, targetLanguage, sourceLanguage, params.fullText);

  const apiEndpoint = url || defaultConfigs.llm.url;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  const response = await fetch(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSysPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultConfigs.llm.model,
      temperature: normalizeNumber(temperature, defaultConfigs.llm.temperature),
    }),
    signal: params.signal,
  });

  const data = await response.json();
  if (!response.ok) {
    throw new Error(getErrorMessage(data, response.status));
  }
  return getOpenAICompatContent(data, "Custom LLM");
};
