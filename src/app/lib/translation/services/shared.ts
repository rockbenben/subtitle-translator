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
  const nested = (data as { error?: { message?: string } } | null)?.error?.message;
  if (typeof nested === "string" && nested.trim()) return nested;

  const topLevel = (data as { error?: string; message?: string } | null)?.error ?? (data as { message?: string } | null)?.message;
  if (typeof topLevel === "string" && topLevel.trim()) return topLevel;

  return `HTTP error! status: ${status}`;
};
