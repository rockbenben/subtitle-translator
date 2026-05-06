// Single source of truth for every translation provider.
//
// PROVIDERS below is the ONE place you edit to add / change a service.
// TRANSLATION_SERVICES (UI list), LLM_MODELS, defaultConfigs, categorizedOptions,
// OPENAI_COMPAT_PROVIDERS (factory input), findMethodLabel, getDefaultConfig,
// and the TranslationMethod union type are all derived views over PROVIDERS.

import type { TranslationConfig, TranslationServiceInfo } from "./types";

export type ServiceCategory = "machine-translation" | "llm" | "aggregator";

type BaseProvider = {
  label: string;
  category: ServiceCategory;
  docs?: string;
  apiKeyUrl?: string;
  /**
   * Quick-pick endpoints surfaced as tags above the URL field. Useful for
   * providers with multiple regional / product variants (Qwen mainland/intl/us,
   * MiniMax io/cn, Doubao standard/coding) and for Custom (llm) where it
   * lists common local/cloud OpenAI-compat servers as starter URLs.
   * Convention: for providers with an implicit runtime default (OpenAI-compat
   * `endpoint` or a populated `defaults.url`), `endpoints[0].url` should match
   * that default — so the active tag highlights correctly.
   */
  endpoints?: Array<{ label: string; url: string }>;
};

/** OpenAI-compatible providers driven by the shared chat-completions factory. */
export type OpenAICompatProviderSpec = BaseProvider & {
  kind: "openai-compat";
  endpoint: string;
  defaultModel: string;
  defaultTemperature: number;
  /** Extra headers to merge into every upstream request (OpenRouter attribution etc). */
  extraHeaders?: Record<string, string>;
  /** When true, user-supplied `params.url` overrides the default endpoint (Doubao, Qwen). */
  allowCustomUrl?: boolean;
  /** When true, UI renders a "useRelay" toggle that routes through the Cloudflare Worker. */
  allowRelay?: boolean;
  /** Models on this provider that support thinking-mode. UI shows the toggle only when the current model matches; service injects thinking params only when matched + enabled. */
  thinkingModelPattern?: RegExp;
};

/** Providers with hand-written implementations (Claude, Gemini, Azure OpenAI, Nvidia, Custom LLM, all MT). */
export type CustomProviderSpec = BaseProvider & {
  kind: "custom";
  defaults: TranslationConfig;
};

export type ProviderSpec = OpenAICompatProviderSpec | CustomProviderSpec;

// Declared in UI display order. TRANSLATION_SERVICES iterates this directly,
// so changing order here changes the Select/chip order.
export const PROVIDERS = {
  // ===== Machine Translation =====
  gtxFreeAPI: {
    kind: "custom",
    category: "machine-translation",
    label: "GTX API (Free)",
    defaults: { batchSize: 100 },
  },
  google: {
    kind: "custom",
    category: "machine-translation",
    label: "Google Translate",
    docs: "https://docs.cloud.google.com/translate/docs/setup",
    defaults: { apiKey: "", delayTime: 200, batchSize: 100 },
  },
  deepl: {
    kind: "custom",
    category: "machine-translation",
    label: "DeepL",
    docs: "https://developers.deepl.com/docs/api-reference/translate",
    apiKeyUrl: "https://www.deepl.com/your-account/keys",
    defaults: { url: "", apiKey: "", chunkSize: 5000, delayTime: 200, batchSize: 20 },
  },
  azure: {
    kind: "custom",
    category: "machine-translation",
    label: "Azure Translate",
    docs: "https://learn.microsoft.com/azure/ai-services/translator/text-translation/reference/v3/translate",
    defaults: { apiKey: "", chunkSize: 10000, delayTime: 200, region: "eastasia", batchSize: 100 },
  },
  deeplx: {
    kind: "custom",
    category: "machine-translation",
    label: "DeepLX (Free)",
    docs: "https://deeplx.owo.network/endpoints/free.html",
    defaults: { url: "", chunkSize: 1000, delayTime: 200, batchSize: 10 },
  },
  qwenMt: {
    kind: "custom",
    category: "machine-translation",
    label: "Qwen-MT",
    docs: "https://help.aliyun.com/zh/model-studio/machine-translation",
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    defaults: { url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", apiKey: "", domains: "", model: "qwen-mt-flash", batchSize: 20 },
    endpoints: [
      { label: "Mainland (CN)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "International", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "US", url: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions" },
    ],
  },
  translategemma: {
    kind: "custom",
    category: "machine-translation",
    // Google's TranslateGemma family — translation-specialized Gemma derivative
    // with a non-standard chat template (structured `content` array w/ lang
    // codes). The service implementation pre-renders the template and POSTs to
    // /v1/completions to bypass servers that normalize multimodal content
    // (notably LM Studio's OpenAI-compat layer).
    label: "TranslateGemma",
    docs: "https://huggingface.co/collections/google/translategemma",
    // No apiKey field — TranslateGemma is a model (weights), not a hosted
    // service. Users self-host on LM Studio / llama.cpp / Ollama / vLLM,
    // none of which require an API key by default. (Users behind an auth
    // proxy should use Custom (OpenAI-compatible) instead — that path
    // exposes apiKey + URL together. Importing apiKey via JSON here won't
    // work because migrateConfig strips fields not in defaults.)
    // No temperature field — Google's model card uses greedy decoding
    // (`do_sample=False`); the model wasn't trained for sampling and
    // non-zero values degrade output. Service hardcodes temperature=0
    // so LM Studio's UI default (typically 0.7-1.0) doesn't bleed in.
    defaults: { url: "http://127.0.0.1:1234/v1/chat/completions", model: "translategemma-4b-it", batchSize: 10, delayTime: 200 },
    endpoints: [
      // Same local-server order as Custom (OpenAI-compatible) — LM Studio first
      // (matches `defaults.url` + placeholder), then Ollama / llama.cpp.
      { label: "LM Studio", url: "http://127.0.0.1:1234/v1/chat/completions" },
      { label: "Ollama", url: "http://127.0.0.1:11434/v1/chat/completions" },
      { label: "llama.cpp", url: "http://127.0.0.1:8080/v1/chat/completions" },
    ],
  },

  // ===== LLM APIs (mixed OpenAI-compat + custom; ordered by usage) =====
  deepseek: {
    kind: "openai-compat",
    category: "llm",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-v4-flash",
    defaultTemperature: 0.7,
    docs: "https://api-docs.deepseek.com/",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    allowRelay: true,
    thinkingModelPattern: /^deepseek-v4-pro$/i,
  },
  openai: {
    kind: "openai-compat",
    category: "llm",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-5.4-mini",
    defaultTemperature: 1,
    docs: "https://platform.openai.com/docs/api-reference/chat",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    allowRelay: true,
  },
  claude: {
    kind: "custom",
    category: "llm",
    label: "Claude",
    docs: "https://docs.anthropic.com/en/api/messages",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    defaults: { apiKey: "", model: "claude-sonnet-4-6", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100, enableThinking: false, useRelay: false },
  },
  gemini: {
    kind: "custom",
    category: "llm",
    label: "Gemini",
    docs: "https://ai.google.dev/gemini-api/docs/text-generation",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    defaults: { apiKey: "", model: "gemini-3-flash", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100 },
  },
  qwen: {
    kind: "openai-compat",
    category: "llm",
    label: "Qwen",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen3.6-plus",
    defaultTemperature: 0.7,
    docs: "https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions",
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "International", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "US", url: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions" },
    ],
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    label: "Moonshot (Kimi)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2.5",
    defaultTemperature: 0.7,
    docs: "https://platform.moonshot.cn/docs",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.moonshot.cn/v1/chat/completions" },
      { label: "International", url: "https://api.moonshot.ai/v1/chat/completions" },
    ],
  },
  doubao: {
    kind: "openai-compat",
    category: "llm",
    label: "Doubao (火山方舟)",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-seed-2-0-lite-260215",
    defaultTemperature: 0.7,
    docs: "https://www.volcengine.com/docs/82379",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Standard", url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions" },
      { label: "Coding Plan", url: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions" },
    ],
  },
  zhipu: {
    kind: "openai-compat",
    category: "llm",
    label: "Zhipu GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4.6",
    defaultTemperature: 0.7,
    docs: "https://docs.bigmodel.cn/",
    apiKeyUrl: "https://open.bigmodel.cn/usercenter/apikeys",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
      { label: "International (Z.ai)", url: "https://api.z.ai/api/paas/v4/chat/completions" },
    ],
  },
  minimax: {
    kind: "openai-compat",
    category: "llm",
    label: "MiniMax",
    endpoint: "https://api.minimaxi.com/v1/chat/completions",
    defaultModel: "MiniMax-M2.7",
    defaultTemperature: 0.7,
    docs: "https://platform.minimax.io/docs/api-reference/text-chat",
    apiKeyUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    allowCustomUrl: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.minimaxi.com/v1/chat/completions" },
      { label: "International", url: "https://api.minimax.io/v1/chat/completions" },
    ],
  },
  hunyuan: {
    kind: "openai-compat",
    category: "llm",
    label: "Tencent Hunyuan (混元)",
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    defaultModel: "hunyuan-turbos-latest",
    defaultTemperature: 0.7,
    docs: "https://cloud.tencent.com/document/product/1729/111007",
    apiKeyUrl: "https://console.cloud.tencent.com/hunyuan/api-key",
  },
  qianfan: {
    kind: "openai-compat",
    category: "llm",
    label: "Baidu ERNIE (百度千帆)",
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-5.0",
    defaultTemperature: 0.7,
    docs: "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
    apiKeyUrl: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
  },
  mistral: {
    kind: "openai-compat",
    category: "llm",
    label: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-large-latest",
    defaultTemperature: 0.7,
    docs: "https://docs.mistral.ai/api/",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    allowRelay: true,
  },
  grok: {
    kind: "openai-compat",
    category: "llm",
    label: "xAI (Grok)",
    endpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4-1-fast-non-reasoning",
    defaultTemperature: 0.7,
    docs: "https://docs.x.ai/docs/models",
    apiKeyUrl: "https://console.x.ai/",
    allowRelay: true,
  },
  perplexity: {
    kind: "openai-compat",
    category: "llm",
    label: "Perplexity",
    endpoint: "https://api.perplexity.ai/chat/completions",
    defaultModel: "sonar",
    defaultTemperature: 0.7,
    docs: "https://docs.perplexity.ai/api-reference/chat-completions-post",
    apiKeyUrl: "https://www.perplexity.ai/account/api/keys",
    allowRelay: true,
  },
  cohere: {
    kind: "openai-compat",
    category: "llm",
    label: "Cohere",
    endpoint: "https://api.cohere.ai/compatibility/v1/chat/completions",
    defaultModel: "command-a-translate-08-2025",
    defaultTemperature: 0.7,
    docs: "https://docs.cohere.com/docs/compatibility-api",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
  },

  // ===== Aggregators & Self-hosted (no relay — already cross-provider / CORS-friendly / user-controlled) =====
  openrouter: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    defaultModel: "nvidia/nemotron-3-super-120b-a12b:free",
    defaultTemperature: 0.7,
    docs: "https://openrouter.ai/models?q=free",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    extraHeaders: { "HTTP-Referer": "https://aishort.top", "X-Title": "AIShort" },
  },
  groq: {
    kind: "openai-compat",
    category: "aggregator",
    label: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    defaultModel: "openai/gpt-oss-20b",
    defaultTemperature: 0.7,
    docs: "https://console.groq.com/docs/text-chat",
    apiKeyUrl: "https://console.groq.com/keys",
  },
  siliconflow: {
    kind: "openai-compat",
    category: "aggregator",
    label: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V3.2",
    defaultTemperature: 0.7,
    docs: "https://docs.siliconflow.cn/api-reference/chat-completions/chat-completions",
    apiKeyUrl: "https://cloud.siliconflow.cn/me/account/ak",
  },
  nvidia: {
    kind: "custom",
    category: "aggregator",
    label: "Nvidia NIM",
    docs: "https://build.nvidia.com/explore/discover",
    apiKeyUrl: "https://build.nvidia.com/",
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v4-flash", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100, enableThinking: false },
  },
  azureopenai: {
    kind: "custom",
    category: "aggregator",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure",
    defaults: { url: "", apiKey: "", model: "gpt-5-mini", apiVersion: "2025-11-18", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100 },
  },
  llm: {
    kind: "custom",
    category: "aggregator",
    // Catch-all for any OpenAI-compatible endpoint not in the dedicated list above
    // (Ollama / LM Studio / vLLM / Together AI / Fireworks AI / self-hosted, etc).
    // defaults.url stays empty intentionally — Custom has no implicit default URL,
    // user must pick. The `endpoints` array offers common starting points.
    label: "Custom (OpenAI-compatible)",
    // sendSystemPrompt: true by default to match historical behavior. Users running
    // models with chat templates that reject `system` role (Gemma family on LM Studio,
    // some codegemma variants) can switch this off so only the user message is sent
    // — avoids jinja "Conversations must start with a user prompt".
    // (TranslateGemma is its own dedicated service — see `translategemma` provider.)
    defaults: { url: "", apiKey: "", model: "", temperature: 0.7, sendSystemPrompt: true, batchSize: 10, contextBatchSize: 1, contextWindow: 100 },
    endpoints: [
      // Local servers first (LM Studio → Ollama → llama.cpp by general
      // popularity), cloud aggregators after. Order matches translategemma's
      // local section so users get the same chip order across both
      // URL-primary services.
      { label: "LM Studio", url: "http://127.0.0.1:1234/v1/chat/completions" },
      { label: "Ollama", url: "http://127.0.0.1:11434/v1/chat/completions" },
      { label: "llama.cpp", url: "http://127.0.0.1:8080/v1/chat/completions" },
      { label: "Together AI", url: "https://api.together.xyz/v1/chat/completions" },
      { label: "Fireworks AI", url: "https://api.fireworks.ai/inference/v1/chat/completions" },
    ],
  },

  // ===== Internal-only (in defaultConfigs + dispatch but omitted from user-facing lists) =====
  webgoogletranslate: {
    kind: "custom",
    category: "machine-translation",
    label: "Web Google Translate",
    defaults: { batchSize: 1 },
  },
} as const satisfies Record<string, ProviderSpec>;

// Note: `TranslationMethod` is canonicalized in `./types.ts` (which adds the
// `(string & {})` open-union to preserve user-supplied values). We don't
// redeclare it here to avoid an ambiguous re-export via the barrel.
type ProviderKey = keyof typeof PROVIDERS;

// Providers that live in defaultConfigs + dispatch but are NOT surfaced in the
// user-facing service list (server-side proxies, internal routing).
const INTERNAL_PROVIDERS: ReadonlySet<string> = new Set(["webgoogletranslate"]);

// ========== Derived views ==========

// Narrow the key union to only OpenAI-compat entries. This preserves the
// specific literal union so consumers typing `Record<OpenAICompatProviderKey, T>`
// get exhaustiveness guarantees (e.g. services/index.ts's dispatch table).
export type OpenAICompatProviderKey = {
  [K in keyof typeof PROVIDERS]: (typeof PROVIDERS)[K] extends { kind: "openai-compat" } ? K : never;
}[keyof typeof PROVIDERS];

// OpenAI-compat subset — consumed by the factory in services/llm.ts.
export const OPENAI_COMPAT_KEYS = Object.entries(PROVIDERS)
  .filter(([, p]) => p.kind === "openai-compat")
  .map(([k]) => k) as OpenAICompatProviderKey[];

export const OPENAI_COMPAT_PROVIDERS = Object.fromEntries(Object.entries(PROVIDERS).filter(([, p]) => p.kind === "openai-compat")) as Record<OpenAICompatProviderKey, OpenAICompatProviderSpec>;

// Services that behave as LLMs in the UI (prompt fields visible, context window, etc.).
export const LLM_MODELS: string[] = Object.entries(PROVIDERS)
  .filter(([, p]) => p.category !== "machine-translation")
  .map(([k]) => k);

/**
 * Services where URL is the primary credential — apiKey is optional/absent
 * because the runtime is typically self-hosted (LM Studio, llama.cpp, vLLM)
 * and doesn't require auth. Affects:
 *   - UI: URL field shows as required (red *), apiKey hidden / not-required
 *   - Validation: URL emptiness blocks translation; missing apiKey is OK
 *   - Status: empty URL → "needs-config"; otherwise → "configured" (not "free")
 *
 * Add new services here when they fit this profile (URL required, apiKey optional).
 */
export const URL_IS_PRIMARY_CRED: ReadonlySet<string> = new Set(["llm", "translategemma"]);

// User-facing service list, declaration-order. The cast widens `as const` literal
// types so optional `docs` / `apiKeyUrl` are uniformly accessible across entries.
export const TRANSLATION_SERVICES: TranslationServiceInfo[] = Object.entries(PROVIDERS)
  .filter(([k]) => !INTERNAL_PROVIDERS.has(k))
  .map(([value, p]) => {
    const spec = p as ProviderSpec;
    return {
      value,
      label: spec.label,
      ...(spec.docs && { docs: spec.docs }),
      ...(spec.apiKeyUrl && { apiKeyUrl: spec.apiKeyUrl }),
    };
  });

// Compose the TranslationConfig for each provider.
const buildOpenAICompatDefault = (spec: OpenAICompatProviderSpec): TranslationConfig => {
  const base: TranslationConfig = {
    apiKey: "",
    model: spec.defaultModel,
    temperature: spec.defaultTemperature,
    // batchSize = line-by-line / non-context concurrency; kept high because
    // each request is a single short prompt. contextBatchSize = concurrent
    // context batches (heavy payloads, ~100 lines each); low default to avoid
    // rate-limit storms. Users with paid tier can raise either in settings.
    batchSize: 20,
    contextBatchSize: 3,
    contextWindow: 100,
  };
  if (spec.allowCustomUrl) base.url = "";
  if (spec.allowRelay) base.useRelay = false;
  return base;
};

/**
 * Pattern of models on `service` that support thinking-mode, or undefined if the
 * service has no model-conditional thinking support. UI uses this to gate the
 * thinking toggle on the current model; services use it to decide whether to
 * inject thinking params upstream.
 */
export const getThinkingModelPattern = (service: string): RegExp | undefined => {
  const p = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  return p?.kind === "openai-compat" ? p.thinkingModelPattern : undefined;
};

/**
 * Quick-pick endpoints for providers that surface multiple URL options (regional
 * variants like qwen mainland/intl/us, or curated starter URLs for Custom).
 * Returns undefined when the provider doesn't declare any. The cast widens the
 * literal `as const` inference so TS sees endpoints as an optional BaseProvider
 * field on every entry.
 */
export const getProviderEndpoints = (service: string): Array<{ label: string; url: string }> | undefined => {
  return (PROVIDERS[service as ProviderKey] as ProviderSpec | undefined)?.endpoints;
};

export const defaultConfigs = Object.fromEntries(Object.entries(PROVIDERS).map(([k, p]) => [k, p.kind === "openai-compat" ? buildOpenAICompatDefault(p) : p.defaults])) as Record<
  ProviderKey,
  TranslationConfig
>;

// Grouped Select options for the service picker UI.
const CATEGORY_LABELS: Record<ServiceCategory, string> = {
  "machine-translation": "Machine Translation",
  llm: "LLM APIs",
  aggregator: "Aggregators & Self-hosted",
};

export const categorizedOptions = (["machine-translation", "llm", "aggregator"] as const).map((cat) => ({
  label: CATEGORY_LABELS[cat],
  options: TRANSLATION_SERVICES.filter((s) => PROVIDERS[s.value as ProviderKey]?.category === cat).map(({ value, label }) => ({ value, label })),
}));

// Lookups
export const findMethodLabel = (method: string): string => PROVIDERS[method as ProviderKey]?.label ?? method;

export const getDefaultConfig = (method: string): TranslationConfig | undefined => defaultConfigs[method as ProviderKey];
