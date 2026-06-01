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
  // Thinking directive. An effort (low/medium/high) = thinking ON at that level;
  // the "auto" sentinel = OMIT the param and follow the server default; undefined =
  // the DEFAULT (no user entry) = thinking OFF, i.e. send the provider's explicit
  // DISABLE payload (for tagged + custom models) or omit (for non-thinking models
  // that can't be disabled). Set by the orchestrator from deriveThinkingParams.
  // The "auto" escape exists for custom models whose disable param a STRICT provider
  // would 422 (the user picks Auto to omit instead).
  reasoningEffort?: ThinkingDirective;
  domains?: string; // Optional: domains setting for Qwen-MT
  fullText?: string; // Optional: complete text for ${fullText} variable
  signal?: AbortSignal; // Optional: for request cancellation
}

export type ReasoningEffort = "low" | "medium" | "high";

/**
 * What the user picked for thinking on a model. An effort (low/medium/high) =
 * enable thinking at that level; the `"auto"` sentinel = OMIT the param and follow
 * the server default. Absence of any entry (undefined) is the DEFAULT, "Off":
 * thinking off, sent as the provider's explicit DISABLE payload (or omitted for
 * models that default off / can't be disabled). The `"auto"` sentinel only
 * originates from the custom-model 3-state control (Off/On/Auto) — tagged models
 * stay 2-state (Off/On) where absence already means disable.
 */
export type ThinkingDirective = ReasoningEffort | "auto";

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
   * Per-model thinking directive. Key is the model SKU; value is the chosen effort
   * (low/medium/high = thinking on) or the `"auto"` sentinel (omit, custom models
   * only). Absence of an entry = the DEFAULT "Off": thinking disabled (per the
   * historical "如果没开启,则不记录" convention — for tagged models the wire sends an
   * explicit disable; for custom models likewise, which is why custom models add an
   * "auto" escape for SKUs a STRICT provider would 422 on the disable param).
   *
   * Per-call params (TranslateTextParams) expose a single flat `reasoningEffort`;
   * orchestrator derives it from this record at translate-time via deriveThinkingParams.
   */
  thinkingEffort?: Record<string, ThinkingDirective>;
  domains?: string;
}
