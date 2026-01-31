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

// Third-party proxy services (community-maintained endpoints)
// These are external proxy/relay services that provide:
//   - Free or alternative access to paid APIs
//   - CORS-friendly endpoints for browser-based applications
//   - Regional access optimization or rate limit workarounds
export const THIRD_PARTY_ENDPOINTS = {
  deeplx: "https://deeplx.aishort.top/translate",
  deepseekRelay: "https://llm-proxy.aishort.top/api/deepseek",
} as const;

export const normalizeNumber = (value: unknown, fallback: number): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : fallback;
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

export const getErrorMessage = (data: unknown, status: number): string => {
  const nested = (data as { error?: { message?: string; code?: number } } | null)?.error?.message;
  const nestedCode = (data as { error?: { code?: number } } | null)?.error?.code;
  const effectiveCode = nestedCode || status;

  // User-friendly hints for common error codes
  const getHint = (code: number): string => {
    if (code === 401) return " (API Key invalid or expired / API 密钥无效或已过期)";
    if (code === 403) return " (Access forbidden / 访问被禁止)";
    if (code === 429) return " (Rate limit exceeded, please retry later / 请求过于频繁，请稍后重试)";
    if (code >= 500 && code < 600) return " (Server error, please retry later / 服务器错误，请稍后重试)";
    return "";
  };

  if (typeof nested === "string" && nested.trim()) {
    return `[${effectiveCode}] ${nested}${getHint(effectiveCode)}`;
  }

  const topLevel = (data as { error?: string; message?: string } | null)?.error ?? (data as { message?: string } | null)?.message;
  if (typeof topLevel === "string" && topLevel.trim()) {
    return `[${status}] ${topLevel}${getHint(status)}`;
  }

  return `HTTP error! status: ${status}${getHint(status)}`;
};
