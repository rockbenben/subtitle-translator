// Translation retry configuration and utilities

import { LLM_MODELS } from "@/app/lib/translation";

export interface RetryConfig {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
  shouldRetry?: (params: { error: unknown }) => boolean;
}

/**
 * Get optimized retry configuration based on translation method
 */
export const getRetryConfig = (translationMethod: string): RetryConfig => {
  const baseConfig: RetryConfig = {
    retries: 3,
    factor: 2,
    minTimeout: 1000,
    maxTimeout: 30000,
    randomize: true,
  };

  switch (translationMethod) {
    case "gtxFreeAPI":
      return {
        ...baseConfig,
        retries: 5,
        minTimeout: 2000,
        maxTimeout: 60000,
        shouldRetry: ({ error }: { error: unknown }) => {
          const status = (error as { status?: number })?.status;
          return !status || status >= 500 || status === 429;
        },
      };

    case "deeplx":
      return {
        ...baseConfig,
        retries: 4,
        minTimeout: 1500,
        shouldRetry: ({ error }: { error: unknown }) => {
          const message = ((error as Error)?.message || "").toLowerCase();
          const status = (error as { status?: number })?.status;
          return !message.includes("unauthorized") && (!status || status >= 500 || status === 429);
        },
      };

    case "deepl":
    case "google":
    case "azure":
      return {
        ...baseConfig,
        retries: 2,
        minTimeout: 500,
        maxTimeout: 10000,
        shouldRetry: ({ error }: { error: unknown }) => {
          const status = (error as { status?: number })?.status;
          return !status || status >= 500 || status === 429;
        },
      };

    default:
      if (LLM_MODELS.includes(translationMethod)) {
        return {
          ...baseConfig,
          retries: 3,
          minTimeout: 1000,
          maxTimeout: 20000,
          shouldRetry: ({ error }: { error: unknown }) => {
            const message = ((error as Error)?.message || "").toLowerCase();
            const status = (error as { status?: number })?.status;

            if (message.includes("context length") || message.includes("token limit")) {
              return false;
            }

            return !status || status >= 500 || status === 429;
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
