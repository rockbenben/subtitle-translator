// Shared helpers for translation service implementations

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
