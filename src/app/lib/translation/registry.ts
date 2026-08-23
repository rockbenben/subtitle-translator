// Single source of truth for every translation provider.
//
// PROVIDERS below is the ONE place you edit to add / change a service.
// TRANSLATION_PROVIDERS (UI list), LLM_MODELS, defaultConfigs, categorizedOptions,
// OPENAI_COMPAT_PROVIDERS (factory input), findMethodLabel, getDefaultConfig,
// and the TranslationMethod union type are all derived views over PROVIDERS.

import type { ReasoningEffort, ThinkingDirective, TranslationConfig, TranslationProvider } from "./types";
// 纯 URL 工具,放在零依赖的 services/shared 里 —— 端点解析(拼 ?endpoint=)与
// 这里的分类必须用【同一个】规范化,否则界面判成官方、线上却因大小写/尾斜杠
// 被中转 allowlist 精确匹配拒掉(exact match)。
import { canonicalEndpoint, completeClaudeUrl, completeOpenAICompatUrl, relayUrl, usesBuiltinRelay } from "./services/shared";

export type ServiceCategory = "machine-translation" | "llm" | "aggregator";

type BaseProvider = {
  label: string;
  category: ServiceCategory;
  docs?: string;
  apiKeyUrl?: string;
  /**
   * Quick-pick endpoints surfaced as tags above the URL field. Useful for
   * providers with multiple regional / product variants (Qwen mainland/intl/us,
   * MiniMax io/cn, mimo 按量/Token Plan) and for Custom (llm) where it
   * lists common local/cloud OpenAI-compat servers as starter URLs.
   * Convention: for providers with an implicit runtime default (OpenAI-compat
   * `endpoint` or a populated `defaults.url`), `endpoints[0].url` should match
   * that default — so the active tag highlights correctly.
   */
  /**
   * `label` 的写法约定 —— 这些字符串【不走 i18n】,会原样显示给所有语言的用户,
   * 所以不能写中文(tokenhub 曾写成「广州」「新加坡」,英文/日文界面上就是两个方块字)。
   * 也不要在 label 里标「(默认)」:哪个在用由高亮表达(见 TranslationSettings 的
   * 端点标签),写进文案就是同一事实编码两遍,而且各家标法还会不一致。
   * 一条原则:label 写【能把这个选项跟同组其他选项区分开的那个信息】,别写别处
   * 已经有的。点中标签后完整地址就显示在下面的输入框里,所以能从地址读到的东西
   * (端口、路径)通常不该进 label;provider 名也不该重复(LiteLLM 下面再挂个叫
   * "LiteLLM" 的选项等于没说)。反过来,泛词(`Local`)或裸主机名(`translate-pa`)
   * 同样不合格 —— 它们没说清那是什么。
   * 落到几类上:
   *   - 地域(同一服务的国内/海外节点):统一 `Mainland (CN)` / `International`
   *     / `US`,别用城市名 —— 用户关心的是"哪个区",不是机房在哪座城
   *   - 产品线 / 协议(不是地域):照厂商叫法并点明区别,如 doubao
   *     `Pay-as-you-go` / `Token Plan (CN)`、gtxFreeAPI `Google translate-pa` /
   *     `Google gtx (legacy)`(两者是两套协议,见 services/traditional.ts 的分流)
   *   - 多个本地运行时 / 自建网关:产品名就是区分点,`LM Studio` / `Ollama` /
   *     `llama.cpp` / `LiteLLM`,不必写端口(地址栏里有)
   *
   * ⚠ 这个数组同时是【中转侧的 allowlist】:relay provider 的 endpoints 必须与
   * scripts/llm-proxy-worker.js 里同名 provider 的 URL 集合完全一致
   * (workerParity.test.ts 机械校验)。客户端走中转时把选中的官方端点作为
   * `?endpoint=` 传给 Worker,Worker 校验它属于该集合后转发 —— 所以【每个官方
   * 变体都能走中转】,不需要逐个手工开路由。
   *
   * 曾经这里有个 `relayKey` 字段(变体各自对应一条 Worker 路由),已删除:它把
   * 「用哪个官方端点」(provider 事实)和「走哪条中转路由」(传输细节)绑死,要求
   * 每个变体手工 opt-in,结果 9 个变体(qwen 三地域、mimo 四档、moonshot 国际站
   * Plan…)一选中就静默失去中转 —— 恰恰是网络受限用户最需要它的时候。
   */
  /**
   * `docs` 只给【一个芯片就是一个独立产品】的那种端点用（Custom 底下的
   * LM Studio / Ollama / LiteLLM…）：provider 级的 docs 对它们没有意义，
   * 而这恰恰是最需要文档的一条路 —— 用户要照着上游文档把服务先跑起来。
   * 同一服务的地域/计费变体（qwen 三地域之类）共用 provider 级 docs，不写。
   */
  endpoints?: Array<{ label: string; url: string; docs?: string }>;
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
  models?: ReadonlyArray<ProviderModel>;
};

/** 一个可选模型条目。抽成具名类型:getProviderModels 的返回类型要带上 thinkingLevels。 */
export type ProviderModel = {
  label: string;
  value: string;
  thinking?: boolean;
    /**
     * 该 SKU 接受的思考档位,【由低到高】。声明它的三家(gemini / grok / groq)有
     * 共同特征:档位集合逐 SKU 不同,且厂商【不提供关闭开关】—— 所以这个字段
     * 同时是 canDisableThinking 的判据。发一个该 SKU 不收的档位是确定性 400。
     * 其余厂商要么全系同档、要么有真正的关闭值,不用声明。解析见 pickThinkingLevel。
     */
  thinkingLevels?: ReadonlyArray<"minimal" | "low" | "medium" | "high">;
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
  /**
   * Factory default for the user's `useRelay` config toggle — the exact same
   * spec↔config pairing as defaultModel↔model and defaultTemperature↔temperature.
   * Presence = this provider has a Cloudflare relay route (UI renders the
   * toggle); value = the toggle's initial state. The user's toggle ALWAYS has
   * the final say — relay is never forced (今天实测的"直连必死"不是永恒事实，
   * 上游修了 CORS 用户应能自行切回直连):
   *   - false: direct by default; relay is the escape hatch for CORS-walled
   *     networks/origins.
   *   - true: relay by default because browser-direct is broken as of the
   *     verification date noted on the entry (tokenhub: preflight 404).
   * Members need a matching /api/{key} Worker route (scripts/llm-proxy-worker.js).
   *
   * 【规范】固定端点的 openai-compat provider 一律带这个字段(通常 false):
   * 逃生口与 url 字段同理全员配发 —— 谁会被上游拦无法预判,而且自部署 Worker 的
   * 用户拿到的文件应当开箱全覆盖,不该要求他们会改代码。【缺席】只允许结构性
   * 加不了的:端点由用户掌控(llm/azureopenai/nvidia —— 中转没有固定
   * 上游可写)、协议不是固定地址的 chat/completions(gemini 把 model 拼在 URL
   * 路径里,pass-through 转发不了)。
   */
  defaultUseRelay?: boolean;
};

// 【openai-compat 一律带可选 url 字段】(buildOpenAICompatDefault 无条件
// `base.url = ""`)。这里曾有一条派生规则 acceptsCustomUrl(allowCustomUrl ||
// 有中转路由),已连同 allowCustomUrl 字段一起删除 —— 那套机制把「用户有没有
// 逃生口」交给两个与之无关的标志决定,结果 qianfan/cohere/openrouter/groq/
// siliconflow/atlascloud 六家零退路,不是谁判断过，是漏了。而 DeepSeek 判例
// (探测全绿、真实用户仍被上游按 origin 拦 403,见 services/llm.ts 的 403 重写)
// 证明「谁会被拦」无法预判 —— 无法预判的风险就不该用"逐条记得写"的 opt-in
// 分配退路，默认人人有才是与之匹配的设计。
// url 的三种取值语义由 classifyEndpointUrl(见 getProviderEndpoints 附近)统一
// 判定:空/官方默认、官方变体、真自定义 —— UI 与端点解析共用同一判据。

// ─── docs / apiKeyUrl 的维护约定 ────────────────────────────────────────────
// 全部 54 个链接在 2026-08-20 实测过一轮(curl -L 跟随重定向,带浏览器 UA)。
// 无死链;修正了 7 处会重定向的地址,规则是【写最终落点,别让用户多跳一次】:
//   · 域名迁移 → 直接写新域(console.anthropic.com → platform.claude.com、
//     platform.moonshot.cn → platform.kimi.com)
//   · 落到更具体的子页 → 直接指子页(deepl 的 request-translation、
//     minimax 的 text-chat-openai、siliconflow 的 /cn/ 本地化路径)
// ⚠ 【locale 段:能不写就不写】。本项目支持 18 语言,把任一 locale 写死都会
// 让另一半用户落在读不懂的页面上。判据只有一条 —— 去掉 locale 段后仍可达
// 且会按 Accept-Language 自动适配的,就不写(2026-08-20 逐条实测):
//   · 不写:learn.microsoft.com(zh→/zh-cn/、en→/en-us/)、help.aliyun.com
//     (zh→/zh/、en→/en/)、www.deepl.com(zh→/zh/)、mimo.mi.com(无段直达)
//   · 必须写:docs.bigmodel.cn/cn/、platform.claude.com/docs/en/ —— 去掉即
//     404,locale 是路径的必需组成部分,不是本地化开关
//   · docs.siliconflow.cn/cn/ 也保留:它只有中文版,任何语言都跳 /cn/
// ⚠ curl 探测在这里【会骗人】:不发 Accept-Language 时微软/阿里都落到英文页,
// 看着像"301 到 /en-us",据此"修正"就是把中文用户锁死(本仓库犯过:上一轮我
// 按探测结果把 translator 改成 /en-us,azureopenai 则原本就写死 /zh-cn)。
// 复查时务必带上语言头对比两次。
// 【不改】的两类,别把它们当问题:
//   · apiKeyUrl 跳登录/授权页(mistral、cohere、openrouter、siliconflow、
//     腾讯、opencode、Google AI Studio):未登录时必然如此,登录后直达目标页。
//   · yandex 跳验证码页:该站对脚本抓取一律返回验证码,浏览器打开正常
//     (核对 SKU 必须用浏览器,见 yandex 条目注释)。
// ⚠ 火山:必须用 docs.volcengine.com,www 域会 301 且脚本/扩展都读不到内容。
// 复查方法:把本文件的 docs/apiKeyUrl 抽出来 curl -sSL -w '%{url_effective}',
// 落点与原地址不同的就是候选 —— 再按上面两类规则判断改不改。

/** Providers with hand-written implementations (Claude, Gemini, Azure OpenAI, Nvidia, Custom LLM, all MT). */
export type CustomProviderSpec = BaseProvider & {
  kind: "custom";
  defaults: TranslationConfig;
};

export type ProviderSpec = OpenAICompatProviderSpec | CustomProviderSpec;

// 【本地运行时芯片，三家共用一份】—— llm / translategemma / milmmt 都是
// URL_IS_PRIMARY_CRED，同一个用户会在它们之间来回切，某一家少一个运行时是
// “加的时候忘了”而不是判断过。顺序大致按流行度。
//
// ⚠ 【派生而不是抄三遍】。这四条曾经在三个 provider 里各抄一份，靠一条不变量
// 测试盯着 —— 而那条测试按硬编码的主机名过滤，只给 milmmt 加一个新运行时
// （vLLM :8000）会被两边一起滤掉、测试照样绿，它自己引的 koboldcpp 遗漏事故
// 可以原样重演。派生后漂移在结构上不可能，那条测试也就一并删了（同 llm.ts 的
// “派生而不是再抄一遍字面量，三处就不可能漂移”）。
//
// docs 逐条写而不用 provider 级那一条：芯片背后是四个独立产品，而 provider 级
// docs（Custom 根本没有，两个 MT 是 HF 模型卡）只讲模型，答不了“怎么把这个服务
// 跑起来”—— 而那正是这条路的第一道坑。链接 2026-08-22 实测。
const LM_STUDIO = { label: "LM Studio", url: "http://127.0.0.1:1234/v1/chat/completions", docs: "https://lmstudio.ai/docs/developer/openai-compat" } as const;
const OLLAMA = { label: "Ollama", url: "http://127.0.0.1:11434/v1/chat/completions", docs: "https://docs.ollama.com/api/openai-compatibility" } as const;
const LLAMA_CPP = { label: "llama.cpp", url: "http://127.0.0.1:8080/v1/chat/completions", docs: "https://github.com/ggml-org/llama.cpp/tree/master/tools/server" } as const;
const KOBOLDCPP = { label: "koboldcpp", url: "http://127.0.0.1:5001/v1/chat/completions", docs: "https://github.com/LostRuins/koboldcpp/wiki" } as const;

/** Custom (llm) —— 走 /v1/chat/completions，四个本地运行时都合适。 */
const LOCAL_RUNTIME_ENDPOINTS = [LM_STUDIO, OLLAMA, LLAMA_CPP, KOBOLDCPP] as const;

/**
 * TranslateGemma / MiLMMT —— 它们把提示词【预渲染】后打 /v1/completions，整条
 * 设计的保证是「服务端不再套任何模板」。
 *
 * ⚠ 【Ollama 不在这张表里，是结构性的，不是漏了】。Ollama 的 OpenAI 兼容层在
 * /v1/completions 上【仍然套 Modelfile 模板】—— 源码三行为证(2026-08-22 核对
 * ollama/main)：
 *   1. api/types.go        `// Raw set to true means that no formatting will be applied to the prompt.`
 *   2. openai/openai.go    FromCompleteRequest 构造 api.GenerateRequest 时【没有设 Raw】→ 默认 false
 *   3. server/routes.go    `if !req.Raw { tmpl := m.Template … }`
 * 于是我们精心预渲染的提示词会被再包一层（包成什么取决于导入时那个 GGUF 带的
 * 模板，我们完全控制不了）—— 正是这条路存在要消灭的"模板抽奖"。给它一个芯片
 * 等于一键把用户送上一条保证不成立的路，还没有任何提示。
 *
 * 想在 Ollama 上跑这两个模型的用户仍可手填地址（url 字段没堵死），但那是用户
 * 的显式选择，不是我们的推荐。加第 5 个运行时时，请分别判断它属于哪张表 ——
 * 判据就一条：它的 /v1/completions 是不是真的原样透传。
 */
const RAW_PROMPT_RUNTIME_ENDPOINTS = [LM_STUDIO, LLAMA_CPP, KOBOLDCPP] as const;

// Declared in UI display order. TRANSLATION_PROVIDERS iterates this directly,
// so changing order here changes the Select/chip order.
export const PROVIDERS = {
  // ===== Machine Translation =====
  gtxFreeAPI: {
    kind: "custom",
    category: "machine-translation",
    label: "GTX API (Free)",
    // chunkSize 触发 useTranslationState 的 chunk 路径：整批行按 \n 拼成
    // ~5000 字符块，每块一个请求 (translateHtml 原生接受文本数组，120 行 /
    // 12.5KB 单请求实测 200)。相比旧的每行一请求 ×100 并发，请求数降
    // 50-100x，免费共享端点的 IP 限流压力随之消失;残余 429 仍由共享冷却闸
    // (lib/translation/retry.ts rateLimitGate) 全局暂停后自动恢复。
    // batchSize 只服务 line 路径兜底 (chunk 路径是顺序循环，不读它)。
    //
    // url 可切换网关，服务实现按 URL 形状分流协议 (见 services/traditional.ts):
    //   - 含 /translate_a/ → legacy 表单协议 (被 Google 反滥用墙拦截的旧端点，
    //     但墙按 IP 信誉放行，部分地区/IP 仍可用，保留作备选)
    //   - 其余 (默认 translate-pa，或用户自建同协议镜像)→ translateHtml 数组协议
    defaults: { url: "https://translate-pa.googleapis.com/v1/translateHtml", chunkSize: 5000, delayTime: 200, batchSize: 100 },
    endpoints: [
      { label: "Google translate-pa", url: "https://translate-pa.googleapis.com/v1/translateHtml" },
      { label: "Google gtx (legacy)", url: "https://translate.googleapis.com/translate_a/single" },
    ],
  },
  edgeFreeAPI: {
    kind: "custom",
    category: "machine-translation",
    // 微软 Edge 浏览器内置翻译的免费后端 (Azure Translator 引擎 + Edge 的
    // 免费 JWT auth 端点)。与 gtxFreeAPI 同为零配置免费服务，互为备胎：
    // Google 反滥用墙收紧时用户可一键切到 Edge，反之亦然。
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
    docs: "https://developers.deepl.com/api-reference/translate/request-translation",
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
    docs: "https://help.aliyun.com/model-studio/machine-translation",
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    defaults: { url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions", apiKey: "", domains: "", model: "qwen-mt-flash", batchSize: 20 },
    endpoints: [
      { label: "Mainland (CN)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "International", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "US", url: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions" },
    ],
    // qwen-mt-turbo deprecated 不收录;qwen-mt-lite-us 是美区分部署版本，
    // 仅在 international endpoint 才可用，不放主清单避免误选。
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
    // LM Studio / llama.cpp / koboldcpp / vLLM, usually keyless. But gated setups
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
    // Users self-host on heterogeneous runtimes (LM Studio :1234, llama.cpp :8080,
    // koboldcpp :5001 —— 不含 Ollama，见 RAW_PROMPT_RUNTIME_ENDPOINTS); shipping any
    // one as the default would mislead users on the others. Empty default
    // → status starts as "needs-config" and forces
    // an explicit endpoint pick from the chips below.
    defaults: { url: "", apiKey: "", model: "translategemma-4b-it", batchSize: 10, delayTime: 200 },
    endpoints: [
      ...RAW_PROMPT_RUNTIME_ENDPOINTS,
    ],
    models: [
      { label: "TranslateGemma 4B", value: "translategemma-4b-it" },
      { label: "TranslateGemma 12B", value: "translategemma-12b-it" },
      { label: "TranslateGemma 27B", value: "translategemma-27b-it" },
    ],
  },

  milmmt: {
    kind: "custom",
    category: "machine-translation",
    // Xiaomi's MiLMMT-46 — a Gemma3-12B derivative post-trained purely for
    // translation (arXiv 2608.10812). Same operational shape as translategemma
    // (self-hosted weights, greedy decoding, one segment per request), so it
    // shares localCompletionsTranslate in services/traditional.ts.
    //
    // ⚠ It is deliberately NOT an `llm` category service. Xiaomi state plainly
    // (huggingface.co/xiaomi-research/MiLMMT-46-12B-v1.0/discussions/1) that
    // post-training "largely stripped away" instruction-following: the model
    // "perceives [tags and instructions] as noise rather than commands".
    // System prompts, glossaries and context markers are not just unsupported,
    // they actively pollute the input — hence machine-translation category
    // (no context toggle), GLOSSARY_UNSUPPORTED, and a fixed prompt the user
    // cannot edit.
    label: "MiLMMT",
    docs: "https://huggingface.co/xiaomi-research/MiLMMT-46-12B-v1.0",
    // URL_IS_PRIMARY_CRED, empty by default — identical reasoning to
    // translategemma: users self-host on LM Studio :1234 / llama.cpp :8080 /
    // koboldcpp :5001 (不含 Ollama —— 见 RAW_PROMPT_RUNTIME_ENDPOINTS), and shipping
    // any one as the default would mislead everyone on the others.
    //
    // No temperature field: the model card's only documented recipe is
    // greedy (temperature 0, top_k 1). The service hardcodes it so a runtime's
    // UI default (LM Studio ships 0.7-1.0) can't bleed in.
    defaults: { url: "", apiKey: "", model: "MiLMMT-46-4B-v1.0", batchSize: 10, delayTime: 200 },
    endpoints: [
      ...RAW_PROMPT_RUNTIME_ENDPOINTS,
    ],
    // 4B is the default: it is the family's most-downloaded checkpoint by a
    // wide margin and the only one that fits comfortably on consumer VRAM
    // alongside a browser. 1B for CPU-only boxes, 12B for quality.
    // Only v1.0 is listed — v0.1 is the SFT-only ancestor this model supersedes.
    models: [
      { label: "MiLMMT-46 4B", value: "MiLMMT-46-4B-v1.0" },
      { label: "MiLMMT-46 1B", value: "MiLMMT-46-1B-v1.0" },
      { label: "MiLMMT-46 12B", value: "MiLMMT-46-12B-v1.0" },
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
    // 无 defaultTemperature:GPT-5.x 全系为推理模型，拒绝非默认 temperature
    // (400 "Only the default (1) value is supported",运行时实测，2026-07 核查;
    // effort:none 是否解锁在 5.4+ 未确认)。字段移除 → 请求不发、UI 不显示，
    // 服务端默认生效。
    docs: "https://developers.openai.com/api/docs/guides/text",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultUseRelay: false,
    // https://developers.openai.com/api/docs/models
    // GPT-5.6 家族 (sol/terra/luna) 是当前主推旗舰，均支持 reasoning;上一代
    // 5.5 / 5.4-mini 仍在售 (不在总览页推荐位，但详情页与 deprecations 页都确认
    // 未停用),保留作对照/低成本档。5.6 无 mini 变体，luna 即低成本高并发档
    // (官方原文点名 cost-sensitive/high-volume),故设为翻译默认。
    // ⚠ reasoning.effort 的取值集合【按型号不同】,官方原文 "Supported values are
    // model-dependent... Some models support only a subset":5.6 家族到 max,而
    // 5.5 / 5.4-mini 最高只到 xhigh(无 max)。我方 ReasoningEffort 只有
    // low/medium/high,三档对全系都安全 —— 要加 max/xhigh 档时必须按型号裁剪，
    // 否则给 5.5 / 5.4-mini 发 max 会 400。
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
    apiKeyUrl: "https://platform.claude.com/settings/keys",
    // url 可选：自建中转 (转发到 api.anthropic.com/v1/messages 的自有 Worker)。
    // 与中转开关正交:url 决定用哪个 endpoint,useRelay 决定走不走中转,二者互不覆盖。
    // endpoints[] 只有官方这一个 —— 声明它不是为了给界面渲染芯片(单个不渲染),
    // 而是让 classifyEndpointUrl 认得出官方地址:用户把文档上的地址原样贴进 url
    // 框时,不该被判成"自定义"(界面文案会宣称"请求直连",而中转恰恰声明了它)。
    // 服务层的 CLAUDE_DIRECT_ENDPOINT 从这里派生,中转 allowlist 由 workerParity 钉住。
    endpoints: [{ label: "Anthropic", url: "https://api.anthropic.com/v1/messages" }],
    // 无 temperature 字段:adaptive 世代 (Opus 5 / Sonnet 5 / Fable 5) 拒绝
    // 非默认 temperature(400，官方成文);统一 provider 级不发，服务端默认生效。
    defaults: { url: "", apiKey: "", model: "claude-sonnet-5", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {}, useRelay: false },
    // 两代思考机制并存 (service 层按 model 分流，见 services/llm.ts claude +
    // isAdaptiveThinkingClaude):
    //   - Adaptive thinking(Opus 5 / Sonnet 5 / Fable 5):thinking:{type:"adaptive"}
    //     + output_config.effort;拒绝 temperature/top_p 及旧的 budget_tokens(均 400)。
    //   - Extended thinking(Haiku 4.5):沿用 thinking:{type:"enabled",budget_tokens}。
    // temperature 是 provider 级不发 (上面 defaults 无此字段)—— Haiku 4.5 虽仍
    // 接受该参数，但为简化统一不发，用服务端默认值。
    // 证据:platform.claude.com/docs/en/build-with-claude/adaptive-thinking
    //
    // 默认仍是 Sonnet 5 而不是旗舰 Opus 5:逐行翻译是高频短请求，Sonnet 5
    // ($3/$15 per MTok) 对这个负载的性价比明显优于 Opus 5 ($5/$25),要旗舰
    // 质量的用户在下拉里一键就能切。
    // model id 一律用不带日期后缀的规范写法 (官方 model 表原文即完整 id);
    // 带日期的快照 id 仍可用户手填，isAdaptiveThinkingClaude 用子串匹配兜住。
    // Opus 4.8 已随 Opus 5 上线移出清单 —— 同价位($5/$25)的上一代，留着只是噪音。
    // 仍可手填 (isAdaptiveThinkingClaude 的 opus-4-[78] 分支照样判成 adaptive 世代)。
    models: [
      { label: "Claude Opus 5", value: "claude-opus-5", thinking: true },
      { label: "Claude Sonnet 5", value: "claude-sonnet-5", thinking: true },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5", thinking: true },
      { label: "Claude Fable 5", value: "claude-fable-5", thinking: true },
    ],
  },
  gemini: {
    kind: "custom",
    category: "llm",
    label: "Gemini",
    docs: "https://ai.google.dev/gemini-api/docs/text-generation",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    // 无 temperature 字段 (同 translategemma 先例):Gemini 3.x 官方强烈建议
    // 保持默认值 1.0(<1.0 可能导致循环输出/推理退化，ai.google.dev
    // whats-new-gemini-3.5,AI Studio 已移除滑块)。service 层不发该参数 →
    // 服务端默认 1.0 生效;字段移除后 UI 输入框自动隐藏，migrateConfig 的
    // defaults-key-only 合并会清掉用户已存的旧值。
    defaults: { apiKey: "", model: "gemini-3.7-flash", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
    // 仅收录 Gemini 3.x 系列 (2.5 已过时，且参数协议不同需要 budget mapping 增加
    // service 复杂度，精简掉)。Gemini 3 thinking 通过
    // `generationConfig.thinkingConfig.thinkingLevel` 控制,默认开启且【没有关闭值】,
    // off 时传该 SKU 收得下的最低档;档位集合按 SKU 不同,就声明在下方每行的
    // thinkingLevels 里,解析统一走 pickThinkingLevel。
    // 默认 3.7-flash:2026-08-13 GA,官方称 "latest and most capable Flash";
    // 3.5-flash 已被官方页降称 "previous-generation Flash model"。
    // thinkingLevels 抄自官方【逐模型表】(ai.google.dev/gemini-api/docs/thinking,
    // 2026-08-20 核对),由低到高。加 SKU 时对着那张表补这一行 —— 别再用
    // "名字里有 -pro 就只收 low/high" 这类正则近似:官方表里 3-pro-preview 确实
    // 只收 low/high,但 3.1-pro-preview 收 low/medium/high,按名字归并会把用户
    // 选的 Medium 静默降级成 Low(与 grok 全线钳 medium 同一类 bug)。
    models: [
      { label: "Gemini 3.1 Pro (Preview)", value: "gemini-3.1-pro-preview", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 3.7 Flash", value: "gemini-3.7-flash", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 3.5 Flash", value: "gemini-3.5-flash", thinking: true, thinkingLevels: ["minimal", "low", "medium", "high"] },
      { label: "Gemini 3.5 Flash Lite", value: "gemini-3.5-flash-lite", thinking: true, thinkingLevels: ["minimal", "low", "medium", "high"] },
    ],
  },
  qwen: {
    kind: "openai-compat",
    category: "llm",
    label: "Qwen",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen3.7-plus",
    defaultTemperature: 0.7,
    docs: "https://help.aliyun.com/model-studio/qwen-api-via-openai-chat-completions",
    apiKeyUrl: "https://bailian.console.aliyun.com/?tab=model#/api-key",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "International", url: "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" },
      { label: "US", url: "https://dashscope-us.aliyuncs.com/compatible-mode/v1/chat/completions" },
    ],
    // https://help.aliyun.com/zh/model-studio/models (「选择模型」推荐页的三个头牌)
    // 全系混合思考模式、`enable_thinking` 可切换，且【默认开启思考】—— 所以三个
    // 都打 thinking 标签,off 态才会发显式 enable_thinking:false(qwen 在
    // SERVER_DEFAULT_THINKING_ON 里)。语义 2026-08 复核无变化。
    // ⚠ 官方坑:思考模式下 max_tokens 有效范围收窄为 [1, 32768],超出直接 400。
    //
    // 3.7-max → 3.8-max:同价 (¥12/¥36),3.8 是当前旗舰且原生多模态,而 3.7-max
    // 页面自述「当前开放纯文本模型能力供体验」,已不在推荐头牌里。
    // 3.6-flash → 3.7-flash:同代升级且【便宜 2-6 倍】(≤32k 档 ¥0.2/¥0.8 vs
    // 3.6 的 ¥1.2/¥7.2)。3.6-flash 未下线，只是被取代。
    // 默认保持 qwen3.7-plus:官方三头牌里的高性价比档 (¥2/¥8, 1M 上下文)。
    models: [
      { label: "Qwen3.8 Max", value: "qwen3.8-max", thinking: true },
      { label: "Qwen3.7 Plus", value: "qwen3.7-plus", thinking: true },
      { label: "Qwen3.7 Flash", value: "qwen3.7-flash", thinking: true },
    ],
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    // Kimi 在前、Moonshot 在括号:官方平台已自称「Kimi API 开放平台」,文档域
    // 迁到 platform.kimi.com,模型全部是 kimi-* —— 主名跟着官方走。括号保留
    // Moonshot 是因为老用户仍按"月之暗面/Moonshot"检索(同 xAI (Grok) 写法)。
    // ⚠ registry key 与 endpoint 仍是 moonshot/api.moonshot.cn:key 换掉会让
    // 存量配置与中转路由全部失效,而 API host 官方【未】迁移(见下方注释)。
    label: "Kimi (Moonshot)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k3",
    // 无 defaultTemperature:kimi-k2.x 全系 temperature 锁定 (thinking 1.0 /
    // non-thinking 0.6),传其他值直接报错 (platform.kimi.ai 迁移指南原文
    // "any other value will result in an error",官方建议不传)。字段移除 →
    // 请求不发、UI 不显示，服务端按模式取锁定值。
    // 文档站已迁域:platform.moonshot.cn 301 → platform.kimi.com(2026-08 核查)。
    // ⚠ API host 未变，官方 curl 示例仍是 api.moonshot.cn —— 别顺手把 endpoint
    // 一起改了。
    docs: "https://platform.kimi.com/docs/models",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.moonshot.cn/v1/chat/completions" },
      { label: "International", url: "https://api.moonshot.ai/v1/chat/completions" },
    ],
    // K2.6 / K2.5 都通过扁平 `thinking: {type}` 切换思考模式,两者都【默认开启
    // 思考】,故都打标签 —— off 态才会发显式 disabled(moonshot 在
    // SERVER_DEFAULT_THINKING_ON 里)。
    // ⚠ 修正:此前注释写「K2.5 不支持参数切换 thinking」是错的。官方参数表里
    // k2.5 与 k2.6 的 `thinking.type` 同为 "enabled"(默认)/"disabled";k2.5 真正
    // 不支持的是 **Preserved Thinking**(`thinking.keep`),不是开关本身。因为写错
    // 而漏打标签，gated() 走 listed-but-untagged 分支【省略】thinking 参数 →
    // 用户关着思考、k2.5 却按服务端默认一直在推理。同 DeepSeek「10M tokens」事故。
    // kimi-k2-thinking 系列已 2026-05-25 退役，不收录。
    //
    // ⚠ kimi-k3 与 K2.x【协议不同】,是本 provider 唯一需要按 SKU 分流的地方:
    // K2.x 用扁平 thinking:{type},k3 仅思考模式、【不接受 thinking 参数】,改用
    // 顶层 reasoning_effort(low/high/max,默认 max —— 官方 platform.kimi.com/docs)。
    // 因为 k3 没有关闭值,它走【逐 SKU 档位表】那条路(thinkingLevels +
    // pickThinkingLevel,同 gemini/grok/groq):关闭态发最低档 low。
    // max 不写进表里 —— 同 grok 的 xhigh:ReasoningEffort 只有 low/medium/high,
    // 我们发不出它;写进去也只是死数据(want 最高是 high,本就命中 high)。
    // (2026-08-20 复核 platform.kimi.com/docs/api/chat:「Kimi K3 始终启用思考」,
    //  无 off/none;models.dev 给 k3 标 toggle=true 与官方原文冲突,别照它改。)
    // 声明了 thinkingLevels ⇒ canDisableThinking("moonshot") 为 false ⇒ 界面把
    // 该档标成 Min —— 这对 K2.x 略显保守(它们真能关),但一个 provider 只有一个
    // 标签,宁可保守:标 Off 却关不掉是计费可见的谎,标 Min 而实际关掉了不骗人。
    // service 层按 isThinkingModel + 型号分流,见 services/llm.ts 的 moonshotEffort。
    //
    // kimi-k2.5 已下线:官方模型页写明「停止向新注册用户开放」+ 平台 8-31 停服,
    // TokenHub 的 /v1/models 实拉也把它标成 status="pre-offline"(2026-08-20 实测),
    // 而 k2.6 / k2.7-code / k3 均为 online。留着等于给用户一个 11 天后必死的选项。
    models: [
      { label: "Kimi K3", value: "kimi-k3", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "Kimi K2.6", value: "kimi-k2.6", thinking: true },
    ],
  },
  doubao: {
    kind: "openai-compat",
    category: "llm",
    label: "Doubao (Volcengine)",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-seed-2-1-turbo-260628",
    defaultTemperature: 0.7,
    // ⚠ 用 docs.volcengine.com 而不是 www.volcengine.com:后者会 301 到前者,
    // 而且脚本抓取与浏览器扩展在 www 域上都拿不到内容(权限/空页),只有 docs
    // 域可读。直接指向【模型列表】页,而不是文档站首页 —— 核对 SKU 时少一跳。
    docs: "https://docs.volcengine.com/docs/82379/1330310",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    defaultUseRelay: false,
    // ⚠ 【不收录 Coding Plan 端点】(/api/coding/v3,2026-08-20 撤除)。它不是一个
    // "地域/线路变体",而是另一种计费权益,官方 FAQ 原文:「套餐是否仅可用于 AI
    // 工具中的调用？是的,在【非 AI 工具】中使用 Coding Plan / Agent Plan 权益
    // 对应的 Base URL 和 API Key 有可能被识别为滥用/违规,会导致【订阅停用或
    // 账号封禁】」。判据不是"是不是 CLI"(官方支持 Codex CLI / OpenCode /
    // OpenClaw 这类自托管 CLI),而是【是不是 AI 编程工具】—— 本项目是字幕/
    // Markdown/JSON 批量翻译,不写代码不读代码库,落在"非 AI 工具"一侧。
    // 收录它对用户【零收益】(非指定工具调用不走套餐额度,照常扣标准余额)
    // 却把封号风险转嫁过去;而且该端点主推编码向模型,翻译场景本就不该用。
    // 同理不收录 GLM(/api/coding/paas/v4)、Kimi(api.kimi.com/coding)、
    // 火山 Agent Plan 等一切"按工作流卖额度"的端点 —— 新增此类时先查这一条。
    endpoints: undefined,
    // 清单以上方 docs 链接(官方模型列表页)的【推荐模型】栏为准,2026-08-20
    // 用浏览器逐条核对 —— 该站对脚本抓取不返回内容,必须用浏览器打开。
    // 官方把模型分「推荐 / 往期 / 即将下线」三层,我们只收【推荐】那一层:
    // 2.0 系列(pro-260215、lite-260428 等)已整体降为往期,同 zhipu 只留 5.x 的
    // 处置 —— 老型号对翻译没有不可替代价值,留着只是让下拉更长。
    //
    // 默认 2.1 turbo 而非推荐榜首的 evolving:逐行翻译是【高频短请求】,
    // turbo 是轻量高速档,性价比最优;evolving 的 1024k 上下文对逐行/小批量
    // 翻译用不上(我们的上下文批默认才 3 行 + 窗口 50),多花的钱换不来质量。
    // 要旗舰能力或超长上下文的用户在下拉里一键就能切。
    // ⚠ evolving 是【滚动别名】,不带日期后缀,官方标注「快速迭代 / 周级迭代」——
    // 同一个 id 的行为会随周更新变化。已知副作用:逐行缓存按【源文+配置】做键,
    // 模型悄悄换代后旧缓存仍会命中,同一份文件重跑拿到的是上一代译文(要新结果
    // 得清缓存)。这也是它不适合当默认的另一个理由 —— 默认应当行为可预期。
    // ⚠ 限流:三个推荐型号都是 RPM 500 / TPM 100万(往期 2.0 系列曾是 RPM 30000,
    // 60 倍)。长文件高并发更容易撞 429 —— 引擎有共享冷却闸兜着
    // (retry.ts rateLimitGate),表现为变慢而不是失败。
    models: [
      { label: "Doubao Seed Evolving", value: "doubao-seed-evolving", thinking: true },
      { label: "Doubao Seed 2.1 Pro", value: "doubao-seed-2-1-pro-260628", thinking: true },
      { label: "Doubao Seed 2.1 Turbo", value: "doubao-seed-2-1-turbo-260628", thinking: true },
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
    // endpoints and default to pay-as-you-go.
    // ⚠ 与已撤除的火山 Coding Plan【性质不同,别混为一谈】:Token Plan 是通用
    // token 预付包(同一批模型、文档无任何用途限制,预付更便宜),收录它用户真省钱;
    // 火山 Coding Plan 卖的是 AI 编程工作流额度,官方明写非 AI 工具使用可能封号,
    // 且不走套餐额度 —— 判据见 doubao 条目。新增"套餐/权益类"端点先对照这两条。 Token Plan has three regional clusters (CN / Singapore /
    // Europe) — all share the same tp-xxxxx key; the url field (universal on
    // openai-compat) also lets users paste any other variant.
    endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
    defaultModel: "mimo-v2.5",
    defaultTemperature: 0.7,
    // 文档站已迁域:platform.xiaomimimo.com → mimo.mi.com(2026-08 核查,两条地址
    // 均已人工实测)。控制台仍在旧域，且路径【不带 `#/`】。
    // ⚠ API 端点 (api.xiaomimimo.com) 未随文档站迁移，别顺手一起改。
    docs: "https://mimo.mi.com/docs/api/chat/openai-api",
    apiKeyUrl: "https://platform.xiaomimimo.com/console/api-keys",
    defaultUseRelay: false,
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
    // (排除标记"即将下线"的 glm-4.5-flash),按文档原顺序。GLM-5.3(2026-08-14)
    // 是当前旗舰,glm-5.2 次之 (1M 无损上下文),glm-5-turbo 为长任务优化档。
    //
    // ⚠ glm-5.3 【故意不打 thinking 标签】,虽然它恰恰是思考模型 —— 官方模型页
    // 原文「会始终启用思考功能……并不再支持禁用思考功能」,`thinking.type` 只收
    // "enabled"。而 zhipu 在 SERVER_DEFAULT_THINKING_ON 里,打了标签就意味着
    // 关闭态要发 thinking:{type:"disabled"} —— 对 5.3 是非法值。不打标签 →
    // gated() 走 listed-but-untagged 分支【整个省略】thinking 参数 (llm.ts),
    // 模型按自己的默认强度思考，请求合法。同 MiniMax M2.x / hunyuan-a13b 先例。
    // 代价:UI 上 5.3 没有思考开关 —— 它本来也关不掉，如实反映而已。
    //
    // 默认仍是 glm-5.2 而非旗舰 5.3:逐行翻译不需要强制推理，5.2 可关思考、
    // 单位成本更低;要 5.3 的用户在下拉里一键就能切。
    //
    // ⚠ 【只收 5.x】(2026-08-20 精简):GLM-4.x 全系 8 个已移除。5.x 四代已覆盖
    // 旗舰/长上下文/快速各档,4.x 对翻译场景没有不可替代价值;而且官方文档索引
    // (docs.bigmodel.cn/llms.txt)里 4.5 以下已不再单独建页 —— 那是退役前兆。
    // 加回任何 4.x 之前先确认它在官方模型页仍在售。
    models: [
      { label: "GLM-5.3", value: "glm-5.3" },
      { label: "GLM-5.2", value: "glm-5.2", thinking: true },
      { label: "GLM-5.1", value: "glm-5.1", thinking: true },
      { label: "GLM-5", value: "glm-5", thinking: true },
      { label: "GLM-5 Turbo", value: "glm-5-turbo", thinking: true },
    ],
  },
  minimax: {
    kind: "openai-compat",
    category: "llm",
    label: "MiniMax",
    endpoint: "https://api.minimaxi.com/v1/chat/completions",
    defaultModel: "MiniMax-M3",
    defaultTemperature: 0.7,
    docs: "https://platform.minimax.io/docs/api-reference/text-chat-openai",
    apiKeyUrl: "https://platform.minimax.io/console/access",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.minimaxi.com/v1/chat/completions" },
      { label: "International", url: "https://api.minimax.io/v1/chat/completions" },
    ],
    models: [
      // M3 引入了真开关:`thinking:{type:"adaptive"|"disabled"}`(服务端默认
      // adaptive = ON，可关)→ 打 thinking 标签，off 态发显式 disabled，否则
      // 每次翻译都默默烧推理 token(DeepSeek「10M tokens」同款事故)。
      // M2.x 仍是 intrinsic/unclosable(无 toggle 参数)→ 不打标签。See llm.ts.
      { label: "MiniMax M3", value: "MiniMax-M3", thinking: true },
      { label: "MiniMax M2.7", value: "MiniMax-M2.7" },
      { label: "MiniMax M2.7 High-Speed", value: "MiniMax-M2.7-highspeed" },
      // ⚠ M2.5 已下线收录:TokenHub 的 /v1/models 把 minimax-m2.5 标成
      // status="pre-offline"(2026-08-20 实拉)。规则是【任一渠道 pre-offline
      // 即全面下线】—— 老模型不留,免得用户选中一个随时会消失的选项。
      // 已知代价:手填 "MiniMax-M2.5" 的存量用户会落进 gated() 的 custom 分支,
      // 默认 Off 态发 thinking:{type:"disabled"},而 M2.x 无此参数 → 可能 4xx。
      // 按仓库「不做向后兼容」方针接受:逃生口是把思考档切 Auto(省略参数)。
    ],
  },
  stepfun: {
    kind: "openai-compat",
    category: "llm",
    label: "StepFun (阶跃星辰)",
    endpoint: "https://api.stepfun.com/v1/chat/completions",
    defaultModel: "step-3.5-flash",
    defaultTemperature: 0.7,
    docs: "https://platform.stepfun.com/docs/llm/modeloverview",
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    defaultUseRelay: false,
    // 官方模型总览(platform.stepfun.com/docs/llm/modeloverview,2026-08-20 核对)
    // 的两个主推旗舰,均 256K 上下文、均标"推荐",无即将下线标记。
    // 默认 3.5-flash 而非 3.7:3.7 是【多模态】推理旗舰,3.5 是【语言】推理
    // 旗舰 —— 翻译是纯文本任务,语言向那款更对路且更便宜。
    // ⚠ 【不打 thinking 标签】:官方 OpenAI 兼容文档与模型总览都【没有】记载
    // thinking / reasoning_effort / enable_thinking 任何一个开关。按 gated()
    // 的既定纪律,未知协议的 SKU 一律不注入推理参数(乱发可能 4xx);哪天官方
    // 成文了再连标签带 builder 一起加。
    // ⚠ 不收 StepAudio(语音)、Step-1o Turbo Vision(视觉,32K)—— 非文本对话。
    models: [
      { label: "Step 3.5 Flash", value: "step-3.5-flash" },
      { label: "Step 3.7 Flash", value: "step-3.7-flash" },
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
    defaultUseRelay: false,
    models: [
      { label: "ERNIE 5.1", value: "ernie-5.1" },
      { label: "ERNIE 5.0", value: "ernie-5.0" },
      // ERNIE 5.0-Thinking server-defaults enable_thinking=true, but it's a hybrid
      // SKU with a real toggle: `enable_thinking` boolean (binary → qianfan is in
      // BINARY_EFFORT_VENDORS). Tagged so off-state sends explicit enable_thinking:false.
      { label: "ERNIE 5.0 Thinking", value: "ernie-5.0-thinking-latest", thinking: true },
      // ERNIE X1.1 是文心深度推理线，reasoning 内生 (不支持 thinking_budget)。
      // 不打 thinking 标签:qianfan 走二元 enable_thinking，给内生推理模型发
      // enable_thinking:false 可能被拒;省略即用其默认推理，翻译结果照常返回。
      { label: "ERNIE X1.1", value: "ernie-x1.1" },
      // 128k 已转正，去掉 -preview 后缀
      { label: "ERNIE 4.5 Turbo 128K", value: "ernie-4.5-turbo-128k" },
      { label: "ERNIE 4.5 Turbo 32K", value: "ernie-4.5-turbo-32k" },
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
    defaultUseRelay: false,
    // 来自 https://docs.mistral.ai/models/overview
    // Adjustable reasoning(mistral-medium-3-5 / mistral-small) 通过 reasoning_effort
    // 控制 (docs.mistral.ai/studio-api/conversations/reasoning，取值 high|none，二元 →
    // BINARY_EFFORT_VENDORS)。Large 3 / Ministral 非推理模型。
    // 注：除 medium-3-5(有效可调 id) 外，一律用 `-latest` 别名 —— Mistral 可调
    // API id 是日期版 (mistral-small-2603 等),纯版本号写法 (mistral-small-4) 不可调用。
    // Magistral 线已整体废弃 (magistral-medium-2509 于 2026-07-31 退役),移除。
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
    defaultModel: "grok-4.6",
    defaultTemperature: 0.7,
    docs: "https://docs.x.ai/developers/models",
    apiKeyUrl: "https://console.x.ai/",
    defaultUseRelay: false,
    // Grok 4.6(2026-08 上线,500k 上下文)是当前 frontier 档，与 4.5 同价，设为默认。
    // 只收录 4.6 / 4.5 两档在产 SKU;更早的世代不收录。
    //
    // thinkingLevels 抄自官方逐模型表(docs.x.ai/docs/guides/reasoning,2026-08-20
    // 核对):4.6 收 low/medium/high/xhigh,4.5 收 low/medium/high(xhigh 被当 high,
    // 是静默降级不是报错)。xhigh 不写进表里 —— 我们的 ReasoningEffort 只有三档,
    // 发不出它;哪天 UI 加了档再补。
    // ⚠ off 态【不发 "none"】:官方枚举里没有这个值,且原文明写
    // "Reasoning cannot be disabled" —— 详见 pickThinkingLevel 的注释。
    // (models.dev 给 grok 列过 none,与官方原文冲突,别照它改。)
    models: [
      { label: "Grok 4.6", value: "grok-4.6", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Grok 4.5", value: "grok-4.5", thinking: true, thinkingLevels: ["low", "medium", "high"] },
    ],
  },
  // Perplexity 已【提前下线】(原硬期限 2026-09-27)。整条 Sonar chat/completions
  // 线转 Agent API,官方横幅原文「Sonar Chat Completions is now Agent API. Sonar
  // will be supported until September 27, 2026.」
  //
  // 选择「删除」而不是「迁移」,两条理由:
  //   1. 迁移成本高:Agent API 是 OpenAI【Responses】形状,不是 chat/completions。
  //      URL 变 /v1/agent、`messages`→`input`、`max_tokens`→`max_output_tokens`、
  //      取文本要遍历 output[] 找 type=="output_text",而且它是严格模式 —— 任何
  //      残留字段直接 400,连错误都以 HTTP 200 + status:"failed" 返回。等于要从
  //      openai-compat 降级成手写 kind:"custom" service 并单独做错误判定。
  //   2. 迁移后没有留下来的理由:Sonar 的差异化本来就是「默认联网搜索」,而 Agent
  //      API 把联网改成了显式 opt-in 的 tools。不传 tools 它就只是又一个普通 LLM,
  //      本表里已有十几个。为一个无差异化的 provider 维护全项目唯一一份 Responses
  //      API 解析分支，不划算。
  // 来源:docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview
  cohere: {
    kind: "openai-compat",
    category: "llm",
    label: "Cohere",
    endpoint: "https://api.cohere.ai/compatibility/v1/chat/completions",
    defaultModel: "command-a-plus-05-2026",
    defaultTemperature: 0.7,
    docs: "https://docs.cohere.com/docs/compatibility-api",
    apiKeyUrl: "https://dashboard.cohere.com/api-keys",
    defaultUseRelay: false,
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
    // url 可选：自建中转 (转发到 llm.api.cloud.yandex.net 的自有代理)。
    // 与中转开关正交:url 决定用哪个 endpoint,useRelay 决定走不走中转,二者互不覆盖。
    // endpoints[] 单条,理由同 claude:让官方地址被 classifyEndpointUrl 认出来。
    endpoints: [{ label: "Yandex Cloud", url: "https://llm.api.cloud.yandex.net/v1/chat/completions" }],
    defaults: { url: "", apiKey: "", folderId: "", model: "yandexgpt-5.1", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 50, useRelay: true },
    // Hosted SKUs per aistudio.yandex.ru/docs/en/ai-studio/concepts/generation/models
    // (2026-08-20 逐条核对:下方 10 个 SKU 与官方"Common instance models"表【完全一致】,
    // 既无失效项也无遗漏项,无任何退役标注)。
    // ⚠ 该站对脚本抓取返回验证码页,只能用浏览器打开核对 —— 别因为 curl/WebFetch
    // 拿不到内容就以为它下线了。
    // Yandex 的退役模式是【先替换、再给一个月宽限】(Release Notes:V3.2→V4 Flash、
    // Qwen3.5→Qwen3.6 都是这个节奏),所以盯 Release Notes 比盯模型表更早发现变动。
    // No thinking tags — the OpenAI-compat path documents no reasoning toggle
    // (YandexGPT 5.1's Chain-of-Reasoning isn't exposed as a request param);
    // sending reasoning_effort risks a 400 on a gateway that never documented it.
    // DeepSeek V3.2 已于 2026-06-28 到期 (URI 失效返回 400),由 V4 Flash 取代
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
    defaultUseRelay: false,
    extraHeaders: { "HTTP-Referer": "https://aishort.top", "X-Title": "AIShort" },
    // 选型依据:openrouter.ai/models?order=top-weekly 的周榜前列 —— 免费档
    // (:free 后缀)+ 各家主流旗舰各取若干。不写死数量:清单随榜单增删,
    // 写了必漂(此处曾写"2 个 free+9 个主流",增补后就与实际对不上了)。
    // OpenRouter 统一 reasoning_effort 参数会自动转发底层 provider(Claude→budget_tokens,
    // OpenAI→reasoning_effort,Gemini→thinkingLevel,DeepSeek→thinking 等),所以
    // 底层 model 支持 thinking 的 slug 都标 thinking: true 即可。
    // ⚠ slug 写法不统一，逐个以 /api/v1/models/{slug}/endpoints 实拉为准:
    // Claude 新代是 `anthropic/claude-opus-5`(无小数点),而旧的 opus 4.8 是
    // `anthropic/claude-opus-4.8`(有小数点)。别按一个规律推另一个。
    // ⚠ 「model 存在」≠「能调用」:poolside/laguna-m.1:free 的 model 对象仍在，但
    // endpoints 数组为【空】(0 个 provider)= 实际不可调用，已换成 laguna-s-2.1:free
    // (1 endpoint, prompt $0, 262k 上下文)。核 free SKU 必须打 endpoints 端点,
    // /api/v1/models 全量 JSON 太大会被截断，据它判「不存在」会误删。
    models: [
      { label: "Nemotron 3 Super 120B (free)", value: "nvidia/nemotron-3-super-120b-a12b:free" },
      { label: "Laguna S 2.1 (free)", value: "poolside/laguna-s-2.1:free" },
      { label: "DeepSeek V4 Flash", value: "deepseek/deepseek-v4-flash", thinking: true },
      // preview → 正式版:hy3-preview 在上游标注 2026-08-31 下线，不等它挂。
      // tencent/hy3 已核实有 4 个 status=0 的健康 provider(含腾讯自营),而
      // hy3-preview 只剩 GMICloud 单点供应 —— 单点本身就是随时归零的形态。
      { label: "Hy3", value: "tencent/hy3", thinking: true },
      { label: "Claude Sonnet 5", value: "anthropic/claude-sonnet-5", thinking: true },
      { label: "Claude Opus 5", value: "anthropic/claude-opus-5", thinking: true },
      { label: "Gemini 3.7 Flash", value: "google/gemini-3.7-flash", thinking: true },
      { label: "GPT-5.6 Luna", value: "openai/gpt-5.6-luna", thinking: true },
      // glm-5.3 不打 thinking:上游强制思考、不可禁用,打了标签 off 态会经 OpenRouter
      // 统一参数发 reasoning:{enabled:false},对它是非法请求。同原生 zhipu 的处理。
      { label: "GLM-5.3", value: "z-ai/glm-5.3" },
      { label: "Grok 4.5", value: "x-ai/grok-4.5" },
      { label: "Kimi K2.6", value: "moonshotai/kimi-k2.6", thinking: true },
      // M3 上游默认 adaptive thinking(可关)→ 打标签让 off 态经 OpenRouter
      // 统一参数发 reasoning:{enabled:false},否则默认烧推理 token。
      { label: "MiniMax M3", value: "minimax/minimax-m3", thinking: true },
    ],
  },
  opencode: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenCode Zen",
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
    // ⚠ 需要 apiKey，尽管 zen 的 *-free SKU 匿名直连确实能用 —— 那条路不可依赖:
    // zen 的免费档本来就很容易 429(实测撞过 Retry-After ≈21.6 小时的冷却)，
    // 零配置进来的用户第一次点翻译就吃闭门羹。理由详见 NO_CRED_REQUIRED 的注释。
    //
    // 「需要 key」≠「要花钱」,别把这两件事混起来 (否则下一个人会觉得这里
    // 降级得太狠，又把它挪回 NO_CRED_REQUIRED):官方定价表把 8 个 *-free SKU
    // 标为 Free/Free/Free,填了 key 用它们【依然免费】,key 的门槛是注册 +
    // 绑账单信息 (官方原话 "add your billing details"),不是预付费。填 key
    // 换来的是【额度按账号计】而不是和全站陌生人共享一个 IP。
    //
    // ⚠ CLI【同样需要 key】。技术上那条路本来可行 (Node 无 CORS、useRelay
    // 默认关 → 直连用户自己的 IP，免费 SKU 匿名可用，实测直连 200),但凭证门
    // (validateTranslationInputs → getConfigStatus) 是两个壳共用的一套，退出
    // NO_CRED_REQUIRED 就一起退出了。
    // 【故意不给 CLI 开后门】:开后门要在 registry 里按平台或按 useRelay 分叉
    // 凭证判定，把「这个服务要不要凭证」从一条规则切成两条 —— 代价大于收益，
    // 而 CLI 用户填 key 的成本只是 `--api-key` 或 `-s settings.json`。
    // (曾在 fe250adca 的 commit message 与本注释里声称 CLI 不受影响，那是
    //  未经验证就写下的断言，实测 `yarn cli -m opencode` 直接 exit 2。)
    defaultModel: "deepseek-v4-flash-free",
    defaultTemperature: 0.7,
    docs: "https://opencode.ai/docs/zen/",
    apiKeyUrl: "https://opencode.ai/auth",
    // 上游【完全不发 CORS 头】,且 OPTIONS 预检返回站点 404 HTML(实测 2026-08-06)
    // —— 浏览器直连必死在预检，这也是 Custom(llm) 填 zen 地址走不通的原因。
    // 故默认开 relay;开关保留，上游补 CORS 后用户可自行切回直连。
    defaultUseRelay: true,
    // 模型 id 取自 GET https://opencode.ai/zen/v1/models(实测)。清单只收翻译
    // 用得上的档位，60+ 全量不列 —— model 字段可自由输入，要冷门 SKU 自己填。
    // 不标 thinking:zen 是网关，是否把 reasoning_effort 透传给底层 provider
    // 未经验证，标了就会发未验证的参数。不标 = 不发，安全。
    // GPT-5.x 线故意不收：该线在 OpenAI 侧拒 temperature(见 openai spec 省略
    // defaultTemperature 的理由),而 zen 是否代为剥离无法在匿名下验证 —— 收进
    // 清单等于把一个未验证的 400 风险摆到默认下拉里。要用自行填 model。
    // 2026-08 复核:ling-3.0-flash-free 与 longcat-2.0-free 已从 /v1/models 消失
    // (连不带 -free 的同名 SKU 也搜不到),移除;当前 6 个 -free SKU 已全部收录。
    models: [
      { label: "DeepSeek V4 Flash (free)", value: "deepseek-v4-flash-free" },
      { label: "Big Pickle (free)", value: "big-pickle" },
      { label: "MiMo V2.5 (free)", value: "mimo-v2.5-free" },
      { label: "Hy3 (free)", value: "hy3-free" },
      { label: "Nemotron 3 Ultra (free)", value: "nemotron-3-ultra-free" },
      { label: "Nemotron 3.5 Lightning (free)", value: "nemotron-3.5-lightning-free" },
      { label: "Laguna S 2.1 (free)", value: "laguna-s-2.1-free" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5" },
      { label: "Claude Sonnet 5", value: "claude-sonnet-5" },
      { label: "Claude Opus 5", value: "claude-opus-5" },
      { label: "Gemini 3.6 Flash", value: "gemini-3.6-flash" },
      { label: "Kimi K2.6", value: "kimi-k2.6" },
      { label: "GLM 5.2", value: "glm-5.2" },
      { label: "Qwen3.6 Plus", value: "qwen3.6-plus" },
    ],
  },
  tokenhub: {
    kind: "openai-compat",
    category: "aggregator",
    label: "TokenHub (Tencent)",
    // 已从原混元平台迁到 TokenHub。决定性依据是 TokenHub 迁移指南
    // (document/product/1823/131382,更新于 2026-08-05) 的这句:
    //   「hunyuan-t1-latest、**hunyuan-a13b**、hunyuan-turbos-latest、hunyuan-lite、
    //     hunyuan-translation、hunyuan-translation-lite、hunyuan-large-role-latest,
    //     TokenHub 将不再支持,建议您切换到 TokenHub 时改为使用更新的模型」
    // 即 a13b 【没有迁移路径】—— 它不会出现在新平台上(模型列表 1823/130051 里
    // 确实没有它)。叠加同一份指南的「原平台……停止新购模型服务」:对一个面向公众
    // 的工具来说,【新用户已经开通不了 a13b】,留着等于给新人一个开不了的选项。
    //
    // ⚠ 别把这条写成"旧端点 9-30 就死了" —— 曾经这么写过,是【推断不是事实】:
    // 公告里「9 月 30 日全面停服」那句链接指向的是混元【模型广场 web 控制台】,
    // 并未点名 API host;实测 2026-08-19 旧端点 api.hunyuan.cloud.tencent.com
    // 仍正常应答。迁移不靠那个日期成立,靠的是上面「a13b 无迁移路径 + 新用户
    // 开不了」。
    //
    // 回滚的话把 endpoint / defaultModel / models 与 worker 路由一起改回去即可,
    // 没有其他耦合 —— 但回滚等于把 provider 钉死在一个新用户拿不到的模型上。
    //
    // ⚠ 这里托管 9 个模型,只有 hy3 是腾讯自研,其余来自 deepseek/glm/kimi/
    // minimax/mimo 五家 —— 按多厂商托管归 aggregator,与 opencode/siliconflow 同类。
    endpoint: "https://tokenhub.tencentmaas.com/v1/chat/completions",
    defaultModel: "hy3",
    defaultTemperature: 0.7,
    // ⚠ TokenHub 光有 API Key 【调不通】:每个模型要先在控制台「在线推理」页
    // 开通(开启免费体验 / 启用后付费),否则任何调用返回 400 gateway_error
    // code 401006「输入的服务 ID 不存在，或模型与服务不匹配」。
    // 实测 2026-08-19:key 有效(无效 key 报的是 401 而非 400),模型也确实在
    // /v1/models 目录里且 status=online,hy3 / deepseek-v4-flash / glm-5.2 /
    // kimi-k2.6 四个全部同样 401006 —— 即账号一个都没开通。
    // ⚠ 文档之间不一致，别被带偏:《混元调用指南》(1823/132252) 的「前提条件」
    // 只写了「注册账号 + 获取 API Key」,【没提】开通这一步;写了的是《迁移指南》
    // (1823/131382) 的第一步。按实际行为，开通是必须的。
    // 请求形状本身没问题:model 填模型 ID(不是"服务 ID"),与 132252 的官方 curl
    // 示例逐字段一致 —— 用 OpenAI SDK 走 baseURL 也是发同一个请求,不会有差别。
    // 这跟绝大多数 provider「填了 key 就能用」的心智不同 —— 用户配好 key 仍然
    // 400 时，八成是没开通，不是我们的 bug。docs 指向调用概览,apiKeyUrl 指向
    // 控制台(开通与建 key 都在那里)。
    docs: "https://cloud.tencent.com/document/product/1823/130079",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/apikey",
    // 浏览器直连不可用 —— 2026-08-19 在【真实浏览器 + 生产 origin】上实测,
    // 不是 curl 推断(前两版结论都是靠 curl 猜的，都写错过):
    //   POST 广州 / POST 新加坡 / GET /v1/models 带 Authorization / 不带任何
    //   自定义头的简单 GET —— 四种全部 `TypeError: Failed to fetch`。
    // 对照组同页跑，排除了网络与代理干扰:api.github.com(ACAO:*) 200、
    // 我方 llm-proxy Worker 200、tokenhub 的 no-cors 请求不抛错(主机可达)。
    // 即:主机通、浏览器跨域能力正常，就是被 CORS 拦的。
    //
    // 机制(别再只拿错误响应去验 CORS,会得出相反结论):
    //   - TokenHub 【只在应用层成功响应上】发 CORS 头 —— 带有效 key 的
    //     GET /v1/models 200 确实带 `Access-Control-Allow-Origin: *`。
    //   - 但所有错误路径(401/400)与 `OPTIONS`(全路径 405)都【不发】CORS 头。
    //   - 带 Authorization 的请求必然触发预检 → 预检非 2xx → 浏览器当场掐断,
    //     永远走不到那个会放行的成功响应。
    // 故 relay 是必需路径。上游哪天补上 OPTIONS 处理就能直连,开关照旧留给用户。
    defaultUseRelay: true,
    // 两个地域都经中转:客户端把选中的节点作为 ?endpoint= 传给 Worker,后者从
    // 自己声明的集合里校验并转发。这两个 URL 必须与 worker 的 tokenhub 数组一致。
    // ⚠ 【API Key 是分地域的】,换地域要换 key:2026-08-19 同一把广州 key 经中转
    // 对两个地域实测(当时经由旧版按地域分路由的 worker;现行契约是
    // /api/tokenhub?endpoint=<所选地域>,结论不变)——广州节点返回 401006
    // (key 有效、模型未开通),新加坡节点返回 401002「API Key 不存在或签名校验
    // 失败」。所以切到国际站后若报 401002,不是中转坏了,是那把 key 不属于该地域。
    endpoints: [
      { label: "Mainland (CN)", url: "https://tokenhub.tencentmaas.com/v1/chat/completions" },
      { label: "International", url: "https://tokenhub-intl.tencentmaas.com/v1/chat/completions" },
    ],
    // ⚠⚠ 本条 endpoint 改动【必须同步重新部署 Cloudflare Worker】:
    // scripts/llm-proxy-worker.js 的 PROVIDER_URLS.tokenhub 已在同一 commit 里
    // 指向 TokenHub,但那是【部署源】,不重新部署的话线上 Worker 仍然把
    // /api/tokenhub 转发到旧域 —— 而 relay 是本 provider 的默认路径,等于所有
    // 默认配置的用户拿 hy3 去打老平台，必失败。workerParity.test.ts 只能保证
    // 仓库里两处一致，保证不了线上那份。
    //
    // model id 以 TokenHub 模型列表 (document/product/1823/130051) 为准:
    // `hy3` 256k(最大输入 192k / 输出 128k),无下线标注;`hy3-preview` 同规格但
    // 标注「(2026-08-31 下线)」,不收。
    //
    // ⚠ 混元的【专用翻译模型】(hy-mt2-pro/plus/lite) 【刻意不收】。它们确实在同一个
    // /v1/chat/completions 端点上、同样的 messages 形状，看起来一行就能加进来,
    // 但规格上就不适合本项目这条管线 —— 模型列表原文:三者都是 **8k 上下文,
    // 最大输入/输出各 4k**。而这里的默认是 contextWindow 50 行 + 系统提示词 +
    // 术语表,4k 输入上限会直接顶爆。别再"顺手补上"这几个 SKU:端点兼容 ≠ 能塞进
    // 按通用对话模型设计的管线(提示词/术语表/上下文窗口/双语装配)。
    // 真要支持专用 MT,应该按 machine-translation 类别另起一个 provider。
    //
    // TokenHub 是【聚合网关】,除自研 hy3 外还转售 deepseek / glm / kimi / minimax /
    // qwen / mimo,所以按本表其他聚合网关(openrouter / opencode / siliconflow /
    // atlascloud / nvidia)的一贯做法把主流型号列出来 —— 一个 key 一份额度就能用到
    // 这些模型，正是聚合网关的价值所在;"那几家各自有一手 provider" 不构成不列的
    // 理由(否则 openrouter 那份清单也不该存在)。
    // 未收录的:hy3-preview(8-31 下线)、hy-mt2-*(见上)、glm-5v-turbo(视觉)、
    // hunyuan-role-latest / hy-role(角色扮演)、kimi-k2.7-code*(代码向)、
    // 带日期的 deepseek-v4-*-2026xx(裸 id 已在)。
    //
    // ⚠ 全部【不打 thinking 标签】,同 atlascloud 的处理:这是个混合上游的网关,
    // 「能不能关思考」逐个模型不同 —— TokenHub 模型支持表里 hy3 默认 disabled,
    // 而 Kimi-K2.7-Code / MiniMax-M2.7 明确标「enabled(不支持关闭)」。没有逐个
    // 核实之前，统一发 thinking:{type:"disabled"} 会打到不支持关闭的那些型号上。
    // 代价要说清楚:选 deepseek-v4 / glm-5.3 / kimi-k3 这类服务端默认开推理的型号,
    // 在这里会按它自己的默认推理(比一手 provider 多烧 token)—— 要精确控制思考,
    // 用本表里对应的一手 provider。
    // 将来要在这里做开关的话:网关级字段是 thinking:{type:"enabled"|"disabled"|
    // "adaptive"}(文档 1823/135872),需要先核出【每个型号】支不支持 disabled。
    //
    // Not thinking-tagged,但理由跟别处不同 —— 不是"不能关",而是"本来就是关的"。
    // 官方《OpenAI Chat Completions 协议字段说明》(1823/135872) 对 hy3 原文:
    // 「默认关闭思考，默认推理强度 `low`」,`thinking.type` 合法取值三个:
    // `enabled` / `disabled` / `adaptive`。
    // 既然服务端默认就是关的,省略参数 = 不推理 = 翻译要的行为,不打标签最省事,
    // 也不会像 SERVER_DEFAULT_THINKING_ON 那几家一样偷烧推理 token。
    //
    // 要加思考开关是可行的(三个取值都合法),代价是三处:models 里给 hy3 打
    // `thinking: true`、THINKING_BUILDERS 加一条 `gated("tokenhub", thinkingType)`、
    // 把 tokenhub 放进 BINARY_EFFORT_VENDORS;另外 thinking.test.ts 里
    // 「tokenhub & minimax M2.x send no thinking body」那条断言要跟着改。
    // ⚠ 别用 `reasoning_effort:"none"` —— TokenHub 只列了 low/medium/high。
    // 清单以 `GET /v1/models` 实拉为准(带 `status` 字段,比翻文档准):只收
    // status="online" 的文本对话模型,"pre-offline" 的一律不收 —— 2026-08-19 实测
    // hy3-preview / kimi-k2.5 / minimax-m2.5 / qwen3.5-plus / qwen3.5-flash /
    // deepseek-v3.2 都已是 pre-offline。
    // 另外排除:*-code(代码向)、glm-5v-turbo(视觉)、hy-role/hunyuan-role(角色)、
    // hy-mt2-*(见上)、embedding/video/image/3d/asr/speech 各类非对话模型。
    models: [
      { label: "Hunyuan hy3", value: "hy3" },
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      { label: "GLM-5.3", value: "glm-5.3" },
      { label: "GLM-5.2", value: "glm-5.2" },
      { label: "Kimi K3", value: "kimi-k3" },
      { label: "Kimi K2.6", value: "kimi-k2.6" },
      { label: "MiniMax M3", value: "minimax-m3" },
      { label: "MiMo V2.5 Pro", value: "mimo-v2.5-pro" },
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
    defaultUseRelay: false,
    // 来自 console.groq.com/docs/models 当前 production 列表。preview 阶段的不收录，
    // 避免引导用户选随时可能下线的 SKU。
    // gpt-oss 系列支持 reasoning_effort(top-level enum),其他 model 不支持。
    // llama-3.3-70b-versatile / llama-3.1-8b-instant 已于 2026-08-16 退役
    // (console.groq.com/docs/deprecations),官方替代分别是 gpt-oss-120b / gpt-oss-20b
    // —— 两者本来就在清单里，所以是纯删除，不需要补位。
    // 删完 production 文本模型只剩 gpt-oss 两档 + compound 两个 system:Groq 当前
    // 的 production 层就这么大，其余全在 preview 层，不收。
    models: [
      // thinkingLevels:console.groq.com/docs/reasoning(2026-08-20 核对)——
      // gpt-oss 只收 low/medium/high,【没有 none】("none" 仅 Qwen 3.6 27B 支持)。
      // 与 gemini/grok 同族:厂商不提供关闭开关,关闭态发最低档 low。
      // ⚠ 曾经关闭态【省略】该参数 —— 那是落到服务端默认(未文档化,gpt-oss
      // 惯例是 medium),用户点了"关"却按中档推理计费,方向正好反了。
      { label: "GPT-OSS 20B", value: "openai/gpt-oss-20b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-OSS 120B", value: "openai/gpt-oss-120b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Groq Compound", value: "groq/compound" },
      { label: "Groq Compound Mini", value: "groq/compound-mini" },
    ],
  },
  cerebras: {
    kind: "openai-compat",
    category: "aggregator",
    label: "Cerebras",
    endpoint: "https://api.cerebras.ai/v1/chat/completions",
    defaultModel: "gpt-oss-120b",
    defaultTemperature: 0.7,
    docs: "https://inference-docs.cerebras.ai/models/overview",
    apiKeyUrl: "https://cloud.cerebras.ai/",
    defaultUseRelay: false,
    // 收录它【不是为了模型】—— 两个公共模型(gpt-oss-120b / gemma-4-31b)在
    // groq、nvidia、siliconflow 上都能调到。卖点是【速度】:官方标称
    // ~3000 tokens/s(gpt-oss-120b),约为 groq 同款的三倍;逐行翻译是高频短
    // 请求,吞吐直接变成用户感知的等待时间。另有每日 100 万 free token。
    // 同一个开源模型在不同厂商下速度/价格不同,本就是并存多个聚合器的理由。
    //
    // 清单以官方 Model Catalog 为准(inference-docs.cerebras.ai/models/overview,
    // 2026-08-20 核对):public endpoints 就这两个,其余在 Dedicated Endpoints
    // (需预留产能,不是个人自助能用的),不收。
    // ⚠ /v1/models 需鉴权,无法免 key 实拉;复查请读上面的 Model Catalog 页
    // (它有 llms.txt 机器可读索引)。
    models: [
      // thinkingLevels 抄自官方 API 参考的逐模型 reasoning_effort 取值
      // (2026-08-20):gpt-oss-120b 收 low/medium(默认)/high —— 【没有 none】,
      // 与 groq 上的同款一致,故关闭态发最低档 low(canDisableThinking→false,
      // 界面标 Min)。gemma-4-31b 则【有 none】且是默认值,属于能真正关掉的一档,
      // 所以它不声明 thinkingLevels、走 reasoningEffortOrNone 那条路。
      { label: "GPT-OSS 120B", value: "gpt-oss-120b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      // 打 thinking 标签:它【支持】reasoning_effort(none 默认/low/medium/high)。
      // 不打的话 gated() 会把它当"已知非思考模型"直接省略参数 —— 而 none 是
      // 它的服务端默认,省略与发 none 恰好等效,所以漏打不会出错、只会让用户
      // 无法开启思考(下拉里没有档位控件)。不声明 thinkingLevels:它有真正的
      // 关闭值,走 reasoningEffortOrNone 那条路(见 llm.ts 的 cerebras builder)。
      { label: "Gemma 4 31B", value: "gemma-4-31b", thinking: true },
    ],
  },
  siliconflow: {
    kind: "openai-compat",
    category: "aggregator",
    label: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    defaultTemperature: 0.7,
    docs: "https://docs.siliconflow.cn/cn/api-reference/chat-completions/chat-completions",
    apiKeyUrl: "https://cloud.siliconflow.cn/me/account/ak",
    defaultUseRelay: false,
    // 来自 siliconflow.com/pricing 当前文本生成模型表
    // 登录后查看 https://cloud.siliconflow.cn/me/models?types=chat
    // DeepSeek V4 和 Kimi K2.6 通过 SiliconFlow 走 OpenAI-compat 协议
    // (同原生 DeepSeek/Moonshot 的 thinking + reasoning_effort 参数)。
    // ⚠ SiliconFlow 的 id 大小写与前缀都很挑，写错就是 404,一律以 pricing 页
    // 实际字串为准:
    //   - org 前缀是 MiniMaxAI(非 minimax),小写会 404
    //   - 部分模型【只有 `Pro/` 付费档】,不存在裸 id —— 2026-08 复核发现
    //     GLM-5.1 与 Kimi-K2.6 都属此列,原先写的裸 id 一直是无效的
    //   - GLM-4.7 已从 pricing 页下架，移除
    // 明确核过【不在】SiliconFlow 上:MiniMax-M3、GLM-5.3、Qwen3.8 —— 别照着别家
    // 的清单往这里搬。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/DeepSeek-V4-Flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-ai/DeepSeek-V4-Pro", thinking: true },
      { label: "Kimi K2.6 (Pro)", value: "Pro/moonshotai/Kimi-K2.6", thinking: true },
      { label: "GLM-5.2", value: "zai-org/GLM-5.2" },
      { label: "GLM-5.1 (Pro)", value: "Pro/zai-org/GLM-5.1" },
    ],
  },
  atlascloud: {
    kind: "openai-compat",
    category: "aggregator",
    label: "Atlas Cloud",
    endpoint: "https://api.atlascloud.ai/v1/chat/completions",
    defaultModel: "deepseek-ai/deepseek-v4-flash",
    defaultTemperature: 0.7,
    docs: "https://www.atlascloud.ai/docs",
    apiKeyUrl: "https://www.atlascloud.ai/console/api-keys",
    defaultUseRelay: false,
    // Atlas Cloud exposes a shared OpenAI-compatible endpoint for its hosted
    // text models. Keep thinking controls hidden because support and request
    // shape vary by the selected upstream model.
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/deepseek-v4-flash" },
      { label: "GLM-5.2", value: "zai-org/glm-5.2" },
      { label: "Qwen3.8 Max", value: "qwen/qwen3.8-max" },
    ],
  },
  // GitHub Models(models.github.ai)已整家退役 —— 2026-07-30 官方 changelog
  // 「GitHub Models is now retired. The playground, model catalog, inference API,
  // and bring your own key (BYOK) are no longer available to any customer」,
  // catalog 端点实测 HTTP 410 Gone。整个 provider 已删除，不是删几个模型:
  // 它没有任何可替换的端点，留着等于给用户一个必定失败的选项。
  // 官方迁移指向 Azure AI Foundry(本表里的 azureopenai)。
  nvidia: {
    kind: "custom",
    category: "aggregator",
    label: "Nvidia NIM",
    docs: "https://build.nvidia.com/explore/discover",
    apiKeyUrl: "https://build.nvidia.com/",
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v4-flash-0731", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 50 },
    // model id 一律以 integrate.api.nvidia.com/v1/models 实拉为准 ——
    // build.nvidia.com 展示页的 slug 跟真实 id 不是一回事，别照着网页抄。
    //
    // ⚠ 2026-08 核查发现两个 id 已失效，其中一个还是【默认模型】(整个 provider
    // 开箱即 404):
    //   - deepseek-ai/deepseek-v4-flash → 现在只有带日期的 `-0731`,裸 id 不存在
    //   - deepseek-ai/deepseek-v4-pro   → NIM 上【完全没有】V4 Pro
    // 该前缀下如今只剩 deepseek-coder-6.7b-instruct 与 deepseek-v4-flash-0731。
    //
    // 随 v4-pro 移除，本 provider 已【没有任何】thinking 模型 —— NIM 的 thinking
    // 注入是 DeepSeek 专属的 chat_template_kwargs.thinking + reasoning_effort 嵌套，
    // 只对 v4-pro 有意义。故 defaults 里的 thinkingEffort 一并删掉(留着是死配置,
    // 且会让 UI 以为这个 provider 有思考能力)。要 thinking 走原生 DeepSeek provider;
    // 将来 NIM 上了可控推理的 SKU 再连标签一起加回。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/deepseek-v4-flash-0731" },
      { label: "Nemotron 3 Ultra 550B", value: "nvidia/nemotron-3-ultra-550b-a55b" },
      { label: "GLM-5.2", value: "z-ai/glm-5.2" },
      // gpt-oss 不打 thinking:nvidia 的注入是 DeepSeek 专属 chat_template_kwargs
      // 嵌套，发给 gpt-oss 是错误形状;其推理本就默认开 (medium),省略即正确。
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
    docs: "https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure",
    // 无 temperature 字段：微软官方把 temperature 列入 reasoning 模型 Not
    // Supported 清单 (GPT-5 全系，learn.microsoft.com/azure/ai-foundry/openai/
    // how-to/reasoning),运行时证据为 400;统一 provider 级不发。
    defaults: { url: "", apiKey: "", model: "gpt-5.4-mini", apiVersion: "2025-11-18", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
    // GPT-5 系列全部支持 reasoning(OpenAI 原生 + Azure 镜像同行为)。
    // gpt-chat-latest 是 5.5 Instant 别名 (per Azure docs),同样支持;2026-08 复核
    // 别名指向未变，但它现在明确标 Preview 且滚动更新(最新快照 2026-08-06 把上下文
    // 从 128k 提到 400k)—— 选它要接受行为随时变。
    //
    // GPT-5.6 系列 (sol/terra/luna) 已在 Azure GA(doc 标 NEW,2026-07-09 快照,
    // 1,050,000 上下文)。⚠【故意不设为默认】:官方原文「Some quota tiers require
    // quota requests for gpt-5.6 to deploy this model. Tier 5 and Tier 6
    // subscriptions have quota by default」—— 低配额订阅要先申请才能部署，设成默认
    // 会让一部分用户开箱即失败。默认保持 gpt-5.4-mini。
    //
    // ⚠ apiVersion「2025-11-18」已是过时写法:Azure 已切到 v1 GA API,原文
    // 「api-version is no longer a required parameter with the v1 GA API」,
    // 新形态是 base 走 /openai/v1/ 且不传 api-version。改这个要动 services 层的
    // URL 组装，不在本次模型清单更新范围内 —— 单独处理。
    models: [
      { label: "GPT-5.6 Sol", value: "gpt-5.6-sol", thinking: true },
      { label: "GPT-5.6 Terra", value: "gpt-5.6-terra", thinking: true },
      { label: "GPT-5.6 Luna", value: "gpt-5.6-luna", thinking: true },
      { label: "GPT-chat-latest", value: "gpt-chat-latest", thinking: true },
      { label: "GPT-5.5", value: "gpt-5.5", thinking: true },
      { label: "GPT-5.4", value: "gpt-5.4", thinking: true },
      { label: "GPT-5.4 Mini", value: "gpt-5.4-mini", thinking: true },
      { label: "GPT-5.4 Nano", value: "gpt-5.4-nano", thinking: true },
    ],
  },
  // LiteLLM 曾在这里是独立 provider,已并入 llm(Custom)的端点芯片。理由是它
  // 与 Together AI / Fireworks AI 是同一类东西 —— "一个 OpenAI 兼容地址 + 一份
  // 文档",而那两家一直就只是芯片。独立槽位换来的只是一份可以并存的存档,代价
  // 是下拉里多一项、配置要填两遍、还得单独维护一套 provider 级注册(凭据分类、
  // preflight 名单、UI 顺序)。芯片各自带 docs 之后,独立 provider 的最后一点
  // 好处(有文档链接)也没有了。
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
    // (TranslateGemma 与 MiLMMT 各有专用 service,不要走 Custom —— 它们的提示词
    // 格式是模型卡钉死的,而 Custom 必发 system 消息。MiLMMT 尤其糟:它的 chat
    // template 是纯拼接,system prompt 不会报错,只会被当正文喂进去。)
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
    // 每个芯片背后是一个独立产品，所以各带各的 docs —— provider 级的一条链接
    // 在这里没有意义（"Custom" 没有文档），而这条路恰恰最需要文档:用户得先照着
    // 上游的说明把服务跑起来、把地址和模型名弄对。链接一律写最终落点(2026-08-21
    // 实测跟随重定向确认,无 locale 段；koboldcpp 于 2026-08-22 补验)。
    // 前四个本地运行时芯片与 translategemma / milmmt 完全一致（含 docs），
    // 改其中一家就三家一起改 —— 同一个用户会在它们之间来回切。
    endpoints: [
      // Local runtimes first, self-hosted gateway next, cloud aggregators after.
      ...LOCAL_RUNTIME_ENDPOINTS,
      // LiteLLM 曾是独立 provider,合并进来了:它和 Together / Fireworks 一样,
      // 无非是"一个 OpenAI 兼容地址 + 一份文档",而后两者一直就是芯片。
      // 独立 provider 只多给一个存档槽位,却要多占一个下拉项、多一份重复配置。
      { label: "LiteLLM", url: "http://127.0.0.1:4000/v1/chat/completions", docs: "https://docs.litellm.ai/docs/" },
      { label: "Together AI", url: "https://api.together.xyz/v1/chat/completions", docs: "https://docs.together.ai/docs/inference/openai-compatibility" },
      { label: "Fireworks AI", url: "https://api.fireworks.ai/inference/v1/chat/completions", docs: "https://docs.fireworks.ai/tools-sdks/openai-compatibility" },
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
 * 不支持术语表的服务 (denylist)——没有任何「模型内」术语执行通道的纯 MT:
 * 既不吃 systemPrompt 术语块 (LLM 全系),也没有原生术语参数 (qwenMt 的
 * translation_options.terms)。这些服务只有事后的漏翻兜底网，UI 展示术语表
 * 入口会让用户误以为有完整执行能力。其余服务默认支持;新增无术语通道的 MT
 * 服务时在这里登记。
 */
export const GLOSSARY_UNSUPPORTED: ReadonlySet<string> = new Set(["gtxFreeAPI", "edgeFreeAPI", "google", "deepl", "deeplx", "azure", "translategemma", "milmmt", "webgoogletranslate"]);

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
export const URL_IS_PRIMARY_CRED: ReadonlySet<string> = new Set(["llm", "translategemma", "milmmt"]);

// 注:曾短暂给厂商 provider 取消过自由填 URL 的输入框(只留 endpoints 标签),
// 已【撤销】—— 总有自建代理 / 特殊网络的用户需要指一个别的地址,堵死这个口子
// 得不偿失。官方变体走 endpoints 标签，自由填的口子同时保留，两者不冲突:
// 标签选中的地址会被 resolveEndpoint 认出是官方变体(见 services/llm.ts),
// 与中转开关互不干涉:开着就经中转转发到它,关着就直连过去。

/**
 * Services that work with zero user configuration because they fall back to a
 * public/shared endpoint when no credentials are supplied:
 *   - gtxFreeAPI: hits Google's translate-pa gateway with the public te_lib key
 *   - edgeFreeAPI: hits Microsoft Edge's free translator (auto-issued JWT)
 *   - deeplx: empty URL falls back to our public THIRD_PARTY_ENDPOINTS.deeplx
 *
 * ⚠ 不是「上游有免费档」就能进来 —— 判据是【浏览器里那条零配置路径真的能跑】，
 * 而且要能稳定地跑。opencode 曾短暂进过这个集合:zen 的 *-free SKU 匿名直连实测
 * 200(2026-08-06),看起来完美符合。但 zen 的免费档本来就很容易 429(实测撞到过
 * FreeUsageLimitError、Retry-After 77681 秒 ≈21.6 小时),而这个集合的语义是
 * 「零配置也能直接用」—— 一次成功的探测不等于这条路可依赖。
 * 三个留下的成员没有这个问题：各自要么公共端点无额度概念，要么按请求放行。
 *
 * 退出本集合是【两个壳一起退出】的：凭证门 getConfigStatus 由网页与 CLI 共用，
 * 所以 `yarn cli -m opencode` 也会要 key(实测 exit 2)。想按平台/按 useRelay
 * 分叉判定的话，「这个服务要不要凭证」就从一条规则变成两条 —— 有意不做。
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
 *   - llm, translategemma, milmmt: self-hosted (LM Studio / llama.cpp / vLLM / LiteLLM
 *     proxy) — "server not running" / wrong URL is a NETWORK error (no
 *     auth-abort), and the probe hits the user's own machine, so it's free.
 *     (指向 LiteLLM 之类网关时,probe 会经它转发到上游，严格说花一次微量补全;
 *     但网关挂掉 / 地址错才是这条路的主导故障，不 probe 就逐行慢失败。)
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
 * self-hosted `llm` (no paid cloud LLM is probed). validate()'s smart gate still
 * PROCEEDS (not blocks) on transient 429/5xx from these — the probe only
 * HARD-blocks definitive failures.
 */
export const PREFLIGHT_PROBE_METHODS: ReadonlySet<string> = new Set(["deepl", "deeplx", "llm", "gtxFreeAPI", "edgeFreeAPI", "translategemma", "milmmt"]);

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

/**
 * apiKey 是否【可选】——「这个方法要不要用户填 key」的单一判据，两个集合的并。
 *
 * ⚠ 与 getConfigStatus 的关系：后者【不能】复用它。getConfigStatus 需要把两个
 * 集合【分开】看 (NO_CRED_REQUIRED → "free";URL_IS_PRIMARY_CRED → 看 url 填没填),
 * 合成 OR 会丢掉这个区别。这里回答的是另一个问题:"空 apiKey 该不该拦"。
 *
 * 消费者：服务层的 openAICompatRequest、设置表单的保存校验、状态块的
 * apiKey 输入框可见性。它们此前各自只查 URL_IS_PRIMARY_CRED —— 今天行为
 * 恰好正确，只因三个 NO_CRED_REQUIRED 服务的 defaults 里都没有 apiKey 字段;
 * 一旦某个免配置服务【带】可选 apiKey(opencode 曾经就是这个形状),表单就会
 * 用 "enterApiKey" 拦住一个旁边正标着「free」的服务。
 */
export const isApiKeyOptional = (method: string): boolean => NO_CRED_REQUIRED.has(method) || URL_IS_PRIMARY_CRED.has(method);

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
  // url 对 openai-compat 一律存在(空 = 官方默认端点)。它同时承载三种取值:
  // 官方变体(endpoints 标签写入)与真自定义地址(逃生口 —— DeepSeek 判例证明
  // 上游按 origin 拦截无法预判,故人人都有,不再逐条 opt-in)。语义判定统一走
  // classifyEndpointUrl。
  base.url = "";
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
 * Claude's adaptive-thinking generation (Opus 5, Opus 4.7/4.8, Sonnet 5, Fable 5,
 * Mythos). These models use `thinking:{type:"adaptive"}` + `output_config.effort`,
 * and REJECT the legacy manual `budget_tokens` shape with a 400. Substring regex so
 * dated snapshot ids (claude-sonnet-5-20260203) still match.
 * ⚠ 新增 Claude SKU 时【必须】同步这条正则 —— 漏了就会给一个 adaptive 世代的
 * 模型发 budget_tokens,整个 provider 对该 model 恒 400(claude-opus-5 上线时
 * 就是这么漏的)。
 * Doc: platform.claude.com/docs/en/build-with-claude/adaptive-thinking
 * Consumed by services/llm.ts to pick the thinking wire shape.
 */
// 正则单独导出:同步给下游的 provider 目录要带上它的 source —— 这条「按模型名
// 判代」的规则是【厂商事实】,而且【只能按名字判】(用户手填的 SKU 不在任何清单
// 里),所以下游各写一份必然漂。已经漂过一次:某次精简把 4.7/4.8 从下游那份删了,
// 而官方明写 4.7 及以后【拒收】budget_tokens —— 手填 opus-4-8 直接 400。
export const ADAPTIVE_THINKING_CLAUDE_RE = /claude-(opus-5|opus-4-[78]|sonnet-5|fable-5|mythos)/;
export const isAdaptiveThinkingClaude = (model: string): boolean => ADAPTIVE_THINKING_CLAUDE_RE.test(model);

/**
 * adaptive 世代里【关不掉】思考的那一支:Fable 5 与 Mythos 全系。官方逐模型表
 * 把它们标成 "Always on",并明写 `thinking:{type:"disabled"}` 回 400 —— 而同代
 * 的 Opus 5 / Sonnet 5 是接受的("On" 而非 "Always on")。所以「关闭思考」在这
 * 一支上只能是【整个 thinking 字段都不发】,让服务端默认(始终思考)生效。
 * ⚠ 连带影响 max_tokens:这支即便用户选了「关」也仍在思考,思考 token 计入
 * max_tokens,按不思考的额度发会撞 stop_reason:"max_tokens"。
 * Doc: platform.claude.com/docs/en/build-with-claude/thinking-troubleshooting
 *      (Configurations each model rejects 一表)
 */
export const ALWAYS_THINKING_CLAUDE_RE = /claude-(fable-5|mythos)/;
export const isAlwaysThinkingClaude = (model: string): boolean => ALWAYS_THINKING_CLAUDE_RE.test(model);

/**
 * 按【逐 SKU 档位表】解析该发哪个思考档位。表在 models[].thinkingLevels(抄自
 * 厂商官方逐模型表),消费方:gemini / grok / groq / moonshot(kimi-k3) / cerebras
 * —— 它们都属于「档位集合逐 SKU 不同、且厂商不提供关闭开关」这一类。
 *
 *   · want 省略 = 用户把思考【关掉】了。这几家官方都【没有】关闭开关
 *     (Gemini 3 的 thinkingBudget 已是遗留参数;xAI 明写 "Reasoning cannot be
 *     disabled"),所以最低档就是能做到的"最关"。⚠ 别退回去发厂商枚举里没有的
 *     值当"关":要么被拒(默认态每请求 400),要么被忽略(那就是按【服务端默认】
 *     的高档位静默计费 —— DeepSeek「10M tokens」事故就是这个形态)。
 *   · want 给了但该 SKU 不收 → 降到它收的、不高于 want 的最高档。
 *
 * ⚠ 未列出的 SKU(用户手填)用调用方给的 fallback,不硬降用户显式选的档位
 * (选了 custom 自己负责)。
 * ⚠ 曾用正则近似这些表(按名字判 -pro / 硬编码 grok-4.3),两个毛病:按名字归并
 * 会把合法档位静默降级(gemini 3.1-pro 的 medium 官方接受,却被降成 low);而且
 * 其中一个词边界转义在搬迁中被写成了不可见控制字符,那个分支从此静默失效。
 * 表就在数据里,别再回到正则。
 */
const THINKING_LEVEL_ORDER = ["minimal", "low", "medium", "high"] as const;
type ThinkingLevel = (typeof THINKING_LEVEL_ORDER)[number];
const DEFAULT_THINKING_LEVELS: ReadonlyArray<ThinkingLevel> = ["low", "medium", "high"];

export const pickThinkingLevel = (service: string, model: string, want?: ReasoningEffort, fallback: ReadonlyArray<ThinkingLevel> = DEFAULT_THINKING_LEVELS): string => {
  const levels = getProviderModels(service).find((m) => m.value === model)?.thinkingLevels ?? fallback;
  if (!want) return levels[0];
  if (levels.includes(want)) return want;
  const wantIdx = THINKING_LEVEL_ORDER.indexOf(want);
  const lower = levels.filter((l) => THINKING_LEVEL_ORDER.indexOf(l) <= wantIdx);
  return lower.length ? lower[lower.length - 1] : levels[0];
};

/**
 * 未列出的 SKU(用户手填)的回落档位。三家的官方表里在列模型都收这三档,所以
 * 是同一个默认值 —— 曾经给每家包了一个只是换服务名的 helper,三份完全一样。
 * 哪家将来出现不同的回落集合,给它单独传 fallback 即可。
 */
/**
 * 该 provider【能不能真的关掉】思考。
 *
 * 判据从 models[].thinkingLevels 派生,不另立手维护清单:声明了档位表 =
 * 这家把思考表达成"档位"而【没有关闭值】(gemini / grok / groq 的官方文档都
 * 明确如此),我们能做到的最"关"就是发最低档 —— 仍在推理、仍在计费。
 *
 * 界面据此把该档标成「最低」而不是「关闭」:用户关思考的动机正是省时间和
 * token,标成 Off 却照常推理是在撒谎,而且是计费可见的那种。
 * 其余厂商有真正的关闭值(reasoning_effort:"none" / thinking:{type:"disabled"}
 * / enable_thinking:false),Off 名副其实。
 */
export const canDisableThinking = (service: string): boolean => !getProviderModels(service).some((m) => m.thinkingLevels?.length);

/**
 * 同一个问题的【逐 SKU】答案 —— 界面要用的是这个，provider 级那个是它的一半。
 *
 * 「关不掉」有两条互不相干的来源：厂商整家没有关闭值（thinkingLevels，上面那条），
 * 以及官方逐模型表把某几支标成 Always on（isAlwaysThinkingClaude —— 它们连
 * thinking:{type:"disabled"} 都回 400，所以关闭态只能整个字段不发）。后者是逐 SKU
 * 的：claude 四个在册型号里只有 fable-5 / mythos 关不掉，另两个关得掉，所以不能靠
 * 把 provider 级那条翻成 false 来表达 —— 那会对 opus-5 / sonnet-5 撒反方向的谎。
 *
 * 不合并进 canDisableThinking：目录同步下发的是 provider 级字段，那里的语义就该是
 * provider 级；消费方的逐 SKU 判断走它自己的 thinkingWire 有没有 off 键。
 */
export const canDisableThinkingForModel = (service: string, model: string): boolean => canDisableThinking(service) && !(service === "claude" && isAlwaysThinkingClaude(model));

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
 * grok is NOT here: 官方档位是 low/medium/high/xhigh(docs.x.ai),dial 保持
 * 分级,medium 原样发 —— 见 pickThinkingLevel。
 */
// ⚠ moonshot 已移出:收录 kimi-k3 后它【同时】有二元 SKU(K2.x 的 thinking:{type})
// 与真分级 SKU(k3 的 reasoning_effort low/high)。集合是 provider 级的,而 UI 的
// 档位选择器也是 provider 级 —— 给出三档,对 K2.x 是三档折叠成开/关(无害,
// 只是 Medium 与 High 同效),对 k3 是必需。反过来只给 Off/On 则 k3 的 high
// 永远选不到。thinking.test 的「三档形态 ↔ 声明一致」不变量抓住了这次矛盾。
export const BINARY_EFFORT_VENDORS: ReadonlySet<string> = new Set(["deepseek", "doubao", "zhipu", "mimo", "siliconflow", "cohere", "qianfan", "mistral", "minimax"]);

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
 * explicit none either way), grok (omit→server default "high"; no off value —
 * we send lowest level), qwen (3.5+ gen flips commercial
 * default to ON, incl. 3.6-plus), doubao (Seed omit→enabled), zhipu (glm-4.7/5/5.1
 * forced-thinking), moonshot (Kimi "enabled by default"), gemini (3.x omit→model's
 * built-in level, can't fully disable on Pro), mimo (binary thinking:{type}; doc
 * leads with the disable example), azureopenai (mirrors openai's gpt-5.5 omit→medium),
 * siliconflow (V4/K2.6 是上游原生透传,默认思考开;发原生 thinking:{type},
 * 它自家的 enable_thinking 按官方参数表不适用于 V4 系),
 * mistral (adjustable-reasoning mistral-medium-3-5/small via reasoning_effort high|none;
 * default model is reasoning-capable so omit may leave it on → send explicit "none").
 * gemini + azureopenai are CUSTOM services (handle the disable inline:
 * gemini 无关闭值 → 逐 SKU 最低档(pickThinkingLevel);azure → reasoning_effort
 * "none"), so the OpenAI-compat
 * invariant test filters them out — they're listed here for documentation.
 *
 * minimax joined 2026-07 with M3: `thinking:{type:"adaptive"|"disabled"}`,
 * server-default adaptive = ON, off must send explicit disabled (M2.x SKUs stay
 * untagged/intrinsic — the gate omits for them).
 *
 * EXCLUDED (untagged in `models`, no builder) — two distinct reasons, don't
 * conflate them:
 *   - nvidia: since the v4-pro removal it has ZERO thinking SKUs (vLLM defaults
 *     DeepSeek reasoning OFF, opt-in only) — nothing to control, omit is correct.
 *   - tokenhub/hy3: thinking IS toggleable (TokenHub doc 1823/135872,
 *     `thinking:{type:"enabled"|"disabled"|"adaptive"}`), but the documented
 *     DEFAULT is disabled — omitting already yields the non-thinking state
 *     translation wants. 加开关的 playbook 在 tokenhub models 注释里。
 * NOTE mistral is NO LONGER fully here: its default medium/small
 * accept reasoning_effort (Magistral SKU stays intrinsic).
 *
 * NOT in this set but DO send an explicit disable for their TAGGED reasoning SKUs
 * (their DEFAULT model is non-reasoning, so they fail the per-default-model
 * invariant — handled by their builders, not this set): openrouter (universal
 * `reasoning:{enabled:false}` when off), cohere (command-a-reasoning → reasoning_effort
 * "none"), qianfan (ernie-5.0-thinking → enable_thinking:false).
 * groq【已入列】:gpt-oss 推理不可关(官方无 none),但"关"不再是省略 ——
 * 省略落到未文档化的服务端默认,现在发显式最低档 low(2026-08 改)。
 */
export const SERVER_DEFAULT_THINKING_ON: ReadonlySet<string> = new Set([
  "groq",
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
export const getProviderEndpoints = (service: string): Array<{ label: string; url: string; docs?: string }> | undefined => {
  return (PROVIDERS[service as ProviderKey] as ProviderSpec | undefined)?.endpoints;
};

/**
 * 该 provider 的中转 allowlist(= 官方端点集合,[0] 为默认):endpoints[] 优先,
 * 没声明的 openai-compat 回落到 [spec.endpoint]。resolveWireEndpoint 的默认
 * 目标、workerParity 测试都从这里取 —— 此前引擎与测试各写了一份同样的回落
 * 规则,测试等于在校验自己的抄本。
 */
export const getRelayAllowlist = (service: string): readonly string[] => {
  const spec = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  const eps = spec?.endpoints?.map((e) => e.url);
  if (eps?.length) return eps;
  return spec?.kind === "openai-compat" ? [spec.endpoint] : [];
};

// wire 层对 config.url 的补全器 —— 【与各 service 实际做的完全一致】,这是
// classifyEndpointUrl(界面文案/芯片)、blur 自动补全、relayHint 判据的共同判据:
//   - claude:Messages 协议,bare host 补 /v1/messages(completeClaudeUrl)
//   - openai-compat 全员 + 同协议的手写 service(yandex/llm/nvidia/qwenMt/
//     translategemma/milmmt 都在各自实现里调 completeOpenAICompatUrl)
//   - 其余(deepl/deeplx/azureopenai/gtxFreeAPI…):私有协议或资源基址,引擎
//     原样使用,这里也原样返回。
// ⚠ 改某个 service 的补全行为时必须同步这里 —— 界面所见与线上所打分叉,
// 就是这个函数存在要防的事故(bare host 判 custom、文案与线上行为相反)。
const OPENAI_WIRE_CUSTOM_SERVICES: ReadonlySet<string> = new Set(["yandex", "llm", "nvidia", "qwenMt", "translategemma", "milmmt"]);
export const wireUrlNormalizer = (service: string): ((url: string) => string) => {
  if (service === "claude") return completeClaudeUrl;
  const spec = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  if (spec?.kind === "openai-compat" || OPENAI_WIRE_CUSTOM_SERVICES.has(service)) return completeOpenAICompatUrl;
  return (u) => u;
};

export type EndpointUrlClass = {
  /** default = 空或官方默认端点;variant = 命中 endpoints[] 声明的官方变体;custom = 用户自己的地址 */
  kind: "default" | "variant" | "custom";
  /** 该选择对应的官方地址;custom 时 undefined */
  url?: string;
};

/**
 * `config.url` 落在三种语义中的哪一种。**只服务界面**(端点芯片高亮、blur 时
 * 文案区分),并作为 relayWouldServe 的"是不是官方地址"判据。
 *
 * 这里曾带过一个 `relayRoutable` 字段,用来表达"这个 url 会不会把中转关掉"。
 * 随着两轴解耦,那个概念本身消失了:中转开不开【只看开关】。
 *
 * 引擎不另算一遍:resolveWireEndpoint(下方)的"能不能走内置中转"直接读这里的
 * kind —— 界面所见与线上所打【由构造保证】一致,不再是两套实现靠测试钉齐。
 */
export const classifyEndpointUrl = (service: string, url: string | undefined): EndpointUrlClass => {
  const spec = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  // localStorage/导入文件不是类型安全的:非字符串(消毒前的存量、手改)当 undefined
  // 处理,不能让设置表单在每次渲染时抛 TypeError 直到手清存储。
  const trimmed = typeof url === "string" ? url.trim() : undefined;
  // 「留空时实际会打哪个地址」:openai-compat 是 spec.endpoint;手写 kind 则看它
  // defaults 里预置的 url(gtxFreeAPI/qwenMt 有,llm/translategemma 是空 = 无默认,
  // 必须用户自己选)。⚠ 别改用 defaults.url 判 openai-compat —— 它们的 defaults.url
  // 一律是 ""(逃生口字段无条件配发),据此判会得出"没有默认端点"的错误结论。
  // URL 即凭证的服务(llm/translategemma)【没有】隐式默认:留空 =「还没配」,
  // 与 getConfigStatus 的 "needs-config" 是同一句话。若在这里把 spec.endpoint 当成
  // 它的默认,端点标签会在 url 还空着时就亮起"已启用",而状态块同时写着"待配置"
  // —— 界面自相矛盾。(引擎侧留空仍会打 endpoints[0],那是另一层的兜底,
  // 状态块的"待配置"已经把话说清楚了。)
  //
  // 其余:claude/yandex 走最后那档 —— defaults.url 是 ""(逃生口),真正的默认地址
  // 写在 endpoints[0] 里,服务层的 *_DIRECT_ENDPOINT 也从那儿派生,三处同一来源。
  const defaultEndpoint = URL_IS_PRIMARY_CRED.has(service)
    ? undefined
    : spec?.kind === "openai-compat"
      ? spec.endpoint
      : getDefaultConfig(service)?.url?.trim() || spec?.endpoints?.[0]?.url;
  // ⚠ 按【引擎将要打的地址】比,不是裸字符串比 —— 两层规范化都要过:
  //  1. 补全(completeXUrl):引擎在 resolveWireEndpoint 里先补全再比
  //     allowlist,所以 bare host(https://llm.api.cloud.yandex.net)在引擎眼里
  //     【就是】官方端点、照常走中转;这里若按原文判成 custom,文案会宣称
  //     "该地址不会发往公共中转、请求直连",与线上行为正好相反。
  //     选择器 = wireUrlNormalizer(上方),按 service 与引擎逐一对齐 ——
  //     曾把 qwenMt/translategemma/llm/nvidia 漏成 identity,而它们的引擎都调
  //     completeOpenAICompatUrl:导入的 base_url 形态地址引擎打官方变体,界面
  //     却判 custom、芯片不亮。
  //  2. 规范形(canonicalEndpoint):尾斜杠、主机大小写这类写法差异本就指向
  //     同一个官方地址;存量/导入的配置不经过输入框的 blur 补全,渲染时就得判对。
  if (!trimmed) return { kind: "default", url: defaultEndpoint };
  const key = canonicalEndpoint(wireUrlNormalizer(service)(trimmed));
  if (defaultEndpoint && key === canonicalEndpoint(defaultEndpoint)) return { kind: "default", url: defaultEndpoint };
  const variant = (spec?.endpoints ?? []).find((e) => canonicalEndpoint(e.url) === key);
  if (variant) return { kind: "variant", url: variant.url };
  return { kind: "custom" };
};

/**
 * 「开中转对这组配置有没有效果」—— resolveWireEndpoint 的放行判据,也是
 * services/llm.ts「建议打开中转」提示的前置条件(指人去开一个开了也没用的
 * 开关,比不提示更糟)。
 *
 * ⚠ 【不把用户自填的地址发给内置公共中转】。内置中转只转发它声明过的端点,
 * 自填地址必然 400 —— 发过去毫无用处,却会把整条 URL(自建网关常带
 * `?token=SECRET`)留在一台用户没打算牵涉的机器的日志里。这【不是】把
 * 「地址」「开关」两轴绑回去:开关照旧有效,只是这一种组合无处可去。
 * 用户自己的中转(usesBuiltinRelay=false)是另一回事:那台机器归他所有、
 * allowlist 由他声明 —— 这正是解耦要支持的场景,照发。
 * 「是不是官方地址」直接问 classifyEndpointUrl —— 与界面同一个判据,不重算。
 */
export const relayWouldServe = (service: string, opts: { url?: string; relayBase?: string }): boolean =>
  !usesBuiltinRelay(opts.relayBase) || classifyEndpointUrl(service, opts.url).kind !== "custom";

/**
 * THE wire-endpoint resolution —— 所有走中转开关的服务(openai-compat 工厂 +
 * claude/yandex)唯一的出口地址计算。两轴正交:`url` 决定打哪个地址(空 =
 * 官方默认),`useRelay` 决定走不走中转;唯一的组合限制见 relayWouldServe。
 * 中转路由键 = provider key(Worker 的 /api/{key} 就按它命名)。
 * 传输侧与分类侧过同一个 canonicalEndpoint:写法差异若只在一侧抹平,界面判
 * "官方"、Worker 的 exact-match 却 400。
 */
export const resolveWireEndpoint = (service: string, opts: { url?: string; useRelay?: boolean; relayBase?: string }): string => {
  const trimmed = opts.url?.trim();
  // 空 url → allowlist[0](官方默认)。调用方都是中转能力服务,allowlist 非空
  // 由构造 + registry.test 的「endpoints[0] 即默认」不变量保证。
  const target = trimmed ? wireUrlNormalizer(service)(trimmed) : getRelayAllowlist(service)[0]!;
  if (!opts.useRelay || !relayWouldServe(service, opts)) return target;
  return relayUrl(service, opts.relayBase, canonicalEndpoint(target));
};

/**
 * Curated common-model dropdown for the model input. Returns an empty array
 * (not undefined) when the provider hasn't declared any — keeps the UI
 * `<AutoComplete options={...}>` call shape unconditional and lets the model
 * field gracefully degrade to a plain text input behavior.
 */
export const getProviderModels = (service: string): ReadonlyArray<ProviderModel> => {
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

// Object.hasOwn 守卫:method 来自持久化/导入的字符串，"constructor"/"toString"
// 这类原型链键裸索引会返回【继承的函数】(truthy)—— useTranslationState 靠
// 本函数判断 storedMethod 是否合法的回退逻辑被骗过，validate() 在
// UNSUPPORTED_LANGS[method]?.has 上抛 TypeError，翻译按钮每次点击都炸。
export const getDefaultConfig = (method: string): TranslationConfig | undefined => (Object.hasOwn(defaultConfigs, method) ? defaultConfigs[method as ProviderKey] : undefined);
