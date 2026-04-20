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
    defaults: { url: "", apiKey: "", domains: "", model: "qwen-mt-flash", batchSize: 20 },
  },

  // ===== LLM APIs (mixed OpenAI-compat + custom; ordered by usage) =====
  deepseek: {
    kind: "openai-compat",
    category: "llm",
    label: "DeepSeek",
    endpoint: "https://api.deepseek.com/chat/completions",
    defaultModel: "deepseek-chat",
    defaultTemperature: 0.7,
    docs: "https://api-docs.deepseek.com/",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    allowRelay: true,
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
    defaults: { apiKey: "", model: "claude-sonnet-4-6", temperature: 0.7, batchSize: 20, contextWindow: 50, enableThinking: false, useRelay: false },
  },
  gemini: {
    kind: "custom",
    category: "llm",
    label: "Gemini",
    docs: "https://ai.google.dev/gemini-api/docs/text-generation",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    defaults: { apiKey: "", model: "gemini-3-flash", temperature: 0.7, batchSize: 20, contextWindow: 50 },
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
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    label: "Moonshot (Kimi)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2.5",
    defaultTemperature: 0.7,
    docs: "https://platform.moonshot.ai/docs",
    apiKeyUrl: "https://platform.moonshot.ai/console/api-keys",
    allowRelay: true,
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
    allowRelay: true,
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
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v3.2", temperature: 0.7, batchSize: 20, contextWindow: 50, enableThinking: false },
  },
  azureopenai: {
    kind: "custom",
    category: "aggregator",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure",
    defaults: { url: "", apiKey: "", model: "gpt-5-mini", apiVersion: "2025-11-18", temperature: 0.7, batchSize: 20, contextWindow: 50 },
  },
  llm: {
    kind: "custom",
    category: "aggregator",
    label: "Custom LLM",
    defaults: { url: "http://127.0.0.1:11434/v1/chat/completions", apiKey: "", model: "llama3.2", temperature: 0.7, batchSize: 20, contextWindow: 50 },
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
    batchSize: 20,
    contextWindow: 50,
  };
  if (spec.allowCustomUrl) base.url = "";
  if (spec.allowRelay) base.useRelay = false;
  return base;
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
