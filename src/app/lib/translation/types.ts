export interface TranslationProvider {
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
  // Cap on model output tokens. Undefined / 0 = no cap (vendor default).
  // Primary use case: local Ollama small models that hallucinate into repeating
  // loops — capping max_tokens at a sane value (e.g. 2048) lets the loop
  // self-terminate at the cap, surface as a (likely truncated) response, and
  // hand control back to retry/error flow instead of hanging until requestTimeoutSec.
  maxTokens?: number;
  systemPrompt?: string;
  userPrompt?: string;
  sendSystemPrompt?: boolean; // When false, omit the system message (Custom OpenAI-compat — Gemma-style chat templates rejecting system role)
  useRelay?: boolean;
  // Thinking-mode effort level — presence encodes "thinking on". Undefined =
  // thinking off (services either omit the param or, for server-default-ON
  // vendors like Moonshot K2.6 / Gemini, send explicit "disabled"/"minimal").
  // Orchestrator guarantees this is only set when (a) user picked an effort
  // AND (b) the model is tagged thinking in registry — see deriveThinkingParams.
  reasoningEffort?: ReasoningEffort;
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
  /** See TranslateTextParams.maxTokens. Undefined / 0 = no cap. */
  maxTokens?: number;
  chunkSize?: number;
  delayTime?: number;
  batchSize?: number;
  contextBatchSize?: number;
  contextWindow?: number;
  systemPrompt?: string;
  userPrompt?: string;
  sendSystemPrompt?: boolean;
  useRelay?: boolean;
  /**
   * Per-model thinking effort. Key is the model SKU, value is the chosen
   * effort level. Presence of an entry = thinking enabled at that effort;
   * absence of an entry = thinking off (UI doesn't persist OFF state, per
   * "如果没开启,则不记录" convention).
   *
   * Per-call params (TranslateTextParams) expose a single flat `reasoningEffort`
   * (presence = thinking on); orchestrator derives it from this record at
   * translate-time via deriveThinkingParams.
   */
  thinkingEffort?: Record<string, ReasoningEffort>;
  domains?: string;
}
