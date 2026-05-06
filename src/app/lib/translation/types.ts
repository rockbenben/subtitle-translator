// Translation service types

export interface TranslationServiceInfo {
  value: string;
  label: string;
  docs?: string;
  apiKeyUrl?: string;
}

// Derived from the registry's PROVIDERS so adding a service is a single-file change.
// Literal union gives IDE autocomplete; `(string & {})` keeps the type open
// for user-supplied strings while preserving completions.
export type TranslationMethod = keyof typeof import("./registry").defaultConfigs | (string & {});

export interface TranslateTextParams {
  text: string;
  cacheSuffix: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  apiKey?: string;
  region?: string;
  url?: string;
  model?: string;
  apiVersion?: string;
  temperature?: number;
  sysPrompt?: string;
  userPrompt?: string;
  sendSystemPrompt?: boolean; // When false, omit the system message (Custom OpenAI-compat — Gemma-style chat templates rejecting system role)
  useRelay?: boolean;
  enableThinking?: boolean; // Optional: enable thinking mode for supported models (kimi, deepseek, glm, gpt-oss)
  reasoningEffort?: ReasoningEffort; // Optional: effort level when thinking is on (deepseek-v4)
  domains?: string; // Optional: domains setting for Qwen-MT
  fullText?: string; // Optional: complete text for ${fullText} variable
  signal?: AbortSignal; // Optional: for request cancellation
}

export type ReasoningEffort = "low" | "medium" | "high";

export type TranslationService = (params: TranslateTextParams) => Promise<string>;

export interface TranslationConfig {
  apiKey?: string;
  url?: string;
  region?: string;
  model?: string;
  apiVersion?: string;
  temperature?: number;
  chunkSize?: number;
  delayTime?: number;
  batchSize?: number;
  contextBatchSize?: number;
  contextWindow?: number;
  sysPrompt?: string;
  userPrompt?: string;
  sendSystemPrompt?: boolean;
  useRelay?: boolean;
  enableThinking?: boolean;
  reasoningEffort?: ReasoningEffort;
  domains?: string;
}
