// Translation retry configuration and utilities

import { LLM_MODELS } from "@/app/lib/translation";

// User-configurable defaults (in seconds for timeout)
export const DEFAULT_RETRY_COUNT = 3;
export const DEFAULT_RETRY_TIMEOUT = 60; // seconds

export interface RetryConfig {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
  shouldRetry?: (params: { error: unknown }) => boolean;
}

export interface UserRetryConfig {
  retryCount?: number;
  retryTimeout?: number; // in seconds
}

/**
 * Check if error is a non-retryable authentication/authorization error
 * Exported for use in abort logic
 */
export const isAuthError = (error: unknown): boolean => {
  const status = (error as { status?: number })?.status;
  const message = ((error as Error)?.message || "").toLowerCase();

  // Status-based auth errors
  if (status === 401 || status === 403) return true;

  // Message-based auth errors
  if (message.includes("unauthorized") || message.includes("invalid api key") || message.includes("authentication") || message.includes("forbidden")) {
    return true;
  }

  return false;
};

/**
 * Check if error is retryable (server errors or rate limits)
 */
const isRetryableError = (error: unknown): boolean => {
  // Never retry auth errors
  if (isAuthError(error)) return false;

  const status = (error as { status?: number })?.status;
  // Retry on: no status (network error), 5xx server errors, 429 rate limit
  return !status || status >= 500 || status === 429;
};

/**
 * Get optimized retry configuration based on translation method
 * Note: Request timeout is handled separately via AbortController in useTranslateData
 * These minTimeout/maxTimeout are for RETRY INTERVALS, not request timeout
 * @param translationMethod - The translation API method
 * @param userConfig - Optional user-defined retry count
 */
export const getRetryConfig = (translationMethod: string, userConfig?: UserRetryConfig): RetryConfig => {
  const userRetries = userConfig?.retryCount ?? DEFAULT_RETRY_COUNT;

  const baseConfig: RetryConfig = {
    retries: userRetries,
    factor: 2,
    minTimeout: 1000, // 1s minimum wait between retries
    maxTimeout: 30000, // 30s maximum wait between retries
    randomize: true,
    shouldRetry: ({ error }) => isRetryableError(error),
  };

  switch (translationMethod) {
    case "gtxFreeAPI":
      return {
        ...baseConfig,
        minTimeout: 2000,
        maxTimeout: 60000,
      };

    case "deeplx":
    case "deepl":
    case "google":
    case "azure":
      // Use default shouldRetry from baseConfig
      return baseConfig;

    default:
      if (LLM_MODELS.includes(translationMethod)) {
        return {
          ...baseConfig,
          shouldRetry: ({ error }: { error: unknown }) => {
            const message = ((error as Error)?.message || "").toLowerCase();

            // Don't retry token/context limit errors
            if (message.includes("context length") || message.includes("token limit")) {
              return false;
            }

            return isRetryableError(error);
          },
        };
      }
      return baseConfig;
  }
};

/**
 * Delay helper function
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};
