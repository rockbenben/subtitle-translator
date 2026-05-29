// Single source of truth for every translation provider.
//
// PROVIDERS below is the ONE place you edit to add / change a service.
// TRANSLATION_PROVIDERS (UI list), LLM_MODELS, defaultConfigs, categorizedOptions,
// OPENAI_COMPAT_PROVIDERS (factory input), findMethodLabel, getDefaultConfig,
// and the TranslationMethod union type are all derived views over PROVIDERS.

import type { ReasoningEffort, TranslationConfig, TranslationProvider } from "./types";

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
  /**
   * Curated quick-pick model dropdown surfaced on the model input
   * (TranslationSettings → AutoComplete). Users can still type any value —
   * the list is a convenience, not a whitelist. Provider's `defaults.model`
   * (custom kind) or `defaultModel` (openai-compat kind) should appear here
   * so the active model highlights in the dropdown.
   *
   * Why curated: LLM SKUs churn fast (monthly cadence for some vendors), and
   * the previous text-only input forced every user to manually track the
   * vendor's current naming. Listing 2-3 popular SKUs per provider lets
   * users one-click switch tier (flagship / cheap / reasoning).
   *
   * `thinking: true` on an entry marks SKUs that support thinking-mode (per
   * vendor docs). UI uses this flag to gate the "Enable thinking" toggle;
   * services use it to inject the vendor-specific thinking params (see
   * isThinkingModel helper). Per-entry flag is self-documenting and scales
   * without provider-level regex.
   */
  models?: ReadonlyArray<{ label: string; value: string; thinking?: boolean }>;
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

// Declared in UI display order. TRANSLATION_PROVIDERS iterates this directly,
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
  deeplx: {
    kind: "custom",
    category: "machine-translation",
    label: "DeepLX (Free)",
    docs: "https://deeplx.owo.network/endpoints/free.html",
    defaults: { url: "", chunkSize: 1000, delayTime: 200, batchSize: 10 },
  },
  azure: {
    kind: "custom",
    category: "machine-translation",
    label: "Azure Translate",
    docs: "https://learn.microsoft.com/azure/ai-services/translator/text-translation/reference/v3/translate",
    defaults: { apiKey: "", chunkSize: 10000, delayTime: 200, region: "eastasia", batchSize: 100 },
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
    // qwen-mt-turbo deprecated 不收录;qwen-mt-lite-us 是美区分部署版本,
    // 仅在 international endpoint 才可用,不放主清单避免误选。
    models: [
      { label: "Qwen-MT Flash", value: "qwen-mt-flash" },
      { label: "Qwen-MT Plus", value: "qwen-mt-plus" },
      { label: "Qwen-MT Lite", value: "qwen-mt-lite" },
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
    //
    // `defaults.url` stays empty intentionally — same as Custom (OpenAI-compat).
    // Users self-host on heterogeneous runtimes (LM Studio :1234, Ollama :11434,
    // llama.cpp :8080); shipping any one as the default would mislead users on
    // the other two. Empty default → status starts as "needs-config" and forces
    // an explicit endpoint pick from the chips below.
    defaults: { url: "", model: "translategemma-4b-it", batchSize: 10, delayTime: 200 },
    endpoints: [
      // Same local-server order as Custom (OpenAI-compatible) — LM Studio first
      // (matches the input's example placeholder), then Ollama / llama.cpp.
      { label: "LM Studio", url: "http://127.0.0.1:1234/v1/chat/completions" },
      { label: "Ollama", url: "http://127.0.0.1:11434/v1/chat/completions" },
      { label: "llama.cpp", url: "http://127.0.0.1:8080/v1/chat/completions" },
    ],
    models: [
      { label: "TranslateGemma 4B", value: "translategemma-4b-it" },
      { label: "TranslateGemma 12B", value: "translategemma-12b-it" },
      { label: "TranslateGemma 27B", value: "translategemma-27b-it" },
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
    // DeepSeek V4 系列两个 SKU 都支持 thinking / non-thinking 两种模式
    // (docs.deepseek.com: "supporting both modes")。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
    ],
  },
  openai: {
    kind: "openai-compat",
    category: "llm",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-5.4-mini",
    defaultTemperature: 1,
    docs: "https://developers.openai.com/api/docs/guides/text",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    allowRelay: true,
    // https://developers.openai.com/api/docs/models
    // GPT-5 系列全部支持 reasoning ── developers.openai.com 各 model 页明示
    // "Reasoning token support" + reasoning.effort: none/low/medium/high/xhigh
    models: [
      { label: "GPT-5.5", value: "gpt-5.5", thinking: true },
      { label: "GPT-5.4", value: "gpt-5.4", thinking: true },
      { label: "GPT-5.4 Mini", value: "gpt-5.4-mini", thinking: true },
    ],
  },
  claude: {
    kind: "custom",
    category: "llm",
    label: "Claude",
    docs: "https://platform.claude.com/docs/en/intro",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    defaults: { apiKey: "", model: "claude-sonnet-4-6", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100, thinkingEffort: {}, useRelay: false },
    // Claude 4 系列全部支持 thinking ── Opus 4.7 是 adaptive thinking,
    // Sonnet 4.6 + Haiku 4.5 是 extended thinking(per docs.anthropic.com)。
    models: [
      { label: "Claude Opus 4.7", value: "claude-opus-4-7", thinking: true },
      { label: "Claude Sonnet 4.6", value: "claude-sonnet-4-6", thinking: true },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001", thinking: true },
    ],
  },
  gemini: {
    kind: "custom",
    category: "llm",
    label: "Gemini",
    docs: "https://ai.google.dev/gemini-api/docs/text-generation",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    defaults: { apiKey: "", model: "gemini-3.5-flash", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100, thinkingEffort: {} },
    // 仅收录 Gemini 3.x 系列(2.5 已过时,且参数协议不同需要 budget mapping 增加
    // service 复杂度,精简掉)。Gemini 3 thinking 通过
    // `generationConfig.thinkingConfig.thinkingLevel` (minimal/low/medium/high)
    // 控制(ai.google.dev/gemini-api/docs/thinking),默认开启,off 时传 "minimal"。
    models: [
      { label: "Gemini 3.1 Pro (Preview)", value: "gemini-3.1-pro-preview", thinking: true },
      { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash", thinking: true },
      { label: "Gemini 3.1 Flash Lite", value: "gemini-3.1-flash-lite", thinking: true },
    ],
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
    // https://bailian.console.aliyun.com/cn-beijing?spm=5176.29597918.J_F4r-7Zs_PtjrjEY48APSA.d_primary.338d133cOoVKn9&tab=model#/model-market/all?providers=qwen
    models: [
      { label: "Qwen3.7 Max", value: "qwen3.7-max", thinking: true },
      { label: "Qwen3.6 Plus", value: "qwen3.6-plus", thinking: true },
      { label: "Qwen3.6 Flash", value: "qwen3.6-flash", thinking: true },
    ],
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    label: "Moonshot (Kimi)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2.6",
    defaultTemperature: 0.7,
    docs: "https://platform.moonshot.cn/docs",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.moonshot.cn/v1/chat/completions" },
      { label: "International", url: "https://api.moonshot.ai/v1/chat/completions" },
    ],
    // K2.6 通过扁平 `thinking: {type}` 字段切换思考模式。K2.6 同时是 param-locked
    // 模型(temperature 等不可修改),service 层会在 model 匹配时 strip 这些字段。
    // K2.5 不支持参数切换 thinking;kimi-k2-thinking 系列 2026-05 deprecating,
    // 不收录避免引导用户选即将失效的 SKU。
    models: [
      { label: "Kimi K2.6", value: "kimi-k2.6", thinking: true },
      { label: "Kimi K2.5", value: "kimi-k2.5" },
    ],
  },
  doubao: {
    kind: "openai-compat",
    category: "llm",
    label: "Doubao (火山方舟)",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-seed-2-0-lite-260428",
    defaultTemperature: 0.7,
    docs: "https://www.volcengine.com/docs/82379",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Standard", url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions" },
      { label: "Coding Plan", url: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions" },
    ],
    // https://www.volcengine.com/docs/82379/1330310
    models: [
      { label: "Doubao Seed 2.0 Pro", value: "doubao-seed-2-0-pro-260215", thinking: true },
      { label: "Doubao Seed 2.0 Lite", value: "doubao-seed-2-0-lite-260428", thinking: true },
      { label: "Doubao Seed 2.0 Mini", value: "doubao-seed-2-0-mini-260428", thinking: true },
    ],
  },
  zhipu: {
    kind: "openai-compat",
    category: "llm",
    label: "Zhipu GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-4.7",
    defaultTemperature: 0.7,
    docs: "https://docs.bigmodel.cn/cn/guide/start/introduction",
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    allowCustomUrl: true,
    allowRelay: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
      { label: "International (Z.ai)", url: "https://api.z.ai/api/paas/v4/chat/completions" },
    ],
    // docs.bigmodel.cn/cn/guide/start/model-overview "文本模型" 表格完整列表
    // (排除标记"即将下线"的 glm-4.5-flash),按文档原顺序。
    models: [
      { label: "GLM-5.1", value: "glm-5.1", thinking: true },
      { label: "GLM-5", value: "glm-5", thinking: true },
      { label: "GLM-4.7", value: "glm-4.7", thinking: true },
      { label: "GLM-4.7 FlashX", value: "glm-4.7-flashx" },
      { label: "GLM-4.6", value: "glm-4.6", thinking: true },
      { label: "GLM-4.5 Air", value: "glm-4.5-air" },
      { label: "GLM-4.5 AirX", value: "glm-4.5-airx" },
      { label: "GLM-4 Long", value: "glm-4-long" },
      { label: "GLM-4 FlashX", value: "glm-4-flashx-250414" },
      { label: "GLM-4.7 Flash", value: "glm-4.7-flash" },
      { label: "GLM-4 Flash", value: "glm-4-flash-250414" },
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
    models: [
      // Not thinking-tagged: M2 reasoning is intrinsic/unclosable on the hosted
      // API (no toggle param; `enable_thinking` is a local-deploy kwarg). See llm.ts.
      { label: "MiniMax M2.7", value: "MiniMax-M2.7" },
      { label: "MiniMax M2.7 High-Speed", value: "MiniMax-M2.7-highspeed" },
      { label: "MiniMax M2.5", value: "MiniMax-M2.5" },
      { label: "MiniMax M2.1", value: "MiniMax-M2.1" },
    ],
  },
  qianfan: {
    kind: "openai-compat",
    category: "llm",
    label: "Baidu ERNIE (百度千帆)",
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-5.1",
    defaultTemperature: 0.7,
    docs: "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
    apiKeyUrl: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
    models: [
      { label: "ERNIE 5.1", value: "ernie-5.1" },
      { label: "ERNIE 5.0", value: "ernie-5.0" },
      // ERNIE 5.0-Thinking 是 thinking-intrinsic 模型(SKU 即 thinking 模式),无 toggle 参数
      { label: "ERNIE 5.0 Thinking", value: "ernie-5.0-thinking-latest" },
      { label: "ERNIE 4.5 Turbo 128K", value: "ernie-4.5-turbo-128k-preview" },
      { label: "ERNIE 4.5 Turbo 32K", value: "ernie-4.5-turbo-32k" },
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
    models: [
      // Not thinking-tagged: the OpenAI-compat path has no documented thinking
      // toggle (the old `enable_enhancement` was a web-search switch, not
      // thinking). TurboS is fast-think, T1 is reasoning-intrinsic, a13b only
      // toggles via the `/no_think` prompt prefix — none controllable here. See llm.ts.
      { label: "Hunyuan TurboS", value: "hunyuan-turbos-latest" },
      { label: "Hunyuan 2.0 Thinking", value: "hunyuan-2.0-thinking-20251109" },
      { label: "Hunyuan 2.0 Instruct", value: "hunyuan-2.0-instruct-20251111" },
      { label: "Hunyuan T1", value: "hunyuan-t1-latest" },
      { label: "Hunyuan A13B", value: "hunyuan-a13b" },
      { label: "Hunyuan Lite", value: "hunyuan-lite" },
    ],
  },
  mistral: {
    kind: "openai-compat",
    category: "llm",
    label: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    defaultModel: "mistral-medium-3-5",
    defaultTemperature: 0.7,
    docs: "https://docs.mistral.ai/api/",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    allowRelay: true,
    // 来自 https://docs.mistral.ai/models/overview
    models: [
      { label: "Mistral Medium 3.5", value: "mistral-medium-3-5" },
      { label: "Mistral Small 4", value: "mistral-small-4" },
      { label: "Mistral Large 3", value: "mistral-large-3" },
      { label: "Ministral 3 14B", value: "ministral-3-14b" },
      // Magistral 是 thinking-intrinsic(model 选择即 thinking 模式),无 toggle 参数
      { label: "Magistral Medium 1.2", value: "magistral-medium-1-2" },
    ],
  },
  grok: {
    kind: "openai-compat",
    category: "llm",
    label: "xAI (Grok)",
    endpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4.3",
    defaultTemperature: 0.7,
    docs: "https://docs.x.ai/docs/models",
    apiKeyUrl: "https://console.x.ai/",
    allowRelay: true,
    // Grok 4.3 chat/completions 支持 reasoning_effort 但仅 low/high 两档
    // (docs.x.ai/docs/api-reference);grok-4.20-reasoning / multi-agent 是
    // thinking-intrinsic SKU,无 toggle 参数。service 层 medium → low 映射。
    models: [
      { label: "Grok 4.3", value: "grok-4.3", thinking: true },
      { label: "Grok 4.20 Reasoning", value: "grok-4.20-0309-reasoning" },
      { label: "Grok 4.20 Non-Reasoning", value: "grok-4.20-0309-non-reasoning" },
      { label: "Grok 4.20 Multi-Agent", value: "grok-4.20-multi-agent-0309" },
    ],
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
    // https://docs.perplexity.ai/docs/sonar/models
    // Sonar Reasoning Pro / Deep Research 是 thinking-intrinsic 模型,无 toggle 参数,
    // 用户选这些 SKU 即等于选 thinking 模式。
    models: [
      { label: "Sonar", value: "sonar" },
      { label: "Sonar Pro", value: "sonar-pro" },
      { label: "Sonar Reasoning Pro", value: "sonar-reasoning-pro" },
      { label: "Sonar Deep Research", value: "sonar-deep-research" },
    ],
  },
  cohere: {
    kind: "openai-compat",
    category: "llm",
    label: "Cohere",
    endpoint: "https://api.cohere.ai/compatibility/v1/chat/completions",
    defaultModel: "command-a-plus-05-2026",
    defaultTemperature: 0.7,
    docs: "https://docs.cohere.com/docs/compatibility-api",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    // Command A Reasoning 是 thinking-intrinsic 模型(SKU 即 thinking 模式),无 toggle。
    // https://docs.cohere.com/docs/models
    models: [
      { label: "Command A Plus", value: "command-a-plus-05-2026" },
      { label: "Command A", value: "command-a-03-2025" },
      { label: "Command A Reasoning", value: "command-a-reasoning-08-2025" },
      { label: "Command A Translate", value: "command-a-translate-08-2025" },
    ],
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
    // https://openrouter.ai/models?order=top-weekly 2个free+9个主流
    // OpenRouter 统一 reasoning_effort 参数会自动转发底层 provider(Claude→budget_tokens,
    // OpenAI→reasoning_effort,Gemini→thinkingLevel,DeepSeek→thinking 等),所以
    // 底层 model 支持 thinking 的 slug 都标 thinking: true 即可。
    models: [
      { label: "Nemotron 3 Super 120B (free)", value: "nvidia/nemotron-3-super-120b-a12b:free" },
      { label: "Laguna M.1 (free)", value: "poolside/laguna-m.1:free" },
      { label: "DeepSeek V4 Flash", value: "deepseek/deepseek-v4-flash", thinking: true },
      { label: "Hy3 preview", value: "tencent/hy3-preview", thinking: true },
      { label: "Claude Sonnet 4.6", value: "anthropic/claude-sonnet-4.6", thinking: true },
      { label: "Claude Opus 4.7", value: "anthropic/claude-opus-4.7", thinking: true },
      { label: "Gemini 3.5 Flash", value: "google/gemini-3.5-flash", thinking: true },
      { label: "GPT-5.4 Mini", value: "openai/gpt-5.4-mini", thinking: true },
      { label: "Grok 4.3", value: "x-ai/grok-4.3" },
      { label: "Kimi K2.6", value: "moonshotai/kimi-k2.6", thinking: true },
      { label: "MiniMax M2.7", value: "minimax/minimax-m2.7" },
    ],
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
    // 来自 console.groq.com/docs/models 当前 production 列表。preview 阶段的 (如 qwen/qwen3-32b) 不收录避免引导用户选随时可能下线的 SKU。
    // gpt-oss 系列支持 reasoning_effort(top-level enum),其他 model 不支持。
    models: [
      { label: "GPT-OSS 20B", value: "openai/gpt-oss-20b", thinking: true },
      { label: "GPT-OSS 120B", value: "openai/gpt-oss-120b", thinking: true },
      { label: "Llama 3.3 70B Versatile", value: "llama-3.3-70b-versatile" },
      { label: "Llama 3.1 8B Instant", value: "llama-3.1-8b-instant" },
      { label: "Groq Compound", value: "groq/compound" },
      { label: "Groq Compound Mini", value: "groq/compound-mini" },
    ],
  },
  siliconflow: {
    kind: "openai-compat",
    category: "aggregator",
    label: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    defaultTemperature: 0.7,
    docs: "https://docs.siliconflow.cn/api-reference/chat-completions/chat-completions",
    apiKeyUrl: "https://cloud.siliconflow.cn/me/account/ak",
    // 来自 siliconflow.com/pricing 当前文本生成模型表
    // 登录后查看 https://cloud.siliconflow.cn/me/models?types=chat
    // DeepSeek V4 和 Kimi K2.6 通过 SiliconFlow 走 OpenAI-compat 协议
    // (同原生 DeepSeek/Moonshot 的 thinking + reasoning_effort 参数)。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/DeepSeek-V4-Flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-ai/DeepSeek-V4-Pro", thinking: true },
      { label: "Kimi K2.6", value: "moonshotai/Kimi-K2.6", thinking: true },
      { label: "MiniMax M2.5", value: "minimax/MiniMax-M2.5" },
      { label: "GLM-5.1", value: "zai-org/GLM-5.1" },
      { label: "GLM-4.7", value: "zai-org/GLM-4.7" },
    ],
  },
  nvidia: {
    kind: "custom",
    category: "aggregator",
    label: "Nvidia NIM",
    docs: "https://build.nvidia.com/explore/discover",
    apiKeyUrl: "https://build.nvidia.com/",
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v4-flash", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100, thinkingEffort: {} },
    // https://build.nvidia.com/models?filters=nimType%3Anim_type_preview
    // DeepSeek V4 系列在 NVIDIA NIM 上 thinking 协议跟原生 DeepSeek 不同 ──
    // 用 chat_template_kwargs.thinking + reasoning_effort 嵌套(其他 model
    // 不支持 thinking 注入,user 想要 thinking 应该用原生 DeepSeek provider)。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/deepseek-v4-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-ai/deepseek-v4-pro", thinking: true },
      { label: "GLM-5.1", value: "z-ai/glm-5.1" },
      { label: "Gemma 4 31B IT", value: "google/gemma-4-31b-it" },
      { label: "Nemotron Super 120B", value: "nvidia/nemotron-3-super-120b-a12b" },
      { label: "Llama 3.1 70B Instruct", value: "meta/llama-3.1-70b-instruct" },
      { label: "Llama 3.1 8B Instruct", value: "meta/llama-3.1-8b-instruct" },
      { label: "Qwen3 Coder 480B", value: "qwen/qwen3-coder-480b-a35b-instruct" },
    ],
  },
  azureopenai: {
    kind: "custom",
    category: "aggregator",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/zh-cn/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure",
    defaults: { url: "", apiKey: "", model: "gpt-5.4-mini", apiVersion: "2025-11-18", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 100, thinkingEffort: {} },
    // GPT-5 系列全部支持 reasoning(OpenAI 原生 + Azure 镜像同行为)。
    // gpt-chat-latest 是 5.5 Instant 别名(per Azure docs),同样支持。
    models: [
      { label: "GPT-chat-latest", value: "gpt-chat-latest", thinking: true },
      { label: "GPT-5.5", value: "gpt-5.5", thinking: true },
      { label: "GPT-5.4", value: "gpt-5.4", thinking: true },
      { label: "GPT-5.4 Mini", value: "gpt-5.4-mini", thinking: true },
      { label: "GPT-5.4 Nano", value: "gpt-5.4-nano", thinking: true },
    ],
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
    //
    // maxTokens: safety net for local-model repeat-loop. Cross-layer — to expose
    // on another service, also wire it in services/llm.ts (UI + cache key alone
    // gives a half-functional knob). Cloud services skip this on purpose: no
    // repeat-loop risk + their own server-side caps.
    // contextWindow defaults smaller than cloud LLM (100) because the Custom
    // path is the entry point for local Ollama/LM Studio users — small models
    // (<14B) commonly drop lines or scramble structure in long batches.
    // Power users with bigger local models can raise it in Advanced Settings.
    defaults: { url: "", apiKey: "", model: "", temperature: 0.7, maxTokens: 0, sendSystemPrompt: true, batchSize: 10, contextBatchSize: 1, contextWindow: 30 },
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

// `as unknown as Record<...>` double-cast: Object.fromEntries returns a
// generic shape that TS no longer considers "sufficiently overlapping" with
// the strict Record<OpenAICompatProviderKey, ...> target (widening triggered
// by the optional `thinking` field on model entries). The filter is correct
// at runtime; the double-cast bypasses the static narrowing check.
export const OPENAI_COMPAT_PROVIDERS = Object.fromEntries(Object.entries(PROVIDERS).filter(([, p]) => p.kind === "openai-compat")) as unknown as Record<
  OpenAICompatProviderKey,
  OpenAICompatProviderSpec
>;

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

/**
 * Services that work with zero user configuration because they fall back to a
 * public/shared endpoint when no credentials are supplied:
 *   - gtxFreeAPI: hits Google's free translate.googleapis.com directly
 *   - deeplx: empty URL falls back to our public THIRD_PARTY_ENDPOINTS.deeplx
 *
 * Effect:
 *   - Status block shows the "free" tag
 *   - "Configured services" chips row always lists them, even with empty config
 *
 * Do NOT add services here unless an empty config is genuinely functional
 * end-to-end without any user setup.
 */
export const NO_CRED_REQUIRED: ReadonlySet<string> = new Set(["gtxFreeAPI", "deeplx"]);

/**
 * Methods that get a live pre-flight reachability probe in validate() before bulk
 * translation (a one-shot "Hello world" / health check). Membership follows one
 * principle: probe a method IFF its dominant failure mode would NOT already
 * fast-fail on its own AND probing it is free.
 *
 *   - gtxFreeAPI, deeplx: free public proxies — when down/rate-limited they throw
 *     NETWORK / 5xx errors, which don't trip the per-line auth-abort cascade, so
 *     without a probe a dead service slow-fails line-by-line. Probing is free.
 *   - llm, translategemma: self-hosted (Ollama / LM Studio / vLLM) — "server not
 *     running" / wrong URL is a NETWORK error (no auth-abort), and the probe hits
 *     the user's own machine, so it's free.
 *   - deepl: free tier returns 456 (quota) which is non-auth (no abort); the
 *     fast-fail is worth the tiny quota the probe spends.
 *
 * Deliberately EXCLUDED — paid cloud LLMs (openai, deepseek, claude, gemini, …)
 * and paid MT (google, azure, …): their dominant failure is a bad key (401/403),
 * which ALREADY fast-aborts the whole batch for free via the per-line auth-abort
 * cascade (isAuthError → abortControllerRef.abort()). Probing them would instead
 * spend the user's tokens/quota on a "Hello world" health check every cold run.
 *
 * Invariants (registry.test.ts): NO_CRED_REQUIRED ⊆ this set (free methods are
 * always cheap to probe), and the only LLM-category method here is the
 * self-hosted `llm` (no paid cloud LLM is probed). validate()'s smart gate still
 * PROCEEDS (not blocks) on transient 429/5xx from these — the probe only
 * HARD-blocks definitive failures.
 */
export const PREFLIGHT_PROBE_METHODS: ReadonlySet<string> = new Set(["deepl", "deeplx", "llm", "gtxFreeAPI", "translategemma"]);

/**
 * Services that require a non-empty URL **in addition to** apiKey. Compare with
 * URL_IS_PRIMARY_CRED (URL only, apiKey optional). Currently just Azure OpenAI,
 * where URL is the per-tenant resource endpoint and apiKey authenticates.
 *
 * Affects:
 *   - Validation: empty URL blocks translation
 *   - Status: empty URL (with apiKey filled) → "needs-config", not "configured"
 */
export const URL_ALSO_REQUIRED: ReadonlySet<string> = new Set(["azureopenai"]);

export type ConfigStatus = "free" | "needs-config" | "configured";

/**
 * Single source of truth: derive a normalized config status from a service's
 * current config. Used by ApiStatusBlock (tag color) AND the "configured
 * services" chips row in TranslationSettings — keep them in lockstep.
 *
 *   - "free": runs without credentials (NO_CRED_REQUIRED set, or rare future
 *      services where the spec has no apiKey field at all)
 *   - "needs-config": at least one required field (apiKey / url / region) is
 *      empty — UI surfaces this with a warning chip
 *   - "configured": all required fields populated
 */
export const getConfigStatus = (method: string, config: TranslationConfig | undefined): ConfigStatus => {
  if (!config) return "free";
  if (NO_CRED_REQUIRED.has(method)) return "free";

  // URL-only services (Custom OpenAI-compat, TranslateGemma): URL is the credential.
  if (URL_IS_PRIMARY_CRED.has(method)) {
    return typeof config.url === "string" && config.url.trim() ? "configured" : "needs-config";
  }

  // apiKey-based services. apiKey is required when the field exists; some
  // services additionally require URL (URL_ALSO_REQUIRED) or region (Azure).
  const apiKeyOk = config.apiKey === undefined || (typeof config.apiKey === "string" && config.apiKey.trim() !== "");
  const urlOk = !URL_ALSO_REQUIRED.has(method) || (typeof config.url === "string" && config.url.trim() !== "");
  const regionOk = config.region === undefined || (typeof config.region === "string" && config.region.trim() !== "");

  if (!apiKeyOk || !urlOk || !regionOk) return "needs-config";
  // apiKey === undefined here means a no-credential service we forgot to flag
  // in NO_CRED_REQUIRED — keep the safer "free" default rather than lying
  // about "configured" status. webgoogletranslate (internal) lands here.
  return config.apiKey === undefined ? "free" : "configured";
};

// User-facing service list, declaration-order. The cast widens `as const` literal
// types so optional `docs` / `apiKeyUrl` are uniformly accessible across entries.
export const TRANSLATION_PROVIDERS: TranslationProvider[] = Object.entries(PROVIDERS)
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
  // Note: no maxTokens here. Cloud LLMs already have server-side caps and
  // their models are RLHF-tuned out of repeat loops, so exposing an extra
  // knob just creates "I set 500 and my translations got truncated" support
  // tickets. The transparent passthrough in openAICompatRequest still respects
  // maxTokens when present (power users can import via JSON config), so
  // wiring stays consistent — only the surfaced UI default is gated.
  if (spec.allowCustomUrl) base.url = "";
  if (spec.allowRelay) base.useRelay = false;
  // Seed an empty thinkingEffort record when any model on this provider is
  // tagged thinking. Without this, migrateConfig strips the field on next
  // render (defaults-key-only merge), making the UI toggle silently reset.
  if ((spec.models ?? []).some((m) => m.thinking === true)) base.thinkingEffort = {};
  return base;
};

/**
 * True when the given model on `service` is tagged with `thinking: true` in
 * its registry entry. UI uses this to gate the "Enable thinking" toggle;
 * services (Gemini, Moonshot K2.6 — the two server-default-ON providers) use
 * it to distinguish "tagged but toggle off" (send explicit disable) from
 * "untagged SKU" (omit thinking param entirely). Other services rely on the
 * orchestrator's single-point gate via `deriveThinkingParams`.
 *
 * Models not in the registry's `models` list (user-typed custom SKUs) return
 * false — there's no way to enable thinking on those through the UI.
 */
export const isThinkingModel = (service: string, model: string): boolean => {
  const p = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  return (p?.models ?? []).some((m) => m.value === model && m.thinking === true);
};

/**
 * Derive the per-call `reasoningEffort` from a TranslationConfig's per-model
 * thinking record. Single source of truth for the gate:
 *   1. config.model exists
 *   2. user has an entry in config.thinkingEffort[model] (= picked an effort)
 *   3. model is tagged `thinking: true` in registry
 *
 * Returns `undefined` (= thinking off) unless all three hold. Used by the
 * orchestrator (per-translate-call), the cache-key generator (per-cache-lookup),
 * and the Test button (per-test-config) — keep them in lockstep via this helper,
 * not parallel logic.
 */
export const deriveThinkingParams = (method: string, config: TranslationConfig | undefined): ReasoningEffort | undefined => {
  const model = config?.model;
  if (!model) return undefined;
  const effort = config?.thinkingEffort?.[model];
  if (!effort) return undefined;
  if (!isThinkingModel(method, model)) return undefined;
  return effort;
};

/**
 * Vendors whose thinking switch is binary at the wire level — Low/Medium/High
 * all collapse to the same payload (`{thinking:{type:"enabled"}}` for Doubao,
 * Zhipu, and Moonshot). UI renders these as Off/On instead of Off/Low/Medium/High
 * to avoid hinting at granularity that doesn't exist. Selecting On stores a
 * canonical "medium" — the value is irrelevant to wire output, but a defined
 * effort is what triggers the thinking branch in deriveThinkingParams + builders.
 */
export const BINARY_EFFORT_VENDORS: ReadonlySet<string> = new Set(["doubao", "zhipu", "moonshot"]);

/**
 * Providers whose API leaves reasoning/thinking ENABLED when the request omits
 * the thinking field. For these, turning thinking OFF requires sending an
 * EXPLICIT disable payload — merely omitting it silently keeps thinking on and
 * burns reasoning tokens on every call. (The DeepSeek MD-translation "10M
 * tokens" report traced to exactly this: a thinking-off request still returned
 * full `reasoning_content`. Doc: api-docs.deepseek.com/zh-cn/guides/thinking_mode
 * — "默认思考开关为 enabled".)
 *
 * The per-vendor disable wire-shape lives in each service's extra-body builder
 * (services/llm.ts: buildDeepseekExtraBody / buildOpenAIReasoningBody /
 * buildGrokExtraBody / buildQwenExtraBody / binaryThinkingBody for moonshot+
 * doubao+zhipu; gemini handles it inline). THIS set is the single source of
 * truth for WHO needs the explicit disable; the invariant test in
 * services/__tests__/thinking.test.ts asserts every OpenAI-compat member emits a
 * non-empty disable body when thinking is off.
 *
 * All verified against vendor docs: deepseek ("默认 enabled"), openai (gpt-5.5
 * omit→medium; 5.4 omit→none, but we send explicit none either way), grok
 * (omit→"low"), qwen (3.6-plus series), doubao (Seed 2.0), zhipu (glm-4.7
 * forced-thinking), moonshot, gemini.
 * EXCLUDED on purpose: minimax & hunyuan — thinking is intrinsic/uncontrollable
 * on their hosted OpenAI-compat path (untagged in `models`, no builder; hunyuan's
 * old `enable_enhancement` was actually a web-search toggle); aggregators
 * (openrouter/groq/siliconflow) — per-model omit-default is out of our hands.
 */
export const SERVER_DEFAULT_THINKING_ON: ReadonlySet<string> = new Set(["deepseek", "openai", "grok", "qwen", "doubao", "zhipu", "moonshot", "gemini"]);

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

/**
 * Curated common-model dropdown for the model input. Returns an empty array
 * (not undefined) when the provider hasn't declared any — keeps the UI
 * `<AutoComplete options={...}>` call shape unconditional and lets the model
 * field gracefully degrade to a plain text input behavior.
 */
export const getProviderModels = (service: string): ReadonlyArray<{ label: string; value: string }> => {
  return (PROVIDERS[service as ProviderKey] as ProviderSpec | undefined)?.models ?? [];
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
  options: TRANSLATION_PROVIDERS.filter((s) => PROVIDERS[s.value as ProviderKey]?.category === cat).map(({ value, label }) => ({ value, label })),
}));

// Lookups
export const findMethodLabel = (method: string): string => PROVIDERS[method as ProviderKey]?.label ?? method;

export const getDefaultConfig = (method: string): TranslationConfig | undefined => defaultConfigs[method as ProviderKey];
