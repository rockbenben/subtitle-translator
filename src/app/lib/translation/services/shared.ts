// Shared helpers for translation service implementations

// Use local API for: dev mode OR Docker (USE_LOCAL_API=true)
// Use remote API for: static export (production without USE_LOCAL_API)
export const useLocalApi = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_LOCAL_API === "true";

// Proxy endpoints for services that need CORS bypass
// These services are proxied through Next.js API routes (dev) or EdgeOne (prod)
// Used when:
//   - Official APIs have CORS restrictions in browser environments
//   - Need server-side API key handling for security
//   - Static export deployment requires edge function proxies
export const PROXY_ENDPOINTS = {
  deepl: useLocalApi ? "/api/deepl" : "https://api-edgeone.newzone.top/api/deepl",
  nvidia: useLocalApi ? "/api/nvidia" : "https://api-edgeone.newzone.top/api/nvidia",
} as const;

// Cloudflare Worker that proxies all OpenAI-compatible providers + Claude,
// strips CORS, forwards Authorization/x-api-key/anthropic-version headers, and
// routes by provider name under /api/{provider}. Users toggle this via the
// per-provider "useRelay" switch in API Settings when the browser can't reach
// the upstream directly.
export const LLM_RELAY_BASE = "https://llm-proxy.aishort.top";

/** Build the relay URL for a given provider key (e.g. `relayUrl("openai")`). */
export const relayUrl = (provider: string): string => `${LLM_RELAY_BASE}/api/${provider}`;

// Third-party proxy services (community-maintained endpoints)
// These are external proxy/relay services that provide:
//   - Free or alternative access to paid APIs
//   - CORS-friendly endpoints for browser-based applications
//   - Regional access optimization or rate limit workarounds
export const THIRD_PARTY_ENDPOINTS = {
  deeplx: "https://deeplx.aishort.top/translate",
  deepseekRelay: relayUrl("deepseek"),
} as const;

export const normalizePrompt = (value: string | undefined, fallback: string): string => (typeof value === "string" && value.trim() ? value : fallback);

export const normalizeNumber = (value: unknown, fallback: number | undefined): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : (fallback ?? 0);
};

export const requireApiKey = (serviceName: string, apiKey: string | undefined): string => {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error(`${serviceName} API Key is required`);
  }
  return key;
};

export const requireUrl = (serviceName: string, url: string | undefined): string => {
  const endpoint = url?.trim().replace(/\/+$/, "");
  if (!endpoint) {
    throw new Error(`${serviceName} endpoint URL is required`);
  }
  return endpoint;
};

const ERROR_HINTS: Record<number, string> = {
  401: " (API Key invalid or expired / API 密钥无效或已过期)",
  403: " (Access forbidden / 访问被禁止)",
  429: " (Rate limit exceeded, please retry later / 请求过于频繁，请稍后重试)",
};
const getHint = (code: number): string => ERROR_HINTS[code] ?? (code >= 500 && code < 600 ? " (Server error, please retry later / 服务器错误，请稍后重试)" : "");

export const getErrorMessage = (data: unknown, status: number): string => {
  const obj = data as Record<string, unknown> | null;
  const errorObj = obj?.error as Record<string, unknown> | string | undefined;

  // Nested: { error: { message: "...", code: 123 } }
  if (errorObj && typeof errorObj === "object") {
    const msg = errorObj.message;
    const code = (typeof errorObj.code === "number" ? errorObj.code : null) ?? status;
    if (typeof msg === "string" && msg.trim()) {
      return `[${code}] ${msg}${getHint(code)}`;
    }
  }

  // Top-level: { error: "..." } or { message: "..." }
  const topLevel = (typeof errorObj === "string" ? errorObj : null) ?? (typeof obj?.message === "string" ? (obj.message as string) : null);
  if (topLevel?.trim()) {
    return `[${status}] ${topLevel}${getHint(status)}`;
  }

  return `HTTP error! status: ${status}${getHint(status)}`;
};

/**
 * fetch + JSON parse + ok-check in one call. On non-ok, throws an Error built
 * by getErrorMessage (defensively catches JSON parse failures on the error
 * path so a non-JSON error body still produces a clean status-based message).
 */
export const fetchJSON = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    throw new Error(getErrorMessage(data, response.status));
  }
  return response.json();
};

export const getOpenAICompatContent = (data: unknown, serviceName: string): string => {
  const content = (data as { choices?: Array<{ message?: { content?: string } }> } | null)?.choices?.[0]?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`Invalid response format from ${serviceName} API`);
  }
  return content.trim();
};

export const getClaudeContent = (data: unknown, enableThinking: boolean): string => {
  const contentArray = (data as { content?: Array<{ type?: string; text?: string }> } | null)?.content;
  if (!Array.isArray(contentArray) || contentArray.length === 0) {
    throw new Error("Invalid response format from Claude API");
  }
  if (enableThinking) {
    const textBlock = contentArray.find((block) => block.type === "text");
    if (!textBlock || typeof textBlock.text !== "string") {
      throw new Error("Invalid response format from Claude API (no text block found)");
    }
    return textBlock.text.trim();
  }
  const text = contentArray[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Invalid response format from Claude API");
  }
  return text.trim();
};
