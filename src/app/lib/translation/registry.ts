// Single source of truth for every translation provider.
//
// PROVIDERS below is the ONE place you edit to add / change a service.
// TRANSLATION_PROVIDERS (UI list), LLM_MODELS, defaultConfigs, categorizedOptions,
// OPENAI_COMPAT_PROVIDERS (factory input), findMethodLabel, getDefaultConfig,
// and the TranslationMethod union type are all derived views over PROVIDERS.
//
// ⚠ 选品规则：AI provider（category: llm / aggregator）里【不放专属翻译模型】。
//   专属 MT 只属于 category: "machine-translation" 的那几个 provider（qwenMt /
//   translategemma / milmmt / deepl / google …）—— 它们是按 MT 的调用契约【单独实现】的
//   （固定提示词、关掉上下文与术语表开关、逐 SKU 的语种支持表）。挂在 llm 类 provider 下
//   只是"多一个能选的 id"，却拿不到那套契约，而且会误导人：本工具支持 100+ 语种，这类
//   模型的覆盖面小得多（实测 command-a-translate 只有 23 种、上下文 8K、官方还要求生产
//   使用先联系销售）。要 MT 质量 → 让用户去选 machine-translation 类。
//
// ⚠ 每次更新模型清单，除了加/删 SKU，必须逐条确认这三件事：
//   ① defaultModel 仍在 models[] 里（registry.test 会拦，但别等测试）；
//   ② 默认模型【近期没有下架计划】—— 默认是最要命的那一条：它烂掉等于整个 provider
//      开箱即坏。实例见 nvidia 条目（当时的默认模型挂着 `DEPRECATION: 09/19/2026`，
//      两天后死；只有实拉 /v1/models 才看得见）；
//   ③ 该条目的 docs 链接仍指向在售型号（下架常伴随文档改版，链接会先 404）。
//   厂商事实怎么核（哪些端点不带 key 也能实拉、弃用标记藏在页面哪一段）见各条目
//   注释里的先例：nvidia（/v1/models 实拉 + 页面内嵌 isDeprecated/DEPRECATION）、
//   opencodeZen / opencodeGo / atlascloud（官方 /v1/models 不带 key 即返回全量目录）、
//   以及官方文档里的「即将下线 / deprecated」标记。

import type { ReasoningEffort, ThinkingDirective, TranslationConfig, TranslationProvider } from "./types";
// 纯 URL 工具，放在零依赖的 services/shared 里 —— 端点解析 (拼 ?endpoint=) 与
// 这里的分类必须用【同一个】规范化，否则界面判成官方、线上却因大小写/尾斜杠
// 被中转 allowlist 精确匹配拒掉 (exact match)。
import { canonicalEndpoint, completeAzureUrl, completeClaudeUrl, completeOpenAICompatUrl, relayUrl, usesBuiltinRelay } from "./services/shared";

export type ServiceCategory = "machine-translation" | "llm" | "aggregator";

type BaseProvider = {
  label: string;
  category: ServiceCategory;
  /**
   * UI 默认隐藏的 provider。服务/缓存/重试/CLI 等一切【行为层】视图照常包含
   * (导入设置选中后全套功能可用),只从网页的服务选择器与「已配置」chips 里过滤，
   * 用户在 TranslationSettings 里显式打开开关后才出现 (getVisibleCategorizedOptions
   * 是唯一过滤点)。
   *
   * 存在理由不是"实验性功能",而是【目录下发】:365 系列的 legend-talk 把
   * 订阅套餐端点 (火山 Coding Plan、阿里 Token Plan) 当一等公民，那些厂商事实
   * (模型 id、思考 wire) 需要一个单一事实源经 sync-provider-catalog 下发，
   * 生成器不过滤 hidden。本工具自己不主动展示的原因见 volcengine / alibaba
   * 条目注释 (官方文档的封号风险)。
   */
  hidden?: true;
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
   * `label` 的写法约定 —— 这些字符串【不走 i18n】,会原样显示给所有语言的用户，
   * 所以不能写中文 (tokenhub 曾写成「广州」「新加坡」,英文/日文界面上就是两个方块字)。
   * 也不要在 label 里标「(默认)」:哪个在用由高亮表达 (见 TranslationSettings 的
   * 端点标签),写进文案就是同一事实编码两遍，而且各家标法还会不一致。
   * 一条原则:label 写【能把这个选项跟同组其他选项区分开的那个信息】,别写别处
   * 已经有的。点中标签后完整地址就显示在下面的输入框里，所以能从地址读到的东西
   * (端口、路径) 通常不该进 label;provider 名也不该重复 (LiteLLM 下面再挂个叫
   * "LiteLLM" 的选项等于没说)。反过来，泛词 (`Local`) 或裸主机名 (`translate-pa`)
   * 同样不合格 —— 它们没说清那是什么。
   * 落到几类上：
   *   - 地域 (同一服务的国内/海外节点):统一 `Mainland (CN)` / `International`
   *     / `US`,别用城市名 —— 用户关心的是"哪个区",不是机房在哪座城
   *   - 产品线 / 协议 (不是地域):照厂商叫法并点明区别，如 doubao
   *     `Pay-as-you-go` / `Token Plan (CN)`、gtxFreeAPI `Google translate-pa` /
   *     `Google gtx (legacy)`(两者是两套协议，见 services/traditional.ts 的分流)
   *   - 多个本地运行时 / 自建网关：产品名就是区分点，`LM Studio` / `Ollama` /
   *     `llama.cpp` / `LiteLLM`,不必写端口 (地址栏里有)
   *
   * ⚠ 这个数组同时是【中转侧的 allowlist】:relay provider 的 endpoints 必须与
   * scripts/llm-proxy-worker.js 里同名 provider 的 URL 集合完全一致
   * (workerParity.test.ts 机械校验)。客户端走中转时把选中的官方端点作为
   * `?endpoint=` 传给 Worker,Worker 校验它属于该集合后转发 —— 所以【每个官方
   * 变体都能走中转】,不需要逐个手工开路由。
   *
   * 曾经这里有个 `relayKey` 字段 (变体各自对应一条 Worker 路由),已删除：它把
   * 「用哪个官方端点」(provider 事实) 和「走哪条中转路由」(传输细节) 绑死，要求
   * 每个变体手工 opt-in，一变体选中就静默失去中转 —— 恰恰是网络受限用户最需要它的时候。
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
   * 该 SKU 接受的思考档位，【由低到高】。声明它的三家 (gemini / grok / groq) 有
   * 共同特征：档位集合逐 SKU 不同，且厂商【不提供关闭开关】—— 所以这个字段
   * 同时是 canDisableThinking 的判据。发一个该 SKU 不收的档位是确定性 400。
   * 其余厂商要么全系同档、要么有真正的关闭值，不用声明。解析见 pickThinkingLevel。
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
   * 这个 provider 要求把**本轮会话 id** 放进哪个请求头。只声明【头名】——
   * 值由流水线每轮生成（`TranslateTextParams.sessionId`），registry 是静态数据填不了值。
   *
   * ⚠ 用这个字段而不是往 `extraHeaders` 里塞常量：会话 id 的语义是"每轮对话一个稳定值"，
   * 常量等于谎称几千个不相关的对话是同一个会话。见 types.ts 里 sessionId 的注释。
   * ⚠ 加了这个头的 relay provider，头名**必须**同时进 Worker 的 FORWARDED_HEADERS
   * （那份集合兼作 CORS 允许列表，缺了就是"浏览器死在预检 + 中转静默剥掉"）——
   * workerParity.test.ts 第三条断言机械校验这件事。
   */
  sessionHeader?: string;
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
   * 【规范】固定端点的 openai-compat provider 一律带这个字段 (通常 false):
   * 逃生口与 url 字段同理全员配发 —— 谁会被上游拦无法预判，而且自部署 Worker 的
   * 用户拿到的文件应当开箱全覆盖，不该要求他们会改代码。【缺席】只允许结构性
   * 加不了的：端点由用户掌控 (llm/azureopenai/nvidia —— 中转没有固定
   * 上游可写)、协议不是固定地址的 chat/completions(gemini 把 model 拼在 URL
   * 路径里，pass-through 转发不了)。
   */
  defaultUseRelay?: boolean;
};

// 【openai-compat 一律带可选 url 字段】(buildOpenAICompatDefault 无条件
// `base.url = ""`)。这里曾有一条派生规则 acceptsCustomUrl(allowCustomUrl ||
// 有中转路由),已连同 allowCustomUrl 字段一起删除 —— 那套机制把「用户有没有
// 逃生口」交给两个与之无关的标志决定，结果 qianfan/cohere/openrouter/groq/
// siliconflow/atlascloud 六家零退路，不是谁判断过，是漏了。而 DeepSeek 判例
// (探测全绿、真实用户仍被上游按 origin 拦 403，见 services/llm.ts 的 403 重写)
// 证明「谁会被拦」无法预判 —— 无法预判的风险就不该用"逐条记得写"的 opt-in
// 分配退路，默认人人有才是与之匹配的设计。
// url 的三种取值语义由 classifyEndpointUrl(见 getProviderEndpoints 附近) 统一
// 判定：空/官方默认、官方变体、真自定义 —— UI 与端点解析共用同一判据。

// ─── docs / apiKeyUrl 的维护约定 ────────────────────────────────────────────
// 全部链接实测过两轮：2026-08-20 与 2026-09-25（后者带浏览器 UA + Accept-Language
// 双探，bare 与 zh/en 各一遍）。
// 无死链;修正会重定向的地址，规则是【写最终落点，别让用户多跳一次】:
//   · 域名迁移 → 直接写新域 (console.anthropic.com → platform.claude.com、
//     platform.moonshot.cn → platform.kimi.com)
//   · 落到更具体的子页 → 直接指子页 (deepl 的 request-translation、
//     minimax 的 text-chat-openai)
//   · 2026-09-25 改版迁移：火山文档站把数字文档号换成语义路径 (docs/82379/1330310
//     → docs/ark/model-list、…/1928261 → docs/ark/coding-plan-personal-get-started，
//     后者原本还写着 www 域、违反下面那条「必须用 docs.volcengine.com」的规则,一并修);
//     SiliconFlow 文档站重构 (/cn/api-reference/… → /docs/api/chat-completions-post)。
// ⚠ 【locale 段：能不写就不写】。本项目支持 19 语言，把任一 locale 写死都会
// 让另一半用户落在读不懂的页面上。判据只有一条 —— 去掉 locale 段后仍可达
// 且会按 Accept-Language 自动适配的，就不写 (2026-08-20 逐条实测):
//   · 不写:learn.microsoft.com(zh→/zh-cn/、en→/en-us/)、help.aliyun.com
//     (zh→/zh/、en→/en/，2026-09-25 复测仍自适应)、www.deepl.com(zh→/zh/)、
//     mimo.mi.com(无段直达)、docs.siliconflow.cn 新站 (无 locale 段，双语探同一落点)
//   · 必须写:docs.bigmodel.cn/cn/、platform.claude.com/docs/en/ —— 去掉即
//     404,locale 是路径的必需组成部分，不是本地化开关;platform.stepfun.com 的
//     /zh/ 也是 (文档只有中文，去段 404)
// ⚠ curl 探测在这里【会骗人】:不发 Accept-Language 时微软/阿里都落到英文页，
// 看着像"301 到 /en-us",据此"修正"就是把中文用户锁死（曾经就这么错过一次：
// 按无语言头的探测结果把某个 docs 地址改成了 /en-us）。
// 复查时务必带上语言头对比两次。
// 【不改】的两类，别把它们当问题：
//   · apiKeyUrl 跳登录/授权页 (mistral、cohere、openrouter、siliconflow、
//     腾讯、opencode、Google AI Studio):未登录时必然如此，登录后直达目标页。
//   · yandex 跳验证码页：该站对脚本抓取一律返回验证码，浏览器打开正常
//     (核对 SKU 必须用浏览器，见 yandex 条目注释)。
// ⚠ 火山：必须用 docs.volcengine.com,www 域会 301 且脚本/扩展都读不到内容。
// 复查方法：把本文件的 docs/apiKeyUrl 抽出来 curl -sSL -w '%{url_effective}',
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
 * /v1/completions 上【仍然套 Modelfile 模板】—— 源码三行为证 (2026-08-22 核对
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
    // ~5000 字符块，每块一个请求 (translateHtml 原生接受文本数组)。相比逐行一请求，
    // 请求数大幅下降，免费共享端点的 IP 限流压力随之减弱;残余 429 仍由共享冷却闸
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
    // 微软 Edge 浏览器内置翻译的免费后端：免 key、免 auth 的 /translatetext 口
    // (Azure Translator 引擎；见 services/traditional.ts 的 edgeFreeAPI —— 2026-10-02 从老的
    // /translate/auth JWT 两步流迁来，那个 auth 口已 404)。与 gtxFreeAPI 同为零配置免费服务，
    // 互为备胎：Google 反滥用墙收紧时用户可一键切到 Edge，反之亦然。
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
    endpoints: [...RAW_PROMPT_RUNTIME_ENDPOINTS],
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
    endpoints: [...RAW_PROMPT_RUNTIME_ENDPOINTS],
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
    defaultModel: "deepseek-flash",
    defaultTemperature: 0.7,
    docs: "https://api-docs.deepseek.com/",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
    defaultUseRelay: false,
    // 官方说明 (2026-09 复核，2026-09-25 确认路由现状)：模型名推荐使用 deepseek-flash（由 DeepSeek-V4.1-Flash 服务）。
    // 旧模型名 deepseek-v4-flash 仍可调用，但已下线并路由到 V4.1 Flash；
    // deepseek-v4-pro 在 2026-09-14~V4.1 Pro 上线前曾临时全部路由到 V4.1 Flash，
    // 该临时路由【已结束】—— 现直接服务 Pro 档，不再是挂着 Pro 名跑 Flash。
    // 各模型均支持 thinking / non-thinking 两种模式 (docs.deepseek.com: "supporting both modes")。
    // 注：DeepSeek 另提供 Anthropic 兼容端点 (https://api.deepseek.com/anthropic)。
    models: [
      { label: "DeepSeek Flash", value: "deepseek-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
    ],
  },
  openai: {
    kind: "openai-compat",
    category: "llm",
    label: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    defaultModel: "gpt-6-luna",
    // 无 defaultTemperature:GPT-5.x/6.x 全系为推理模型，拒绝非默认 temperature
    // (400 "Only the default (1) value is supported",运行时实测，2026-07 核查;
    // effort:none 是否解锁在 5.4+ 未确认)。字段移除 → 请求不发、UI 不显示，
    // 服务端默认生效。
    docs: "https://developers.openai.com/api/docs/guides/text",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultUseRelay: false,
    // https://developers.openai.com/api/docs/models
    // 当前主推 GPT-6 家族三档：astra(旗舰) / sol(复杂工作) / luna(省钱,
    // 官方原文点名 cost-sensitive/high-volume → 翻译默认)。2026-10-01 官方
    // models 总览复核:sol 档已滚到 gpt-6.1-sol（09-29 标 NEW，总览不再出现
    // gpt-6-sol）,astra/luna 仍为 6.0 代;OpenRouter 目录 gpt-6.1-sol 实拉
    // 6 个 provider 可调用 —— 原生总览为准，清单跟进 6.1-sol。
    // GPT-5.6 家族 (sol/terra/luna) 降为上一代，删出清单（未停用，手填仍可调;
    // 6 家族没有 terra 变体，均衡档由 sol 承担）。更早的 5.5 / 5.4-mini 同判删除。
    // ⚠ reasoning.effort 的取值集合【按型号不同】,官方原文 "Supported values are
    // model-dependent... Some models support only a subset":GPT-6 系 low..max。
    // 我方 ReasoningEffort 只有 low/medium/high,三档对全系都安全 —— 要加
    // max/xhigh 档时必须按型号裁剪，旧代(5.5/5.4-mini 只到 xhigh)会 400。
    models: [
      // ⚠ 用【Model ID】而不是别名：文档惯例是把裸家族名 (gpt-6) 标为某个变体的
      // alias，别名会随版本迁移，写死变体 ID 更稳。
      { label: "GPT-6 Astra", value: "gpt-6-astra", thinking: true },
      { label: "GPT-6.1 Sol", value: "gpt-6.1-sol", thinking: true },
      { label: "GPT-6 Luna", value: "gpt-6-luna", thinking: true },
    ],
  },
  claude: {
    kind: "custom",
    category: "llm",
    label: "Claude",
    docs: "https://platform.claude.com/docs/en/intro",
    apiKeyUrl: "https://platform.claude.com/settings/keys",
    // url 可选：自建中转 (转发到 api.anthropic.com/v1/messages 的自有 Worker)。
    // 与中转开关正交:url 决定用哪个 endpoint,useRelay 决定走不走中转，二者互不覆盖。
    // endpoints[] 只有官方这一个 —— 声明它不是为了给界面渲染芯片 (单个不渲染),
    // 而是让 classifyEndpointUrl 认得出官方地址：用户把文档上的地址原样贴进 url
    // 框时，不该被判成"自定义"(界面文案会宣称"请求直连",而中转恰恰声明了它)。
    // 服务层的 CLAUDE_DIRECT_ENDPOINT 从这里派生，中转 allowlist 由 workerParity 钉住。
    endpoints: [{ label: "Anthropic", url: "https://api.anthropic.com/v1/messages" }],
    // 无 temperature 字段:adaptive 世代 (Opus 5 / Sonnet 5 / Fable 5) 拒绝
    // 非默认 temperature(400，官方成文);统一 provider 级不发，服务端默认生效。
    defaults: { url: "", apiKey: "", model: "claude-sonnet-5-5", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {}, useRelay: false },
    // 两代思考机制并存 (service 层按 model 分流，见 services/llm.ts claude +
    // isAdaptiveThinkingClaude):
    //   - Adaptive thinking(Opus 5/5.5 / Sonnet 5/5.5 / Fable 5/5.1):thinking:{type:"adaptive"}
    //     + output_config.effort;拒绝 temperature/top_p 及旧的 budget_tokens(均 400)。
    //   - Extended thinking(Haiku 4.5):沿用 thinking:{type:"enabled",budget_tokens}。
    // ⚠ 2026-10-02 逐页核官方 whats-new 原文:【关闭档的线格式按型号分三种】，发错就是 400 ——
    //   Opus 5.5 / Fable 5.x / Mythos = "Always on"，连 disabled 都拒 → 整个字段不发
    //   (ALWAYS_THINKING_CLAUDE_RE);Sonnet 5.5 = 最低档是 between_tools，发 disabled 会被拒
    //   (BETWEEN_TOOLS_OFF_CLAUDE_RE);老世代(Opus 5 / Sonnet 5 / Opus 4.7-4.8) 才吃 disabled。
    //   归代与关闭档两张表都由 thinking.test.ts 逐条钉住，加新 SKU 必须一次回答两问。
    // temperature 是 provider 级不发 (上面 defaults 无此字段)—— Haiku 4.5 虽仍
    // 接受该参数，但为简化统一不发，用服务端默认值。
    // 证据:platform.claude.com/docs/en/build-with-claude/adaptive-thinking，加上
    // thinking.md 里那张【逐模型 × thinking.type 接受度矩阵】(No field / adaptive /
    // enabled+budget / between_tools / disabled 五列)。2026-10-02 复核改以那张矩阵为准 ——
    // 一张表覆盖全部在售型号的关闭档形态，比逐页翻 whats-new 更适合下次对照,别把表内容抄进注释。
    //
    // 默认仍是 Sonnet 档而不是旗舰 Opus 5.5:逐行翻译是高频短请求，Sonnet 对这个
    // 负载的性价比明显优于 Opus 5.5 ($4/$20),要旗舰质量的用户在下拉里一键就能切。
    // 2026-10-01 官方 models 总览复核:现役 Sonnet 是 claude-sonnet-5-5，sonnet-5
    // 已不在官方在售表内 —— 默认与清单一并跟上（$2/$10 是 2026-09-25 核的 sonnet-5
    // 价,5.5 的价格未逐字核过，不再复述）。
    // model id 一律用不带日期后缀的规范写法 (官方 model 表原文即完整 id);
    // 带日期的快照 id 仍可用户手填，isAdaptiveThinkingClaude 用子串匹配兜住。
    // 官方当前在售四支:fable-5-1 / opus-5-5 / sonnet-5-5 / haiku-4.5 —— 清单逐一对应。
    // Opus 5 已被 Opus 5.5 取代且【更贵】($5/$25 vs $4/$20)，删出清单；仍可手填
    // (子串正则照样判成 adaptive 世代)。Opus 4.8 更早同理移出。
    models: [
      { label: "Claude Opus 5.5", value: "claude-opus-5-5", thinking: true },
      { label: "Claude Sonnet 5.5", value: "claude-sonnet-5-5", thinking: true },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5", thinking: true },
      { label: "Claude Fable 5.1", value: "claude-fable-5-1", thinking: true },
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
    defaults: { apiKey: "", model: "gemini-3.8-flash", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
    // 仅收录 Gemini 3.x 系列 (2.5 已过时，且参数协议不同需要 budget mapping 增加
    // service 复杂度，精简掉 —— 手填旧世代由 buildGeminiThinkingConfig 的守卫兜住：
    // thinkingLevel 打到 2.x 上是确定性 400，理由写在那里)。Gemini 3 thinking 通过
    // `generationConfig.thinkingConfig.thinkingLevel` 控制，默认开启且【没有关闭值】,
    // off 时传该 SKU 收得下的最低档;档位集合按 SKU 不同，就声明在下方每行的
    // thinkingLevels 里，解析统一走 pickThinkingLevel。
    // 默认 3.8-flash:与 3.7 / 3.6 / 3.5-flash 同价($0.75/$3.75)，取最新那代；
    // 3.5-flash 已被官方页降称 "previous-generation Flash model"。
    // thinkingLevels 抄自官方【逐模型表】(ai.google.dev/gemini-api/docs/thinking,
    // 2026-09-01 全表复核、2026-10-02 再逐字核对同一表),由低到高。加 SKU 时对着那张表补这一行 —— 别再用
    // "名字里有 -pro 就只收 low/high" 这类正则近似：官方表里 3-pro-preview 确实
    // 只收 low/high,但 3.1-pro-preview 收 low/medium/high,按名字归并会把用户
    // 选的 Medium 静默降级成 Low(与 grok 全线钳 medium 同一类 bug)。
    models: [
      // 3.7/3.6/3.5-flash 与 3.8 同价（$0.75/$3.75），留着只是让下拉变长 —— 只留 3.8。
      // ⚠ 3.8-flash 官方档位【恰好】= low/medium/high（2026-10-02 逐字核 docs/thinking 的
      //   "Model / Default / Thinking Levels Supported" 表，与在册三条一致，不是"少给一档"的窄集）。
      //   别把相邻 3.6-flash / 3.5-flash 的 minimal 档抄过来 —— 发它不收的档是确定性 400
      //   （见 ProviderModel.thinkingLevels 的注释）。
      { label: "Gemini 3.1 Pro (Preview)", value: "gemini-3.1-pro-preview", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 3.8 Flash", value: "gemini-3.8-flash", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 3.5 Flash Lite", value: "gemini-3.5-flash-lite", thinking: true, thinkingLevels: ["minimal", "low", "medium", "high"] },
    ],
  },
  qwen: {
    kind: "openai-compat",
    category: "llm",
    label: "Qwen",
    endpoint: "https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen3.8-flash",
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
    // 全系混合思考模式、`enable_thinking` 可切换，且【默认开启思考】—— 所以在册各条
    // 都打 thinking 标签，off 态才会发显式 enable_thinking:false(qwen 在
    // SERVER_DEFAULT_THINKING_ON 里)。语义 2026-08 复核无变化。
    // ⚠ 官方坑：思考模式下 max_tokens 有效范围收窄为 [1, 32768],超出直接 400。
    //
    // 在列三款即「选择模型」推荐页头牌（2026-09-25 复核）。换代史一句话：3.7-max
    // 已不在头牌（页面自述仅开放纯文本体验），flash 线逐代降价——3.8-flash 比 3.6
    // 便宜约 6 倍（≤32k 档 ¥0.2/¥0.8 vs ¥1.2/¥7.2）,旧代 flash 未下线只是被取代。
    // plus 线不收（2026-10-02 维护者判定）：3.8 线至今只有 max / flash / omni-flash / 开源版、
    // 暂无 plus 档，而 plus 这一档对逐行翻译没有不可替代价值 —— 留着只是让下拉变长。
    // 若日后 3.8-plus 上架，再按同族口径(留最新代、清旧代)处理。
    models: [
      { label: "Qwen3.8 Max", value: "qwen3.8-max", thinking: true },
      { label: "Qwen3.8 Flash", value: "qwen3.8-flash", thinking: true },
    ],
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    // Kimi 在前、Moonshot 在括号：官方平台已自称「Kimi API 开放平台」,文档域
    // 迁到 platform.kimi.com，模型全部是 kimi-* —— 主名跟着官方走。括号保留
    // Moonshot 是因为老用户仍按"月之暗面/Moonshot"检索 (同 xAI (Grok) 写法)。
    // ⚠ registry key 与 endpoint 仍是 moonshot/api.moonshot.cn:key 换掉会让
    // 存量配置与中转路由全部失效，而 API host 官方【未】迁移 (见下方注释)。
    label: "Kimi (Moonshot)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    // 默认 k2.6：$0.95/$4 只有 k3($3/$15) 的三分之一，而字幕翻译是高频碎请求、
    // 逐行改写，262K 上下文完全够用；要旗舰质量选 k3。
    // ⚠ k3 声明了 thinkingLevels，canDisableThinking("moonshot") 因此是 false，界面把
    // 【整个 provider】的关闭档标成 Min —— 这个保守标签也落在默认的 k2.6 上（它其实真能
    // 关，wire 上发的就是 thinking:{type:"disabled"}）。标 Min 而实际关掉了不骗人，
    // 标 Off 却关不掉才是计费的谎，所以这个方向可以接受。
    defaultModel: "kimi-k2.6",
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
    // K2.x 用扁平 `thinking: {type: enabled(默认)|disabled}`，都【默认开启思考】、
    // 都打标签 —— off 态才会发显式 disabled(moonshot 在 SERVER_DEFAULT_THINKING_ON 里)。
    // ⚠ 纪律（k2.5 时代踩过两次）：漏打标签 = gated() 走 listed-but-untagged 分支
    // 【省略】thinking 参数 = 用户关着思考、服务端默认却一直推理计费。同 DeepSeek
    // 「10M tokens」事故。k2.5 已停服下线（pre-offline 实证），k2-thinking 系退役，均不收录。
    //
    // ⚠ kimi-k3 与 K2.x【协议不同】,是本 provider 唯一需要按 SKU 分流的地方：
    // K2.x 用扁平 thinking:{type},k3 仅思考模式、【不接受 thinking 参数】,改用
    // 顶层 reasoning_effort(low/high/max，默认 max —— 官方 platform.kimi.com/docs)。
    // 因为 k3 没有关闭值，它走【逐 SKU 档位表】那条路 (thinkingLevels +
    // pickThinkingLevel，同 gemini/grok/groq):关闭态发最低档 low。
    // max 不写进表里 —— 同 grok 的 xhigh:ReasoningEffort 只有 low/medium/high,
    // 我们发不出它;写进去也只是死数据 (want 最高是 high，本就命中 high)。
    // (2026-08-20 复核 platform.kimi.com/docs/api/chat:「Kimi K3 始终启用思考」,
    //  无 off/none;models.dev 给 k3 标 toggle=true 与官方原文冲突，别照它改。)
    // 声明了 thinkingLevels ⇒ canDisableThinking("moonshot") 为 false ⇒ 界面把
    // 该档标成 Min —— 这对 K2.x 略显保守 (它们真能关),但一个 provider 只有一个
    // 标签，宁可保守：标 Off 却关不掉是计费可见的谎，标 Min 而实际关掉了不骗人。
    // service 层按 isThinkingModel + 型号分流，见 services/llm.ts 的 THINKING_BUILDERS.moonshot
    // （k3 走 reasoning_effort，其余走 thinkingType）。
    models: [
      // 复核 2026-10-02（curl platform.kimi.com/docs/models.md + guide/use-reasoning-effort.md）：
      // 官方逐字「reasoning_effort | K3 的顶层推理强度字段，支持 "low" / "high" / "max"，默认 "max"」。
      // 下面 levels 只列 low/high 是【既有取舍】：我方 ReasoningEffort 只有三档，max/xhigh 这类
      // 顶档要按型号裁剪才能开（见 CLAUDE.md「加 max/xhigh 档时必须按型号裁剪」），不是漏项。
      // 官方在售另有 kimi-k2.7-code / kimi-k2.7-code-highspeed（thinking.type 仅 enabled，传
      // "disabled" 直接报错，且不支持 reasoning_effort）⇒ 没有可用的关闭形态，暂不收录。
      { label: "Kimi K3", value: "kimi-k3", thinking: true, thinkingLevels: ["low", "high"] },
      // 2026-10-02 收录但不给思考控件：官方对照表把 k2.7-code 列在「thinking.type 仅 enabled，
      // 始终思考，传 "disabled" 报错」且 reasoning_effort 一栏「不支持」—— 它既没有关闭值也没有
      // 档位，打标后关闭态发的 disabled 是确定性 400，不打标（gated 省略参数）才是安全的一侧。
      // -highspeed 是同代高速细分档，按「细分档不收」不列。
      { label: "Kimi K2.7 Code", value: "kimi-k2.7-code" },
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
    // ⚠ 用 docs.volcengine.com 而不是 www.volcengine.com:后者会 301 到前者，
    // 而且脚本抓取与浏览器扩展在 www 域上都拿不到内容 (权限/空页),只有 docs
    // 域可读。直接指向【模型列表】页，而不是文档站首页 —— 核对 SKU 时少一跳。
    docs: "https://docs.volcengine.com/docs/ark/model-list",
    // 复核 2026-10-02（真实浏览器读 model-list 整页；curl/WebFetch 只得 SPA 壳）：四条 Model ID
    // 全部在册 ✓，限流表逐字为 evolving/2-1-pro「RPM 500 / TPM 1000000」、2-1-lite「30000 / 5000000」，
    // 与下面的限流注释一致。思考口径逐字：「带"深度思考"能力标签的模型，默认调用即启用深度思考；
    // 如需仅执行文本生成任务，可通过调用参数关闭深度思考（Chat API 传入 thinking.type=disabled，
    // Responses API 传入 reasoning.effort=minimal）」⇒ 四条 thinking=true（②可关、服务端默认 ON）判定正确。
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    defaultUseRelay: false,
    // ⚠ 【按量线不收 Coding Plan 端点】(/api/coding/v3)。它不是一个
    // "地域/线路变体",而是另一种计费权益，官方 FAQ 原文:「套餐是否仅可用于 AI
    // 工具中的调用？是的，在【非 AI 工具】中使用 Coding Plan / Agent Plan 权益
    // 对应的 Base URL 和 API Key 有可能被识别为滥用/违规，会导致【订阅停用或
    // 账号封禁】」。判据不是"是不是 CLI"(官方支持 Codex CLI / OpenCode /
    // OpenClaw 这类自托管 CLI),而是【是不是 AI 编程工具】—— 本项目是字幕/
    // Markdown/JSON 批量翻译，不写代码不读代码库，落在"非 AI 工具"一侧。
    // 火山 FAQ【另一条独立问题】还称：套餐额度只在支持的 Coding 工具中生效，
    // 之外的 API 调用按方舟现有 (按量) 计费规则收费 —— 此说法只代表火山一家，
    // 阿里的套餐页面没有同类表述，禁止外推;翻译场景也不该用编码向模型。
    // 2026-09:订阅端点本身以【独立 hidden provider】(volcengine / alibaba，本文件
    // 末尾) 收了进来 —— 为的是给 legend-talk 下发目录，网页 UI 默认不显示、开关旁
    // 挂封号警告;GLM(/api/coding/paas/v4)、Kimi(api.kimi.com/coding)、火山
    // Agent Plan 等其他"按工作流卖额度"的端点仍不收，等有下游消费方时照此办理。
    endpoints: undefined,
    // 清单以上方 docs 链接 (官方模型列表页) 的【推荐模型】栏为准，2026-08-20 首核、
    // 2026-09-25 浏览器复核 —— 该站对脚本抓取不返回内容，必须用浏览器打开。
    // 官方把模型分「推荐 / 往期 / 即将下线」三层，我们只收【推荐】那一层：
    // 2.0 系列 (pro-260215、lite-260428 等) 已整体降为往期，同 zhipu 只留 5.x 的
    // 处置 —— 老型号对翻译没有不可替代价值，留着只是让下拉更长。
    // 2026-09-25 换代：pro 的在售快照从 260628 滚到 【260915】(260628 已降入往期，
    // 按上面这条规则必须换);推荐层现共四支 (evolving / 2-1-pro-260915 /
    // 2-1-lite-260915 / 2-1-turbo-260628),turbo 未变、默认不动。lite 见下面限流段。
    // ⚠ 别把套餐侧的下线结论套到这一条上：方舟 **Coding Plan** 的 Doubao-Seed-2.1-turbo /
    // 2.0-lite 自 2026-10-02 起不再向新用户服务、10-09 正式下线，那约束的是 /api/coding/v3
    // 那套别名空间；本条目走按量端点，同日复核 model-list 页里
    // 2-1-turbo-260628 仍在【推荐模型】层（限流 RPM 500/TPM 1000000），默认不动。
    // 反向也一样：Plan 下架不代表按量下架，反之按量往期化也不代表 Plan 有它。
    //
    // 默认 2.1 turbo 而非推荐榜首的 evolving:逐行翻译是【高频短请求】,
    // turbo 是轻量高速档，性价比最优;evolving 的 1024k 上下文对逐行/小批量
    // 翻译用不上 (我们的上下文批默认才 3 行 + 窗口 50),多花的钱换不来质量。
    // 要旗舰能力或超长上下文的用户在下拉里一键就能切。
    // ⚠ evolving 是【滚动别名】,不带日期后缀，官方标注「快速迭代 / 周级迭代」——
    // 同一个 id 的行为会随周更新变化。已知副作用：逐行缓存按【源文 + 配置】做键，
    // 模型悄悄换代后旧缓存仍会命中，同一份文件重跑拿到的是上一代译文 (要新结果
    // 得清缓存)。这也是它不适合当默认的另一个理由 —— 默认应当行为可预期。
    // ⚠ 限流（2026-09-25 逐行核推荐表）：evolving/pro/turbo 都是 RPM 500 / TPM 100 万,
    // 长文件高并发更容易撞 429 —— 引擎有共享冷却闸兜着 (retry.ts rateLimitGate),
    // 表现为变慢而不是失败。例外是【lite-260915:RPM 30000 / TPM 500 万】(60 倍,
    // 2.0 往期老线的高配额在 lite 新快照上回来了) —— 被 429 卡的批量任务可一键切它。
    models: [
      { label: "Doubao Seed Evolving", value: "doubao-seed-evolving", thinking: true },
      { label: "Doubao Seed 2.1 Pro", value: "doubao-seed-2-1-pro-260915", thinking: true },
      { label: "Doubao Seed 2.1 Lite", value: "doubao-seed-2-1-lite-260915", thinking: true },
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
    // ⚠ 与本文件末尾两个【用途受限】的订阅套餐端点【性质不同，别按名字站队】:
    // mimo 的 Token Plan 是通用 token 预付包 (同一批模型、文档无任何用途限制，
    // 预付更便宜),收录它用户真省钱;火山 Coding Plan 卖的是 AI 编程工作流额度，
    // 官方 FAQ 明写在非 AI 编程工具中使用其 Base URL/Key 可能被识别为滥用而封停
    // 订阅或账号 —— 判据见 doubao 条目。阿里的套餐 2026-09 也改名 Token Plan
    // (token-plan.cn-beijing.maas host，见 PROVIDERS.alibaba),但【限制照旧】:
    // 官方概述页仍写明仅限 AI 编程工具/Agent 交互式使用 —— "Token Plan"这个名字
    // 本身不代表无限制，逐家看文档。新增"套餐/权益类"端点先对照这一条
    // (另：火山 FAQ 还有一句"非工具调用不消耗套餐额度、按按量规则计费",那是
    // 火山一家的独立条目，阿里无此说法，别外推)。Token Plan has three regional clusters (CN / Singapore /
    // Europe) — all share the same tp-xxxxx key; the url field (universal on
    // openai-compat) also lets users paste any other variant.
    endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
    defaultModel: "mimo-v2.6-flash",
    defaultTemperature: 0.7,
    // 文档站已迁域:platform.xiaomimimo.com → mimo.mi.com(2026-08 核查，两条地址
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
    // Doc: mimo.mi.com llms.txt → static/docs/api/chat/openai-api.md（逐参数核对 2026-09-25:
    // v2.6 全系与 v2.5 同形态、同「default enabled」;thinking 态下 temperature/top_p 被
    // 强制回默认 —— 与既有「思考态锁定参数」各家先例一致，不改发送逻辑）
    // ⚠ 2026-09-25 官方 Models 页红字公告：mimo-v2.5 与 mimo-v2.5-pro 将于
    // 2026-10-21 10:00 (北京) 正式退役 —— 按「默认不许挂着将死模型」整族换 v2.6
    // (flash/pro;还有 pro-ultraspeed 是商务合作制，不收)。v2.5 手填在退役前仍可用。
    models: [
      { label: "MiMo V2.6 Flash", value: "mimo-v2.6-flash", thinking: true },
      { label: "MiMo V2.6 Pro", value: "mimo-v2.6-pro", thinking: true },
    ],
  },
  zhipu: {
    kind: "openai-compat",
    category: "llm",
    label: "Zhipu GLM",
    endpoint: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    defaultModel: "glm-5.3",
    defaultTemperature: 0.7,
    docs: "https://docs.bigmodel.cn/cn/guide/start/introduction",
    // 复核 2026-10-02（curl docs.bigmodel.cn/cn/**.md 服务端渲染原文）：三条 Model Code
    // （glm-5.3 / glm-5.3-flash / glm-5.3-flashx）全部在册 ✓；思考档位/关闭档口径见下方 models 注释。
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
      { label: "International (Z.ai)", url: "https://api.z.ai/api/paas/v4/chat/completions" },
    ],
    // docs.bigmodel.cn/cn/guide/start/model-overview "文本模型" 表格完整列表
    // 按文档原顺序。GLM-5.3(2026-08-14)
    // 是当前旗舰，glm-5.2 次之 (1M 无损上下文),glm-5-turbo 为长任务优化档。
    //
    // ⚠ 思考：三条都【打标】thinking:true + thinkingLevels["low","high"]。zhipu 有专用形状
    // (llm.ts gated)：关闭态发官方迁移原句指定的 thinking:{type:"enabled"}+reasoning_effort:"low"，
    // 不是省略——glm-5.3 强制思考不可关，省略=服务端默认 max 白烧 token，所以必须打。逐字依据见
    // models 处注释。已把 zhipu 移出 BINARY_EFFORT_VENDORS（否则 provider 级二元会把 medium 直接
    // 映射成 high，抹掉官方档位语义）。UI 上没有"真 Off"档（canDisableThinking=false），如实反映它关不掉。
    //
    // 默认 = 旗舰 5.3（2026-09-17 改）。原默认 5.2 与它【同价】($1.4/$4.4，OpenRouter
    // 公开价目核对)且更旧，旧代唯一的卖点是「能真正关掉思考」—— 而"能关思考"不构成选它
    // 的理由（思考已是各家的默认形态），故 5.2 删除、默认上移到 5.3。
    // 5.3-Flash 便宜 15 倍($0.09/$0.30)但官方把它归在【多模态】档（文档路径
    // /cn/guide/models/vlm/glm-5.3-flash，"原生理解图片视频"）—— 翻译是纯文本任务，
    // 默认仍取文本旗舰，同 stepfun「3.5-flash 优于 3.7-flash」的判据。
    //
    // ⚠ 【只收官方「推荐模型」表的文本款】：4.x 全系、5.2 与降进「全部模型」一般条目的
    // 5.1/5/5-Turbo 都不收（仍在售，要手填照样能填）。GLM-5.3-FlashX 2026-09-25 入表时
    // 调用侧 id 拿不到（子页 404）不发死 id;2026-10-01 复核概览表已直接给出 Model Code
    // glm-5.3-flashx —— 收编。
    models: [
      // 这里曾经写着「不打 thinking，因为打了 off 态会发被拒的形态」—— 那个前提已经不再成立：
      // zhipu 现在有专用形状（见 services/llm.ts），打标后关闭态发的是官方迁移原句指定的
      // `thinking:{type:"enabled"} + reasoning_effort:"low"`。
      // 官方逐字（models/text/glm-5.3.md）：「GLM-5.3 会始终启用思考功能，支持三个思考强度级别：
      // low、high 和 max，并不再支持禁用思考功能」+「如果您的应用当前使用 thinking.type: "disabled"
      // …将其更改为 enabled，并将 reasoning_effort 设置为 low。否则，请求将失败」。
      // 不打标=整个省略=服务端默认 max 在想（静默计费），所以才必须打。levels 只列官方认的
      // low/high（我方 medium 会被 pickThinkingLevel 降到 low，max 属顶档按既有取舍不开）。
      // ⚠ flash/flashx 的 low 曾标"存疑、需带 key 实测",现由官方【对话补全 API 字段参考】裁定:
      // api-reference/模型-api/对话补全.md 逐字「对于 GLM-5.3 GLM-5.3-FLASH 模型，仅支持 low/high/max」
      // ——判"API 收不收某值"以最直接的字段参考为准，flash 的 low 合法;flashx 未被这句单独点名,
      // 但 glm-5.3-flash.md 把 flash/flashx 同 Model Code 行、同推荐 reasoning_effort:max → 按同族推定。
      // (thinking.md L29「low 仅 GLM-5.3 支持」与字段参考冲突,取字段参考。) 若某次实测 flashx-low
      // 真被拒,就把那一条 levels 收成 ["high"],不影响另两条。
      { label: "GLM-5.3", value: "glm-5.3", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "GLM-5.3 Flash", value: "glm-5.3-flash", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "GLM-5.3 FlashX", value: "glm-5.3-flashx", thinking: true, thinkingLevels: ["low", "high"] },
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
      // 2026-10-02 收录 M2.7（官方正文「在售」区，非历史折叠区）：仍按上面那条 M2.x 的判据
      // 【不打标】—— 它 thinking 无法关闭，且传 disabled 会被接收但不生效（=静默思考静默计费），
      // 比 M3 更糟，所以既不标也不发。-highspeed 是同代高速细分档，按「细分档不收」不列。
      { label: "MiniMax M2.7", value: "MiniMax-M2.7" },
      // ⚠ 已删 SKU 的通用处置（M2.5 由 TokenHub pre-offline 实证后移除）：
      // 规则 =【任一渠道 pre-offline 即全面下线】，老模型不留。代价：手填旧 id
      // 落进 gated() 的 custom 分支，Off 态发的 thinking:{type:"disabled"} 对
      // M2.x 可能 4xx —— 按「不做向后兼容」接受，逃生口 = 思考档切 Auto。
    ],
  },
  stepfun: {
    kind: "openai-compat",
    category: "llm",
    label: "StepFun (阶跃星辰)",
    endpoint: "https://api.stepfun.com/v1/chat/completions",
    defaultModel: "step-3.5-flash",
    defaultTemperature: 0.7,
    // ⚠ 站点加了 /zh/ 前缀，旧的 /docs/llm/modeloverview 现在 404（2026-09-17 实测）。
    // 无 locale 与 /en/ 形式都 404 —— StepFun 文档**只有中文**，所以这条链接对所有
    // 语种的用户都会落到中文页，这是上游的现实，不是我们写错了。
    docs: "https://platform.stepfun.com/docs/zh/guides/models",
    // 复核 2026-10-02（curl docs/llms.txt → 各页 .md 原文）：官方推理模型区为 step-5-preview、
    // step-3.7-flash、step-3.5-flash、step-3.5-flash-2603（2026-07-08 下线批次不含目录两条 ✓）。
    // ⚠ 待修：step-3.7-flash 官方「支持三档推理强度」low/medium/high（medium 为默认推荐），
    // 目录却标 thinking=- levels=- —— 界面选不到档、也关不到 low。step-5-preview 是官方指南
    // 首选推荐旗舰，未收录。step-3.5-flash 不打标判为正确（官方未给它 reasoning_effort 记载）。
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    defaultUseRelay: false,
    // 官方文本模型共三款（总览路径现 307 到最新型号子页，逐款有独立文档页;
    // 官方 llms.txt 可机读）：3.5-flash / 3.7-flash / step-5-preview。
    // **step-5-preview 不收**:编程/多模态向旗舰 + preview 滚动命名，翻译是纯文本
    // 任务 —— 判据同下面"3.5 而非 3.7"那条。07-08 的下线公告只动 step-1/2/3 老线，
    // 在列两条无下线标注。
    // 默认 3.5-flash 而非 3.7:3.7 是【多模态】推理旗舰，3.5 是【语言】推理
    // 旗舰 —— 翻译是纯文本任务，语言向那款更对路且更便宜。
    // ⚠ 【不打 thinking 标签】：官方总览与推理指南成文 Chat Completions 支持
    // reasoning_effort（step-3.7-flash 收 low/medium/high）。
    // ⚠ 2026-10-02 逐页核官方原文后给 step-3.7-flash 补标：模型专节「step-3.7-flash 支持三档
    // 推理强度」= low/medium/high（medium 为默认推荐），全篇无 none/disabled 关闭值 ⇒ 打标 +
    // 档位表，关闭态由 pickThinkingLevel 发 low（builder 见 services/llm.ts 的 stepfun 行）。
    // 此前"不打标签"的前提是【档位集合未逐款核实】；3.7-flash 已核实所以补，
    // 3.5-flash 仍不核实：它的模型页没有任何 reasoning_effort 记载（官方两档写法只给了
    // step-3.5-flash-2603），省略参数才是安全的一侧。
    // ⚠ 不收 StepAudio(语音)、Step-1o Turbo Vision(视觉，32K)—— 非文本对话。
    models: [
      { label: "Step 3.5 Flash", value: "step-3.5-flash" },
      { label: "Step 3.7 Flash", value: "step-3.7-flash", thinking: true, thinkingLevels: ["low", "medium", "high"] },
    ],
  },
  qianfan: {
    kind: "openai-compat",
    category: "llm",
    label: "Baidu ERNIE (Qianfan)",
    endpoint: "https://qianfan.baidubce.com/v2/chat/completions",
    defaultModel: "ernie-5.1",
    defaultTemperature: 0.7,
    // 指向【模型列表】页而不是计费页：model 入参的权威来源在这里（同 doubao 的取舍 ——
    // 核对 SKU 时少一跳）。价格另见 https://cloud.baidu.com/doc/qianfan/s/wmh4sv6ya
    docs: "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j",
    apiKeyUrl: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
    defaultUseRelay: false,
    models: [
      { label: "ERNIE 5.1", value: "ernie-5.1" },
      // ERNIE 5.0-Thinking server-defaults enable_thinking=true, but it's a hybrid
      // SKU with a real toggle: `enable_thinking` boolean (binary → qianfan is in
      // BINARY_EFFORT_VENDORS). Tagged so off-state sends explicit enable_thinking:false.
      // ⚠ ernie-x1.1 双条在官方【模型列表】页都标「即将下线」→ 按「老模型不留」不收。
      // 教训固化：核 model 入参一律以「模型列表」页为准（docs 已指向它），计费页只
      // 用来对价格 —— 计费页会漏行，据此判「id 不存在」曾得出过错误结论。
    ],
  },
  mistral: {
    kind: "openai-compat",
    category: "llm",
    label: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    // 默认 Small 4：官方把 Medium 3.5 定位成「frontier-class multimodal model
    // optimized for **agentic and coding** use cases」—— 翻译不是那个负载；而 Small 4
    // 是官方那句「unifying instruct, reasoning, and coding in a single **efficient**
    // model」的便宜档，便宜 10 倍（$0.15/$0.60 vs $1.50/$7.50，OpenRouter 价目核对）。
    defaultModel: "mistral-small-latest",
    defaultTemperature: 0.7,
    docs: "https://docs.mistral.ai/api/",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    defaultUseRelay: false,
    // 来自 https://docs.mistral.ai/models/overview
    // Adjustable reasoning(mistral-medium-3-5-26-04 / mistral-small) 通过 reasoning_effort
    // 控制 (docs.mistral.ai/studio-api/conversations/reasoning，取值 high|none，二元 →
    // BINARY_EFFORT_VENDORS)。Large 3 / Ministral 非推理模型。
    // 注（2026-10-01 官方 API 参考复核）:`-latest` 别名【只有】 mistral-small-latest /
    // mistral-large-latest 两个在列;medium/ministral 用总览的日期版 id。纯版本号
    // 写法（mistral-small-4、mistral-medium-3-5、ministral-14b-latest）均查无可调
    // 证据，一律不收。
    // Magistral 线已退役，不收录。
    models: [
      { label: "Mistral Medium 3.5", value: "mistral-medium-3-5-26-04", thinking: true },
      { label: "Mistral Small 4", value: "mistral-small-latest", thinking: true },
      { label: "Mistral Large 3", value: "mistral-large-latest" },
      { label: "Ministral 3 14B", value: "ministral-3-14b-25-12" },
    ],
  },
  grok: {
    kind: "openai-compat",
    category: "llm",
    label: "xAI (Grok)",
    endpoint: "https://api.x.ai/v1/chat/completions",
    defaultModel: "grok-4.7",
    defaultTemperature: 0.7,
    docs: "https://docs.x.ai/developers/models",
    apiKeyUrl: "https://console.x.ai/",
    defaultUseRelay: false,
    // Grok 4.7 是当前 frontier 档（官方 models 页 2026-09-25 列 4.7/4.6/4.5/4.3;
    // 4.7 与 4.6 同价 $2/$6 —— Zen 公开价目核对）。4.6(2026-08 上线，500k 上下文)
    // 降为上一代删出清单，手填仍可调。
    //
    // thinkingLevels 抄自官方逐模型表 (curl 取正文走 docs.x.ai/developers/model-capabilities/
    // text/reasoning.md;旧的 /docs/guides/reasoning 已成 Next.js SPA 壳。2026-08-20 核对、
    // 2026-09-25 复测、2026-10-02 再核一致):4.7 与 4.6 同收 low/medium/high/xhigh,4.5 收
    // low/medium/high(xhigh 被当 high,是静默降级不是报错)。xhigh 不写进表里 ——
    // 我们的 ReasoningEffort 只有三档，发不出它;哪天 UI 加了档再补。
    // ⚠ off 态【不发 "none"】:官方枚举里没有这个值，且原文明写
    // "Reasoning cannot be disabled"（4.7 复核同样如此）—— 详见 pickThinkingLevel 的注释。
    // (models.dev 给 grok 列过 none，与官方原文冲突，别照它改。)
    models: [
      // 官方只推荐 4.7（4.6 与它同价、是被支配的旧代）。
      { label: "Grok 4.7", value: "grok-4.7", thinking: true, thinkingLevels: ["low", "medium", "high"] },
    ],
  },
  // Perplexity 已于 2026-09-27 前【提前移除】—— 别急着按 Agent API 加回来，两条
  // 理由当时论证过：① Agent API 是 Responses 形状(/v1/agent、input/output[]、严格
  // 模式、错误以 HTTP 200+status:"failed" 返回),等于全项目唯一一份手写 Responses
  // 分支；② Sonar 的差异化只剩「默认联网」,Agent API 改成显式 opt-in tools 后它就
  // 是又一个普通 LLM，本表已有十几个。若哪天联网价值重新成立，连理由①的代价一起
  // 重估。来源:docs.perplexity.ai/docs/agent-api/migrate-from-sonar/overview
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
      { label: "Command A Reasoning", value: "command-a-reasoning-08-2025", thinking: true },
      // ⚠ Command A Translate 不收：AI provider 里不放专属翻译模型 —— 规则与落点
      // 见本文件头部「选品规则」。要 MT 质量请选 machine-translation 类。
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
    // 复核 2026-10-02【清单面已取到】：真实浏览器成功读到 "Common instance models" 表（本轮该 URL
    // 没跳验证码；上次命中的是 /tmgrdfrend/showcaptchafast）。9 条 id 与表逐一对齐 ✓（见 models 处）。
    // 免 key 探针仍证伪不了型号名（GET 回 400 "empty request body"、无 key POST 回 "Failed to parse
    // model URI"、/v1/models 回 401），所以清单以文档表为准；下次若再遇验证码：人工过或带 key 拉 foundationModels。
    apiKeyUrl: "https://aistudio.yandex.ru/platform/folders/",
    // url 可选：自建中转 (转发到 llm.api.cloud.yandex.net 的自有代理)。
    // 与中转开关正交:url 决定用哪个 endpoint,useRelay 决定走不走中转，二者互不覆盖。
    // endpoints[] 单条，理由同 claude:让官方地址被 classifyEndpointUrl 认出来。
    endpoints: [{ label: "Yandex Cloud", url: "https://llm.api.cloud.yandex.net/v1/chat/completions" }],
    defaults: { url: "", apiKey: "", folderId: "", model: "yandexgpt-5.1", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 50, useRelay: true },
    // Hosted SKUs per aistudio.yandex.ru/en/docs/ai-studio/concepts/generation/models
    // (2026-10-02 真实浏览器逐条核对：9 条与官方"Common instance models"表【完全一致】，无遗漏/无失效)。
    // ⚠ 更正：此前注释说"无任何退役标注"是错的——表里 gpt-oss-120b 与 gpt-oss-20b 各标「available until
    //   October 30, 2026」，仍在售且非默认，先留并记退役日；过点按"退役不迁移"撤。表里另有
    //   qwen3-235b-a22b-fp8(until 9-30，已到期不收)、fine-tuned yandexgpt-lite(微调占位非基础款，不收)。
    // ⚠ 该站对脚本抓取返回验证码页，只能用浏览器打开核对 —— 别因为 curl/WebFetch
    // 拿不到内容就以为它下线了。
    // Yandex 的退役模式是【先替换、再给一个月宽限】(Release Notes:V3.2→V4 Flash、
    // Qwen3.5→Qwen3.6 都是这个节奏),所以盯 Release Notes 比盯模型表更早发现变动。
    // No thinking tags — the OpenAI-compat path documents no reasoning toggle
    // (YandexGPT 5.1's Chain-of-Reasoning isn't exposed as a request param);
    // sending reasoning_effort risks a 400 on a gateway that never documented it.
    models: [
      { label: "YandexGPT Pro 5.1", value: "yandexgpt-5.1" },
      { label: "YandexGPT Pro 5", value: "yandexgpt-5-pro" },
      { label: "YandexGPT Lite 5", value: "yandexgpt-5-lite" },
      { label: "Alice AI LLM", value: "aliceai-llm" },
      { label: "Alice AI LLM Flash", value: "aliceai-llm-flash" },
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash" },
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
    // (:free 后缀)+ 各家主流旗舰各取若干。不写死数量：清单随榜单增删，写了必漂。
    // OpenRouter 统一 reasoning_effort 参数会自动转发底层 provider(Claude→budget_tokens,
    // OpenAI→reasoning_effort,Gemini→thinkingLevel,DeepSeek→thinking 等),所以
    // 底层 model 支持 thinking 的 slug 都标 thinking: true 即可。
    // ⚠ slug 写法不统一，逐个以 /api/v1/models/{slug}/endpoints 实拉为准：
    // Claude 新代是 `anthropic/claude-opus-5`(无小数点),而 `claude-opus-5.5` 又带
    // 小数点、旧的 opus 4.8 也是小数点 —— 别按一个规律推另一个。
    // ⚠ 「model 存在」≠「能调用」:poolside/laguna-m.1:free 的 model 对象仍在，但
    // endpoints 数组为【空】(0 个 provider)= 实际不可调用，已换成 laguna-s-2.1:free
    // (1 endpoint, prompt $0, 262k 上下文)。核 free SKU 必须打 endpoints 端点，
    // /api/v1/models 全量 JSON 太大会被截断，据它判「不存在」会误删。
    models: [
      { label: "Nemotron 3 Super 120B (free)", value: "nvidia/nemotron-3-super-120b-a12b:free" },
      { label: "Laguna S 2.1 (free)", value: "poolside/laguna-s-2.1:free" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek/deepseek-v4.1-flash", thinking: true },
      // Hy3 正式版（8-31 到期前就从 hy3-preview 换了过来 —— 教训：单点供应的
      // preview 就是随时归零的形态，核 free/curated SKU 要数健康 provider）。
      { label: "Hy3", value: "tencent/hy3", thinking: true },
      { label: "Claude Sonnet 5", value: "anthropic/claude-sonnet-5", thinking: true },
      // 2026-10-01 endpoints 实拉增补:sonnet-5.5(8 个 provider;k3 见下)、
      // nemotron-3.5-lightning:free(1 个 provider —— 与 laguna-s-2.1/qwen3.8-27b
      // 两个免费项同形,单点供应的归零风险按既有先例接受,不作默认即可)。
      { label: "Claude Sonnet 5.5", value: "anthropic/claude-sonnet-5.5", thinking: true },
      { label: "Claude Opus 5.5", value: "anthropic/claude-opus-5.5", thinking: true },
      { label: "Gemini 3.8 Flash", value: "google/gemini-3.8-flash", thinking: true },
      { label: "GPT-6 Astra", value: "openai/gpt-6-astra", thinking: true },
      { label: "GPT-6 Luna", value: "openai/gpt-6-luna", thinking: true },
      // glm-5.3 不打 thinking:上游强制思考、不可禁用，打了标签 off 态会经 OpenRouter
      // 统一参数发 reasoning:{enabled:false},对它是非法请求。同原生 zhipu 的处理。
      { label: "GLM-5.3", value: "z-ai/glm-5.3" },
      { label: "Grok 4.7", value: "x-ai/grok-4.7" },
      { label: "Kimi K2.6", value: "moonshotai/kimi-k2.6", thinking: true },
      // ⚠ kimi-k3 不打 thinking:k3 仅思考、不收关闭参数(见原生 moonshot 条目),
      // 打了标签 off 态会经 OpenRouter 统一参数发禁用请求 —— 同 GLM-5.3 那条的判据。
      { label: "Kimi K3", value: "moonshotai/kimi-k3" },
      // Qwen3.8 27B 免费档（top-weekly 免费榜在列，endpoints 实拉 1 个健康）。
      { label: "Qwen3.8 27B (free)", value: "qwen/qwen3.8-27b:free" },
      { label: "Nemotron 3.5 Lightning (free)", value: "nvidia/nemotron-3.5-lightning:free" },
      // M3 上游默认 adaptive thinking(可关)→ 打标签让 off 态经 OpenRouter
      // 统一参数发 reasoning:{enabled:false},否则默认烧推理 token。
      { label: "MiniMax M3", value: "minimax/minimax-m3", thinking: true },
    ],
  },
  opencodeZen: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenCode Zen",
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
    // key 带 Zen 后缀是【有意的】:同一个账号下有两条产品线(Zen 余额按量 / Go 订阅),
    // 光写 `opencode` 读不出是哪条 —— 这正是让人以为两者该合成一个 provider 的原因。
    // 姊妹条目叫 opencodeGo,这里对称。改名代价已知并接受:旧的存档值会优雅回落
    // (getDefaultConfig 判不过 → DEFAULT_API,且不写回),Worker 需重新部署
    // (/api/opencode → /api/opencodeZen),下游三个 app 目录需重跑 yarn sync:providers。
    // ⚠ 别把它"简化"回 opencode —— 那会把这条产品线重新藏进厂商名里。
    // ⚠ 也【不要】把 Zen 与 Go 合并成 endpoints[] 变体:变体只共享 provider 级
    // models[]，而两家在售集合不同(交集从早期 4/31 涨到 26/42 —— 2026-09-25 实拉，
    // 但 Go 仍有 16 条 Zen 没有的选品，如 muse-spark/longcat/mimo-2.6/免费档)，
    // 何况计费形态不同 —— 合并后总有一份清单对当前端点是错的(见 opencodeGo 条目)。
    // ⚠ 需要 apiKey。**匿名这条路已被上游关掉**（2026-09-17 实测、复测稳定）：
    //   无 key → 403 FreeTierError「OpenCode's free tier can only be used from
    //   within OpenCode」；带【任意】key（哪怕是假 key）→ 过闸，变成 401 AuthError。
    // 即门槛是【凭证】而不是客户端 —— 这比"匿名能用但容易 429"的旧说法更硬，
    // 也因此退出 NO_CRED_REQUIRED。理由详见该集合的注释。
    //
    // 「需要 key」≠「要花钱」,别把这两件事混起来 (否则下一个人会觉得这里
    // 降级得太狠，又把它挪回 NO_CRED_REQUIRED):官方定价表把一批 *-free SKU
    // 标为 Free (2026-10-01 实拉目录共 12 条),填了 key 用它们【依然免费】,key
    // 的门槛是注册 + 绑账单信息 (官方原话 "add your billing details"),不是预付费。
    // 填 key 换来的是【额度按账号计】而不是和全站陌生人共享一个 IP。
    // 免费档的收录/排除判据在下面模型清单的第 ④ 条（一律收，只排实测不通与同族旧代）。
    //
    // ⚠ CLI【同样需要 key】—— 匿名 403 这个凭证门对两个壳共用一套
    // (validateTranslationInputs → getConfigStatus)，没有 key 哪边都打不通。
    // 【故意不给 CLI 开后门】:开后门要在 registry 里按平台或按 useRelay 分叉
    // 凭证判定，把「这个服务要不要凭证」从一条规则切成两条 —— 代价大于收益，
    // 而 CLI 用户填 key 的成本只是 `--api-key` 或 `-s settings.json`。
    // 默认 space-bunny-free（2026-10-01 改）:原默认 deepseek-v4-flash-free 免 key
    // 探针恒 400 server_error「Model is unavailable」（子代理三轮 + 本仓复现，目录
    // 仍在册但打不通 —— 正是头部规则②说的"默认烂掉=开箱即坏"）。space-bunny-free
    // 是目录内唯一实测匿名打通并回 completion 的免费档（见下方免费档注释）。
    defaultModel: "space-bunny-free",
    defaultTemperature: 0.7,
    docs: "https://opencode.ai/docs/zen/",
    apiKeyUrl: "https://opencode.ai/auth",
    // 上游【完全不发 CORS 头】,且 OPTIONS 预检返回站点 404 HTML(2026-08-06 首次实测，
    // 2026-09-17 复测不变:OPTIONS → 404 且零 CORS 头；带 Origin 的 POST → 401 且无 ACAO)
    // —— 浏览器直连必死在预检，这也是 Custom(llm) 填 zen 地址走不通的原因。
    // 故默认开 relay;开关保留，上游补 CORS 后用户可自行切回直连。
    // ⚠ 别被 `/v1/models` 误导:那个端点【是】开放 CORS 的(OPTIONS 200 +
    //   Access-Control-Allow-Origin: *),只有 chat/completions 不发 —— 所以
    //   「models 能拉」推不出「chat 能直连」。CLI(Node)侧则两条路都通,没有 CORS 层。
    defaultUseRelay: true,
    // 模型清单：**按输入价升序**（一眼看出成本档位），每个家族只留最新一代。
    // 全量 84 条不列（2026-10-01 实拉）—— model 字段可自由输入，冷门 SKU 自己填。排除四类：
    //   ① GPT-5.x / gpt-6 线：该线在 OpenAI 侧拒 temperature（见 openai spec 省略
    //      defaultTemperature 的理由），而 zen 是否代为剥离无法在无 key 下验证 ——
    //      收进来等于把一个未验证的 400 风险摆到默认下拉里。
    //   ② 代码 / 视觉特化：kimi-k2.7-code、gpt-5.x-codex、deepseek-v4-flash-vision-exp。
    //   ③ 隐身 / preview / 实测不可用：union-alpha（2026-08 实测 500，2026-09-25 复测
    //      已彻底消失：'is not supported'）、hy3-preview、hy4-preview、omen-alpha。
    //   ④ 免费档一律收（上游 12 条免费 SKU 收 7 条）。⚠ **数据条款不作为排除理由** ——
    //      「免费期内收集的数据可能用于改进模型」（Big Pickle / MiMo Free / Ling 3.0
    //      Flash Fin Free）与「仅限试用、勿提交机密数据」（Nemotron 两条）都照收：
    //      字幕正文不是个人文档，被信息收集可以接受（用户 2026-09-17 明确确认）。
    //      不收的 5 条全是【功能】原因，不是条款：jev-1.13-free 与
    //      muse-spark-1.3-contributor-free **实测 500**（2026-09-25 复测仍 500），
    //      muse-spark-1.2-contributor-free 与 mimo-v2.5-free 是同族旧代（2.6 已上架），
    //      longcat-2.5-preview-free 命中 ③ 的 preview 判据（2026-10-01 新增的免费档）。
    // 未收的付费新款（在册、探针过）：qwen3.8-max 与在列的 grok/sonnet 档重叠且更贵，
    // deepseek-v4.1-flash 比在收的 v4-flash 贵一倍而同族已在列 —— 都不改变成本梯度，
    // 收了只是让下拉变长；要它们照样能手填。
    // 不标 thinking —— 结论不变，但理由从"没验证"升级为一手实测（2026-10-02）：
    //   · 官方 /docs/zen 与 /docs/go 全文【零提及】reasoning / effort / thinking 控制参数。
    //   · 端点确实会【透传并校验】reasoning_effort，不是静默忽略：space-bunny-free 上
    //     `none` → 400 invalid_request_error「Upstream request failed」；`minimal/low/high`
    //     → 200；未知字段 `zzz_bogus` → 200 被忽略。⇒ 与 openrouter/cerebras 同属
    //     OpenAI-compat passthrough，发错值就是每请求 400（不透传即不伤，但传错必炸）。
    //   · 然而逐 SKU 的档位/关闭语义【无 key 证不了】：匿名只有 space-bunny-free 回
    //     completion，付费档全 401 AuthError、其余 *-free 403 FreeTierError；网关背后
    //     Claude/GPT/Gemini/DeepSeek 各线把 reasoning_effort 映射成什么，一手文档没写。
    //   ⇒ 保持不标 = 不发 reasoning_effort，走各模型服务端默认（推理默认开）。这是
    //     【有意的保守】，不是漏标。
    // ⚠ 若要改标：别套 reasoningEffortOrNone / reasoningEffortBinary —— 二者关闭态都发
    //   `none`，实测会被 400。真要加得先带 key 逐 SKU 测出厂商认的最低合法档（space-bunny-free
    //   上 `minimal` 使 reasoning_content 归零 ≈ 关），再按 pickThinkingLevel 填 thinkingLevels。
    // ⚠ models.dev 给这批 SKU 标 reasoning=True 只是在【分类底座模型】，不代表 opencode 这条
    //   聚合端点暴露"可控 thinking"；本次正是顺这条线索去一手核实，结论仍是不标。
    // ⚠ 复核用无 key 探针：AuthError = 模型在（不带 Authorization 头回 "Missing API key."，
    // 带无效 key 回 "Invalid API key."，两种都算可用）；ModelError "… is not supported"
    // = 已下架；"… for format X" = 走不了该协议；FreeTierError 403 = 免费档【匿名】被拒。
    // ⚠ 【/v1/models 在册 ≠ 未弃用】(2026-10-01 抓到,当日复测坐实):docs
    // (opencode.ai/docs/zen) 的 "Deprecated models" 表与 /v1/models 并存冲突 ——
    // minimax-m2.5 / glm-5 / kimi-k2.5 在弃用表里(8-05/5-14/8-05)却仍留在目录里。
    // 反向也成立:表里的 Claude Opus 4.1 已从目录消失。判弃用必须以 docs 表 + 探针
    // 交叉为准，只拉目录会把死 SKU 当活的收进来。
    models: [
      // 免费档（7 条；条款见上第 ④ 条。2026-09-25：mimo 换 2.6 代；space-bunny 是
      // 唯一【匿名也能打通】的免费档 —— 免 key 探针直接返回了 completion，其余都要
      // key。2026-10-01：space-bunny 升为默认，原因见 defaultModel 上方注释）
      { label: "Space Bunny (free)", value: "space-bunny-free" },
      // ⚠ 2026-10-01 实测探针恒 400 server_error「Model is unavailable」（目录在册、
      // docs 弃用表无它,疑似上游通道故障）—— 暂留在清单，但已从默认位撤下。
      { label: "DeepSeek V4 Flash (free)", value: "deepseek-v4-flash-free" },
      { label: "Big Pickle (free)", value: "big-pickle" },
      { label: "MiMo V2.6 Flash (free)", value: "mimo-v2.6-flash-free" },
      { label: "Ling 3.0 Flash Fin (free)", value: "ling-3.0-flash-fin-free" },
      { label: "Nemotron 3 Ultra (free)", value: "nemotron-3-ultra-free" },
      { label: "Nemotron 3.5 Lightning (free)", value: "nemotron-3.5-lightning-free" },
      // 付费档，输入价升序（$0.14 → $4.00 / 1M，Zen 价格页 2026-09-25 核对）
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash" },
      { label: "Qwen3.8 Flash", value: "qwen3.8-flash" },
      { label: "GLM 5.3 Flash", value: "glm-5.3-flash" },
      { label: "MiniMax M3", value: "minimax-m3" },
      { label: "Qwen3.6 Plus", value: "qwen3.6-plus" },
      { label: "Kimi K2.6", value: "kimi-k2.6" },
      { label: "Claude Haiku 4.5", value: "claude-haiku-4-5" },
      { label: "GLM 5.3", value: "glm-5.3" },
      { label: "Gemini 3.8 Flash", value: "gemini-3.8-flash" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      // 2026-10-01:sonnet 档按「每族只留最新代」换成 claude-sonnet-5-5（目录在册、
      // 免 key 探针 AuthError 过闸）。它的价格行还没在 Zen 价格页核到，升序位置
      // 暂沿旧 sonnet 档，价格核实后再调。
      { label: "Claude Sonnet 5.5", value: "claude-sonnet-5-5" },
      // grok-4.7 与 4.6 同价（$2/$6）更新代 —— 按「同价旧代不留」替换。
      { label: "Grok 4.7", value: "grok-4.7" },
      { label: "Kimi K3", value: "kimi-k3" },
      // opus-5-5 比 opus-5 更新且【更便宜】($4/$20 vs $5/$25)，直接替换。
      { label: "Claude Opus 5.5", value: "claude-opus-5-5" },
    ],
  },
  opencodeGo: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenCode Go",
    endpoint: "https://opencode.ai/zen/go/v1/chat/completions",
    // 与上方 opencodeZen(Zen)【同 host、同账号、同一把 key】,只有三处不同:路径
    // (/zen/go/v1 vs /zen/v1)、在售 SKU 集合、计费形态 —— 所以这里是【独立条目】,
    // 不是 opencodeZen 的 endpoints[] 变体。变体机制只共享 provider 级 models[],
    // 而两边在售集合不同(2026-09-25 实拉:交集已涨到 26/42，但 Go 仍有 16 条 Zen
    // 没有的选品 —— muse-spark/longcat/mimo-2.6 系/免费档),计费形态更不同。
    // 「填了 key」在两边含义不同:Go 是 $10/月的订阅额度(官方按每模型月限额换算:
    // 5 小时 = 20%、周 = 50%、月 = 100%),Zen 是充值余额 —— UI 文案里别把 Go
    // 写成"充值即用"。官方限定一个 workspace 只能有一人订阅 Go。
    //
    // ⚠ 官方定位是【编程 agent】:"designed for OpenCode and other coding agents
    // that produce similar types of requests. Traffic is monitored for abuse that
    // degrades the experience for other users." 字幕翻译的流量形态与这个预期不符。
    // 官方没禁止第三方客户端(还专门列了一份 Validated Clients 名单),但上游一旦
    // 收紧,这家是最先被砍的。用户付的是自己的订阅钱,这句话留在这里让他知情。
    defaultModel: "mimo-v2.6-flash",
    defaultTemperature: 0.7,
    docs: "https://opencode.ai/docs/go/",
    apiKeyUrl: "https://opencode.ai/auth",
    // 默认取 mimo-v2.6-flash：它在 Go 的 chat/completions 集合里【三条价格轴同时最低】
    // (输入 $0.14、输出 $0.28、缓存读 $0.0028 每 1M),月限额又落在最高的 $60 档。
    // 2026-09-25 由 mimo-v2.5 换代：官方 Go 价格表里 2.6-flash 与 2.5 三条价格轴
    // 同价、同 $60 限额档 —— 按「同价旧代不留」直接替换，选它的理由一字未变。
    // 字幕翻译请求多而碎、且依赖提示缓存,缓存读价直接决定总成本。
    // 质量排序这里无法验证,别把它当结论 —— 要更强的模型在下拉里换即可
    // (glm-5.3-flash 同为 $60 档、输入 $0.15)。
    //
    // 上游与 Zen 同 host,CORS 状况逐字一致:OPTIONS 预检返回站点 404 HTML、
    // 一个 CORS 头都不发(2026-09-16 实测),浏览器直连必死 —— 故默认开 relay。
    //
    // ⚠ 【必须重新部署 Worker,否则网页端仍 400】。路由已在本仓库声明:
    //   scripts/llm-proxy-worker.js 的 PROVIDER_URLS.opencodeGo。
    // 但那份文件是【部署源】,不是运行中的实例 —— 改它不会影响
    // llm-proxy.api2026.workers.dev,必须重新部署才生效。发版前请确认已部署;
    // 未部署时的症状是 POST /api/opencodeGo → 400 {"error":"Unsupported provider…"}。
    // 借道已有的 /api/opencodeZen 不行 —— Worker 按 provider 校验 endpoint 白名单,
    // 回 400「Endpoint not allowed for provider "opencodeZen"」。
    // 自部署 Worker 的用户:这份文件就是配置,加了键即可(见文件头注释)。
    // CLI 不受影响:那条路默认直连(Node 无 CORS),填 Go 的 key 即可用。
    // 尽管部署前打不通,仍按"有中转"声明(不隐藏、不摘掉开关):上游 CORS 确实是死的,
    // 写 false 等于宣称"直连默认可用",那是假的;缺的是 Worker 侧那一跳,
    // 不是这里该给出的判断。
    defaultUseRelay: true,
    // ⚠ 唯一该发的自定义头。官方原话:"Identify itself with its own user agent,
    // such as my-coding-agent/1.0, rather than a generic SDK or HTTP-library name."
    // 浏览器侧 fetch 会【静默丢掉】User-Agent(它是 forbidden header name,且不计入
    // 预检的 Access-Control-Request-Headers)—— 预检集合因此不变,不需要为它调整
    // CORS 语义(Authorization / content-type 本来就在白名单里)。
    // ⚠ 但它【必须】在 Worker 的 FORWARDED_HEADERS 里:那份白名单同时兼作【转发】
    // 白名单,不在其中的头会被中转【静默剥掉】,于是直连与中转行为悄悄分叉 ——
    // workerParity.test.ts 第三条断言拦的正是这件事(relay provider 的 extraHeaders
    // 必须全部在白名单内)。"user-agent" 在这份白名单里 —— 加它【不会】放宽 CORS:
    // 浏览器本来就设不了这个头,白名单多一项对预检集合没有任何影响。
    // Node 侧照发,而 Node 默认 UA 正好是 `undici`,一个通用 HTTP 库名,恰是官方
    // 点名不要的那类 —— 这个头实际只在 CLI 生效,而 CLI 正是需要它的那侧。
    // 不写版本号:registry 是静态数据,写死的版本发一次版就失真,而这里没有可用的
    // 构建期注入(导入 package.json 会把整份依赖清单打进客户端包)。
    extraHeaders: { "User-Agent": "subtitle-translator" },
    // 会话 id 的头名（值由流水线每轮生成）。理由与三步改法见下。
    sessionHeader: "x-opencode-session",
    // ⚠ `x-opencode-session`：**官方公告说得很清楚，别再只看文档那句 should**。
    //   官方（@opencode）公告原文：
    //     "Some tools using OpenCode Go are missing the x-opencode-session header which
    //      prevents optimization of prompt caching. If impacted you will receive an email
    //      soon with personalized suggestions on how to fix. **Starting 09/06 requests
    //      missing this header may error.**"
    //   上游报错（多来源复现，错误类型是 `MissingSessionID`）：
    //     `{"type":"error","error":{"type":"MissingSessionID","message":"Error from provider
    //      (Console Go): Request is missing x-opencode-session and cannot be routed
    //      efficiently. Please see https://opencode.ai/docs/go/#where-can-i-use-it"}}`
    //   独立报告：VS Code、DeepSeek Harness、TRAE、CodexPlusPlus#2125、多篇 CSDN 排查文。
    //   ⇒ 判定：**按实际必需处理**（2026-09-06 起会报错）。
    //   ⚠ 官方文档那一页的措辞仍是 "should"、且没有 400 的说法 —— 光读文档会得出反的结论；
    //     但同一页维护着「Validated / Known Problematic Clients」清单，逐个点名哪些客户端
    //     "会话信息缺失"，其中 DeepSeek Harness 那条写着"某些模型路径上缺失"（= 至少部分
    //     路径是硬要求）。文档的软措辞不足以当"可以不发"的依据。
    //   ⚠ 这条我们**复现不了**：会话检查在鉴权之后，无 key 先回 401 AuthError。证据来自
    //     官方公告 + 多个独立用户的实测（其中一人的可用配置就是硬编码一个 UUID 填这个头，
    //     说明要求是【存在】而非"每轮稳定"—— 稳定只影响缓存收益，所以我们发每轮 id 是
    //     它的超集：既满足存在，又拿到 routing / prompt caching）。
    //   ⚠ Zen 文档**完全没提**任何请求头 —— 这是 Go 线的事。
    //   ⚠ PR #70 里同时加的 `x-opencode-client`：**两份文档都没有这个头**，别跟着发
    //     （那份可用的社区配置里也只设了 session 一个头，是这条判断的旁证）。
    //     客户端标识官方要求的是 User-Agent（上面 extraHeaders 已经发了）。
    // 已修（2026-09-17）。三处一起改的，缺一处都会「看着修了但没用」：
    //   ① 本条目声明 `sessionHeader: "x-opencode-session"` —— 只声明【头名】；
    //   ② 值由流水线给：`RunCtx.sessionId` 在 runTranslateLines 里生成一次，
    //      经 `TranslateTextParams.sessionId` 传到 services/llm.ts 的请求头里
    //      （**每轮稳定**，不是常量也不是每请求随机 —— 见 types.ts 的注释）；
    //   ③ Worker 的 FORWARDED_HEADERS 加了 "x-opencode-session"
    //      （那份集合兼作 CORS 允许列表，不加就是「浏览器死在预检 + 中转静默剥掉」）。
    // ⚠ **Worker 必须重新部署**，否则网页端仍会 400（症状同下）。
    // ⚠ 也别忘了别的壳：CLI 走的是同一条 pipeline，自动带上，无需额外改动。
    // ⚠ 千万别改成「在 services/shared.ts 的 fetchJSON 里按 url.includes("opencode.ai")
    //   加头」（PR #70 的做法）：中转 URL 形如
    //   `https://<worker>/api/opencodeGo?endpoint=https%3A%2F%2Fopencode.ai%2F…`，
    //   encodeURIComponent 不编码 `.`/字母 → **那段判断在中转时也命中**，而浏览器默认
    //   就走中转；于是预检带上一个 Worker 不允许的头 → **把本来能用的中转弄坏**，
    //   且失败被 withNetworkHint 改写成「请开启 API Relay」，用户会去开一个已经开着的
    //   开关。层次上也不对：provider 专用头属于 registry，不属于通用传输层。
    // 不标 thinking:与 Zen 同理(同一 host、同一 key、同一透传语义) —— 一手 /docs/go
    // 零提及 reasoning 控制；端点会透传并校验 reasoning_effort(实测证据见 Zen 条目),
    // 但 Go 的付费档无 key 全 401、逐 SKU 关闭语义证不了,故照旧不发。改标的护栏(别用
    // 会发 `none` 的 shape)一并见 Zen 条目。
    //
    // 模型清单：**按输入价升序**（一眼看出成本档位），每个家族只留最新一代。
    // 官方把目录（2026-09-25 实拉 /v1/models 共 42 条）按"主推协议"分成三张表，但那**不是排他约束**：逐条实测只有
    // grok-4.6 在 /v1/chat/completions 上被拒（"not supported for format oa-compat"，
    // 同一条 SKU 在 Zen 上是好的；2026-09-25 复测 grok-4.7 同样被拒，故 grok 家族
    // 仍只收 4.5）。这条文案就是判据：带 "for format X" = SKU 在但走不了该协议；只写 "is not supported" = SKU 不存在。
    // 排除：grok-4.6 / grok-4.7（协议不兼容，见上；**同族的 4.5 收**）、gpt-5.6-luna（GPT-5.x 拒
    // temperature，同 Zen）、代码/视觉/全模态特化（kimi-k2.7-code、
    // deepseek-v4-flash-vision-exp、mimo-v2-omni）、preview / stealth / 定价表里没有的
    // （hy3-preview、hy4-preview、omen-alpha、union-alpha、deepseek-flash、glm-5、
    // kimi-k2.5、mimo-v2-pro、qwen3.5-plus —— 会像 Zen 的 hy3-free 那样无声消失）。
    // ⚠ `muse-spark-1.3-contributor` 的「条款允许拿输入训练」**不是**排除理由：字幕正文不是
    // 个人文档，被信息收集可以接受（用户 2026-09-17 明确确认）。所以 1.3 收，1.2 只是
    // 同族旧代才不收。
    // ⚠ 它**能用于翻译**（已核：Meta 的多模态**推理**模型，1M 上下文 / 131K 输出，支持
    // `temperature` —— 不存在 GPT-5.x 那种拒参数的坑；OpenAI 兼容端点）。但两条要知道：
    //   ① 官方 Go 文档给它的端点是 **`/v1/responses`**，不是 chat/completions。现在网关
    //      允许我们走 chat/completions（无 key 探针过了格式校验，而 grok-4.6 是被明确
    //      拒掉的），但上游一旦按协议强制，它会像 grok-4.6 那样突然 400。
    //   ② 可用性受 **Meta 地理使用政策**限制 —— 部分地区直接不可用。
    //   ③ 它是推理模型，reasoning token 计入输出，实际成本高于标价；官方定位是
    //      "experimentation / early-stage"，别当成稳定档。
    // ⚠ 同价旧代一律不留（glm-5.1/5.2 与 5.3 同价、minimax-m2.5/m2.7 与 m3 同价、
    // deepseek-v4-flash 与 v4.1-flash 同价、qwen3.7-max 比 3.8-max 还贵）——
    // 它们对"一眼看出成本档位"没有贡献，只会让下拉变长。
    models: [
      // 免费档（官方 Go 价格表标 Free / Unlimited，2026-09-25；免 key 探针过格式校验）
      { label: "Space Bunny (free)", value: "space-bunny-free" },
      { label: "Muse Spark 1.3 Contributor", value: "muse-spark-1.3-contributor" },
      { label: "MiMo V2.6 Flash", value: "mimo-v2.6-flash" },
      { label: "Hy3", value: "hy3" },
      { label: "Qwen3.8 Flash", value: "qwen3.8-flash" },
      { label: "GLM 5.3 Flash", value: "glm-5.3-flash" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash" },
      { label: "LongCat 2.0", value: "longcat-2.0" },
      { label: "MiniMax M3", value: "minimax-m3" },
      { label: "Qwen3.7 Plus", value: "qwen3.7-plus" },
      { label: "MiMo V2.6 Pro", value: "mimo-v2.6-pro" },
      { label: "Qwen3.6 Plus", value: "qwen3.6-plus" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      { label: "Kimi K2.6", value: "kimi-k2.6" },
      { label: "GLM 5.3", value: "glm-5.3" },
      { label: "Grok 4.5", value: "grok-4.5" },
      { label: "Qwen3.8 Max", value: "qwen3.8-max" },
      { label: "Kimi K3", value: "kimi-k3" },
    ],
  },
  tokenhub: {
    kind: "openai-compat",
    category: "aggregator",
    label: "TokenHub (Tencent)",
    // 已从原混元平台迁到 TokenHub，依据是迁移指南(document/product/1823/131382)：
    // hunyuan-* 老一代（t1/a13b/turbos/lite/translation 系）在 TokenHub【无迁移路径】
    // 且原平台停止新购 —— 新用户开不通的模型不留。
    // ⚠ 别把这条写成"旧 API host 在某日已死"：公告的停服日期指的是【模型广场 web
    // 控制台】，没点名 API host（实测旧 host 当时仍应答）。迁移结论只靠上面
    // "无路径+开不通"成立。回滚=改 endpoint/defaultModel/models+重部署 worker,
    // 但等于把 provider 钉死在新用户拿不到的模型上。
    //
    // ⚠ 这里是多厂商托管（自研 hy 线 + 转售 deepseek/glm/kimi/minimax/mimo）——
    // 按多厂商托管归 aggregator，与 opencodeZen/siliconflow 同类。
    endpoint: "https://tokenhub.tencentmaas.com/v1/chat/completions",
    defaultModel: "hy3",
    defaultTemperature: 0.7,
    // ⚠ TokenHub 光有 API Key【调不通】:每个模型要先在控制台「在线推理」页
    // 开通 (开启免费体验 / 启用后付费),否则任何调用返回 400 gateway_error
    // code 401006「输入的服务 ID 不存在，或模型与服务不匹配」。判据：401=坏 key,
    // 400/401006=key 有效但模型没开通 —— 实测过四个在册 online 模型全是 401006
    // 即账号一个都没开通。
    // ⚠ 文档之间不一致，别被带偏:《混元调用指南》(1823/132252) 的「前提条件」
    // 只写了「注册账号 + 获取 API Key」,【没提】开通这一步;写了的是《迁移指南》
    // (1823/131382) 的第一步。按实际行为，开通是必须的。
    // 请求形状本身没问题:model 填模型 ID(不是"服务 ID"),与 132252 的官方 curl
    // 示例逐字段一致 —— 用 OpenAI SDK 走 baseURL 也是发同一个请求，不会有差别。
    // 这跟绝大多数 provider「填了 key 就能用」的心智不同 —— 用户配好 key 仍然
    // 400 时，八成是没开通，不是我们的 bug。docs 指向调用概览，apiKeyUrl 指向
    // 控制台 (开通与建 key 都在那里)。
    docs: "https://cloud.tencent.com/document/product/1823/130079",
    // 复核 2026-10-02（真实浏览器「语言模型调用概览」协议表；curl 只得 JS 壳、页面自述更新 2026-09-23）：
    // hy4-preview / hy3 / deepseek-v4-pro / glm-5.3 / kimi-k3 / kimi-k2.6 / minimax-m3 / mimo-v2.6-pro
    // 八条逐字在册 ✓。DeepSeek-V4.1-Flash 的 id 现由【模型列表页 130051】坐实(无需带 key):
    // 同名模型在表里有两条供货路由 id —— 标准 `deepseek-v4.1-flash`(目录在用)与原厂直供
    // `deepseek/deepseek-flash`(130079 协议页展示的那条),两者都合法、指同一模型不同供货路径。
    // bare `deepseek-v4-flash`(无 .1)是【另一代】(V4 非 V4.1),与目录不冲突,别混。
    // 官方「最新的可用模型列表可通过 GET /v1/models 查询，status 为 online 的即为当前可用模型」需 key；
    // 免 key 时 hy3 与乱造 id 同回 401002（鉴权先于模型查找），所以「在册性」只能读文档页。
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/apikey",
    // 浏览器直连不可用 —— 2026-08-19 在【真实浏览器 + 生产 origin】上实测（四种
    // 请求形态全部 Failed to fetch；同页对照组 api.github.com / 我方 Worker 均正常）。
    // ⚠ 验 CORS 别只看错误响应，会得出相反结论 —— 机制：
    //   - TokenHub【只在应用层成功响应上】发 CORS 头（带有效 key 的 GET /v1/models
    //     确实带 ACAO: *）;
    //   - 但所有错误路径 (401/400) 与 `OPTIONS`(全路径 405) 都【不发】;
    //   - 带 Authorization 的请求必然触发预检 → 预检非 2xx → 浏览器当场掐断，
    //     永远走不到那个会放行的成功响应。
    // 故 relay 是必需路径。上游哪天补上 OPTIONS 处理就能直连，开关照旧留给用户。
    defaultUseRelay: true,
    // 两个地域都经中转：客户端把选中的节点作为 ?endpoint= 传给 Worker，后者从
    // 自己声明的集合里校验并转发。这两个 URL 必须与 worker 的 tokenhub 数组一致。
    // ⚠ 【API Key 是分地域的】,换地域要换 key —— 症状对照：拿广州 key 打新加坡节点
    // 报 401002「API Key 不存在或签名校验失败」（不是中转坏了）;打广州自己则报
    // 401006（key 有效、模型未开通）。
    endpoints: [
      { label: "Mainland (CN)", url: "https://tokenhub.tencentmaas.com/v1/chat/completions" },
      { label: "International", url: "https://tokenhub-intl.tencentmaas.com/v1/chat/completions" },
    ],
    // ⚠⚠ 本条 endpoint 改动【必须同步重新部署 Cloudflare Worker】:
    // scripts/llm-proxy-worker.js 的 PROVIDER_URLS.tokenhub 已在同一 commit 里
    // 指向 TokenHub，但那是【部署源】,不重新部署的话线上 Worker 仍然把
    // /api/tokenhub 转发到旧域 —— 而 relay 是本 provider 的默认路径，等于所有
    // 默认配置的用户拿 hy3 去打老平台，必失败。workerParity.test.ts 只能保证
    // 仓库里两处一致，保证不了线上那份。
    //
    // model id 以 TokenHub 模型列表 (document/product/1823/130051) 为准。
    // `hy3` 256k(最大输入 192k / 输出 128k),无下线标注。
    //
    // ⚠ 混元的【专用翻译模型】(hy-mt2-pro/plus/lite) 【刻意不收】。它们确实在同一个
    // /v1/chat/completions 端点上、同样的 messages 形状，看起来一行就能加进来，
    // 但规格上就不适合本项目这条管线 —— 模型列表原文：三者都是 **8k 上下文，
    // 最大输入/输出各 4k**。而这里的默认是 contextWindow 50 行 + 系统提示词 +
    // 术语表，4k 输入上限会直接顶爆。别再"顺手补上"这几个 SKU:端点兼容 ≠ 能塞进
    // 按通用对话模型设计的管线 (提示词/术语表/上下文窗口/双语装配)。
    // 真要支持专用 MT，应该按 machine-translation 类别另起一个 provider。
    //
    // TokenHub 是【聚合网关】,除自研 hy3 外还转售 deepseek / glm / kimi / minimax /
    // qwen / mimo，所以按本表其他聚合网关 (openrouter / opencodeZen / siliconflow /
    // atlascloud / nvidia) 的一贯做法把主流型号列出来 —— 一个 key 一份额度就能用到
    // 这些模型，正是聚合网关的价值所在;"那几家各自有一手 provider" 不构成不列的
    // 理由 (否则 openrouter 那份清单也不该存在)。
    // 未收录的:hy3-preview(8-31 下线)、hy-mt2-*(见上)、glm-5v-turbo(视觉)、
    // hunyuan-role-latest / hy-role(角色扮演)、kimi-k2.7-code*(代码向)、
    // 带日期的 deepseek-v4-*-2026xx(裸 id 已在)。
    //
    // ⚠ 全部【不打 thinking 标签】,同 atlascloud 的处理：这是个混合上游的网关，
    // 「能不能关思考」逐个模型不同 —— TokenHub 模型支持表里 hy3 默认 disabled,
    // 而 Kimi-K2.7-Code / MiniMax-M2.7 明确标「enabled(不支持关闭)」。没有逐个
    // 核实之前，统一发 thinking:{type:"disabled"} 会打到不支持关闭的那些型号上。
    // 代价要说清楚：选 deepseek-v4 / glm-5.3 / kimi-k3 这类服务端默认开推理的型号，
    // 在这里会按它自己的默认推理 (比一手 provider 多烧 token)—— 要精确控制思考，
    // 用本表里对应的一手 provider。
    // 将来要在这里做开关的话：网关级字段是 thinking:{type:"enabled"|"disabled"|
    // "adaptive"}(文档 1823/135872),需要先核出【每个型号】支不支持 disabled。
    //
    // Not thinking-tagged，但理由跟别处不同 —— 不是"不能关",而是"本来就是关的"。
    // 官方《OpenAI Chat Completions 协议字段说明》(1823/135872) 对 hy3 原文：
    // 「默认关闭思考，默认推理强度 `low`」,`thinking.type` 合法取值三个：
    // `enabled` / `disabled` / `adaptive`。
    // 既然服务端默认就是关的，省略参数 = 不推理 = 翻译要的行为，不打标签最省事，
    // 也不会像 SERVER_DEFAULT_THINKING_ON 那几家一样偷烧推理 token。
    //
    // 要加思考开关是可行的 (三个取值都合法),代价是三处:models 里给 hy3 打
    // `thinking: true`、THINKING_BUILDERS 加一条 `gated("tokenhub", thinkingType)`、
    // 把 tokenhub 放进 BINARY_EFFORT_VENDORS;另外 thinking.test.ts 里
    // 「tokenhub & minimax M2.x send no thinking body」那条断言要跟着改。
    // ⚠ 别用 `reasoning_effort:"none"` —— TokenHub 只列了 low/medium/high。
    // 清单以 `GET /v1/models` 实拉为准 (带 `status` 字段，比翻文档准):只收
    // status="online" 的文本对话模型，"pre-offline" 的一律不收 —— 历次删掉的
    // 同代 id（k2.5 / minimax-m2.5 / qwen3.5 系 / deepseek-v3.2 / hy3-preview）
    // 当时实测全是 pre-offline，这条判据一直在先杀后将死条目。
    // 另外排除:*-code(代码向)、glm-5v-turbo(视觉)、hy-role/hunyuan-role(角色)、
    // hy-mt2-*(见上)、embedding/video/image/3d/asr/speech 各类非对话模型。
    models: [
      // 2026-09-25 浏览器复核模型列表文档 (1823/130051，/v1/models 免 key 拉不了)：
      // deepseek 换代到 v4.1-flash（v4-flash 行仍在列，按「同族旧代不留」不并收）;
      // mimo 两代并存，v2.6-pro 已上架 → 直接换成 2.6（v2.5 原生 10-21 退役，
      // 这里没必要收将老的那条）。表里另有 glm-5.3-flash/flashx、kimi-k2.7-code
      // 系、k2.8-preview、step-5-preview、minimax-m2.7 —— 按既有排除
      // (细分档不收/*-code 不收/无名 preview 不收/同族旧代不收) 维持不列。
      // 2026-10-01 文档复核:自研新一代 hy4-preview 上架（1M 上下文）。「无名 preview
      // 不收」排的是转售线;hy 自研线例外收 —— hy3 当初也是从 preview 长出来的。滚动
      // 换代的风险同 doubao evolving 那条（缓存会命中旧代），所以只进下拉、不作默认。
      { label: "Hunyuan hy4 Preview", value: "hy4-preview" },
      { label: "Hunyuan hy3", value: "hy3" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      { label: "GLM-5.3", value: "glm-5.3" },
      { label: "Kimi K3", value: "kimi-k3" },
      { label: "Kimi K2.6", value: "kimi-k2.6" },
      { label: "MiniMax M3", value: "minimax-m3" },
      { label: "MiMo V2.6 Pro", value: "mimo-v2.6-pro" },
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
    // 来自 console.groq.com/docs/models 当前 production 列表（2026-09-25 以
    // 机器可读的 /docs/models.md 复核）。preview 阶段的不收录（含新出现在
    // preview 层的 qwen/qwen3.8-27b、minimax-m2.7），避免引导用户选随时可能下线的 SKU；
    // 带 Enterprise 标的 llama-3.1/3.3 行是企业主专属，普通账号开不了，不收。
    // gpt-oss 系列支持 reasoning_effort(top-level enum),其他 model 不支持。
    // ⚠ groq/compound 系已于 2026-09-21 停服、llama-3.1/3.3 通用档已于 08-16 退役
    // (console.groq.com/docs/deprecations)—— 别按旧清单往回加。至此 production
    // 通用文本层就只剩 gpt-oss 两档：Groq 当前的生产层就这么大。
    models: [
      // thinkingLevels:console.groq.com/docs/reasoning(2026-08-20 核对)——
      // gpt-oss 只收 low/medium/high,【没有 none】。与 gemini/grok 同族：厂商不提供
      // 关闭开关，关闭态发最低档 low。
      // ⚠ 曾经关闭态【省略】该参数 —— 那是落到服务端默认 (未文档化，gpt-oss
      // 惯例是 medium),用户点了"关"却按中档推理计费，方向正好反了。
      { label: "GPT-OSS 20B", value: "openai/gpt-oss-20b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-OSS 120B", value: "openai/gpt-oss-120b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
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
    // 收录它【不是为了模型】—— 同款开源权重模型在别家 (groq / 一手厂商) 也
    // 多半能调到。卖点是【速度】:官方标称
    // ~3000 tokens/s(gpt-oss-120b),约为 groq 同款的三倍;逐行翻译是高频短
    // 请求，吞吐直接变成用户感知的等待时间。另有每日 100 万 free token。
    // 同一个开源模型在不同厂商下速度/价格不同，本就是并存多个聚合器的理由。
    //
    // 清单以官方 Model Catalog 为准 (inference-docs.cerebras.ai/models/overview,
    // 2026-08-20 核对):public endpoints 就这两个，其余在 Dedicated Endpoints
    // (需预留产能，不是个人自助能用的),不收。
    // ⚠ /v1/models 需鉴权，无法免 key 实拉;复查请读上面的 Model Catalog 页
    // (它有 llms.txt 机器可读索引)。
    models: [
      // thinkingLevels 抄自官方 API 参考的逐模型 reasoning_effort 取值
      // (2026-08-20):gpt-oss-120b 收 low/medium(默认)/high —— 【没有 none】,
      // 与 groq 上的同款一致，故关闭态发最低档 low(canDisableThinking→false,
      // 界面标 Min)。qwen-3.8-27b 则【有 none】(官方原文 "Reasoning is enabled by
      // default at high. Set reasoning_effort to none to disable it.")，
      // 属于能真正关掉的一档，所以它不声明 thinkingLevels、走 reasoningEffortOrNone
      // 那条路 (见 llm.ts 的 cerebras builder)。
      //
      // ⚠ gemma-4-31b 曾收录、已删：Cerebras 的**公开端点**如今只剩下面两条
      // （其余家族只走 Dedicated Endpoints）,留着就是选中必 404 的死条目。
      { label: "GPT-OSS 120B", value: "gpt-oss-120b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      // 打 thinking 标签：它【支持】reasoning_effort(none/low/medium/high，默认 high)。
      // 不打的话 gated() 会把它当"已知非思考模型"直接省略参数 —— 省略与发 none 等效，
      // 所以漏打不会出错、只会让用户无法开启思考(下拉里没有档位控件)。
      // 不声明 thinkingLevels:它有真正的关闭值 none，走 reasoningEffortOrNone 那条路。
      { label: "Qwen 3.8 27B", value: "qwen-3.8-27b", thinking: true },
    ],
  },
  siliconflow: {
    kind: "openai-compat",
    category: "aggregator",
    label: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V4.1-Flash",
    defaultTemperature: 0.7,
    docs: "https://docs.siliconflow.cn/docs/api/chat-completions-post",
    apiKeyUrl: "https://cloud.siliconflow.cn/me/account/ak",
    defaultUseRelay: false,
    // 来自 siliconflow.com/pricing 当前文本生成模型表
    // 登录后查看 https://cloud.siliconflow.cn/me/models?types=chat
    // DeepSeek V4 和 Kimi K2.6 通过 SiliconFlow 走 OpenAI-compat 协议
    // (同原生 DeepSeek/Moonshot 的 thinking + reasoning_effort 参数)。
    // ⚠ SiliconFlow 的 id 大小写与前缀都很挑，写错就是 404，一律以 pricing 页
    // 实际字串为准：
    //   - org 前缀是 MiniMaxAI(非 minimax),小写会 404
    //   - `Pro/` 前缀：2026-08 曾按「只有 Pro 付费档」把 GLM-5.1 / Kimi-K2.6 写成
    //     Pro/ 形态;2026-10-01 复核公开 models 详情页 (siliconflow.com/models/*),
    //     官方字面就是裸 id —— 清单回归裸 id。Pro/ 串在登录侧是否仍可调未核,
    //     公开口径以裸 id 为准。
    //   - GLM-4.7 已从 pricing 页下架，移除
    // MiniMax-M3、Qwen3.8 现已在 pricing 页在册（2026-10-01）。是否收编仍按成本梯度与代际判:Qwen3.8 旗舰收，MiniMax-M3 暂不搬
    // (登录侧档位未核)。别家在售 ≠ 这里必收，但也别再写「核过不在」的死断言。
    // 默认 deepseek-ai/DeepSeek-V4.1-Flash:2026-10-01 公开 pricing 与
    // models 详情页 (siliconflow.com/models/deepseek-v4-1-flash) 双证在册，
    // 旧的「若 404 退回 V4-Flash」兜底口径撤除。
    models: [
      { label: "DeepSeek V4.1 Flash", value: "deepseek-ai/DeepSeek-V4.1-Flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-ai/DeepSeek-V4-Pro", thinking: true },
      { label: "Kimi K3", value: "moonshotai/Kimi-K3" },
      // ⚠ K3 不打 thinking:k3 仅思考模式、不收 thinking 参数(见原生 moonshot 条目),
      // 而这里的注入是原生 thinking:{type} 透传 —— 打了标签 off 态就是对它发非法参数。
      { label: "Kimi K2.6", value: "moonshotai/Kimi-K2.6", thinking: true },
      // ⚠ 不打 thinking：GLM-5.3 上游强制思考、不可禁用(同 zhipu / openrouter 的判据)。
      // （5.2 已删：同价、被 5.3 支配 —— 它唯一的卖点是能关思考，不足以留住旧代。）
      { label: "GLM-5.3", value: "zai-org/GLM-5.3" },
      { label: "GLM-5.1", value: "zai-org/GLM-5.1" },
      { label: "Qwen3.8 2.4T", value: "Qwen/Qwen3.8-2.4T-A95B" },
    ],
  },
  atlascloud: {
    kind: "openai-compat",
    category: "aggregator",
    label: "Atlas Cloud",
    endpoint: "https://api.atlascloud.ai/v1/chat/completions",
    // 默认接同族最新代 v4.1-flash（2026-10-01 实拉在册；v4 裸代仍在清单作便宜档）。
    defaultModel: "deepseek-ai/deepseek-v4.1-flash",
    defaultTemperature: 0.7,
    docs: "https://www.atlascloud.ai/docs",
    apiKeyUrl: "https://www.atlascloud.ai/console/api-keys",
    defaultUseRelay: false,
    // Atlas Cloud exposes a shared OpenAI-compatible endpoint for its hosted
    // text models. Keep thinking controls hidden because support and request
    // shape vary by the selected upstream model.
    // ⚠ 目录的 `is_ready` 字段【不可】当下架信号（2026-10-01 实拉：全目录 78 false /
    // 46 undefined / 0 true —— 它根本不是可用性语义）。判在册以 /v1/models 字面为准。
    // 2026-10-01 实拉在册新增三条（带 -aws/-az/-ccmax/-coding 后缀的镜像/渠道变体
    // 一律不收）:deepseek v4.1-flash 同族最新代、kimi-k3、claude-sonnet-5。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/deepseek-v4-flash" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-ai/deepseek-v4.1-flash" },
      { label: "Kimi K3", value: "moonshotai/kimi-k3" },
      { label: "Claude Sonnet 5", value: "anthropic/claude-sonnet-5" },
      { label: "Qwen3.8 Max", value: "qwen/qwen3.8-max" },
    ],
  },
  // GitHub Models(models.github.ai) 已整家退役 —— 2026-07-30 官方 changelog
  // 「GitHub Models is now retired. The playground, model catalog, inference API,
  // and bring your own key (BYOK) are no longer available to any customer」,
  // catalog 端点实测 HTTP 410 Gone。整个 provider 已删除，不是删几个模型：
  // 它没有任何可替换的端点，留着等于给用户一个必定失败的选项。
  // 官方迁移指向 Azure AI Foundry(本表里的 azureopenai)。
  nvidia: {
    kind: "custom",
    category: "aggregator",
    label: "Nvidia NIM",
    docs: "https://build.nvidia.com/explore/discover",
    apiKeyUrl: "https://build.nvidia.com/",
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v4.1-flash", temperature: 0.7, thinkingEffort: {}, batchSize: 20, contextBatchSize: 3, contextWindow: 50 },
    // model id 一律以 integrate.api.nvidia.com/v1/models 实拉为准 ——
    // build.nvidia.com 展示页的 slug 跟真实 id 不是一回事，别照着网页抄。
    //
    // ⚠ 2026-08 核查发现两个 id 已失效，其中一个还是【默认模型】(整个 provider
    // 开箱即 404):
    //   - deepseek-ai/deepseek-v4-flash → 现在只有带日期的 `-0731`,裸 id 不存在
    //   - deepseek-ai/deepseek-v4-pro   → NIM 上【完全没有】V4 Pro
    // ⚠ 2026-09-17 再核一遍，又抓到两条，且两条都【只有实拉 /v1/models 才看得见】
    // （build.nvidia.com 的展示页看不出）—— 这个端点不带 key 也返回 200，82 条全量
    // 目录，所以本清单每一条都能直接核，别等用户报 404：
    //   - openai/gpt-oss-120b → 页面上 `isDeprecated:true`，且【不在】/v1/models 里
    //     = 已下架。当初按展示页抄进来的 id 是个死条目，换成同门的 openai/gpt-oss-20b
    //     （在册、isDeprecated:false）。
    //   - deepseek-ai/deepseek-v4-flash-0731 → 页面 attributes 挂着
    //     `DEPRECATION: 09/19/2026`，原文「This API will be deprecated on 09/19/2026.
    //     It will no longer be supported after 09/21/2026.」。它当时是【默认模型】——
    //     按本仓「老模型不留，免得用户选中一个随时会消失的选项」的既定规则（见 minimax
    //     M2.5 那段）一并删掉。
    //     2026-09-25 复拉：该前缀下重新有了 deepseek-v4.1-flash（在册、无弃用标记），
    //     外加代码模型 deepseek-coder-6.7b-instruct。
    //
    // 2026-09-25 复拉补充：目录另有 nvidia/nemotron-4-340b-instruct（与 reward）——
    // 那是 3 Ultra/Super 世代之前的旧命名线，不收（当时按「展示页看不出代际」犹豫过，
    // 立此存照免得下次再问「4 怎么没列」）。
    //
    // 2026-10-01 复核固化两条方法:/v1/models 已缩到 81 条（deepseek-v4-flash-0731 如
    // 预告消失,前次删除正确）;`isDeprecated` 字段【只能】从 build.nvidia.com/{org}/{slug}
    // 单页 RSC 里拿（/v1/models 与展示页列表都不含它）—— kimi-k3 与
    // nemotron-3.5-lightning-30b-a3b 单页 false，glm-5.3-flash 单页未取到标记、以
    // /v1/models 在册为准收。当日新收这三条（均实拉在册）:k3 是目录里唯一在售的
    // Kimi 旗舰,lightning-30b 是 Nemotron 3.5 新代,glm-5.3-flash 补上 GLM 通道。
    //
    // 默认 2026-09-25 换回 deepseek-ai/deepseek-v4.1-flash：NIM 在本表的存在理由
    // 就是「DeepSeek 通道」，此前退到 gemma-4-31b-it 纯粹因为 v4-pro/v4-flash 双双
    // 失效、目录里没活的 DeepSeek（见上）；如今 v4.1-flash 在册无弃用 → 回归本位。
    // 计费口径：NIM 公共端点【就是免费节点】(限额/限速，不按 token 收费) ——
    // 2026-09-26 官网复核坐实：developer.nvidia.com 官方博客 2024-07-29
    // 「Access to NVIDIA NIM Now Available Free to Developer Program Members」
    // (托管端点发放 free credits)；2026 年开发者论坛官方回复原文
    // 「Many of you are using free tier API access to NVIDIA NIMs」，默认限速
    // 40 RPM。OpenRouter 上 NVIDIA 托管节点标 $0 为第三方旁证。
    // 免费 ⇒ 默认选品只看译文质量不看成本，flash 档是最优解；
    // 清单里的 Nemotron/Gemma 仍是能力/延迟对照档。
    //
    // 2026-09-25 起本 provider 【重新有】thinking 模型：deepseek-v4.1-flash 上架
    // （此前 v4-pro 移除后一度为零，故 defaults 里的 thinkingEffort 也删过 —— 现已随
    // 上架恢复）。注入走 service 内联的 buildNvidiaThinkingParams（chat_template_kwargs
    // 嵌套，那条实现一直留着没删）。NIM 服务端默认【关】思考（opt-in），省略 = 关，
    // 所以它不进 SERVER_DEFAULT_THINKING_ON、off 态无需显式 disable。
    // 要 thinking 也可走原生 DeepSeek provider;新 SKU 的实际效果未逐档实测。
    models: [
      { label: "Nemotron 3 Ultra 550B", value: "nvidia/nemotron-3-ultra-550b-a55b" },
      // gpt-oss / kimi / glm / nemotron 都不打 thinking:nvidia 的注入是 DeepSeek 专属
      // chat_template_kwargs 嵌套，发给非 DeepSeek 型号是错误形状;gpt-oss 推理本就
      // 默认开 (medium),其余按上游自己的默认走。2026-10-01 三条新收同此判据。
      { label: "GPT-OSS 20B", value: "openai/gpt-oss-20b" },
      { label: "Gemma 4 31B IT", value: "google/gemma-4-31b-it" },
      { label: "Nemotron Super 120B", value: "nvidia/nemotron-3-super-120b-a12b" },
      { label: "Nemotron 3.5 Lightning 30B", value: "nvidia/nemotron-3.5-lightning-30b-a3b" },
      { label: "Kimi K3", value: "moonshotai/kimi-k3" },
      { label: "GLM-5.3 Flash", value: "z-ai/glm-5.3-flash" },
      // 2026-09-25 实拉 /v1/models 新增：NIM 上唯一在册的 DeepSeek 对话新代，
      // 打 thinking 标签（NIM 默认关思考，见上面那段）。
      { label: "DeepSeek V4.1 Flash", value: "deepseek-ai/deepseek-v4.1-flash", thinking: true },
    ],
  },
  azureopenai: {
    // 【2026-09-26 并入 openai-compat 工厂】前提事实见下面「悬案结案」段：v1 API
    // 接受裸 api-key 走 Authorization: Bearer —— 与工厂 wire 完全同型，手写 service
    // 已删，思考参数走 gated("azureopenai", reasoningEffortOrNone)。
    // endpoint 全员唯一留空：地址就是每个租户自己的资源根 (用户填，URL_ALSO_REQUIRED
    // 拦空)，没有官方固定地址可声明；URL 补全在 wireUrlNormalizer 里走
    // completeAzureUrl（拼 /openai/v1/chat/completions）。中转同理没有固定上游
    // 可写进 Worker → 无 defaultUseRelay（结构性例外，见 OpenAICompatProviderSpec 注释）。
    kind: "openai-compat",
    category: "aggregator",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure",
    endpoint: "",
    // 无 defaultTemperature = 永不下发 temperature：微软官方把 temperature 列入
    // reasoning 模型 Not Supported 清单 (GPT-5 全系，learn.microsoft.com/azure/
    // ai-foundry/openai/how-to/reasoning),运行时证据为 400;统一 provider 级不发。
    defaultModel: "gpt-5.4-mini",
    // GPT-5 系列全部支持 reasoning(OpenAI 原生 + Azure 镜像同行为)。
    // ⚠ 例外是 gpt-chat-latest(5.5 Instant 别名,Preview 且滚动更新 —— 最新快照
    // 2026-08-06 把上下文从 128k 提到 400k，选它要接受行为随时变)。官方原文:
    // 「gpt-chat-latest uses a fixed, nonzero reasoning level... Unlike other
    // reasoning models, **you can't configure this level with the `reasoning_effort`
    // parameter**」—— 它【收不了 reasoning_effort】，所以下面那条不打 thinking 标签。
    //
    // GPT-5.6 系列 (sol/terra/luna) 已在 Azure GA(doc 标 NEW,2026-07-09 快照，
    // 1,050,000 上下文)。⚠【故意不设为默认】:官方原文「Some quota tiers require
    // quota requests for gpt-5.6 to deploy this model. Tier 5 and Tier 6
    // subscriptions have quota by default」—— 低配额订阅要先申请才能部署，设成默认
    // 会让一部分用户开箱即失败。默认保持 gpt-5.4-mini。
    // 2026-10-01 官方 models 页复核:GPT-6 系已在 Azure 上架（astra 09-03、
    // luna/sol 09-22、6.1-sol 09-29 标 NEW）—— 按原生口径补录 astra/luna/6.1-sol。5.6 系保留:Azure 侧仍在 GA 列表，且 6 系
    // 的配额门槛未逐档核实。默认仍 gpt-5.4-mini，配额兜底理由不变。
    //
    // 【2026-09-25 已迁移 v1 GA API】：base 走 /openai/v1/ 且不传 api-version
    // （官方原文「api-version is no longer a required parameter with the v1 GA
    // API」）。apiVersion 配置字段随之整体删除 —— types/config/pipeline/validation/
    // UI 各触点一并清掉；migrateConfig 的 defaults-key-only 合并会清掉用户已存的
    // 旧 apiVersion。
    // 【2026-09-26 官网复核，悬案结案】此前悬着的「/openai/v1 认不认
    // Authorization: Bearer <裸 api-key>」——认。官方 v1 API 文档
    // (learn.microsoft.com/azure/foundry/openai/api-version-lifecycle) 的
    // key 认证示例就是裸 OpenAI 客户端 `new OpenAI({ baseURL: ".../openai/v1/",
    // apiKey })`（Python/JS/C#/Go/Java 一致），而该客户端只发 Bearer、不发
    // api-key 头；REST 页签则另列 api-key 头两条路都通。⇒ 同日本仓并入工厂。
    models: [
      { label: "GPT-6 Astra", value: "gpt-6-astra", thinking: true },
      { label: "GPT-6.1 Sol", value: "gpt-6.1-sol", thinking: true },
      { label: "GPT-6 Luna", value: "gpt-6-luna", thinking: true },
      { label: "GPT-5.6 Sol", value: "gpt-5.6-sol", thinking: true },
      { label: "GPT-5.6 Terra", value: "gpt-5.6-terra", thinking: true },
      { label: "GPT-5.6 Luna", value: "gpt-5.6-luna", thinking: true },
      // ⚠ 【不打 thinking】(2026-09-17 核 Azure 官方页):它收不了 reasoning_effort,
      // 打了标签关闭态就会发 reasoning_effort:"none" → 对它是非法参数。不打 → 整个省略,
      // 模型按自己那个固定档思考,请求合法。同 GLM-5.3 / MiniMax M2.x 的处置。
      // 代价:UI 上它没有思考开关 —— 它本来也关不掉,如实反映。
      { label: "GPT-chat-latest", value: "gpt-chat-latest" },
      // ⚠ 这一条**必须留**，不是"旧代":它是本 provider 的 defaultModel，且理由是官方配额
      // ——gpt-5.6 在低配额订阅上要先申请配额才能部署，把 5.6 设成默认会让一部分用户开箱
      // 即失败（见上面那段长注释）。删了它 defaultModel 就指向不存在的模型。
      { label: "GPT-5.4 Mini", value: "gpt-5.4-mini", thinking: true },
    ],
  },
  // LiteLLM 曾在这里是独立 provider，已并入 llm(Custom) 的端点芯片。理由是它
  // 与 Together AI / Fireworks AI 是同一类东西 —— "一个 OpenAI 兼容地址 + 一份
  // 文档",而那两家一直就只是芯片。独立槽位换来的只是一份可以并存的存档，代价
  // 是下拉里多一项、配置要填两遍、还得单独维护一套 provider 级注册 (凭据分类、
  // preflight 名单、UI 顺序)。芯片各自带 docs 之后，独立 provider 的最后一点
  // 好处 (有文档链接) 也没有了。
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
    // (TranslateGemma 与 MiLMMT 各有专用 service，不要走 Custom —— 它们的提示词
    // 格式是模型卡钉死的，而 Custom 必发 system 消息。MiLMMT 尤其糟：它的 chat
    // template 是纯拼接，system prompt 不会报错，只会被当正文喂进去。)
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
    // 在这里没有意义（"Custom" 没有文档），而这条路恰恰最需要文档：用户得先照着
    // 上游的说明把服务跑起来、把地址和模型名弄对。链接一律写最终落点 (2026-08-21
    // 实测跟随重定向确认，无 locale 段；koboldcpp 于 2026-08-22 补验)。
    // 前四个本地运行时芯片与 translategemma / milmmt 完全一致（含 docs），
    // 改其中一家就三家一起改 —— 同一个用户会在它们之间来回切。
    endpoints: [
      // Local runtimes first, self-hosted gateway next, cloud aggregators after.
      ...LOCAL_RUNTIME_ENDPOINTS,
      // LiteLLM 曾是独立 provider，合并进来了：它和 Together / Fireworks 一样，
      // 无非是"一个 OpenAI 兼容地址 + 一份文档",而后两者一直就是芯片。
      // 独立 provider 只多给一个存档槽位，却要多占一个下拉项、多一份重复配置。
      { label: "LiteLLM", url: "http://127.0.0.1:4000/v1/chat/completions", docs: "https://docs.litellm.ai/docs/" },
      // 9Router / OmniRoute：同为自托管网关（OmniRoute 是 9Router 的 TS fork），但**默认端口不同**，
      // 所以是两枚芯片、各指各的地址（两枚地址必须不同，见 registry.test.ts 的 url 唯一性检查）。
      // 端口依据（2026-09-22 查源码，别只信 README）：9Router 的 package.json 是 `--port 20127`
      // （它的 README 示例却写 20128，与源码矛盾，以源码为准）；OmniRoute 是 `${PORT:-20128}`。
      // 模型名各自填：9Router 形如 `cc/claude-opus-4-6`（前缀/模型），OmniRoute 可用 `auto` 走零配置路由。
      { label: "9Router", url: "http://127.0.0.1:20127/v1/chat/completions", docs: "https://github.com/decolua/9router" },
      { label: "OmniRoute", url: "http://127.0.0.1:20128/v1/chat/completions", docs: "https://github.com/diegosouzapw/OmniRoute" },
      { label: "Together AI", url: "https://api.together.xyz/v1/chat/completions", docs: "https://docs.together.ai/docs/inference/openai-compatibility" },
      { label: "Fireworks AI", url: "https://api.fireworks.ai/inference/v1/chat/completions", docs: "https://docs.fireworks.ai/tools-sdks/openai-compatibility" },
    ],
  },

  // ── Hidden providers（UI 默认不显示，见 BaseProvider.hidden）──────────────
  //
  // 这两条是【订阅套餐】端点 (火山 Coding Plan、阿里 Token Plan),与上方
  // doubao / qwen 的按量付费端点是同一家厂商的两条产品线 —— 另一个 host、
  // 另一套套餐专属 SKU，所以是两个独立 provider 而不是 endpoints[] 变体
  // (变体会共享模型清单，而两边的在售 SKU 集合真的不同:deepseek-v4-pro-0813 /
  // glm-5.2 在按量线没有对应条目)。
  // 阿里这条 2026-09 由 Coding Plan(coding.dashscope host) 整体切换为
  // Token Plan(token-plan.cn-beijing.maas host):旧套餐 SKU 几乎全换;
  // key 保持 alibaba 不变以保住下游存档键。
  //
  // 为什么【收】(2026-09 反转 doubao 条目 2026-08-20 的撤除决定):
  //   它们是 365 系列 legend-talk 的一等公民条目，其厂商事实此前在那个仓库
  //   手抄维护。收进这里并标记 hidden，模型清单 / 思考 wire / 文档链接就有了
  //   单一事实源，sync-provider-catalog 会把它们生成进下游目录 (生成器不过滤
  //   hidden)。本工具自己不主动展示 —— 默认下拉里没有，知道自己在做什么的
  //   用户可以在 Provider 设置里显式打开开关。
  //
  // ⚠ 风险仍然存在，没有因为"隐藏"或"换了套餐名字"而消失。封号条款两家官方
  // 文档都逐字写了：
  //   火山 FAQ「在【非 AI 工具】中使用 Coding Plan / Agent Plan 权益对应的
  //   Base URL 和 API Key 有可能被识别为滥用/违规，会导致【订阅停用或账号
  //   封禁】」;阿里 Token Plan 概述页「将套餐 API Key 用于允许范围之外的调用
  //   将被视为违规或滥用，可能会导致订阅被暂停或 API Key 被封禁」(同页还写明
  //   Token Plan 仅限在 Claude Code/Cursor 等 AI 编程工具与 OpenClaw 类 Agent
  //   中交互式使用，自动化脚本/应用后端/批量调用均在范围外)。本工具是批量翻译，
  //   明确落在非 AI 编程工具一侧 —— UI 开关旁挂着这条警告文案
  //   (showCodingPlansHelp),别删。火山 FAQ【另一条独立问题】还称套餐额度只在
  //   支持的 Coding 工具内生效、之外的 API 调用按方舟按量规则收费 —— 这是
  //   火山独有的说法，阿里页面没有任何计费后果表述，UI 文案不得把它当两家
  //   共有后果。
  //   GLM(/api/coding/paas/v4)、Kimi(api.kimi.com/coding) 等其他订阅工作流
  //   端点目前【不收】:没有下游消费方，等有了照此办理。
  volcengine: {
    kind: "openai-compat",
    category: "llm",
    hidden: true,
    label: "Volcengine Coding Plan",
    // 字节方舟 Coding Plan 订阅端点 (/api/coding/v3，区别于 doubao 的按量线
    // /api/v3)。模型清单以官方「快速开始」(docs/ark/coding-plan-personal-get-started,
    // 2026-09-25 起数字文档号已迁移为语义路径)的 Model Name
    // 表为唯一权威 —— 那是套餐别名空间 (全小写、滚动指向当前代),与按量线带
    // 日期后缀的 id 不同;退役别名由快照 diff 自动记账、随目录下发（scripts/model-retirements.json）。
    endpoint: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    defaultModel: "doubao-seed-evolving",
    defaultTemperature: 0.7,
    docs: "https://docs.volcengine.com/docs/ark/coding-plan-personal-get-started",
    // 复核 2026-10-02（真实浏览器《Coding Plan 个人版 · 快速开始》；curl 只得 SPA 壳）：官方
    // 「支持配置的 Model Name」13 项与目录逐字一致 ✓（doubao-seed-evolving / 2.1-pro / 2.1-lite /
    // 2.0-mini / minimax-m3 / glm-5.3 / glm-5.3-flash / deepseek-v4.1-flash / deepseek-v4-flash /
    // deepseek-v4-pro / kimi-k2.7-code / kimi-k2.8-preview / kimi-k3，另有「Model Name 不支持配置为 Auto」）。
    // 形态双轨的原句也在这页：「配置 Model Name 时，支持使用全小写格式，同时也支持直接复制开通管理
    // 页面中的模型名称」——所以点号 vs 带日期连字体的差【不是】漂移，别拿它当证据。
    // ⚠ 待修 thinking（三家口径拼起来）：glm-5.3/glm-5.3-flash 官方强制思考不可关、kimi-k3 只吃
    // reasoning_effort(low/high/max)、kimi-k2.7-code 标着 thinking=true 但官方 thinking.type 仅 enabled
    // （传 disabled 报错）⇒ 用户在套餐端点上拨 Off 会拿到 400。封停条款原句在《套餐概览》页，本轮未取到。
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    // 浏览器直连不通 (legend-talk 侧实测必须走它的 CORS 代理),故默认中转开。
    // ⚠ 改完需要重新部署 scripts/llm-proxy-worker.js(workerParity 钉着路由)。
    defaultUseRelay: true,
    models: [
      // 2026-09-25 按套餐页 Model Name 表整单复核（该表换血：turbo/2.0-lite 下架，
      // 新列 pro/lite/2.0-mini/v4.1-flash/k2.8-preview）；2026-10-01 再核，13 个型号
      // 与该表一致、同序；2026-10-02 官方公告坐实这次换血的时间线（2.1-pro / 2.1-lite /
      // 2.0-mini 已上线，2.1-turbo / 2.0-lite 于 10-09 正式下线、即日起不再向新用户服务）
      // —— 目录里那两支本就没有，别因为按量端点还能调 turbo 就把它加回套餐清单。
      // ⚠ 形态判据(2026-10-01):页面 Model Name 表把 doubao 线写成
      // 点号 (doubao-seed-2.1-pro/2.1-lite/2.0-mini),同页注明支持的两种形态是
      // ①表内全小写写法、②「直接复制开通管理页面中的模型名称」(带日期全名,见下面
      // glm-5.3 条) —— 无日期连字符形态两条都不沾(那是按量线 /api/v3 的
      // id 风格,而套餐别名空间另成体系,见 doubao 条目头段),免 key 探针无法证伪
      // (Ark 先鉴权后校验模型,三种写法同回 AuthenticationError),故按文档一手字面
      // 改收点号。thinking 统一走套餐 FAQ 的
      // {"thinking":{"type":...}} 开关;doubao / deepseek 家族在方舟「深度思考」
      // 文档里逐型号在册（deepseek 三款原话「支持手动关闭」），minimax-m3 依套餐 FAQ 的
      // 通用机制标注 —— 若实测某家不收 disabled，
      // 把该条的 thinking 撤掉 (撤了 = gated 省略参数 = 用模型默认，安全的另一半;
      // 留着的代价见下面 glm-5.3/k3 两条：概览页原话「默认开启思考，不支持关闭
      // 思考」,对它们发 disabled 是确定性 400)。
      // ⚠ kimi-k2.7-code 2026-10-02 已按同一条判据撤标：深度思考页把它列在
      // 「仅思考模式：kimi-k3、kimi-k2.7-code、kimi-k2-thinking」（百炼部署与月之暗面
      // 部署两行同判），它没有可用的关闭值、也不接受 reasoning_effort。
      // k2.8-preview 协议未逐档核过 → 不打标(gated 对未标模型省略参数)。
      { label: "Doubao Seed Evolving", value: "doubao-seed-evolving", thinking: true },
      { label: "Doubao Seed 2.1 Pro", value: "doubao-seed-2.1-pro", thinking: true },
      { label: "Doubao Seed 2.1 Lite", value: "doubao-seed-2.1-lite", thinking: true },
      { label: "Doubao Seed 2.0 Mini", value: "doubao-seed-2.0-mini", thinking: true },
      { label: "MiniMax M3", value: "minimax-m3", thinking: true },
      // glm-5.3 同时接受别名 glm-latest;开通管理页复制出来的是带日期的全名。
      // 2026-10-01 撤 thinking 标:概览页原文「默认开启思考，不支持关闭思考」。
      { label: "GLM-5.3 (glm-latest)", value: "glm-5.3" },
      { label: "GLM-5.3 Flash", value: "glm-5.3-flash" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash", thinking: true },
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
      // ⚠ 2026-10-02 撤标：上游官方（platform.kimi.com/docs/guide/use-thinking-models.md）逐字
      // 「thinking.type | 仅 "enabled"，始终思考，传 "disabled" 报错」，且这支【不支持】
      // reasoning_effort —— 打标后关闭态会发 disabled，就是 400。火山是否透传这套约束未经
      // 带 key 实测，所以先整个省略 thinking 字段（不打标），比发一个会被拒的形态安全。
      { label: "Kimi K2.7 Code", value: "kimi-k2.7-code" },
      { label: "Kimi K2.8 Preview", value: "kimi-k2.8-preview" },
      // 2026-10-01 撤 thinking 标:火山概览页原文「默认开启思考，不支持关闭思考」。
      // 证据分歧留痕:阿里直供文档称其 kimi-k3 可传 enable_thinking false ——
      // 不同通道不同 wire，按火山自家页面处理。
      { label: "Kimi K3", value: "kimi-k3" },
    ],
  },
  alibaba: {
    kind: "openai-compat",
    category: "llm",
    hidden: true,
    label: "Alibaba Bailian Token Plan",
    // 阿里百炼【Token Plan 个人版】订阅端点 (token-plan.cn-beijing.maas host 的
    // compatible-mode,2026-09 取代原 Coding Plan;区别于 qwen 的按量线
    // dashscope.aliyuncs.com/compatible-mode)。API Key 仍是 sk-sp- 开头，
    // 在 Token Plan 控制台「我的订阅」页生成。
    // 思考开关：百炼 OpenAI 兼容文档 (qwen-api-via-openai-chat-completions) 载明
    // 裸 enable_thinking 布尔适用于 Qwen3.7/3.6/3.5 系列、GLM 系列 (阿里直供)、
    // 以及 DeepSeek-V4.1-Flash、DeepSeek-V4-Pro/V4-Flash 系列 (阿里云直供) ——
    // 2026-10-01 逐字核适用句，v4.1-flash 在列，deepseek-v4.1-flash 补标 (开/关走 enable_thinking；它的
    // reasoning_effort 是 1~100 整数，两个参数并存不矛盾)。
    // ⚠ qwen3.8-max/flash 2026-10-02 已补标（逐字依据记在 models 那两条上）：深度思考页把两型
    // 明列为「混合思考模式，默认开启思考模式」并给出对 qwen3.8-max 传 enable_thinking 的兼容示例;
    // 10-01 说的"两页互斥"经核对是另一页的适用句枚举没跟着 3.8 更新，不是排除条款。
    // ⚠ glm-5.3 不打标:官方 GLM 页(help.aliyun/zh/model-studio/glm)逐字「glm-5.3 仅支持思考模式，
    // 不支持关闭思考」+「传入 enable_thinking = false 不会生效」—— 是【被忽略】不是报错。故不打标
    // (打了对它 off 态发的 enable_thinking:false 也关不掉、思考照开)。别写成"false 会导致请求失败"。
    endpoint: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen3.8-flash",
    defaultTemperature: 0.7,
    docs: "https://help.aliyun.com/model-studio/token-plan-personal-overview",
    // 复核 2026-10-02（curl help.aliyun.com/zh/model-studio/token-plan-personal-overview + deep-thinking）：
    // 目录每条 id 都在套餐「模型清单」表内 ✓（表内未收的对话类：auto、glm-5.2，
    // 以及 qwen3.7-max / qwen3.6-flash —— 后两条是【同族旧代】，2026-10-02 清掉，见 models 处）。
    // 封停条款原句：「仅限在编程工具和智能体工具…中交互式使用，不可用于自动化脚本…将套餐 API Key 用于
    // 允许范围之外的调用将被视为违规或滥用，可能会导致订阅被暂停或 API Key 被封禁」+「模型输入以及模型
    // 生成的内容将用于服务改进与模型优化」⇒ hidden 语义成立，且这条 Key 不该被默认端点鼓励使用。
    // ⚠ 2026-10-02 两页对质后补标 qwen3.8-max / qwen3.8-flash（逐字依据记在 models 那两条上）:
    // 深度思考页明列两型「混合思考模式，默认开启思考模式」，另一页的适用句只列到 3.7/3.6/3.5/3,
    // 属枚举未跟着更新，不是排除条款 ⇒ 不打标=省略=服务端默认开着想。
    // glm-5.3 相反仍不打标，官方 GLM 页逐字:「仅支持思考模式，不支持关闭思考」「传 enable_thinking
    // = false 不会生效」(被忽略,非报错)——所以省略即可，发 false 也关不掉、思考照开。
    apiKeyUrl: "https://bailian.console.aliyun.com/cn-beijing/subscription/token-plan/personal",
    // 浏览器直连可用性未知 (原 coding host 实测必须走中转),保守默认中转开。
    // ⚠ 改完需要重新部署 scripts/llm-proxy-worker.js(workerParity 钉着路由)。
    defaultUseRelay: true,
    models: [
      // 2026-09-25 按 token-plan-personal-overview 支持表复核：与下面清单逐条一致
      // (只收文本模型;万相/HappyHorse/decision-model 等多模态与领域模型不收)。
      // 2026-10-01 再核:清单在册、默认在册;qwen3.8-max-preview 页面已标
      // 「已下线」(ID 仍路由至 qwen3.8-max) —— 不收依据不变。表内另有 glm-5.2
      // (纯文本推理款,深度思考页列混合模式),按「同价旧代不留」口径不收 (5.3 已在)。
      // 官方表另有 `auto` 路由项（按 Credits 折算最省），不收——本表默认档已按
      // 逐行翻译负载手挑，且 auto 的落点不可预期，缓存语义同 doubao-evolving。
      // 原 Coding Plan 的专属 id 已随套餐换代整体消失 —— 下游【不做存档迁移】
      // (存量套餐用户极少，旧 id 报错后重选即可，见条目头段)。
      // qwen3.8-max-preview 是指向 qwen3.8-max 的弃用别名，不收。顺序即页面顺序。
      // 2026-10-02 两页对质后补标（推翻 10-01 的"互斥按保守不发"）：深度思考页「支持的模型」逐字
      // 「千问 3.8 Max 系列（混合思考模式，默认开启思考模式）：qwen3.8-max、qwen3.8-max-0902
      // 千问 3.8 Flash 系列（混合思考模式，默认开启思考模式）：qwen3.8-flash」，同页「使用方式」
      // 说混合模式「可按请求开启或关闭思考」，OpenAI 兼容示例更是直接对 model="qwen3.8-max" 传
      // extra_body={"enable_thinking":True}。另一页（qwen-api-via-openai-chat-completions）的
      // enable_thinking 适用句只列到 Qwen3.7/3.6/3.5/3 —— 那是枚举没跟着 3.8 更新，不构成对
      // 明写「混合、可关」的否决。不打标=省略参数=服务端默认开着想（静默计费）。
      { label: "Qwen 3.8 Max", value: "qwen3.8-max", thinking: true },
      { label: "Qwen 3.8 Flash", value: "qwen3.8-flash", thinking: true },
      // ⚠ 2026-10-02 按「同族旧代不留」清掉两支：官方 3.8 线已有 max 与 flash（models 页
      // 「Qwen3.8」段列 qwen3.8-max / qwen3.8-max-0902 / qwen3.8-flash / 开源 27b / omni-flash），
      // 所以 qwen3.7-max 与 qwen3.6-flash 是【同线旧代】，未下线但已被取代 —— 与 qwen 条目
      // 早先删掉旧代 flash 的处置一致。
      // plus 线一并撤除(2026-10-02):3.8 无 plus 档，plus 对逐行翻译无不可替代价值，与 qwen 条目同判。
      // 2026-10-01 补标:enable_thinking 适用句逐字含「DeepSeek-V4.1-Flash…（阿里云直供）」。
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
      { label: "DeepSeek V4 Pro 0813", value: "deepseek-v4-pro-0813", thinking: true },
      { label: "DeepSeek V4 Flash 0731", value: "deepseek-v4-flash-0731", thinking: true },
      // glm-5.3 官方模型表（2026-09-16 更新）里有；5.2 已按「同价旧代不留」删掉。
      // ⚠ 不打 thinking：5.3 系列强制思考、不可禁用。
      { label: "GLM-5.3", value: "glm-5.3" },
    ],
  },
} as const satisfies Record<string, ProviderSpec>;

// 退役 id 的处置 = 【直接删，不迁移】。不设迁移表、不记退役账（2026-10-01 定案）：
// 与本仓一贯的"老型号不留、不做向后兼容垫片"同一条方针 —— 消费方存档里的旧 id 会
// 以一次可见、可自救的报错呈现（重选即可），比静默把用户迁到自选之外的型号诚实。
// 默认档随清单滚动直接改 defaultModel。provider 级【键名】改名是另一种失败
// （丢的是五张表的键，不是少一个型号），那由消费方自己的 PROVIDER_ID_MIGRATIONS 管。


// Note: `TranslationMethod` is canonicalized in `./types.ts` (which adds the
// `(string & {})` open-union to preserve user-supplied values). We don't
// redeclare it here to avoid an ambiguous re-export via the barrel.
type ProviderKey = keyof typeof PROVIDERS;

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
export const GLOSSARY_UNSUPPORTED: ReadonlySet<string> = new Set(["gtxFreeAPI", "edgeFreeAPI", "google", "deepl", "deeplx", "azure", "translategemma", "milmmt"]);

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

// 注：曾短暂给厂商 provider 取消过自由填 URL 的输入框 (只留 endpoints 标签),
// 已【撤销】—— 总有自建代理 / 特殊网络的用户需要指一个别的地址，堵死这个口子
// 得不偿失。官方变体走 endpoints 标签，自由填的口子同时保留，两者不冲突：
// 标签选中的地址会被 resolveEndpoint 认出是官方变体 (见 services/llm.ts),
// 与中转开关互不干涉：开着就经中转转发到它，关着就直连过去。

/**
 * Services that work with zero user configuration because they fall back to a
 * public/shared endpoint when no credentials are supplied:
 *   - gtxFreeAPI: hits Google's translate-pa gateway with the public te_lib key
 *   - edgeFreeAPI: hits Microsoft Edge's free translator (keyless /translatetext — no auth, no JWT)
 *   - deeplx: empty URL falls back to our public THIRD_PARTY_ENDPOINTS.deeplx
 *
 * ⚠ 不是「上游有免费档」就能进来 —— 判据是【浏览器里那条零配置路径真的能跑】，
 * 而且要能稳定地跑。opencodeZen 曾短暂进过这个集合:zen 的 *-free SKU 匿名直连实测
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
 *     (指向 LiteLLM 之类网关时，probe 会经它转发到上游，严格说花一次微量补全;
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
  // about "configured" status.
  return config.apiKey === undefined ? "free" : "configured";
};

// User-facing service list, declaration-order. The cast widens `as const` literal
// types so optional `docs` / `apiKeyUrl` are uniformly accessible across entries.
export const TRANSLATION_PROVIDERS: TranslationProvider[] = Object.entries(PROVIDERS).map(([value, p]) => {
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
  // url 对 openai-compat 一律存在 (空 = 官方默认端点)。它同时承载三种取值：
  // 官方变体 (endpoints 标签写入) 与真自定义地址 (逃生口 —— DeepSeek 判例证明
  // 上游按 origin 拦截无法预判，故人人都有，不再逐条 opt-in)。语义判定统一走
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
 * 模型发 budget_tokens，整个 provider 对该 model 恒 400(claude-opus-5 上线时
 * 就是这么漏的)。
 * Doc: platform.claude.com/docs/en/build-with-claude/adaptive-thinking
 * Consumed by services/llm.ts to pick the thinking wire shape.
 */
// 正则单独导出：同步给下游的 provider 目录要带上它的 source —— 这条「按模型名
// 判代」的规则是【厂商事实】,而且【只能按名字判】(用户手填的 SKU 不在任何清单
// 里),所以下游各写一份必然漂。已经漂过一次：某次精简把 4.7/4.8 从下游那份删了，
// 而官方明写 4.7 及以后【拒收】budget_tokens —— 手填 opus-4-8 直接 400。
export const ADAPTIVE_THINKING_CLAUDE_RE = /claude-(opus-5|opus-4-[78]|sonnet-5|fable-5|mythos)/;
export const isAdaptiveThinkingClaude = (model: string): boolean => ADAPTIVE_THINKING_CLAUDE_RE.test(model);

/**
 * adaptive 世代里【根本关不掉】思考的那一支:Fable 5.x / Mythos 全系 + Opus 5.5。官方逐模型表
 * 把它们标成 "Always on",并明写 `thinking:{type:"disabled"}` 回 400。
 * ⚠ 2026-10-02 逐页核 whats-new 原文后修正过成员:Opus 5.5 官方逐字「thinking is always on:
 * a request that sets `thinking: {"type": "disabled"}`, or a manual budget with
 * `thinking: {"type": "enabled", "budget_tokens": N}`, returns a 400 invalid_request_error」
 * —— 老世代的 Opus 5 / Sonnet 5 确实是「On 而不是 Always on」，接受 disabled，但 5.5 两支都不接受:
 * Opus 5.5 归到这里（整个字段不发），Sonnet 5.5 见下面 BETWEEN_TOOLS_OFF_CLAUDE_RE。
 * ⚠ 连带影响 max_tokens:这支即便用户选了「关」也仍在思考，思考 token 计入
 * max_tokens，按不思考的额度发会撞 stop_reason:"max_tokens"。
 * Doc: platform.claude.com/docs/en/models/opus-5-5/whats-new-opus-5-5#thinking-cant-be-disabled
 *      + build-with-claude/thinking-troubleshooting (Configurations each model rejects 一表)
 */
export const ALWAYS_THINKING_CLAUDE_RE = /claude-(fable-5|mythos|opus-5-5)/;
export const isAlwaysThinkingClaude = (model: string): boolean => ALWAYS_THINKING_CLAUDE_RE.test(model);

/**
 * 2026-10-02 逐页核官方原文后新增的第三种关闭形态。
 * 官方（models/sonnet-5-5/whats-new-sonnet-5-5.md）逐字：「a request that sends
 * `thinking: {"type": "disabled"}` returns a 400 invalid_request_error whose message
 * points to `between_tools`」+「To turn off up-front thinking … send
 * `thinking: {"type": "between_tools"}` … It's the lowest thinking setting on this model」。
 * 所以 Sonnet 5.5 【有关得掉的最低档】（区别于 Opus 5.5 / Fable 5.1 的"根本关不掉"），
 * 但那一档的名字是 between_tools，不是 disabled。
 * ⚠ 官方同时写明 between_tools 只在 low/medium/high 档被接受，xhigh/max 下发它会 400
 * —— 关闭态本来就不带 effort，所以只在【没有 effort】时走这条（见 buildClaudeThinkingBody）。
 */
export const BETWEEN_TOOLS_OFF_CLAUDE_RE = /claude-sonnet-5-5/;
export const isBetweenToolsOffClaude = (model: string): boolean => BETWEEN_TOOLS_OFF_CLAUDE_RE.test(model);

/**
 * 按【逐 SKU 档位表】解析该发哪个思考档位。表在 models[].thinkingLevels(抄自
 * 厂商官方逐模型表),消费方:gemini / grok / groq / moonshot(kimi-k3) / zhipu(glm-5.3 系)
 * / stepfun(step-3.7-flash) / cerebras(gpt-oss-120b) —— 都属于「档位集合逐 SKU 不同、
 * 且厂商不提供关闭开关」这一类。
 * 2026-10-02 逐 SKU 一手复核(全 curl 直出的官方逐模型表:gemini docs/thinking、grok
 * developers/model-capabilities/text/reasoning、groq console.groq/docs/reasoning、cerebras
 * inference-docs/capabilities/reasoning、zhipu docs.bigmodel glm-5.3.md、kimi platform.kimi
 * use-reasoning-effort、stepfun platform.stepfun reasoning.md):每条 thinkingLevels 都是官方
 * 合法集合的子集、且关闭语义(发最低档、无真 off)一致,无漂移。加/改这类 SKU 时重跑这一遍。
 *
 *   · want 省略 = 用户把思考【关掉】了。这几家官方都【没有】关闭开关
 *     (Gemini 3 的 thinkingBudget 已是遗留参数;xAI 明写 "Reasoning cannot be
 *     disabled"),所以最低档就是能做到的"最关"。⚠ 别退回去发厂商枚举里没有的
 *     值当"关":要么被拒 (默认态每请求 400),要么被忽略 (那就是按【服务端默认】
 *     的高档位静默计费 —— DeepSeek「10M tokens」事故就是这个形态)。
 *   · want 给了但该 SKU 不收 → 降到它收的、不高于 want 的最高档。
 *
 * ⚠ 未列出的 SKU(用户手填) 用调用方给的 fallback，不硬降用户显式选的档位
 * (选了 custom 自己负责)。
 * ⚠ 曾用正则近似这些表 (按名字判 -pro / 硬编码 grok-4.3),两个毛病：按名字归并
 * 会把合法档位静默降级 (gemini 3.1-pro 的 medium 官方接受，却被降成 low);而且
 * 其中一个词边界转义在搬迁中被写成了不可见控制字符，那个分支从此静默失效。
 * 表就在数据里，别再回到正则。
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
 * 的：在册的 claude 型号里只有被 ALWAYS_THINKING_CLAUDE_RE 命中的那几支关不掉，其余关得掉，
 * 所以不能靠
 * 把 provider 级那条翻成 false 来表达 —— 那会对没被命中的 opus / sonnet 撒反方向的谎。
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
 * 分级，medium 原样发 —— 见 pickThinkingLevel。
 */
// ⚠ moonshot 已移出：收录 kimi-k3 后它【同时】有二元 SKU(K2.x 的 thinking:{type})
// 与真分级 SKU(k3 的 reasoning_effort low/high)。集合是 provider 级的，而 UI 的
// 档位选择器也是 provider 级 —— 给出三档，对 K2.x 是三档折叠成开/关 (无害，
// 只是 Medium 与 High 同效),对 k3 是必需。反过来只给 Off/On 则 k3 的 high
// 永远选不到。thinking.test 的「三档形态 ↔ 声明一致」不变量抓住了这次矛盾。
// volcengine(方舟 Coding Plan)= 扁平 thinking:{type},alibaba(百炼 Token Plan)
// = 裸 enable_thinking，都是二元形态;两家是 hidden provider，登记规则不变。
// ⚠ alibaba 并非每个在册 SKU 都打 thinking 标:glm-5.3 因官方 GLM 页明写「不支持关闭思考、传
// enable_thinking=false 不会生效」而不发（qwen3.8-* 已于 2026-10-02 依「混合思考、默开」原文补标）—— 理由逐条见该
// 条目注释 (deepseek-v4.1-flash 已于 2026-10-01 依适用句原文补标)。volcengine 的
// glm-5.3*/kimi-k3/kimi-k2.7-code 同日撤标或不标 (官方把后两者列在「仅思考模式」行)。
// ⚠ zhipu 已移出：GLM-5.3 系官方有档位表（low/high/max），打标后 wire 是分级形态
// （low/medium/high 三挡里 medium 由 pickThinkingLevel 降到 low），与"二元"声明矛盾;
// 同 moonshot 的处置——给三档，折叠掉的那一档无害，反过来会把官方有的档位锁死。
export const BINARY_EFFORT_VENDORS: ReadonlySet<string> = new Set(["deepseek", "doubao", "mimo", "siliconflow", "cohere", "qianfan", "mistral", "minimax", "volcengine", "alibaba"]);

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
 * 该 provider 的中转 allowlist(= 官方端点集合，[0] 为默认):endpoints[] 优先，
 * 没声明的 openai-compat 回落到 [spec.endpoint]。resolveWireEndpoint 的默认
 * 目标、workerParity 测试都从这里取 —— 此前引擎与测试各写了一份同样的回落
 * 规则，测试等于在校验自己的抄本。
 */
export const getRelayAllowlist = (service: string): readonly string[] => {
  const spec = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  const eps = spec?.endpoints?.map((e) => e.url);
  if (eps?.length) return eps;
  return spec?.kind === "openai-compat" ? [spec.endpoint] : [];
};

// wire 层对 config.url 的补全器 —— 【与各 service 实际做的完全一致】,这是
// classifyEndpointUrl(界面文案/芯片)、blur 自动补全、relayHint 判据的共同判据：
//   - claude:Messages 协议，bare host 补 /v1/messages(completeClaudeUrl)
//   - azureopenai:v1 GA 协议，资源根补 /openai/v1/chat/completions(completeAzureUrl)
//     —— 全员唯一 endpoint 留空的 openai-compat，没有官方地址可当默认
//   - 其余 openai-compat 全员 + 同协议的手写 service（名单就是下面那个集合，
//     它们都在各自实现里调 completeOpenAICompatUrl）
//   - 其余 (deepl/deeplx/gtxFreeAPI…):私有协议或资源基址，引擎
//     原样使用，这里也原样返回。
// ⚠ 改某个 service 的补全行为时必须同步这里 —— 界面所见与线上所打分叉，
// 就是这个函数存在要防的事故 (bare host 判 custom、文案与线上行为相反)。
const OPENAI_WIRE_CUSTOM_SERVICES: ReadonlySet<string> = new Set(["yandex", "llm", "nvidia", "qwenMt", "translategemma", "milmmt"]);
export const wireUrlNormalizer = (service: string): ((url: string) => string) => {
  if (service === "claude") return completeClaudeUrl;
  if (service === "azureopenai") return completeAzureUrl;
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
 * 这里曾带过一个 `relayRoutable` 字段，用来表达"这个 url 会不会把中转关掉"。
 * 随着两轴解耦，那个概念本身消失了：中转开不开【只看开关】。
 *
 * 引擎不另算一遍:resolveWireEndpoint(下方) 的"能不能走内置中转"直接读这里的
 * kind —— 界面所见与线上所打【由构造保证】一致，不再是两套实现靠测试钉齐。
 */
export const classifyEndpointUrl = (service: string, url: string | undefined): EndpointUrlClass => {
  const spec = PROVIDERS[service as ProviderKey] as ProviderSpec | undefined;
  // localStorage/导入文件不是类型安全的:非字符串(消毒前的存量、手改)当 undefined
  // 处理，不能让设置表单在每次渲染时抛 TypeError 直到手清存储。
  const trimmed = typeof url === "string" ? url.trim() : undefined;
  // 「留空时实际会打哪个地址」:openai-compat 是 spec.endpoint;手写 kind 则看它
  // defaults 里预置的 url(gtxFreeAPI/qwenMt 有，llm/translategemma 是空 = 无默认，
  // 必须用户自己选)。⚠ 别改用 defaults.url 判 openai-compat —— 它们的 defaults.url
  // 一律是 ""(逃生口字段无条件配发),据此判会得出"没有默认端点"的错误结论。
  // URL 即凭证的服务 (llm/translategemma)【没有】隐式默认：留空 =「还没配」,
  // 与 getConfigStatus 的 "needs-config" 是同一句话。若在这里把 spec.endpoint 当成
  // 它的默认，端点标签会在 url 还空着时就亮起"已启用",而状态块同时写着"待配置"
  // —— 界面自相矛盾。(引擎侧留空仍会打 endpoints[0],那是另一层的兜底，
  // 状态块的"待配置"已经把话说清楚了。)
  //
  // 其余:claude/yandex 走最后那档 —— defaults.url 是 ""(逃生口),真正的默认地址
  // 写在 endpoints[0] 里，服务层的 *_DIRECT_ENDPOINT 也从那儿派生，三处同一来源。
  const defaultEndpoint = URL_IS_PRIMARY_CRED.has(service) ? undefined : spec?.kind === "openai-compat" ? spec.endpoint : getDefaultConfig(service)?.url?.trim() || spec?.endpoints?.[0]?.url;
  // ⚠ 按【引擎将要打的地址】比，不是裸字符串比 —— 两层规范化都要过：
  //  1. 补全 (completeXUrl):引擎在 resolveWireEndpoint 里先补全再比
  //     allowlist，所以 bare host(https://llm.api.cloud.yandex.net) 在引擎眼里
  //     【就是】官方端点、照常走中转;这里若按原文判成 custom，文案会宣称
  //     "该地址不会发往公共中转、请求直连",与线上行为正好相反。
  //     选择器 = wireUrlNormalizer(上方),按 service 与引擎逐一对齐 ——
  //     曾把 qwenMt/translategemma/llm/nvidia 漏成 identity，而它们的引擎都调
  //     completeOpenAICompatUrl:导入的 base_url 形态地址引擎打官方变体，界面
  //     却判 custom、芯片不亮。
  //  2. 规范形 (canonicalEndpoint):尾斜杠、主机大小写这类写法差异本就指向
  //     同一个官方地址;存量/导入的配置不经过输入框的 blur 补全，渲染时就得判对。
  if (!trimmed) return { kind: "default", url: defaultEndpoint };
  const key = canonicalEndpoint(wireUrlNormalizer(service)(trimmed));
  if (defaultEndpoint && key === canonicalEndpoint(defaultEndpoint)) return { kind: "default", url: defaultEndpoint };
  const variant = (spec?.endpoints ?? []).find((e) => canonicalEndpoint(e.url) === key);
  if (variant) return { kind: "variant", url: variant.url };
  return { kind: "custom" };
};

/**
 * 「开中转对这组配置有没有效果」—— resolveWireEndpoint 的放行判据，也是
 * services/llm.ts「建议打开中转」提示的前置条件(指人去开一个开了也没用的
 * 开关，比不提示更糟)。
 *
 * ⚠ 【不把用户自填的地址发给内置公共中转】。内置中转只转发它声明过的端点，
 * 自填地址必然 400 —— 发过去毫无用处，却会把整条 URL(自建网关常带
 * `?token=SECRET`) 留在一台用户没打算牵涉的机器的日志里。这【不是】把
 * 「地址」「开关」两轴绑回去：开关照旧有效，只是这一种组合无处可去。
 * 用户自己的中转 (usesBuiltinRelay=false) 是另一回事：那台机器归他所有、
 * allowlist 由他声明 —— 这正是解耦要支持的场景，照发。
 * 「是不是官方地址」直接问 classifyEndpointUrl —— 与界面同一个判据，不重算。
 */
export const relayWouldServe = (service: string, opts: { url?: string; relayBase?: string }): boolean => !usesBuiltinRelay(opts.relayBase) || classifyEndpointUrl(service, opts.url).kind !== "custom";

/**
 * 这个 provider 界面上有没有中转开关。withNetworkHint(services/index.ts) 用它决定
 * 该不该提「请开启中转」—— 指人去拨一个他那个 provider 根本没有的开关，
 * 比不提示更糟。
 *
 * ⚠ 判据是【默认配置里有没有 useRelay 字段】,不是 `spec.defaultUseRelay`:
 * 后者只是 openai-compat 工厂的输入 (buildOpenAICompatDefault 据此填字段),
 * 而手写 kind 的 claude / yandex 直接把 useRelay 写在自己的 defaults 里 ——
 * 按 defaultUseRelay 判会把这两家当成「没有中转」。这里与 TranslationSettings
 * 决定该不该渲染那个 Switch 的判据 (config?.useRelay !== undefined) 同源。
 */
const isRelayCapable = (service: string): boolean => getDefaultConfig(service)?.useRelay !== undefined;

/**
 * 「指他去开中转」这句话到底有没有用 —— withNetworkHint(services/index.ts) 的
 * CORS 改写与 deepseek 的 403 改写 (services/llm.ts) 共用这一个判据。
 * 三个前置缺一不可：有那个开关、现在没开、开了真会路由到位（relayWouldServe
 * —— 与端点解析、界面文案同一个判据，bare host / 官方变体 / 自建中转的取舍
 * 不在这里重算）。
 *
 * ⚠ 别退回成 `&& !opts.url`:那是旧的「自定义 endpoint 压过开关」优先级留下的，
 * 会连"填的就是官方地址"和"自己有中转"这两种真能获益的情况一起吃掉。
 */
export const relayHintWouldHelp = (service: string, opts: { useRelay?: boolean; url?: string; relayBase?: string }): boolean =>
  isRelayCapable(service) && !opts.useRelay && relayWouldServe(service, opts);

/**
 * 「这个地址是用户自己的」—— withNetworkHint(services/index.ts) 据此把网络错误改写成
 * CORS 提示 (中转帮不上，补救在对面服务器上)。两种形态缺一不可：
 * URL_IS_PRIMARY_CRED 那几家根本没有官方默认端点 (填什么都是他的);其余家
 * 则看他是不是填了个非官方地址。
 * ⚠ 单靠 kind==="custom" 会漏掉最常撞 CORS 的那批:LM Studio / Ollama 等
 * 本地运行时地址在 llm 的 endpoints[] 里有芯片，会被判成 "variant"。
 */
export const isUserSuppliedEndpoint = (service: string, url: string | undefined): boolean => URL_IS_PRIMARY_CRED.has(service) || classifyEndpointUrl(service, url).kind === "custom";

/**
 * THE wire-endpoint resolution —— 所有走中转开关的服务 (openai-compat 工厂 +
 * claude/yandex)唯一的出口地址计算。两轴正交:`url` 决定打哪个地址 (空 =
 * 官方默认),`useRelay` 决定走不走中转;唯一的组合限制见 relayWouldServe。
 * 中转路由键 = provider key(Worker 的 /api/{key} 就按它命名)。
 * 传输侧与分类侧过同一个 canonicalEndpoint:写法差异若只在一侧抹平，界面判
 * "官方"、Worker 的 exact-match 却 400。
 */
export const resolveWireEndpoint = (service: string, opts: { url?: string; useRelay?: boolean; relayBase?: string }): string => {
  const trimmed = opts.url?.trim();
  // 空 url → allowlist[0](官方默认)。调用方都是中转能力服务，allowlist 非空
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

/**
 * 带 `hidden: true` 的 provider(目前 volcengine 方舟 Coding Plan、alibaba
 * 百炼 Token Plan 两个用途受限的订阅套餐端点)。行为层视图 (LLM_MODELS /
 * defaultConfigs / dispatch / CLI) 全量
 * 包含，UI 选择器通过本判据过滤 —— 全仓过滤 hidden 的唯一合法判据，别再手抄
 * key 集合。
 */
export const isUiHiddenMethod = (method: string): boolean => (PROVIDERS[method as ProviderKey] as ProviderSpec | undefined)?.hidden === true;

/**
 * 服务选择器 (TranslationSettings + ApiStatusBlock 两处 Select) 的数据源。
 * `showHidden` 关闭 (默认) 时滤掉 hidden provider;但【当前选中值】永远保留 ——
 * 经设置导入选中 hidden 服务的用户必须看到自己在用什么，antd Select 对不在
 * options 里的 value 只会显示裸 key。
 */
export const getVisibleCategorizedOptions = (showHidden: boolean, currentMethod?: string) =>
  categorizedOptions.map((group) => ({
    ...group,
    options: group.options.filter((o) => showHidden || o.value === currentMethod || !isUiHiddenMethod(o.value)),
  }));

// Lookups
export const findMethodLabel = (method: string): string => PROVIDERS[method as ProviderKey]?.label ?? method;

// Object.hasOwn 守卫:method 来自持久化/导入的字符串，"constructor"/"toString"
// 这类原型链键裸索引会返回【继承的函数】(truthy)—— useTranslationState 靠
// 本函数判断 storedMethod 是否合法的回退逻辑被骗过，validate() 在
// UNSUPPORTED_LANGS[method]?.has 上抛 TypeError，翻译按钮每次点击都炸。
export const getDefaultConfig = (method: string): TranslationConfig | undefined => (Object.hasOwn(defaultConfigs, method) ? defaultConfigs[method as ProviderKey] : undefined);
