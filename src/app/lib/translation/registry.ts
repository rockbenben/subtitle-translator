// Single source of truth for every translation provider.
//
// PROVIDERS below is the ONE place you edit to add / change a service.
// TRANSLATION_PROVIDERS (UI list), LLM_MODELS, defaultConfigs, categorizedOptions,
// OPENAI_COMPAT_PROVIDERS (factory input), findMethodLabel, getDefaultConfig,
// and the TranslationMethod union type are all derived views over PROVIDERS.

import type { ThinkingDirective, TranslationConfig, TranslationProvider } from "./types";

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
  /**
   * Absence = the provider NEVER gets a temperature (no config field → UI hides
   * the input, wire request omits the param, server default applies). Used for
   * lineups that reject/lock it: OpenAI GPT-5.x (400 on non-default), Moonshot
   * kimi-k2.x (locked, other values error). Presence = normal tunable default.
   */
  defaultTemperature?: number;
  /** Extra headers to merge into every upstream request (OpenRouter attribution etc). */
  extraHeaders?: Record<string, string>;
  /** When true, user-supplied `params.url` overrides the default endpoint (Doubao, Qwen). */
  allowCustomUrl?: boolean;
  /**
   * Factory default for the user's `useRelay` config toggle — the exact same
   * spec↔config pairing as defaultModel↔model and defaultTemperature↔temperature.
   * Presence = this provider has a Cloudflare relay route (UI renders the
   * toggle); value = the toggle's initial state. The user's toggle ALWAYS has
   * the final say — relay is never forced (今天实测的"直连必死"不是永恒事实,
   * 上游修了 CORS 用户应能自行切回直连):
   *   - false: direct by default; relay is the escape hatch for CORS-walled
   *     networks/origins.
   *   - true: relay by default because browser-direct is broken as of the
   *     verification date noted on the entry (hunyuan: preflight 404).
   * Members need a matching /api/{key} Worker route (scripts/llm-proxy-worker.js).
   */
  defaultUseRelay?: boolean;
};

/**
 * Whether an openai-compat provider accepts a user-supplied URL. STRUCTURAL
 * rule, not a convention: relay capability implies it (用户规则:能用共享中转
 * 就必须能填自建中转),so `defaultUseRelay` presence grants the url field
 * automatically — no per-entry `allowCustomUrl: true` to forget, no invariant
 * test to keep them in sync. `allowCustomUrl` remains only for NON-relay
 * providers with alternate endpoints (mimo billing/regional variants,
 * minimax io/cn, litellm self-hosted).
 */
export const acceptsCustomUrl = (spec: OpenAICompatProviderSpec): boolean => Boolean(spec.allowCustomUrl) || spec.defaultUseRelay !== undefined;

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
    // chunkSize 触发 useTranslationState 的 chunk 路径:整批行按 \n 拼成
    // ~5000 字符块,每块一个请求(translateHtml 原生接受文本数组,120 行 /
    // 12.5KB 单请求实测 200)。相比旧的每行一请求 ×100 并发,请求数降
    // 50-100x,免费共享端点的 IP 限流压力随之消失;残余 429 仍由共享冷却闸
    // (hooks/translation/retry.ts rateLimitGate)全局暂停后自动恢复。
    // batchSize 只服务 line 路径兜底(chunk 路径是顺序循环,不读它)。
    //
    // url 可切换网关,服务实现按 URL 形状分流协议(见 services/traditional.ts):
    //   - 含 /translate_a/ → legacy 表单协议(被 Google 反滥用墙拦截的旧端点,
    //     但墙按 IP 信誉放行,部分地区/IP 仍可用,保留作备选)
    //   - 其余(默认 translate-pa,或用户自建同协议镜像)→ translateHtml 数组协议
    defaults: { url: "https://translate-pa.googleapis.com/v1/translateHtml", chunkSize: 5000, delayTime: 200, batchSize: 100 },
    endpoints: [
      { label: "translate-pa (Default)", url: "https://translate-pa.googleapis.com/v1/translateHtml" },
      { label: "Legacy gtx", url: "https://translate.googleapis.com/translate_a/single" },
    ],
  },
  edgeFreeAPI: {
    kind: "custom",
    category: "machine-translation",
    // 微软 Edge 浏览器内置翻译的免费后端(Azure Translator 引擎 + Edge 的
    // 免费 JWT auth 端点)。与 gtxFreeAPI 同为零配置免费服务,互为备胎:
    // Google 反滥用墙收紧时用户可一键切到 Edge,反之亦然。
    label: "Edge API (Free)",
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
    docs: "https://developers.deepl.com/api-reference/translate",
    apiKeyUrl: "https://www.deepl.com/en/your-account/keys",
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
    // Optional apiKey — TranslateGemma is a model (weights) self-hosted on
    // LM Studio / llama.cpp / Ollama / vLLM, usually keyless. But gated setups
    // DO need a key: LM Studio's "require API key" toggle, vLLM `--api-key`, or
    // an auth reverse proxy. URL stays the primary credential (URL_IS_PRIMARY_CRED),
    // apiKey is offered as optional — the service attaches `Authorization: Bearer`
    // only when it's set, so leaving it blank keeps the keyless local flow intact.
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
    defaults: { url: "", apiKey: "", model: "translategemma-4b-it", batchSize: 10, delayTime: 200 },
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
    defaultUseRelay: false,
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
    defaultModel: "gpt-5.6-luna",
    // 无 defaultTemperature:GPT-5.x 全系为推理模型,拒绝非默认 temperature
    // (400 "Only the default (1) value is supported",运行时实测,2026-07 核查;
    // effort:none 是否解锁在 5.4+ 未确认)。字段移除 → 请求不发、UI 不显示,
    // 服务端默认生效。
    docs: "https://developers.openai.com/api/docs/guides/text",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultUseRelay: false,
    // https://developers.openai.com/api/docs/models
    // GPT-5.6 家族(sol/terra/luna)是当前主推旗舰,均支持 reasoning
    // (reasoning.effort 新增 max 档:none/low/medium/high/xhigh/max);上一代
    // 5.5 / 5.4-mini 仍在售,保留作对照/低成本档。5.6 无 mini 变体,luna 即低成本
    // 高并发档(官方点名 cost-sensitive/high-volume),故设为翻译默认。
    models: [
      { label: "GPT-5.6", value: "gpt-5.6", thinking: true },
      { label: "GPT-5.6 Terra", value: "gpt-5.6-terra", thinking: true },
      { label: "GPT-5.6 Luna", value: "gpt-5.6-luna", thinking: true },
      { label: "GPT-5.5", value: "gpt-5.5", thinking: true },
      { label: "GPT-5.4 Mini", value: "gpt-5.4-mini", thinking: true },
    ],
  },
  claude: {
    kind: "custom",
    category: "llm",
    label: "Claude",
    docs: "https://platform.claude.com/docs/en/intro",
    apiKeyUrl: "https://console.anthropic.com/settings/keys",
    // url 可选:自建中转(转发到 api.anthropic.com/v1/messages 的自有 Worker)。
    // 优先级:自定义 URL > useRelay > 官方直连(见 services/llm.ts claude)。
    // 无 temperature 字段:adaptive 世代(Opus 4.8 / Sonnet 5 / Fable 5)拒绝
    // 非默认 temperature(400,官方成文);统一 provider 级不发,服务端默认生效。
    defaults: { url: "", apiKey: "", model: "claude-sonnet-5", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {}, useRelay: false },
    // 两代思考机制并存(service 层按 model 分流,见 services/llm.ts claude +
    // isAdaptiveThinkingClaude):
    //   - Adaptive thinking(Opus 4.8 / Sonnet 5 / Fable 5):thinking:{type:"adaptive"}
    //     + output_config.effort;拒绝 temperature/top_p 及旧的 budget_tokens(均 400)。
    //   - Extended thinking(Haiku 4.5):沿用 thinking:{type:"enabled",budget_tokens}。
    // temperature 是 provider 级不发(上面 defaults 无此字段)—— Haiku 4.5 虽仍
    // 接受该参数,但为简化统一不发,用服务端默认值。
    // 证据:platform.claude.com/docs/en/build-with-claude/adaptive-thinking
    models: [
      { label: "Claude Opus 4.8", value: "claude-opus-4-8", thinking: true },
      { label: "Claude Sonnet 5", value: "claude-sonnet-5", thinking: true },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5-20251001", thinking: true },
      { label: "Claude Fable 5", value: "claude-fable-5", thinking: true },
    ],
  },
  gemini: {
    kind: "custom",
    category: "llm",
    label: "Gemini",
    docs: "https://ai.google.dev/gemini-api/docs/text-generation",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    // 无 temperature 字段(同 translategemma 先例):Gemini 3.x 官方强烈建议
    // 保持默认值 1.0(<1.0 可能导致循环输出/推理退化,ai.google.dev
    // whats-new-gemini-3.5,AI Studio 已移除滑块)。service 层不发该参数 →
    // 服务端默认 1.0 生效;字段移除后 UI 输入框自动隐藏,migrateConfig 的
    // defaults-key-only 合并会清掉用户已存的旧值。
    defaults: { apiKey: "", model: "gemini-3.5-flash", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
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
    defaultModel: "qwen3.7-plus",
    defaultTemperature: 0.7,
    docs: "https://help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions",
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "International", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "US", url: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions" },
    ],
    // https://bailian.console.aliyun.com/cn-beijing?spm=5176.29597918.J_F4r-7Zs_PtjrjEY48APSA.d_primary.338d133cOoVKn9&tab=model#/model-market/all?providers=qwen
    models: [
      { label: "Qwen3.7 Max", value: "qwen3.7-max", thinking: true },
      { label: "Qwen3.7 Plus", value: "qwen3.7-plus", thinking: true },
      { label: "Qwen3.6 Flash", value: "qwen3.6-flash", thinking: true },
    ],
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    label: "Moonshot (Kimi)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k2.6",
    // 无 defaultTemperature:kimi-k2.x 全系 temperature 锁定(thinking 1.0 /
    // non-thinking 0.6),传其他值直接报错(platform.kimi.ai 迁移指南原文
    // "any other value will result in an error",官方建议不传)。字段移除 →
    // 请求不发、UI 不显示,服务端按模式取锁定值。
    docs: "https://platform.moonshot.cn/docs",
    apiKeyUrl: "https://platform.moonshot.cn/console/api-keys",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.moonshot.cn/v1/chat/completions" },
      { label: "International", url: "https://api.moonshot.ai/v1/chat/completions" },
    ],
    // K2.6 通过扁平 `thinking: {type}` 字段切换思考模式。K2.5 不支持参数切换
    // thinking;kimi-k2-thinking 系列已 2026-05-25 退役,不收录。
    models: [
      { label: "Kimi K2.6", value: "kimi-k2.6", thinking: true },
      { label: "Kimi K2.5", value: "kimi-k2.5" },
    ],
  },
  doubao: {
    kind: "openai-compat",
    category: "llm",
    label: "Doubao (Volcengine)",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-seed-2-1-turbo-260628",
    defaultTemperature: 0.7,
    docs: "https://www.volcengine.com/docs/82379",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    defaultUseRelay: false,
    endpoints: [
      { label: "Standard", url: "https://ark.cn-beijing.volces.com/api/v3/chat/completions" },
      { label: "Coding Plan", url: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions" },
    ],
    // https://www.volcengine.com/docs/82379/1330310
    // Seed 2.1(260628)是当前旗舰,2.1 只有 pro/turbo(turbo 即轻量高速档,
    // 翻译性价比最佳 → 默认)。2.0 系列降为往期,保留 pro/lite 作兜底。
    models: [
      { label: "Doubao Seed 2.1 Pro", value: "doubao-seed-2-1-pro-260628", thinking: true },
      { label: "Doubao Seed 2.1 Turbo", value: "doubao-seed-2-1-turbo-260628", thinking: true },
      { label: "Doubao Seed 2.0 Pro", value: "doubao-seed-2-0-pro-260215", thinking: true },
      { label: "Doubao Seed 2.0 Lite", value: "doubao-seed-2-0-lite-260428", thinking: true },
    ],
  },
  mimo: {
    kind: "openai-compat",
    category: "llm",
    label: "Xiaomi MiMo",
    // Two billing modes share the same OpenAI-compat protocol but route through
    // DIFFERENT base URLs with DIFFERENT key formats (docs: platform.xiaomimimo.com):
    //   - 按量付费 (pay-as-you-go): api.xiaomimimo.com,        key sk-xxxxx
    //   - Token Plan (订阅包量):     token-plan-cn.xiaomimimo.com, key tp-xxxxx
    // Keys are not interchangeable, so we surface both products as quick-pick
    // endpoints (same pattern as Doubao Standard/Coding Plan) and default to
    // pay-as-you-go. Token Plan has three regional clusters (CN / Singapore /
    // Europe) — all share the same tp-xxxxx key; allowCustomUrl also lets users
    // paste any other variant.
    endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
    defaultModel: "mimo-v2.5",
    defaultTemperature: 0.7,
    docs: "https://platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api",
    apiKeyUrl: "https://platform.xiaomimimo.com/#/console/api-keys",
    allowCustomUrl: true,
    endpoints: [
      { label: "Pay-as-you-go", url: "https://api.xiaomimimo.com/v1/chat/completions" },
      { label: "Token Plan (CN)", url: "https://token-plan-cn.xiaomimimo.com/v1/chat/completions" },
      { label: "Token Plan (Singapore)", url: "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions" },
      { label: "Token Plan (Europe)", url: "https://token-plan-ams.xiaomimimo.com/v1/chat/completions" },
    ],
    // Thinking control = binary `thinking: {type: "enabled"|"disabled"}` (same
    // wire shape as Doubao/Zhipu/Moonshot → mimo is in BINARY_EFFORT_VENDORS, so
    // UI renders Off/On not Off/Low/Med/High). MiMo server-defaults thinking ON
    // (the doc leads with the disable example), so it's in SERVER_DEFAULT_THINKING_ON:
    // the per-model thinking tag below makes each listed SKU send an explicit
    // `{type:"disabled"}` when off (binaryThinkingBody), so the toggle's default-off
    // state never silently burns reasoning tokens.
    // Doc: platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api
    models: [
      { label: "MiMo V2.5", value: "mimo-v2.5", thinking: true },
      { label: "MiMo V2.5 Pro", value: "mimo-v2.5-pro", thinking: true },
    ],
  },
  zhipu: {
    kind: "openai-compat",
    category: "llm",
    label: "Zhipu GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-5.2",
    defaultTemperature: 0.7,
    docs: "https://docs.bigmodel.cn/cn/guide/start/introduction",
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
      { label: "International (Z.ai)", url: "https://api.z.ai/api/paas/v4/chat/completions" },
    ],
    // docs.bigmodel.cn/cn/guide/start/model-overview "文本模型" 表格完整列表
    // (排除标记"即将下线"的 glm-4.5-flash),按文档原顺序。GLM-5.2 是当前旗舰
    // (1M 无损上下文,唯一支持 reasoning_effort),glm-5-turbo 为长任务优化档。
    models: [
      { label: "GLM-5.2", value: "glm-5.2", thinking: true },
      { label: "GLM-5.1", value: "glm-5.1", thinking: true },
      { label: "GLM-5", value: "glm-5", thinking: true },
      { label: "GLM-5 Turbo", value: "glm-5-turbo", thinking: true },
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
    defaultModel: "MiniMax-M3",
    defaultTemperature: 0.7,
    docs: "https://platform.minimax.io/docs/api-reference/text-chat",
    apiKeyUrl: "https://platform.minimax.io/user-center/basic-information/interface-key",
    allowCustomUrl: true,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.minimaxi.com/v1/chat/completions" },
      { label: "International", url: "https://api.minimax.io/v1/chat/completions" },
    ],
    models: [
      // M3 引入了真开关:`thinking:{type:"adaptive"|"disabled"}`(服务端默认
      // adaptive = ON,可关)→ 打 thinking 标签,off 态发显式 disabled,否则
      // 每次翻译都默默烧推理 token(DeepSeek「10M tokens」同款事故)。
      // M2.x 仍是 intrinsic/unclosable(无 toggle 参数)→ 不打标签。See llm.ts.
      { label: "MiniMax M3", value: "MiniMax-M3", thinking: true },
      { label: "MiniMax M2.7", value: "MiniMax-M2.7" },
      { label: "MiniMax M2.7 High-Speed", value: "MiniMax-M2.7-highspeed" },
      // M2.5 官方已降为 Legacy 但仍在售。保留收录不只是给旧配置兜底:M3 的
      // thinking builder 上线后,若 M2.5 变成 custom(未收录),gated() 的
      // custom 分支会给这个【无 thinking 参数】的 SKU 发显式 disabled → 可能 4xx;
      // 收录为 listed-untagged 则 gate 正确省略。
      { label: "MiniMax M2.5", value: "MiniMax-M2.5" },
    ],
  },
  qianfan: {
    kind: "openai-compat",
    category: "llm",
    label: "Baidu ERNIE (Qianfan)",
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-5.1",
    defaultTemperature: 0.7,
    docs: "https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya",
    apiKeyUrl: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
    models: [
      { label: "ERNIE 5.1", value: "ernie-5.1" },
      { label: "ERNIE 5.0", value: "ernie-5.0" },
      // ERNIE 5.0-Thinking server-defaults enable_thinking=true, but it's a hybrid
      // SKU with a real toggle: `enable_thinking` boolean (binary → qianfan is in
      // BINARY_EFFORT_VENDORS). Tagged so off-state sends explicit enable_thinking:false.
      { label: "ERNIE 5.0 Thinking", value: "ernie-5.0-thinking-latest", thinking: true },
      // ERNIE X1.1 是文心深度推理线,reasoning 内生(不支持 thinking_budget)。
      // 不打 thinking 标签:qianfan 走二元 enable_thinking,给内生推理模型发
      // enable_thinking:false 可能被拒;省略即用其默认推理,翻译结果照常返回。
      { label: "ERNIE X1.1", value: "ernie-x1.1" },
      // 128k 已转正,去掉 -preview 后缀
      { label: "ERNIE 4.5 Turbo 128K", value: "ernie-4.5-turbo-128k" },
      { label: "ERNIE 4.5 Turbo 32K", value: "ernie-4.5-turbo-32k" },
    ],
  },
  hunyuan: {
    kind: "openai-compat",
    category: "llm",
    label: "Tencent Hunyuan",
    endpoint: "https://api.hunyuan.cloud.tencent.com/v1/chat/completions",
    defaultModel: "hunyuan-a13b",
    defaultTemperature: 0.7,
    docs: "https://cloud.tencent.com/document/product/1729/111007",
    apiKeyUrl: "https://console.cloud.tencent.com/hunyuan/api-key",
    // 浏览器直连当前不可用:OPTIONS 预检对该路径恒返回 404(预检必须 2xx,
    // 实测 2026-06-11,POST 响应反而带 CORS 头 —— 但浏览器到不了那一步),
    // 所以默认开 relay 保证开箱可用;开关保留,上游修了预检用户可自行切回直连。
    defaultUseRelay: true,
    // 旧版文生文模型(turbos/t1/2.0-thinking/2.0-instruct/lite)已于 2026-06-22
    // 整体下线(公告 cloud.tencent.com/announce/detail/2301),legacy 端点通用
    // 对话模型仅剩 a13b 在售(混元翻译是机器翻译专项,不收进 LLM 清单)。整个
    // 混元 legacy 平台正迁往 TokenHub(tokenhub.tencentmaas.com),不再新增模型,
    // 长期建议迁移。
    // Not thinking-tagged: OpenAI-compat 路径无可控 thinking 开关
    // (a13b 混合推理仅靠 `/no_think` 提示前缀切换,此处不可控)。
    models: [{ label: "Hunyuan A13B", value: "hunyuan-a13b" }],
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
    defaultUseRelay: false,
    // 来自 https://docs.mistral.ai/models/overview
    // Adjustable reasoning(mistral-medium-3-5 / mistral-small)通过 reasoning_effort
    // 控制(docs.mistral.ai/studio-api/conversations/reasoning,取值 high|none,二元 →
    // BINARY_EFFORT_VENDORS)。Large 3 / Ministral 非推理模型。
    // 注:除 medium-3-5(有效可调 id)外,一律用 `-latest` 别名 —— Mistral 可调
    // API id 是日期版(mistral-small-2603 等),纯版本号写法(mistral-small-4)不可调用。
    // Magistral 线已整体废弃(magistral-medium-2509 于 2026-07-31 退役),移除。
    models: [
      { label: "Mistral Medium 3.5", value: "mistral-medium-3-5", thinking: true },
      { label: "Mistral Small 4", value: "mistral-small-latest", thinking: true },
      { label: "Mistral Large 3", value: "mistral-large-latest" },
      { label: "Ministral 3 14B", value: "ministral-14b-latest" },
    ],
  },
  grok: {
    kind: "openai-compat",
    category: "llm",
    label: "xAI (Grok)",
    endpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4.5",
    defaultTemperature: 0.7,
    docs: "https://docs.x.ai/developers/models",
    apiKeyUrl: "https://console.x.ai/",
    defaultUseRelay: false,
    // Grok 4.5 是当前旗舰(官方 model-selection 指南默认档),reasoning 可配置;
    // Grok 4.3 支持 reasoning_effort 但仅 low/high 两档
    // (docs.x.ai/developers/models);grok-4.20-reasoning / multi-agent 是
    // thinking-intrinsic SKU,无 toggle 参数。service 层 medium → low 映射。
    models: [
      { label: "Grok 4.5", value: "grok-4.5", thinking: true },
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
    defaultUseRelay: false,
    // https://docs.perplexity.ai/docs/sonar/models
    // sonar-reasoning-pro 是 thinking-intrinsic(<think> 内嵌,无 toggle),选它即 thinking。
    // sonar-deep-research 是研究模型:推理无法关闭(默认 medium),但 reasoning_effort
    // (low/medium/high)可调搜索深度/成本 → 标 thinking,走 graded builder(开启发 effort,
    // 关闭省略 = 服务端默认 medium,无法真正禁用,故 perplexity 不进 SERVER_DEFAULT/BINARY)。
    models: [
      { label: "Sonar", value: "sonar" },
      { label: "Sonar Pro", value: "sonar-pro" },
      { label: "Sonar Reasoning Pro", value: "sonar-reasoning-pro" },
      { label: "Sonar Deep Research", value: "sonar-deep-research", thinking: true },
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
    // Command A Reasoning server-defaults thinking ON, but the compatibility API
    // DOES expose a toggle: reasoning_effort "none"|"high" (low/medium unsupported,
    // so it's binary → cohere is in BINARY_EFFORT_VENDORS). Tagged so the off-state
    // sends an explicit "none" instead of silently reasoning.
    // https://docs.cohere.com/docs/compatibility-api
    models: [
      { label: "Command A Plus", value: "command-a-plus-05-2026" },
      { label: "Command A", value: "command-a-03-2025" },
      { label: "Command A Reasoning", value: "command-a-reasoning-08-2025", thinking: true },
      { label: "Command A Translate", value: "command-a-translate-08-2025" },
    ],
  },
  yandex: {
    kind: "custom",
    category: "llm",
    label: "YandexGPT (AI Studio)",
    // Yandex AI Studio's OpenAI-compat API (llm.api.cloud.yandex.net/v1) sends
    // NO CORS headers (verified 2026-06: a preflight OPTIONS is parsed as a JSON
    // request body → 400, no Access-Control-Allow-Origin), so browser-direct
    // calls fail as of that date. useRelay therefore DEFAULTS ON (works out of
    // the box; the relay forwards `Authorization: Bearer <api-key>` to
    // llm.api.cloud.yandex.net/v1/chat/completions), but the toggle stays
    // user-controllable like every other relay-capable provider — if Yandex
    // ever ships CORS headers, users can switch to direct themselves.
    //
    // Model IDs are per-tenant URIs — gpt://<folder_id>/<model>/latest — so the
    // config carries a dedicated `folderId` field (kind: "custom" because the
    // openai-compat factory can't assemble per-user model URIs; same
    // extra-credential pattern as Azure MT's `region`). The service builds the
    // URI from folderId + the short SKU below; a full gpt:// URI pasted into
    // the model field passes through verbatim (folderId then unused but still
    // required by validation — keeping status logic model-value-independent).
    docs: "https://aistudio.yandex.ru/docs/en/ai-studio/concepts/api.html",
    apiKeyUrl: "https://aistudio.yandex.ru/platform/folders/",
    // url 可选:自建中转(转发到 llm.api.cloud.yandex.net 的自有代理)。
    // 优先级:自定义 URL > useRelay > 官方直连(见 services/llm.ts yandex)。
    defaults: { url: "", apiKey: "", folderId: "", model: "yandexgpt-5.1", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 50, useRelay: true },
    // Hosted SKUs per aistudio.yandex.ru/docs (generation/models, 2026-06).
    // No thinking tags — the OpenAI-compat path documents no reasoning toggle
    // (YandexGPT 5.1's Chain-of-Reasoning isn't exposed as a request param);
    // sending reasoning_effort risks a 400, same rationale as GitHub Models.
    // DeepSeek V3.2 已于 2026-06-28 到期(URI 失效返回 400),由 V4 Flash 取代
    // (Yandex Release Notes 2026-05-28)。aliceai-llm-flash 为 2026-05-19 新增。
    models: [
      { label: "YandexGPT Pro 5.1", value: "yandexgpt-5.1" },
      { label: "YandexGPT Pro 5", value: "yandexgpt-5-pro" },
      { label: "YandexGPT Lite 5", value: "yandexgpt-5-lite" },
      { label: "Alice AI LLM", value: "aliceai-llm" },
      { label: "Alice AI LLM Flash", value: "aliceai-llm-flash" },
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash" },
      { label: "Qwen3 235B", value: "qwen3-235b-a22b-fp8" },
      { label: "Qwen3.6 35B", value: "qwen3.6-35b-a3b" },
      { label: "GPT-OSS 120B", value: "gpt-oss-120b" },
      { label: "GPT-OSS 20B", value: "gpt-oss-20b" },
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
      { label: "Claude Sonnet 5", value: "anthropic/claude-sonnet-5", thinking: true },
      { label: "Claude Opus 4.8", value: "anthropic/claude-opus-4.8", thinking: true },
      { label: "Gemini 3.5 Flash", value: "google/gemini-3.5-flash", thinking: true },
      { label: "GPT-5.4 Mini", value: "openai/gpt-5.4-mini", thinking: true },
      { label: "Grok 4.5", value: "x-ai/grok-4.5" },
      { label: "Kimi K2.6", value: "moonshotai/kimi-k2.6", thinking: true },
      // M3 上游默认 adaptive thinking(可关)→ 打标签让 off 态经 OpenRouter
      // 统一参数发 reasoning:{enabled:false},否则默认烧推理 token。
      { label: "MiniMax M3", value: "minimax/minimax-m3", thinking: true },
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
      // org 前缀是 MiniMaxAI(非 minimax),小写前缀会 404
      { label: "MiniMax M2.5", value: "MiniMaxAI/MiniMax-M2.5" },
      { label: "GLM-5.2", value: "zai-org/GLM-5.2" },
      { label: "GLM-5.1", value: "zai-org/GLM-5.1" },
      { label: "GLM-4.7", value: "zai-org/GLM-4.7" },
    ],
  },
  github: {
    kind: "openai-compat",
    category: "aggregator",
    label: "GitHub Models",
    // GitHub's OpenAI-compat inference gateway. Auth is a GitHub PAT (Bearer) with
    // the `models:read` scope — fine-grained token recommended. Generous free tier
    // (rate-limited per model class), so it's a good no-cost entry point for users
    // without a paid LLM key. Single endpoint, no regional variants → no allowCustomUrl.
    endpoint: "https://models.github.ai/inference/chat/completions",
    defaultModel: "openai/gpt-4.1-mini",
    defaultTemperature: 0.7,
    docs: "https://docs.github.com/en/github-models",
    apiKeyUrl: "https://github.com/settings/personal-access-tokens",
    // No thinking tags — GitHub's REST inference API does NOT document a
    // `reasoning_effort` (or any reasoning) parameter: the supported body fields are
    // model/messages/temperature/top_p/penalties/max_tokens/seed/stream/stop/tools/
    // tool_choice/response_format/modalities/stream_options only (verified 2026-06
    // against docs.github.com/en/rest/models/inference). So we expose NO thinking
    // toggle here — sending reasoning_effort risks a 400, and even if ignored it's
    // dead UI. Users wanting reasoning control pick the native OpenAI provider or Custom.
    //
    // Curated for the FREE tier's per-model daily caps (verified 2026-06): Low-tier
    // models get 150 req/day, High-tier 50/day. Listed Low-first (widest quota), and
    // the gpt-5 / o-series reasoning SKUs are deliberately OMITTED — their free tier is
    // 8–15 req/day at 1–2 rpm and reasoning burns the 4000-output cap, so they hit the
    // wall almost immediately under batch translation. Catalog IDs are lowercase
    // {publisher}/{model} (a wrong-case ID 404s) — verified against models.github.ai/catalog/models.
    models: [
      // Low tier — 150 req/day (widest free quota)
      { label: "GPT-4.1 Mini", value: "openai/gpt-4.1-mini" },
      { label: "GPT-4o Mini", value: "openai/gpt-4o-mini" },
      { label: "Mistral Medium 3", value: "mistral-ai/mistral-medium-2505" },
      { label: "Phi-4", value: "microsoft/phi-4" },
      // High tier — 50 req/day
      { label: "GPT-4.1", value: "openai/gpt-4.1" },
      { label: "Llama 3.3 70B", value: "meta/llama-3.3-70b-instruct" },
    ],
  },
  nvidia: {
    kind: "custom",
    category: "aggregator",
    label: "Nvidia NIM",
    docs: "https://build.nvidia.com/explore/discover",
    apiKeyUrl: "https://build.nvidia.com/",
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v4-flash", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
    // https://build.nvidia.com/models
    // NIM 上 deepseek-v4-flash 是 fast 档(官方标签 MoE/agentic/coding/fast,无
    // reasoning),只有 v4-pro 是 reasoning 档 —— 故仅 pro 标 thinking。其 thinking
    // 协议跟原生 DeepSeek 不同:chat_template_kwargs.thinking + reasoning_effort
    // 嵌套(其他 model 不支持 thinking 注入,想要 thinking 用原生 DeepSeek provider)。
    // 注:build.nvidia.com 的 URL slug 用下划线,真实 model id 用点号。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/deepseek-v4-flash" },
      { label: "DeepSeek V4 Pro", value: "deepseek-ai/deepseek-v4-pro", thinking: true },
      { label: "GLM-5.2", value: "z-ai/glm-5.2" },
      // gpt-oss 不打 thinking:nvidia 的注入是 DeepSeek 专属 chat_template_kwargs
      // 嵌套,发给 gpt-oss 是错误形状;其推理本就默认开(medium),省略即正确。
      { label: "GPT-OSS 120B", value: "openai/gpt-oss-120b" },
      { label: "Gemma 4 31B IT", value: "google/gemma-4-31b-it" },
      { label: "Nemotron Super 120B", value: "nvidia/nemotron-3-super-120b-a12b" },
      { label: "Llama 3.3 70B Instruct", value: "meta/llama-3.3-70b-instruct" },
      { label: "Llama 3.1 8B Instruct", value: "meta/llama-3.1-8b-instruct" },
    ],
  },
  azureopenai: {
    kind: "custom",
    category: "aggregator",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/zh-cn/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure",
    // 无 temperature 字段:微软官方把 temperature 列入 reasoning 模型 Not
    // Supported 清单(GPT-5 全系,learn.microsoft.com/azure/ai-foundry/openai/
    // how-to/reasoning),运行时证据为 400;统一 provider 级不发。
    defaults: { url: "", apiKey: "", model: "gpt-5.4-mini", apiVersion: "2025-11-18", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
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
  litellm: {
    kind: "openai-compat",
    category: "aggregator",
    // 自建 LiteLLM 代理 — 单个 OpenAI-compat 网关背后聚合 100+ 上游 provider。
    // 与 Custom (llm) 的差别只在独立配置槽位:常驻 LiteLLM、偶尔切其他自建
    // 端点的用户不必来回改 Custom 的 URL。
    // URL 即凭证(URL_IS_PRIMARY_CRED):defaults.url 留空,chips 给本地默认
    // 地址;apiKey 可选(代理可配 master/virtual key,纯本地常为免鉴权)。
    // defaultModel 留空:可用模型完全取决于用户的代理配置,无从假设。
    // loopback HTTP 是 secure-context 豁免(浏览器混合内容规则放行 127.0.0.1)。
    label: "LiteLLM",
    endpoint: "http://127.0.0.1:4000/v1/chat/completions",
    defaultModel: "",
    defaultTemperature: 0.7,
    docs: "https://docs.litellm.ai/docs/",
    allowCustomUrl: true,
    endpoints: [{ label: "Local (Default)", url: "http://127.0.0.1:4000/v1/chat/completions" }],
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
 * 不支持术语表的服务(denylist)——没有任何「模型内」术语执行通道的纯 MT:
 * 既不吃 systemPrompt 术语块(LLM 全系),也没有原生术语参数(qwenMt 的
 * translation_options.terms)。这些服务只有事后的漏翻兜底网,UI 展示术语表
 * 入口会让用户误以为有完整执行能力。其余服务默认支持;新增无术语通道的 MT
 * 服务时在这里登记。
 */
export const GLOSSARY_UNSUPPORTED: ReadonlySet<string> = new Set(["gtxFreeAPI", "edgeFreeAPI", "google", "deepl", "deeplx", "azure", "translategemma", "webgoogletranslate"]);

/** Whether the glossary feature should surface (and enforce) for a method. */
export const supportsGlossary = (method: string): boolean => method in PROVIDERS && !GLOSSARY_UNSUPPORTED.has(method);

/**
 * Services where URL is the primary credential — apiKey is optional/absent
 * because the runtime is typically self-hosted (LM Studio, llama.cpp, vLLM,
 * LiteLLM proxy) and doesn't require auth. Affects:
 *   - UI: URL field shows as required (red *), apiKey hidden / not-required
 *   - Validation: URL emptiness blocks translation; missing apiKey is OK
 *   - Status: empty URL → "needs-config"; otherwise → "configured" (not "free")
 *
 * Add new services here when they fit this profile (URL required, apiKey optional).
 */
export const URL_IS_PRIMARY_CRED: ReadonlySet<string> = new Set(["llm", "litellm", "translategemma"]);

/**
 * Services that work with zero user configuration because they fall back to a
 * public/shared endpoint when no credentials are supplied:
 *   - gtxFreeAPI: hits Google's translate-pa gateway with the public te_lib key
 *   - edgeFreeAPI: hits Microsoft Edge's free translator (auto-issued JWT)
 *   - deeplx: empty URL falls back to our public THIRD_PARTY_ENDPOINTS.deeplx
 *
 * Effect:
 *   - Status block shows the "free" tag
 *   - "Configured services" chips row always lists them, even with empty config
 *
 * Do NOT add services here unless an empty config is genuinely functional
 * end-to-end without any user setup.
 */
export const NO_CRED_REQUIRED: ReadonlySet<string> = new Set(["gtxFreeAPI", "edgeFreeAPI", "deeplx"]);

/**
 * Methods that get a live pre-flight reachability probe in validate() before bulk
 * translation (a one-shot "Hello world" / health check). Membership follows one
 * principle: probe a method IFF its dominant failure mode would NOT already
 * fast-fail on its own AND probing it is free.
 *
 *   - gtxFreeAPI, edgeFreeAPI, deeplx: free public proxies — when down/rate-limited
 *     they throw NETWORK / 5xx errors, which don't trip the per-line auth-abort
 *     cascade, so without a probe a dead service slow-fails line-by-line. Probing
 *     is free.
 *   - llm, litellm, translategemma: self-hosted (Ollama / LM Studio / vLLM /
 *     LiteLLM proxy) — "server not running" / wrong URL is a NETWORK error (no
 *     auth-abort), and the probe hits the user's own machine, so it's free.
 *     (litellm 的 probe 经代理转发到上游,严格说花一次微量补全;但代理挂掉/
 *     地址错是它的主导故障,与 llm 同款,不 probe 就逐行慢失败。)
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
 * always cheap to probe), and the only LLM-category methods here are the
 * self-hosted `llm` / `litellm` (no paid cloud LLM is probed). validate()'s smart gate still
 * PROCEEDS (not blocks) on transient 429/5xx from these — the probe only
 * HARD-blocks definitive failures.
 */
export const PREFLIGHT_PROBE_METHODS: ReadonlySet<string> = new Set(["deepl", "deeplx", "llm", "litellm", "gtxFreeAPI", "edgeFreeAPI", "translategemma"]);

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
  // services additionally require URL (URL_ALSO_REQUIRED), region (Azure), or
  // folderId (Yandex — per-tenant scope embedded in gpt:// model URIs).
  const apiKeyOk = config.apiKey === undefined || (typeof config.apiKey === "string" && config.apiKey.trim() !== "");
  const urlOk = !URL_ALSO_REQUIRED.has(method) || (typeof config.url === "string" && config.url.trim() !== "");
  const regionOk = config.region === undefined || (typeof config.region === "string" && config.region.trim() !== "");
  const folderIdOk = config.folderId === undefined || (typeof config.folderId === "string" && config.folderId.trim() !== "");

  if (!apiKeyOk || !urlOk || !regionOk || !folderIdOk) return "needs-config";
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
    // batchSize = line-by-line / non-context concurrency; kept high because
    // each request is a single short prompt. contextBatchSize = concurrent
    // context batches (heavy payloads, ~50 lines each); low default to avoid
    // rate-limit storms. Users with paid tier can raise either in settings.
    // contextWindow 50 (was 100): big windows let the LLM merge/renumber lines
    // on dense song-lyric / overlapping-dialogue sections, shifting translations
    // against their timestamps, and the huge requests time out near the tail of
    // long files. 50 contains both — a drift can only affect ≤50 lines.
    batchSize: 20,
    contextBatchSize: 3,
    contextWindow: 50,
  };
  // Note: no maxTokens here. Cloud LLMs already have server-side caps and
  // their models are RLHF-tuned out of repeat loops, so exposing an extra
  // knob just creates "I set 500 and my translations got truncated" support
  // tickets. The transparent passthrough in openAICompatRequest still respects
  // maxTokens when present (power users can import via JSON config), so
  // wiring stays consistent — only the surfaced UI default is gated.
  // defaultTemperature absent = provider never takes a temperature (locked /
  // rejected upstream) — omitting the field hides the UI input and keeps the
  // wire request param-free; migrateConfig strips stale stored values.
  if (spec.defaultTemperature !== undefined) base.temperature = spec.defaultTemperature;
  if (acceptsCustomUrl(spec)) base.url = "";
  if (spec.defaultUseRelay !== undefined) base.useRelay = spec.defaultUseRelay;
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
 * True when `service` has at least one thinking-tagged model — i.e. the provider
 * has a KNOWN thinking-enable wire shape (a THINKING_BUILDER entry, or a custom
 * service that handles thinking inline). Used to decide whether to offer a thinking
 * toggle on a CUSTOM (unlisted) SKU: capable providers let the user opt into
 * thinking on an unknown model; the catch-all Custom (`llm`, no `models` list) and
 * MT services have no tagged model → not capable → no opt-in. Verified necessary by
 * the 2026-05 audit: most providers 422/400 on reasoning params for unsupported
 * models, so we only surface the toggle where we know the enable shape.
 */
export const isThinkingCapableProvider = (service: string): boolean => {
  const p = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  return (p?.models ?? []).some((m) => m.thinking === true);
};

/**
 * True when `model` is a user-typed SKU NOT in the provider's curated `models`
 * list — thinking capability is unknown for these. A listed-but-untagged model
 * (e.g. mistral-large-latest, ministral) returns FALSE: we KNOW it's non-thinking, so
 * no opt-in toggle. Empty model (→ provider default) also returns FALSE.
 */
export const isCustomModel = (service: string, model: string): boolean => {
  if (!model) return false;
  const p = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  if (!p) return false;
  return !(p.models ?? []).some((m) => m.value === model);
};

/**
 * Claude's adaptive-thinking generation (Opus 4.7/4.8, Sonnet 5, Fable 5, Mythos).
 * These models use `thinking:{type:"adaptive"}` + `output_config.effort`, and
 * REJECT the legacy manual `budget_tokens` shape with a 400. Substring regex so
 * dated snapshot ids (claude-sonnet-5-20260203) still match.
 * Doc: platform.claude.com/docs/en/build-with-claude/adaptive-thinking
 * Consumed by services/llm.ts to pick the thinking wire shape.
 */
export const isAdaptiveThinkingClaude = (model: string): boolean => /claude-(opus-4-[78]|sonnet-5|fable-5|mythos)/.test(model);

/**
 * Derive the per-call `reasoningEffort` from a TranslationConfig's per-model
 * thinking record. Single source of truth for the gate:
 *   1. config.model exists
 *   2. user has an entry in config.thinkingEffort[model] (= picked an effort)
 *   3. EITHER the model is tagged `thinking: true` in registry,
 *      OR it's a custom (unlisted) SKU on a thinking-capable provider — the user
 *      opting into thinking on an unknown model (wire layer sends ENABLE only,
 *      never a disable, so plain translations stay 400-safe; a 422/400 on an
 *      unsupported SKU is the user's call — "选了 custom 就自己搞").
 *
 * A listed-but-untagged model (mistral-large-latest, ministral) returns `undefined` —
 * we KNOW it doesn't think. Returns `undefined` (= thinking off) unless (1)+(2)+(3)
 * hold. Used by the orchestrator (per-translate-call), the cache-key generator
 * (per-cache-lookup), and the Test button (per-test-config) — keep them in lockstep
 * via this helper, not parallel logic.
 */
export const deriveThinkingParams = (method: string, config: TranslationConfig | undefined): ThinkingDirective | undefined => {
  const model = config?.model;
  if (!model) return undefined;
  const effort = config?.thinkingEffort?.[model];
  if (!effort) return undefined;
  // Tagged model: 2-state — "auto" is a CUSTOM-model-only sentinel, but it can
  // survive in storage when a model the user once hand-typed (and set to Auto)
  // later joins the curated list (e.g. claude-sonnet-5 added 2026-07). Normalize
  // it to undefined (= Off) here, at the single source, so no wire layer ever
  // sees "auto" on a listed model — otherwise a server-default-ON model (Sonnet 5
  // adaptive) would silently keep thinking with no UI state showing why.
  if (isThinkingModel(method, model)) return effort === "auto" ? undefined : effort;
  // Custom model: pass the directive through verbatim — an effort (enable) or the
  // "auto" sentinel (omit). Absence (handled above → undefined) is the DEFAULT "Off":
  // the wire layer turns undefined into each provider's disable payload for a custom
  // model, while "auto" means omit. Listed-but-untagged models fall through to
  // undefined here and the wire OMITS for them (they're known non-thinking).
  if (isThinkingCapableProvider(method) && isCustomModel(method, model)) return effort;
  return undefined;
};

/**
 * Vendors whose thinking switch is binary at the wire level — Low/Medium/High
 * all collapse to the same payload (`{thinking:{type:"enabled"}}` for Doubao,
 * Zhipu, and Moonshot). UI renders these as Off/On instead of Off/Low/Medium/High
 * to avoid hinting at granularity that doesn't exist. Selecting On stores a
 * canonical "medium" — the value is irrelevant to wire output, but a defined
 * effort is what triggers the thinking branch in deriveThinkingParams + builders.
 *
 * deepseek belongs here because its own wire builder (buildDeepseekExtraBody)
 * deliberately collapses every effort to reasoning_effort:"high" — a graded
 * dial would silently bill the high tier whatever the user picked AND
 * fragment the cache key three ways for byte-identical requests.
 * grok is NOT here: xAI accepts two real tiers (low/high), so the dial stays
 * graded and the wire builder maps medium→low (services/llm.ts).
 */
export const BINARY_EFFORT_VENDORS: ReadonlySet<string> = new Set(["deepseek", "doubao", "zhipu", "moonshot", "mimo", "siliconflow", "cohere", "qianfan", "mistral", "minimax"]);

/**
 * Providers whose API leaves reasoning/thinking ENABLED when the request omits
 * the thinking field. For these, turning thinking OFF requires sending an
 * EXPLICIT disable payload — merely omitting it silently keeps thinking on and
 * burns reasoning tokens on every call. (The DeepSeek MD-translation "10M
 * tokens" report traced to exactly this: a thinking-off request still returned
 * full `reasoning_content`. Doc: api-docs.deepseek.com/zh-cn/guides/thinking_mode
 * — "默认思考开关为 enabled".)
 *
 * The per-vendor disable wire-shape lives in each entry of the THINKING_BUILDERS
 * table (services/llm.ts), declared as `gated(service, effortShape)`; gemini +
 * azureopenai (custom services) handle it inline. THIS set is the single source of
 * truth for WHO needs the explicit disable; the invariant test in
 * services/__tests__/thinking.test.ts asserts every OpenAI-compat member emits a
 * non-empty disable body when thinking is off.
 *
 * All verified against vendor docs (audit 2026-05): deepseek ("默认 enabled" on
 * V4), openai (gpt-5.5/gpt-chat-latest omit→medium; 5.4 omit→none, but we send
 * explicit none either way), grok (omit→"low"), qwen (3.5+ gen flips commercial
 * default to ON, incl. 3.6-plus), doubao (Seed omit→enabled), zhipu (glm-4.7/5/5.1
 * forced-thinking), moonshot (Kimi "enabled by default"), gemini (3.x omit→model's
 * built-in level, can't fully disable on Pro), mimo (binary thinking:{type}; doc
 * leads with the disable example), azureopenai (mirrors openai's gpt-5.5 omit→medium),
 * siliconflow (unified enable_thinking default TRUE → DeepSeek/Kimi hybrids),
 * mistral (adjustable-reasoning mistral-medium-3-5/small via reasoning_effort high|none;
 * default model is reasoning-capable so omit may leave it on → send explicit "none").
 * gemini + azureopenai are CUSTOM services (handle the disable inline:
 * thinkingLevel "minimal" / reasoning_effort "none"), so the OpenAI-compat
 * invariant test filters them out — they're listed here for documentation.
 *
 * minimax joined 2026-07 with M3: `thinking:{type:"adaptive"|"disabled"}`,
 * server-default adaptive = ON, off must send explicit disabled (M2.x SKUs stay
 * untagged/intrinsic — the gate omits for them).
 *
 * EXCLUDED — verified genuinely intrinsic/uncontrollable on the OpenAI-compat
 * path (untagged in `models`, no builder): hunyuan (no standard
 * thinking field; `enable_enhancement` is web-search), nvidia (NIM/vLLM defaults
 * DeepSeek reasoning OFF — opt-in only, so omit is correct). NOTE mistral & perplexity
 * are NO LONGER fully here: mistral's default medium/small accept reasoning_effort
 * (Magistral SKU stays intrinsic); perplexity's sonar-deep-research accepts a GRADED
 * reasoning_effort (low/medium/high) — but it can't be disabled (omit→server-default
 * medium), so it's a builder, NOT a SERVER_DEFAULT member. sonar-reasoning-pro stays intrinsic.
 *
 * NOT in this set but DO send an explicit disable for their TAGGED reasoning SKUs
 * (their DEFAULT model is non-reasoning, so they fail the per-default-model
 * invariant — handled by their builders, not this set): openrouter (universal
 * `reasoning:{enabled:false}` when off), cohere (command-a-reasoning → reasoning_effort
 * "none"), qianfan (ernie-5.0-thinking → enable_thinking:false). groq gpt-oss is
 * unconditionally ON / undisableable → omit is the only option.
 */
export const SERVER_DEFAULT_THINKING_ON: ReadonlySet<string> = new Set([
  "deepseek",
  "openai",
  "grok",
  "qwen",
  "doubao",
  "zhipu",
  "moonshot",
  "gemini",
  "mimo",
  "azureopenai",
  "siliconflow",
  "mistral",
  "minimax",
]);

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

// Object.hasOwn 守卫:method 来自持久化/导入的字符串,"constructor"/"toString"
// 这类原型链键裸索引会返回【继承的函数】(truthy)—— useTranslationState 靠
// 本函数判断 storedMethod 是否合法的回退逻辑被骗过,validate() 在
// UNSUPPORTED_LANGS[method]?.has 上抛 TypeError,翻译按钮每次点击都炸。
export const getDefaultConfig = (method: string): TranslationConfig | undefined => (Object.hasOwn(defaultConfigs, method) ? defaultConfigs[method as ProviderKey] : undefined);
