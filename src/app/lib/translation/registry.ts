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
//   只是"多一个能选的 id"，却拿不到那套契约，而且会误导人：本工具支持 130+ 语种，这类
//   模型的覆盖面小得多（实测 command-a-translate 只有 23 种、上下文 8K、官方还要求生产
//   使用先联系销售）。要 MT 质量 → 让用户去选 machine-translation 类。
//
// ⚠ 收 provider 的门槛（2026-11-11 与维护者定）—— 管【这家在不在表里】，与下面
//   「收型号的三条判据」（管【这家收哪些 SKU】）是两层，别互相顶替。
//   收：① 模型厂商官方平台；② 有真实主体 + 自有/租用推理算力（GPU、RDU 等专用
//      加速器）的推理平台，含官方合作聚合；③ 不转售模型 API 的工具平台
//      （llm Custom 属这类：它只把用户自己的端点接进来）。
//   不收：无自研模型、又无自有/租用算力，纯转售上游模型 API（尤其 Claude / GPT /
//      Gemini 等闭源模型）的转售商。四类红旗：匿名主体或新注册账号、远低于官方的
//      价格、空投 / 签到 / 轮盘等羊毛机制、白标分销（reseller storefront）。
//   ⚠ 【从宽判据：只放给【知名】的官方合作聚合】openrouter / opencodeZen / opencodeGo
//      同样不自有算力，但它们是业内广泛使用、可公开查证的知名聚合平台，且按上游官方
//      标价【平价】转售、主体可查（公司名 + 管辖地）、四类红旗一条不中 ⇒ 按「官方合作
//      聚合」收。别按字面把这三家删了。
//      ⚠ 知名是【硬条件】：平价 + 主体可查 + 零红旗只是必要条件，不知名的新站三条全中
//      也不收 —— 「官方合作」这层关系无从机械核实，知名度是唯一能从外部查证的门槛，
//      用来把口子限定在少数可辨认的平台上。重心仍是红旗，不是"有没有自己的机房"：
//      算力那条是用来挡匿名低价羊毛分销的，不是要求每家自建数据中心。
//      反例：atlascloud 四类全中，已整家删除（取证见 PROVIDERS 里那条删除说明）。
//   ⚠ 这条门槛【没有机械闸，也别加】：「有没有自有/租用算力」「主体是否匿名」不是能
//      从代码或免 key 目录里算出来的东西，写测试只会假绿。靠一手取证（厂商自己的
//      about / pricing / credits 页 + 目录实拉）逐轮人判。
//
// ⚠ 每次更新模型清单，除了加/删 SKU，必须逐条确认这三件事：
//   ① defaultModel 仍在 models[] 里（registry.test 会拦，但别等测试）；
//   ② 默认模型【近期没有下架计划】—— 默认是最要命的那一条：它烂掉等于整个 provider
//      开箱即坏。实例见 nvidia 条目（当时的默认模型挂着 `DEPRECATION: 09/19/2026`，
//      两天后死；只有实拉 /v1/models 才看得见）；
//   ③ 该条目的 docs 链接仍指向在售型号（下架常伴随文档改版，链接会先 404）。
//   ④ **挂任何退役/弃用日期的型号一律先清，也不新收**（2026-11-04 与维护者定为标准）：
//      官方写了 "Deprecation date" / "Retirement" / "available until" /「计划 X 月底下线」
//      这类日期 ⇒ 当下拉项【当场撤】，不等它真归零、不保留"带日期的在册项"、
//      不因某个网关的目录里还列着它就留下（网关表不标退役日期，退役以模型方页面为准）。
//      同族有退役日期的整族一起清 —— 例：Kimi「12 月底下线所有 K2 系列」一次性带走了
//      moonshot / openrouter / opencodeZen / tokenhub 的 k2.6 与 k2.7-code、
//      volcengine 的 k2.8-preview。存档里选过这些 id 的人会拿到明确报错并自行改选
//      （与「模型 id 退役不迁移、报错可见可自救」的定案一致，不做静默迁移）。
//   厂商事实怎么核（哪些端点不带 key 也能实拉、弃用标记藏在页面哪一段）见各条目
//   注释里的先例：nvidia（/v1/models 实拉 + 页面内嵌 isDeprecated/DEPRECATION）、
//   opencodeZen / opencodeGo（官方 /v1/models 不带 key 即返回全量目录）、
//   以及官方文档里的「即将下线 / deprecated」标记。判据工具见 `yarn provider:facts`
//   （退役信号命中在册型号 ⇒ 报告直接列成【必删清单】，不是"参考"）。

import type { ReasoningEffort, ThinkingDirective, TranslationConfig, TranslationProvider } from "./types";
// 纯 URL 工具，放在零依赖的 services/shared 里 —— 端点解析 (拼 ?endpoint=) 与
// 这里的分类必须用【同一个】规范化，否则界面判成官方、线上却因大小写/尾斜杠
// 被中转 allowlist 精确匹配拒掉 (exact match)。
import { canonicalEndpoint, completeAzureUrl, completeClaudeUrl, completeOpenAICompatUrl, isPrivateEndpoint, relayUrl, usesBuiltinRelay } from "./services/shared";

export type ServiceCategory = "machine-translation" | "llm" | "aggregator";

type BaseProvider = {
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
   */
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
  /**
   * `docs` 只给【一个芯片就是一个独立产品】的那种端点用（Custom 底下的
   * LM Studio / Ollama / LiteLLM…）：provider 级的 docs 对它们没有意义，
   * 而这恰恰是最需要文档的一条路 —— 用户要照着上游文档把服务先跑起来。
   * 同一服务的地域/计费变体（qwen 三地域之类）共用 provider 级 docs，不写。
   */
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
  endpoints?: Array<{ label: string; url: string; docs?: string }>;
  /**
   * 【手填型号】的档位表：用户自己敲的 SKU 不在 models[] 里，只能按这家厂商的
   * 通用枚举来钳。绝大多数厂商通用三档 (low/medium/high) 就够，所以不声明；
   * 有一家必须收窄 —— zhipu 的 GLM 系官方枚举只有 low/high（外加 max），
   * 通用那份里的 medium 发出去是每请求 400（见 zhipu 条目注释）。
   *
   * ⚠ 这条是 provider 级兜底，而它以前只存在于【线格式一侧】（llm.ts 里的行内
   *   字面量）—— 界面拿不到，于是界面显示 Medium、线上发 low：用户拨的档与实际
   *   跑的档不是一档。数据挪到这儿之后，线格式与界面下拉读的是同一张表
   *   （见 resolveLevelsTable）。
   */
  unlistedEffortLevels?: ReadonlyArray<EffortLevel>;
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

/**
 * 厂商逐型号表里的【合法档位】。比 `ReasoningEffort`(low|medium|high) 多一档 minimal ——
 * 官方表里真的有它 (gemini-3.5-flash-lite 的 thinkingLevels 就是
 * ["minimal","low","medium","high"])，但【我们界面发不出】minimal(存档的
 * ThinkingDirective 只有 low/medium/high/auto)。
 *
 * ⚠ 两个集合必须分开命名，否则就会出现「用 `as ReasoningEffort` 把 minimal 硬说成
 * 我们的档位」那种空口断言：线上发 minimal 合法 (厂商表里有)，但界面那个下拉
 * 没有 minimal 这一项 —— 显示值与线上值就会分叉。厂商档位=EffortLevel，
 * 我们发得出的=ReasoningEffort，钳位在两者的交集里做。
 */
export type EffortLevel = "minimal" | "low" | "medium" | "high";

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
  thinkingLevels?: ReadonlyArray<EffortLevel>;
  /**
   * 该 SKU 收哪些 effort（【不含】none —— 那是关闭值，由 thinkingWire 的 off 槽表达）。
   * 与 thinkingLevels 分开，是因为那两件事要分开说：
   *   · thinkingLevels = 「厂商没有关闭开关，最低档就是最关」（gemini / grok / groq /
   *     zhipu / kimi-k3 / OpenRouter 的 mandatory 型号）—— 它同时是
   *     canDisableThinking 的判据。
   *   · effortLevels  = 「关得掉，但档位受限」（OpenRouter 的 deepseek-v4.1-flash
   *     官方收 max/high/low/none，【没有 medium】；hy3 收 high/low/none；
   *     nemotron-3-super 收 medium/low/none；kimi-k3 收 max/high/low/none）。
   *     这几支声明了 effortLevels，界面就只列它真有的档位 —— 用户不会拨到一个
   *     官方没有的 Medium（网关虽会「就近映射」，但那是【降级】不是【这一档】）。
   * ⚠ 两者都不声明 = 该 SKU 收全部档位（走通用回落集合）。
   */
  effortLevels?: ReadonlyArray<EffortLevel>;
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
// siliconflow 等多家零退路，不是谁判断过，是漏了。而 DeepSeek 判例
// (探测全绿、真实用户仍被上游按 origin 拦 403，见 services/llm.ts 的 403 重写)
// 证明「谁会被拦」无法预判 —— 无法预判的风险就不该用"逐条记得写"的 opt-in
// 分配退路，默认人人有才是与之匹配的设计。
// url 的三种取值语义由 classifyEndpointUrl(见 getProviderEndpoints 附近) 统一
// 判定：空/官方默认、官方变体、真自定义 —— UI 与端点解析共用同一判据。

// ─── docs / apiKeyUrl 的维护约定 ────────────────────────────────────────────
// 全部链接已实测过两轮（后者带浏览器 UA + Accept-Language 双探，bare 与 zh/en 各一遍），
// 无死链;修正会重定向的地址，规则是【写最终落点，别让用户多跳一次】:
//   · 域名迁移 → 直接写新域 (console.anthropic.com → platform.claude.com、
//     platform.moonshot.cn → platform.kimi.com)
//   · 落到更具体的子页 → 直接指子页 (deepl 的 request-translation、
//     minimax 的 text-chat-openai)
//   · 文档站改版 → 按新结构写 (火山把数字文档号换成语义路径:docs/82379/1330310
//     → docs/ark/model-list、…/1928261 → docs/ark/coding-plan-personal-get-started,
//     后者原本还写着 www 域、违反下面那条「必须用 docs.volcengine.com」的规则，一并修;
//     SiliconFlow /cn/api-reference/… → /docs/api/chat-completions-post)。
// ⚠ 【locale 段：能不写就不写】。本项目支持 19 语言，把任一 locale 写死都会
// 让另一半用户落在读不懂的页面上。判据只有一条 —— 去掉 locale 段后仍可达
// 且会按 Accept-Language 自动适配的，就不写：
//   · 不写:learn.microsoft.com(zh→/zh-cn/、en→/en-us/)、help.aliyun.com
//     (zh→/zh/、en→/en/，复测仍自适应)、www.deepl.com(zh→/zh/)、
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

// ─── 带 key 实拉服务目录（`/v1/models`）这条路 ──────────────────────────────
// 判"id 是否还在被服务"最硬的一手，比读文档措辞强（2026-10-13 一轮里它直接证伪/证实了
// 7 家：deepseek 2 条、groq 11、mimo 9、siliconflow 98、dashscope(qwen+qwen-mt) 175、
// gemini 62、openrouter 459 —— 全部在册命中，0 个死 id）。
// ⚠ 2026-10-21 复核:openrouter 的全量目录已涨到 **468 条**(合并前那次实测是 459),
//   存量 id 仍全部命中;数字只说明"当时抽到多少条",别当常数。
// key 从哪来：维护者本机浏览器里本站的 `translation-configs`（localStorage）。取法是
// 让页面把那份 JSON POST 到 127.0.0.1 的一次性本地端口再落进 gitignored 的临时文件 ——
// 【key 值全程不进对话、不进命令行、不进 commit】，用完即删。别再图省事把 key 打印出来。
// 2026-10-13 实测的通道边界，下次直接照这张表选目标，别一个个试：
//   ✅ 拉得通（openai 形 GET /v1/models + Bearer）：deepseek、groq(/openai/v1)、mimo、
//      siliconflow、openrouter、dashscope(qwen 与 qwen-mt 同一把 key、同一 host)、
//      gemini 走 /v1beta/models + `x-goog-api-key` 头（不是 Bearer）。
//   ❌ 拉不通：阿里 token-plan 域用 dashscope 那把 key 回 401（两家的 key 不通用）；
//      Yandex foundationModels 那条路径 Bearer 与 Api-Key 都 404（见 yandex 条目）。
//   🔓 这几家【根本不用 key】就能拉全目录，别再去找维护者要凭证：nvidia
//      (integrate.api.nvidia.com/v1/models, 80 条)、cerebras
//      (api.cerebras.ai/public/v1/models)、opencode console 与 go
//      (/zen/v1/models、/zen/go/v1/models)、openrouter、integrate 那批同理。
//   ✋ 本机【没有】这几家的 key，别再假设拉得到：claude、mistral、moonshot、zhipu、
//      minimax、doubao/volcengine、grok、cohere、tokenhub、cerebras、azureopenai。
//      其中最值得下次要 key 的是 claude：它的 GET /v1/models 会逐条回
//      `capabilities.thinking.types.disabled.supported`（能不能关思考的机器可读版，
//      现在全靠手抄文档矩阵）。
// ⚠ 目录回答不了协议与形态：OpenCode 五条 Claude/Gemini/Grok 全在 /v1/models 里，
//   实际打 chat/completions 回 400 ModelProtocolUnsupported（见 opencodeZen 条目）。
//   判"能不能用"仍是探针 + 一手文档，目录只判"在不在册"。
// ⚠ 反过来，【逐型号文档页缺页也不是下架信号】：文档页会 404、会分片渲染、会只带出
//   表格一截，而目录实拉是字面在册。判在册以目录为准，文档页只作正文证据 —— 据缺页
//   删条目造过假红（siliconflow 的 pricing 页缺行、公开 model 卡拼不出 slug 同形）。
// ⚠ 另一条【二手】状态源：`models.dev/api.json`（~460KB，228 个 provider，逐模型带
//   `status: active|deprecated|beta`）。它的用法是【起疑清单】——一轮扫下来只该拿到
//   "这些条去看一眼一手"，不该直接照它改：2026-10-13 全仓对账时它给的 4 类信号里
//   只有 1 类经得起一手复核（opencodeGo 的 kimi-k2.6 标 deprecated，而 Go 页三张表、
//   Console 的 Deprecated 表、实拉目录与探针四条一手证据都不认 ⇒ 留着）。
//   ⚠ 用它之前先把 provider 对对干净：同族有多条产品线（alibaba vs alibaba-token-plan、
//   volcengine vs volcengine-coding-plan、opencode vs opencode-go），按【端点 host 猜】
//   会匹配错兄弟、把"人家目录没这条"当成失效（本轮第一版就这么误报过 mistral/tokenhub
//   的一串），要按产品逐条显式映射。
//
// ⚠⚠ 复核【换代】(该不该把某条换成更新的一代) 与复核【在册】是两件事，方法也不同：
//   在册 = 逐条命中即可；换代 = 要按【家族】把目录里同族的兄弟 id 全列出来再判断。
//   本轮就是用家族扫描抓到 opencodeGo 的 qwen3.6-plus（同目录在售 3.7-plus，又新又便宜）
//   —— 只查"在不在册"永远放过这种滞后项。
//   ⚠ 家族扫描【不能按数字大小排新旧】，两个真实反例：
//     · x-ai/grok-4.20 的数字 (4,20) > grok-4.7 的 (4,7)，但 OpenRouter 的 `created`
//       显示 4.20 = 2026-03-31、4.7 = 2026-09-21，厂商文档里 4.20 是 3 月那代 ⇒ 【4.7 更新】。
//     · openai/gpt-oss-120b 与 gpt-oss-20b 是【同一代的两个尺寸】，不是新旧两代。
//   判新旧要用【出处】：目录的 created/release date、厂商定价表的排列、文档的
//   "previous-generation / legacy / newer" 措辞；数字序只能当线索，不能当结论。
//   ⚠ 也别把"同族有更新的型号"一律当成该换：本表多处是【刻意】留旧代或留便宜档的
//   （stepfun 默认 3.5-flash 是语言向旗舰而 3.7 是多模态向；opencodeZen 收
//   deepseek-v4.1-flash 是为了成本梯度而不是追新）。改之前先读那条自己写的判据。

// ─── 收型号的三条判据（全表通用，条目只写"本家属于哪条 + 一手依据"）──────────
//
// ① 【形态】—— 官方文档与目录【没有】的东西一律不收。老型号（同族旧代 / 同价旧代）、
//    preview / 细分档（-highspeed 这类速度变体）、专化档（代码 / 视觉 / 角色扮演 /
//    生图 / 语音）、渠道变体后缀（-aws / -az / -ccmax / -coding、Pro/ 付费前缀）都归这条。
//    典型误判是"厂商还在卖"就收 —— 在售 ≠ 该进下拉（openrouter 的 grok-4.20-0309
//    与 qwen3.8-27b:free 都还挂着，却分别是旧世代 pinned SKU 与 0 endpoints）。
// ② 【地域可达性不是收型号的判据】。Anthropic 的 API 不对中国大陆开放、OpenRouter 对
//    Anthropic 型号按地区限制 —— 但本站受众含大量海外用户。曾据"国内用不了"删掉
//    openrouter 上的 Claude 系，那是拿【我们的用户能否调用】顶替【该 slug
//    是否在册】，与既定口径不符。判形态（①）与判在册，不掺受众。
// ③ 【老型号不留、默认必须是当下最稳的那支】。默认档烂掉等于整个 provider 开箱即坏
//    （nvidia 的默认模型曾挂着 DEPRECATION 标记两天后就死；siliconflow 的默认曾指向
//    一个目录里根本不存在的 id）。代价是"还能调"的老 id 不在列表里 —— 用户手填仍可。
//
// ⚠ 上面这三条是【收什么】；头部「带 key 实拉服务目录」那段是【怎么核】。两者分开：
//   核法（通道、免 key 清单、二手源怎么用）只写在头部一处，条目不再复述。

// ─── 条目注释怎么写：写【当前状态】，不写【复核流水】────────────────────────
//
// ⚠ 本文件曾经一条纪律都没有，于是每轮复核都在条目下【追加】一段「复核 YYYY-MM-DD
//   （用什么通道）：在册 N 条逐条命中 ✓」。三十个 provider 各挂一段，半年下来同一
//   个事实有了三四种说法，新人得把一整屏的日期倒着读一遍才能知道现在是什么状态。
//   **日期不是信息，「当前是什么」才是。** 下面三条是硬要求：
//
// ① 【结论未变就不写】。复核的产出是「发现变化」而不是「又核了一遍」。清单与目录
//   逐条对得上时，那是默认状态，不需要留痕 —— 真要留，一句「目录实拉：在册 N 条
//   全部在册」即可，不必带日期与通道（通道选择见上面那张表）。
// ② 【写状态，不写过程】。「2026-10-13 实拉发现 X ⇒ 改成 Y」要改写成「Y，因为 X」
//   —— 判据留，日期与「这轮/上次/此前」删掉。日期只在两种情况下有价值：① 厂商的
//   **硬截止日**（某 SKU 何时下线，届时这条记录本身就是过期信号）；② 该结论**会随
//   时间失效**且失效时没人会注意到（即将退役、限量入口）。其余一律不写日期。
// ③ 【推翻旧结论时，写清推翻它的是什么】——不是写「之前的结论错了」，而是写清
//   一手证据（如「按总览 Featured 区判『已滚到 6.1-sol』是看漏了 Featured 与全目录
//   的区别」）。否则下一个人会把被推翻的旧结论再推一遍。
//
// ⚠ 判据与理由【可以】留，日期【不要】留 —— 本文件大量注释的价值正在于那些判据
//   （为什么默认是 turbo 而不是榜首、为什么这条不收），它们是决策记录，与复核
//   流水不是一回事，别在压缩流水时顺手删掉。
//
// ⚠ 顺带一条反向纪律（stepfun 那条「⚠ 待修」的教训 generalize 到全文件）：
//   **注释描述的状态必须等于代码的真实状态。** 一条还写着「待修 / 待确认 / 稍后
//   改」的注释留在已修的代码旁边，会让下一个人以为 bug 还在 —— 重复调查一遍，
//   或者更糟：照着它去「修复」一个已经正确的清单。修完就把那段删掉，别留档。

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
const LLAMA_CPP = { label: "llama.cpp", url: "http://127.0.0.1:9931/v1/chat/completions", docs: "https://github.com/ggml-org/llama.cpp/tree/master/tools/server" } as const;
// ⚠ 2026-10-21 复核更正：端口 8080 → 9931。上游默认端口已是 9931(源码 common/common.h
//   `port = 9931`,README 的 --port 选项表同);8080 只出现在官方 Docker 示例里
//   (docker run -p 8080:8080 … --port 8080)—— 照芯片点进去 = 连接被拒。
//   ⚠ 这张表被 llm / translategemma / milmmt 三家共用，改一处三处生效。
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
    //
    // ⚠ 这是本站【默认】服务，开箱就走它 ⇒ 改这条前要实测一次，不能只读文档。
    // 实测状态：两条芯片都通 —— translate-pa 的 /translateHtml 直接回译文（硬编码的
    // 公共 X-Goog-API-Key 仍在放行）、`sl=auto` 照回检测语言；legacy 芯片的
    // translate_a/single?client=gtx 也通（那堵墙按 IP 信誉放行，不是所有人都撞得上）。
    // ⚠ 【两个网关的形态差不是一回事】：正文里的 HTML 标签在默认的 translate-pa 上【被当
    // 标记吞掉】（`This is <b>bold</b> text` → 「这是粗体文本」，标签没了、译文照给），
    // legacy 却原样带回（`\u003cb\u003e` 形态）。emoji 两支都原样保留（16 个语种实测，旗帜、
    // 肤色修饰符、ZWJ 连字族都没丢）—— 「emoji 会被换成 `？？`」那种降级复现不出，别再照它下结论。
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
    // (Azure Translator 引擎；见 services/traditional.ts 的 edgeFreeAPI —— 2026-10 从老的
    // /translate/auth JWT 两步流迁来，那个 auth 口已 404)。与 gtxFreeAPI 同为零配置免费服务，
    // 互为备胎：Google 反滥用墙收紧时用户可一键切到 Edge，反之亦然。
    // 实测状态：/translatetext?from=&to=&isEnterpriseClient=false 直接回译文，`from=`
    // (auto) 也照走检测 —— 迁口之后这条免费路的形态没变过。
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
    // ⚠ 上面那个 docs 域名【只是文档站】，不提供公共实例（根路径 200 是文档，
    // GET /translate 404），别把它当可用 URL。契约面 = POST /translate {text, target_lang,
    // source_lang} → {data: string}，与 services/traditional.ts 的实现一致；内置兜底 URL
    // (services/shared.ts 的 THIRD_PARTY_ENDPOINTS.deeplx) 就只有这一个 `/translate` 面 ——
    // 同机的 /jsonrpc 回 404，别照上游文档去探 JSONRPC 形状。
    // ⚠ 这台是【所有人共用一个出口 IP】的免费实例，DeepL 按 IP 限流：实测常态是
    // 429 `{code:429,msg:"…upstream IP has been temporarily rate-limited by DeepL"}`（string /
    // array / 缺 source_lang / 小写码四种形状同回），夹杂 Cloudflare 的 500 页。那是这台实例
    // 的固有抖动，既不代表镜像挂了、也不代表我们发错形状；429 由共享冷却闸接住。
    // 该兜底实例仍回 alternatives 数组，而文档说 v1.2.0 起恒为 null —— 我们只读 data，不受影响。
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
    // qwen-mt-turbo 不收录，理由是【厂商自己指路 flash】：官方对比表那一行对自身的说明
    // 原话是「turbo 模型后续不再更新，建议选用效果与功能均更优的 flash 模型」—— 于是我们
    // 不给它一个下拉位。（那张表如今连 turbo 整行都撤掉了，只剩 92 语种表的标题还写着
    // 「qwen-mt-plus/flash/turbo 支持的语言 (92 种)」⇒ 一个厂商连说明行都撤掉的档位，
    // 更不该占下拉位。）⚠ 别把它写成"已下架"，那句话不成立：语种表还认它，没有证据说
    // 它已被停服，手填仍可调。
    // qwen-mt-lite-us 是美区分部署版本，
    // 仅在 international endpoint 才可用，不放主清单避免误选。
    // ⚠ 目录实拉（175 条）里 MT 型号是 qwen-mt-uni / lite / flash / plus 四条，在册三条
    // 全部命中；多出来的【qwen-mt-uni 不收】，理由是实测而不是"文档没写"：用本服务的请求
    // 形状（translation_options）打它，回 400 "InvalidParameter: missing required field:
    // input.target_lang"，不带 translation_options 也是同一条 —— 它要的是 `input` 参数包，
    // 与本 provider 的 wire 不是同一个契约。同一次探针里 qwen-mt-flash 用同形状回 200，
    // 所以这不是我们发错了形状。要收它得按型号分叉请求体（一个 provider 两套入参形状），
    // 那是另一个决定，不是补一行 id。
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
    // Users self-host on heterogeneous runtimes (LM Studio :1234, llama.cpp :9931,
    // koboldcpp :5001 —— 不含 Ollama，见 RAW_PROMPT_RUNTIME_ENDPOINTS); shipping any
    // one as the default would mislead users on the others. Empty default
    // → status starts as "needs-config" and forces
    // an explicit endpoint pick from the chips below.
    defaults: { url: "", apiKey: "", model: "translategemma-4b-it", batchSize: 10, delayTime: 200 },
    endpoints: [...RAW_PROMPT_RUNTIME_ENDPOINTS],
    // google/ 官方权重就 4b-it / 12b-it / 27b-it 三支，与下面三条一一对上（HF 上其余
    // 命中全是社区 GGUF/mlx/量化副本，不是新型号）。这里的 value 是【用户本地加载的
    // 名字】而非 HF 全路径，所以自托管侧不受 HF 改名影响。
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
    // translategemma: users self-host on LM Studio :1234 / llama.cpp :9931 /
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
    // xiaomi-research 名下 v1.0 就 1B / 4B / 12B 三支，与下面三条一致；v0.1 与
    // *-Pretrain 仍在但那是旧代与预训练权重（按"每族只留最新代 + 预训练底座不作翻译用"
    // 不收）。
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
    // 模型清单以带 key GET /v1/models 实拉为准：在册仅 deepseek-flash（由 V4.1 Flash 服务）
    // 与 deepseek-v4-pro 两条。
    // 思考模式：各模型服务端默认开启思考。
    //   - 关闭思考显式发 thinking:{type:"disabled"}（优先于 effort；官方 API 参考中
    //     reasoning_effort 亦支持 none/low/high/max，且 medium 映射为 high，
    //     故我方开启时恒发 high，不摆虚假分级）。出处：api-docs.deepseek.com/zh-cn/api/create-chat-completion/
    //   - 参数生效规则：temperature 仅非思考态生效，思考态下被忽略；presence/frequency penalty
    //     已废弃不生效；deepseek-flash 的 top_p 仅思考模式生效（有效范围 0.95–1.0）。
    // 协议保留 Chat Completions：翻译只需文本往返，Responses API 与 Anthropic 兼容端点
    // 无额外缓存或预算优势（api-docs.deepseek.com/zh-cn/guides/responses_api/）。
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
    // 无 defaultTemperature：GPT-5.x/6.x 全系为推理模型，拒绝非默认 temperature
    // (400 "Only the default (1) value is supported")。字段移除 → 请求不发、服务端默认生效。
    docs: "https://developers.openai.com/api/docs/guides/text",
    apiKeyUrl: "https://platform.openai.com/api-keys",
    defaultUseRelay: false,
    // 模型清单（developers.openai.com/api/docs/models）：
    //   主推 GPT-6 家族：astra（旗舰）、6.1-sol（均衡，同价 $2/$10 取代旧 gpt-6-sol）、
    //   luna（经济档，默认）。GPT-5.x 全系降为旧代移出清单（手填仍可调）。
    // 思考档位与关闭值（逐型号页 developers.openai.com/api/docs/models/<id>.md）：
    //   - gpt-6-astra（2026-11-16 逐型号页逐字：reasoning.effort 支持 low/medium/high/xhigh/max）
    //     与 gpt-6.1-sol 不支持 none/minimal，关闭态发 none 会 400 ⇒ 声明
    //     thinkingLevels: ["low", "medium", "high"]，关闭态发最低档。
    //   - gpt-6-luna 支持 none ⇒ 不声明 thinkingLevels，关闭态发 none 真正关闭。
    //   - gpt-6.1-terra（2026-11-16 逐型号页逐字：支持 none/low/medium/high/xhigh/max）⇒
    //     与 luna 同路，不声明档位表，关闭态发 none 真正关闭。xhigh/max 超出我们的档位，不摆。
    models: [
      { label: "GPT-6 Astra", value: "gpt-6-astra", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-6.1 Sol", value: "gpt-6.1-sol", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-6.1 Terra", value: "gpt-6.1-terra", thinking: true },
      { label: "GPT-6 Luna", value: "gpt-6-luna", thinking: true },
    ],
  },
  claude: {
    kind: "custom",
    category: "llm",
    label: "Claude",
    docs: "https://platform.claude.com/docs/en/intro",
    apiKeyUrl: "https://platform.claude.com/settings/keys",
    // url 支持自建中转（转发到 api.anthropic.com/v1/messages 的自有代理）。
    // endpoints 声明官方地址以供 classifyEndpointUrl 识别。
    endpoints: [{ label: "Anthropic", url: "https://api.anthropic.com/v1/messages" }],
    // 无 temperature 字段：adaptive 世代全系拒绝非默认 temperature (400)，provider 级不发。
    defaults: { url: "", apiKey: "", model: "claude-sonnet-5-5", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {}, useRelay: false },
    // 模型清单与思考形态（platform.claude.com/docs/en/build-with-claude/thinking）：
    //   全系在售四支（Opus 5.5 / Sonnet 5.5 / Haiku 5.5 / Fable 5.2）均为 Adaptive 世代
    //   （thinking:{type:"adaptive"} + output_config.effort）。默认 Sonnet 5.5 兼顾速度与成本。
    //   2026-11-16 复核（models/overview.md 逐字：Latest = Opus 5.5 / Sonnet 5.5 / Haiku 5.5 /
    //   Fable 5.2；Fable 5.1 页已标 Legacy 并给迁移指南）⇒ Fable 档换 5.2：同为
    //   "Adaptive (always on)"、1M 上下文 / 128K 输出不变，价格降到 $8/$40。
    //   撤下的旧 5.1 手填仍按 always-on 走（ALWAYS_THINKING_CLAUDE_RE 的 fable-5 分支）。
    //   关闭档线格式分三类（发错即 400，由 thinking.test.ts 钉住）：
    //     - Always on（Opus 5.5 / Fable 5.2）：连 disabled 都拒，关闭态不发思考字段；
    //     - between_tools（Sonnet 5.5）：最低档为 between_tools，发 disabled 拒收；
    //     - 显式 disabled（Haiku 5.5）：官方接受 disabled 关闭。
    //   （旧代 Haiku 4.5 仍可通过手填兼容，内部走 extended thinking 的 budget_tokens 分支）。
    models: [
      { label: "Claude Opus 5.5", value: "claude-opus-5-5", thinking: true },
      { label: "Claude Sonnet 5.5", value: "claude-sonnet-5-5", thinking: true },
      { label: "Claude Haiku 5.5", value: "claude-haiku-5-5", thinking: true },
      { label: "Claude Fable 5.2", value: "claude-fable-5-2", thinking: true },
    ],
  },
  gemini: {
    kind: "custom",
    category: "llm",
    label: "Gemini",
    docs: "https://aistudio.google.com/api-reference/generate-content",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
    // 无 temperature 字段：Gemini 3.x 官方强烈建议保持默认值 1.0（<1.0 易循环退化）。
    defaults: { apiKey: "", model: "gemini-3.8-flash", batchSize: 20, contextBatchSize: 3, contextWindow: 50, thinkingEffort: {} },
    // 模型清单与思考控制（ai.google.dev/gemini-api/docs/thinking）：
    //   收录 Gemini 3.x/4.x 系列（2.x 已过时）。默认 3.8-flash 性价比最高。
    //   2026-11-16 逐个型号页（aistudio.google.com/docs/models/<id>）复核 Gemini 4 三支：
    //     - 4-carbon（最强推理）/ 4-argon（高效前沿）：Thinking Supported (low, medium, high)
    //     - 4-hydrogen（日常 coding/agentic）：Supported (low, medium, high, xhigh) —— xhigh 超出
    //       我们的 EffortLevel，不摆；声明到 high 为止，关闭态发最低档 low。
    //   思考由 thinkingConfig.thinkingLevel 控制，服务端默认开启且无关闭值，
    //   off 态发该 SKU 支持的最低档位（通过 thinkingLevels 约束，解析走 pickThinkingLevel）：
    //     - 4-carbon / 4-argon / 4-hydrogen / 3.8-flash: ["low", "medium", "high"]（无 minimal 档，误发即 400）
    //     - 3.5-flash-lite: ["minimal", "low", "medium", "high"]
    models: [
      { label: "Gemini 4 Carbon", value: "gemini-4-carbon", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 4 Argon", value: "gemini-4-argon", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 4 Hydrogen", value: "gemini-4-hydrogen", thinking: true, thinkingLevels: ["low", "medium", "high"] },
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
      { label: "Hong Kong", url: "https://cn-hongkong.dashscope.aliyuncs.com/compatible-mode/v1/chat/completions" },
    ],
    // 思考模式：全系混合思考模式，服务端默认开启思考，需显式传 enable_thinking:false 关闭。
    // （注意：思考模式下 max_tokens 有效范围为 [1, 32768]）。
    // 模型清单（help.aliyun.com/zh/model-studio/models）：
    //   2026-11-16 逐型号页复核（help.aliyun.com/zh/model-studio/qwen4-max 逐字：「Qwen4-Max 是
    //   通义千问新一代旗舰多模态模型…模型调用 ID：qwen4-max」+ 能力表「深度思考 支持」+
    //   「OpenAI Chat Completions…支持」；deep-thinking 页：「Qwen4 千问 4-Max 系列
    //   （混合思考模式，默认开启思考模式）：qwen4-max」）⇒ 收录 qwen4-max 作旗舰。
    //   3.8 线保留（qwen3.8-max 旗舰档、qwen3.8-flash 默认高速经济档）。
    //   旧代（3.7/3.6）、preview 限时档（qwen4-max-preview 仅 Token Plan、设退役期不收）及
    //   多模态实时口均不入列。
    models: [
      { label: "Qwen4 Max", value: "qwen4-max", thinking: true },
      { label: "Qwen3.8 Max", value: "qwen3.8-max", thinking: true },
      { label: "Qwen3.8 Flash", value: "qwen3.8-flash", thinking: true },
    ],
  },
  moonshot: {
    kind: "openai-compat",
    category: "llm",
    label: "Kimi (Moonshot)",
    endpoint: "https://api.moonshot.cn/v1/chat/completions",
    defaultModel: "kimi-k3",
    // 无 defaultTemperature：Kimi 推理模型服务端锁定参数，不发 temperature。
    docs: "https://platform.kimi.com/docs/models",
    apiKeyUrl: "https://platform.kimi.com/console/api-keys",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.moonshot.cn/v1/chat/completions" },
      { label: "International", url: "https://api.moonshot.ai/v1/chat/completions" },
    ],
    // 模型清单与思考控制（platform.kimi.com/docs/guide/use-reasoning-effort.md）：
    //   K2 系列已退役清出清单；收录 K3 与接班档 K3.1 Pro，以及 2026-11-16 模型页复核到的
    //   同代高速版 K3.1 Pro HighSpeed（官方模型列表逐字：「Kimi K3.1 Pro 的高速版模型，
    //   约为 K3.1 Pro 的 2～3 倍速度」）—— 同等智能、同一套 reasoning_effort 契约。
    //   K3 / K3.1 Pro / HighSpeed 始终进行推理（无关闭值），通过顶层 reasoning_effort 调节深度，
    //   关闭态发最低档 "low"（thinkingLevels: ["low", "high"]）。UI 最低档落到 Low。
    models: [
      { label: "Kimi K3.1 Pro", value: "kimi-k3.1-pro", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "Kimi K3.1 Pro HighSpeed", value: "kimi-k3.1-pro-highspeed", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "Kimi K3", value: "kimi-k3", thinking: true, thinkingLevels: ["low", "high"] },
    ],
  },
  doubao: {
    kind: "openai-compat",
    category: "llm",
    label: "Doubao (Volcengine)",
    endpoint: "https://ark.cn-beijing.volces.com/api/v3/chat/completions",
    defaultModel: "doubao-seed-2-1-turbo-260628",
    defaultTemperature: 0.7,
    docs: "https://docs.volcengine.com/docs/ark/model-list",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    defaultUseRelay: false,
    endpoints: undefined,
    // 本条走火山方舟按量付费线（Coding Plan 订阅线属用途受限端点，独立作为 hidden volcengine 收录）。
    // 思考控制：带深度思考标签模型默认启用思考，关闭需显式发 thinking:{type:"disabled"}。
    // 模型清单（docs.volcengine.com/docs/ark/model-list 推荐模型层）：
    //   收录 2.1 代推荐款及 evolving 滚动别名。默认 2.1-turbo 性价比最优；
    //   lite-260915 配额高（RPM 30000），适合高并发批量任务。
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
    endpoint: "https://api.xiaomimimo.com/v1/chat/completions",
    defaultModel: "mimo-v2.6-flash",
    defaultTemperature: 0.7,
    docs: "https://mimo.mi.com/docs/api/chat/openai-api",
    apiKeyUrl: "https://platform.xiaomimimo.com/console/api-keys",
    defaultUseRelay: false,
    // 支持按量付费 (api.xiaomimimo.com, sk-*) 与通用 Token Plan 订阅 (token-plan-*, tp-*) 两类端点。
    endpoints: [
      { label: "Pay-as-you-go", url: "https://api.xiaomimimo.com/v1/chat/completions" },
      { label: "Token Plan (CN)", url: "https://token-plan-cn.xiaomimimo.com/v1/chat/completions" },
      { label: "Token Plan (Singapore)", url: "https://token-plan-sgp.xiaomimimo.com/v1/chat/completions" },
      { label: "Token Plan (Europe)", url: "https://token-plan-ams.xiaomimimo.com/v1/chat/completions" },
    ],
    // 思考控制：服务端默认开启思考，关闭显式发 thinking:{type:"disabled"}。
    // （Chat API 无 effort 档位，界面呈现二元 Off/On；思考态下锁定推荐参数）。
    // 模型清单：收录在售 v2.6 Flash 与 Pro 档（旧代 v2.5 已退役清出）。
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
    docs: "https://docs.bigmodel.cn/cn/guide/start/model-overview",
    apiKeyUrl: "https://bigmodel.cn/usercenter/proj-mgmt/apikeys",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://open.bigmodel.cn/api/paas/v4/chat/completions" },
      { label: "International (Z.ai)", url: "https://api.z.ai/api/paas/v4/chat/completions" },
    ],
    // 思考控制：GLM-5.3 全系始终启用思考不可关闭。
    // 官方枚举仅 low/high/max，关闭态发最低档 thinking:{type:"enabled"} + reasoning_effort:"low"
    // （省略则服务端默认 max 白耗 token；不接受 disabled 与 medium，发错即 400）。
    // UI 最低落到 Low，反映其不可真正关闭。
    unlistedEffortLevels: ["low", "high"],
    // 模型清单（docs.bigmodel.cn/cn/guide/start/model-overview）：
    //   收录最新 5.3 世代文本推荐款（旗舰 5.3、经济档 Flash、FlashX；4.x/5.2 等旧代移出）。
    models: [
      { label: "GLM-5.3", value: "glm-5.3", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "GLM-5.3 Flash", value: "glm-5.3-flash", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "GLM-5.3 FlashX", value: "glm-5.3-flashx", thinking: true, thinkingLevels: ["low", "high"] },
    ],
  },
  minimax: {
    kind: "openai-compat",
    category: "llm",
    label: "MiniMax",
    endpoint: "https://api.minimax.cn/v1/chat/completions",
    defaultModel: "MiniMax-M3.1-Flash",
    defaultTemperature: 0.7,
    docs: "https://platform.minimax.io/docs/api-reference/text-chat-openai",
    apiKeyUrl: "https://platform.minimax.io/console/access",
    defaultUseRelay: false,
    endpoints: [
      { label: "Mainland (CN)", url: "https://api.minimax.cn/v1/chat/completions" },
      { label: "Mainland (CN, legacy)", url: "https://api.minimaxi.com/v1/chat/completions" },
      { label: "International", url: "https://api.minimax.io/v1/chat/completions" },
    ],
    // 思考形态逐 SKU 不同：
    //   - M3.1 Flash（默认）：强制思考不可关，只收 adaptive（传 disabled 报 400），
    //     通过 reasoning_effort 调节，关闭态发 adaptive + low（thinkingLevels: ["low", "medium", "high"]）。
    //   - M3：支持真关闭，开启走 adaptive，关闭态发 thinking:{type:"disabled"}。
    // 模型清单：M2.x 已退役自动路由，在售收录 M3.1 Flash（半价且 1M 上下文）与 M3。
    models: [
      { label: "MiniMax M3.1 Flash", value: "MiniMax-M3.1-Flash", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "MiniMax M3", value: "MiniMax-M3", thinking: true },
    ],
  },
  stepfun: {
    kind: "openai-compat",
    category: "llm",
    label: "StepFun (阶跃星辰)",
    endpoint: "https://api.stepfun.com/v1/chat/completions",
    defaultModel: "step-3.5-flash",
    defaultTemperature: 0.7,
    // 官方文档仅提供中文，路径写入口终点 /list。
    docs: "https://platform.stepfun.com/docs/zh/guides/models/list",
    apiKeyUrl: "https://platform.stepfun.com/interface-key",
    defaultUseRelay: false,
    // 手填型号的兜底档位表（官方 2603 等仅收 low/high，收窄避免发 medium 导致 400）。
    unlistedEffortLevels: ["low", "high"],
    // 默认选用 step-3.5-flash（纯语言推理，性价比较高）；step-3.7-flash 为多模态推理旗舰。
    // step-3.7-flash 支持 low/medium/high 三档推理，官方全篇无 none/disabled，关闭态发 low。
    // step-3.5-flash 官方无 reasoning_effort 说明，保持不打标（省略思考参数最安全）。
    // step-5-preview（滚动 preview）与语音/视觉模型（StepAudio、Step-1o Turbo Vision）不收录。
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
    // 指向模型列表页（model 入参权威来源）：https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j
    docs: "https://cloud.baidu.com/doc/qianfan/s/rmh4stp0j",
    apiKeyUrl: "https://console.bce.baidu.com/iam/#/iam/apikey/list",
    defaultUseRelay: false,
    // ernie-5.1 是当前最新旗舰。官方参数页中 ernie-5.1 仅出现在 thinking_budget 清单中，
    // 不在 thinking:{type} 或 enable_thinking 开关清单中，也无 reasoning_effort 映射。
    // 故保持不打标，不发思考参数以避免 400。老代 ernie-5.0 / ernie-x1.1 等不收录。
    models: [{ label: "ERNIE 5.1", value: "ernie-5.1" }],
  },
  mistral: {
    kind: "openai-compat",
    category: "llm",
    label: "Mistral",
    endpoint: "https://api.mistral.ai/v1/chat/completions",
    // 默认 Small 4：相比 Medium 3.5 更经济且针对效率优化。
    defaultModel: "mistral-small-latest",
    defaultTemperature: 0.7,
    docs: "https://docs.mistral.ai/api",
    apiKeyUrl: "https://console.mistral.ai/api-keys",
    defaultUseRelay: false,
    // 模型 ID 严格对齐模型卡「API names」行（如 mistral-small-latest、ministral-14b-2512）。
    // 可调推理支持 high | none（二元档位，归入 BINARY_EFFORT_VENDORS）。
    // Small 4 标 thinking: true；Ministral 为纯文本模型不标。
    // Preview 状态的 Large 4 及已弃用/过期的 Medium 3.5 不收录。
    models: [
      { label: "Mistral Small 4", value: "mistral-small-latest", thinking: true },
      { label: "Ministral 3 14B", value: "ministral-14b-2512" },
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
    // Grok 4.7 为当前 frontier 旗舰档。旧世代（grok-4.20、grok-4.3 等）不收录。
    // thinkingLevels 支持 low/medium/high（xhigh 超出 UI 档位未收）。
    // 官方明写「Reasoning cannot be disabled」，关闭态由 pickThinkingLevel 发 low。
    models: [{ label: "Grok 4.7", value: "grok-4.7", thinking: true, thinkingLevels: ["low", "medium", "high"] }],
  },
  // Perplexity 已移除：Agent API 为 Responses 形状且缺乏差异化。
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
    // Command A 系列服务端默认开启 thinking。
    // compatibility 端点通过 reasoning_effort 暴露开关，仅支持 "none" 与 "high" 两档（归入 BINARY_EFFORT_VENDORS）。
    // 标 thinking: true 确保关闭态显式发送 "none" 关闭思考。
    // 专有翻译模型 command-a-translate 按通用 AI provider 规则不收录。
    models: [
      { label: "Command A Plus", value: "command-a-plus-05-2026", thinking: true },
      { label: "Command A Reasoning", value: "command-a-reasoning-08-2025", thinking: true },
    ],
  },
  yandex: {
    kind: "custom",
    category: "llm",
    label: "YandexGPT (AI Studio)",
    // Yandex AI Studio OpenAI 兼容接口（llm.api.cloud.yandex.net/v1）不返回 CORS 头，
    // 浏览器直连会失败，故 useRelay 默认开启（用户亦可自选直连或配置自有代理）。
    // 模型 ID 格式为租户专属 URI：gpt://<folder_id>/<model>/latest，故需独立配置 folderId。
    docs: "https://aistudio.yandex.ru/en/docs/ai-studio/concepts/api",
    apiKeyUrl: "https://aistudio.yandex.ru/platform/folders/",
    endpoints: [{ label: "Yandex Cloud", url: "https://llm.api.cloud.yandex.net/v1/chat/completions" }],
    defaults: { url: "", apiKey: "", folderId: "", model: "yandexgpt-5.1", temperature: 0.7, batchSize: 20, contextBatchSize: 3, contextWindow: 50, useRelay: true },
    // 模型依据官方「Common instance models」列表。已停服/过期的旧型号（yandexgpt-5-lite、deepseek-v4-flash、gpt-oss 等）不收录。
    // 目前保持不打标 thinking：services/llm.ts 暂无 yandex 的 thinking builder，且官方清单未提供逐模型的推理档位字段。
    models: [
      { label: "YandexGPT Pro 5.1", value: "yandexgpt-5.1" },
      { label: "YandexGPT Pro 5", value: "yandexgpt-5-pro" },
      { label: "Alice AI LLM", value: "aliceai-llm" },
      { label: "Alice AI LLM Flash", value: "aliceai-llm-flash" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash" },
      { label: "Qwen3.6 35B", value: "qwen3.6-35b-a3b" },
    ],
  },

  // ===== Aggregators & Self-hosted (no relay — already cross-provider / CORS-friendly / user-controlled) =====
  openrouter: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    // 免费档（:free）可用性以 GET /api/v1/models/{slug}/endpoints 且 status=0 供应方数大于 0 为准。
    defaultModel: "nvidia/nemotron-3.5-lightning:free",
    defaultTemperature: 0.7,
    docs: "https://openrouter.ai/docs/guides/best-practices/reasoning-tokens",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
    defaultUseRelay: false,
    extraHeaders: { "HTTP-Referer": "https://aishort.top", "X-Title": "AIShort" },
    // 选型依据：周榜前列主流旗舰与可用免费档。
    // OpenRouter 自动转发 reasoning_effort 到各底座：
    // - mandatory: true（无法禁用思考）：声明 thinkingLevels（如 low/medium/high 或 low/high），关闭态由 pickThinkingLevel 发最低合法档；
    // - mandatory: false 且含 none：标 thinking: true，关闭态发送 reasoning: {enabled: false} 或 "none"；
    // - effortLevels：当官方 supported_efforts 缺少 medium 时收窄为 ["low", "high"]，避免发送非法档位导致 400。
    // 2026-11-16 目录复核新增两支（supported_efforts 逐条对照 /api/v1/models）：
    //   google/gemini-4-carbon：mandatory=true、[high, medium, low] ⇒ thinkingLevels（关态发最低档）；
    //   qwen/qwen4-max：mandatory=false、[xhigh, high, low, none]、无 medium ⇒ effortLevels: ["low","high"]，
    //   关态走 {enabled:false}（它收 none）。
    models: [
      { label: "DeepSeek V4.1 Flash", value: "deepseek/deepseek-v4.1-flash", thinking: true, effortLevels: ["low", "high"] },
      { label: "Hy3", value: "tencent/hy3", thinking: true, effortLevels: ["low", "high"] },
      { label: "Claude Sonnet 5", value: "anthropic/claude-sonnet-5", thinking: true },
      { label: "Claude Sonnet 5.5", value: "anthropic/claude-sonnet-5.5", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Claude Opus 5.5", value: "anthropic/claude-opus-5.5", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 3.8 Flash", value: "google/gemini-3.8-flash", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Gemini 4 Carbon", value: "google/gemini-4-carbon", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Qwen4 Max", value: "qwen/qwen4-max", thinking: true, effortLevels: ["low", "high"] },
      { label: "GPT-6 Astra", value: "openai/gpt-6-astra", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-6 Luna", value: "openai/gpt-6-luna", thinking: true },
      { label: "GLM-5.3", value: "z-ai/glm-5.3", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "Grok 4.7", value: "x-ai/grok-4.7", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Kimi K3", value: "moonshotai/kimi-k3", thinking: true, effortLevels: ["low", "high"] },
      { label: "Kimi K3.1 Pro", value: "moonshotai/kimi-k3.1-pro", thinking: true, effortLevels: ["low", "high"] },
      { label: "Nemotron 3.5 Lightning (free)", value: "nvidia/nemotron-3.5-lightning:free" },
      { label: "MiniMax M3", value: "minimax/minimax-m3", thinking: true },
    ],
  },
  opencodeZen: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenCode Console",
    endpoint: "https://opencode.ai/zen/v1/chat/completions",
    // 上游由 Zen 更名为 Console，保留 key 与 endpoint 保持向下兼容与 Worker 路由稳定。
    // 计费为 Console 账户充值余额（按量计费），与按月订阅的 Go 分为独立 provider。
    // 必须填 API Key：上游外部客户端匿名请求已被拦截（免费档回 403 FreeTierError，需在官方客户端内使用）。
    // 默认选用 deepseek-v4.1-flash（付费档输入价最低 $0.14/1M，开箱可用）。
    defaultModel: "deepseek-v4.1-flash",
    defaultTemperature: 0.7,
    docs: "https://opencode.ai/docs/console/models/",
    apiKeyUrl: "https://opencode.ai/console/account",
    // 上游不发 CORS 头且 OPTIONS 预检返回 404，浏览器直连不可用，默认开启 relay。
    defaultUseRelay: true,
    // 官方文档未暴露 reasoning 控制参数，透传未知或非法 effort 会被 400 拦截；
    // 故保持不打标 thinking，走服务端默认推理，确保稳定性。
    // 模型列表按输入价升序排列。已下架（410/400）、不走 chat/completions（回 400 ModelProtocolUnsupported）或旧代模型均已剔除。
    // 2026-11-16 官方 /v1/models 目录复核：新增 gemini-4-hydrogen（2026-11-12 发布）与
    // hy4-flash-free（2026-11-16 发布，腾讯 Hy4 flash 的免费档）—— 两条都 type:"chat" 且
    // 官方 go/zen 协议表都指向 chat/completions，故收。
    models: [
      // 免费档（仅在 OpenCode 客户端内免凭证，外部客户端需配置有效账户凭证）
      { label: "Big Pickle (free)", value: "big-pickle" },
      { label: "MiMo V2.6 Flash (free)", value: "mimo-v2.6-flash-free" },
      { label: "Nemotron 3.5 Lightning (free)", value: "nemotron-3.5-lightning-free" },
      { label: "Hy4 Flash (free)", value: "hy4-flash-free" },
      // 付费档（按输入价升序）
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash" },
      { label: "Qwen3.8 Flash", value: "qwen3.8-flash" },
      { label: "GLM 5.3 Flash", value: "glm-5.3-flash" },
      { label: "MiniMax M3", value: "minimax-m3" },
      { label: "Qwen3.6 Plus", value: "qwen3.6-plus" },
      { label: "GLM 5.3", value: "glm-5.3" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      { label: "Kimi K3", value: "kimi-k3" },
      { label: "Gemini 4 Hydrogen", value: "gemini-4-hydrogen" },
    ],
  },
  opencodeGo: {
    kind: "openai-compat",
    category: "aggregator",
    label: "OpenCode Go",
    endpoint: "https://opencode.ai/zen/go/v1/chat/completions",
    // 计费为 OpenCode Go 按月订阅额度（Go / Go Plus / Go Teams），账号体系与 Console 相同但配额与 SKU 独立。
    // 独立条目理由：不同的可用模型集合、不同默认模型、且需专属请求头（User-Agent 与 x-opencode-session）。
    // 默认选用 mimo-v2.6-flash：输入、输出与提示缓存读取价格综合最低，限额档最高。
    defaultModel: "mimo-v2.6-flash",
    defaultTemperature: 0.7,
    docs: "https://opencode.ai/docs/console/go/",
    apiKeyUrl: "https://opencode.ai/console/account",
    // 与 Console 同 host，无 CORS 支持，浏览器环境默认开启 relay。
    defaultUseRelay: true,
    // 官方要求识别客户端标识，避免通用 HTTP 库名称被拦截（已纳入 Worker FORWARDED_HEADERS 白名单）。
    extraHeaders: { "User-Agent": "subtitle-translator" },
    // 官方硬性要求的会话头，缺少会导致 400 MissingSessionID 并影响 prompt caching 优化。
    sessionHeader: "x-opencode-session",
    // 思考控制与 Console 同理：官方未文档化 reasoning 开关，保持不打标以走服务端默认。
    // 模型列表按输入价升序排列，排除非 chat/completions 协议与旧代型号。
    // 2026-11-16 官方目录复核（+2 条 chat 协议）：hy4-flash-free（免费档）与 hy4（2026-11-04
    // 发布的 GA 款，官方协议表指向 openai/v1/chat/completions）；同批新增的 qwen4-max
    // 【不收】—— 官方 go 协议表把它映射到 anthropic/v1/messages，我们的通路是 chat/completions。
    // minimax-m3.1-flash（chat 协议、M3 的接班档）一并补入。
    models: [
      { label: "Hy4 Flash (free)", value: "hy4-flash-free" },
      { label: "Muse Spark 1.3 Contributor", value: "muse-spark-1.3-contributor" },
      { label: "MiMo V2.6 Flash", value: "mimo-v2.6-flash" },
      { label: "Hy3", value: "hy3" },
      { label: "Hy4", value: "hy4" },
      { label: "Qwen3.8 Flash", value: "qwen3.8-flash" },
      { label: "GLM 5.3 Flash", value: "glm-5.3-flash" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash" },
      { label: "LongCat 2.0", value: "longcat-2.0" },
      { label: "MiniMax M3.1 Flash", value: "minimax-m3.1-flash" },
      { label: "MiniMax M3", value: "minimax-m3" },
      { label: "Qwen3.7 Plus", value: "qwen3.7-plus" },
      { label: "MiMo V2.6 Pro", value: "mimo-v2.6-pro" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro" },
      { label: "GLM 5.3", value: "glm-5.3" },
      { label: "Qwen3.8 Max", value: "qwen3.8-max" },
      { label: "Kimi K3", value: "kimi-k3" },
      { label: "Kimi K3.1 Pro", value: "kimi-k3.1-pro" },
    ],
  },
  tokenhub: {
    kind: "openai-compat",
    category: "aggregator",
    label: "TokenHub (Tencent)",
    endpoint: "https://tokenhub.tencentmaas.com/v1/chat/completions",
    defaultModel: "hy3",
    defaultTemperature: 0.7,
    // ⚠ 调用前必须在控制台「在线推理」页面开通相应模型（开启免费体验或后付费），
    // 否则即使 API Key 有效也会返回 400 gateway_error 401006（服务 ID 不存在或不匹配）。
    docs: "https://cloud.tencent.com/document/product/1823/130079",
    apiKeyUrl: "https://console.cloud.tencent.com/tokenhub/apikey",
    // 上游 OPTIONS 预检返回 405 且缺少 CORS 响应头，浏览器直连会被拦截，默认开启 relay。
    defaultUseRelay: true,
    // API Key 分地域（Mainland 与 International 密钥不互通）。
    endpoints: [
      { label: "Mainland (CN)", url: "https://tokenhub.tencentmaas.com/v1/chat/completions" },
      { label: "International", url: "https://tokenhub-intl.tencentmaas.com/v1/chat/completions" },
    ],
    // 模型列表依据 TokenHub 在册模型表（document/product/1823/130051，2026-11-16 复核：
    // 页面更新时间 2026-11-16 12:15）。混元专用翻译模型（hy-mt2-*）因 8k 上下文/4k I/O
    // 限制不适合本通用管线，不予收录。
    // ⚠ 2026-11-16 按判据④撤下 hy4-preview：该表逐字写「Hy4 preview（2026-12-07下线）
    //   hy4-preview」，不再等它归零；同批上位的 Hy4 / Hy4 flash 一并收录（130051 能力列
    //   均为「深度思考（保留式思考）」，130079 协议表两支都吃 chat/completions）。
    // 思考模式配置（线格式见 services/llm.ts 的 tokenhubThinking）：
    // - hy3 / hy4 / hy4-flash / deepseek-v4-pro: 支持 thinking: {type: "enabled"|"disabled"}
    //   （1823/131208 逐字：「开启深度思考 thinking:{type:"enabled"} / 关闭 thinking:{type:"disabled"}」，
    //   支持模型表里 hy4-flash / hy4 / hy3 均标 enabled）；
    // - glm-5.3 / kimi-k3 / kimi-k3.1-pro: 官方不支持关闭，声明 thinkingLevels: ["low", "high"]，关闭态发最低档 low；
    // - minimax-m3: 仅收 adaptive / disabled；
    // - deepseek-v4.1-flash / mimo-v2.6-pro: 官方未说明开关，不打标以走服务端默认。
    models: [
      { label: "Hunyuan hy4 Flash", value: "hy4-flash", thinking: true },
      { label: "Hunyuan hy4", value: "hy4", thinking: true },
      { label: "Hunyuan hy3", value: "hy3", thinking: true },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash" },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
      { label: "GLM-5.3", value: "glm-5.3", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "Kimi K3", value: "kimi-k3", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "Kimi K3.1 Pro", value: "kimi-k3.1-pro", thinking: true, thinkingLevels: ["low", "high"] },
      { label: "MiniMax M3", value: "minimax-m3", thinking: true },
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
    // 选型依据：官方 production 模型列表，排除 preview 及 Enterprise 专属档。
    // gpt-oss 系列支持 reasoning_effort，枚举为 low/medium/high（无 none 选项）。
    // 官方不支持关闭思考，关闭态由 pickThinkingLevel 发最低档 low。
    models: [
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
    // 收录特点：极高推理吞吐（~3000 tokens/s）。
    // 清单依据公开端点免 key 实拉（api.cerebras.ai/public/v1/models）。
    // gpt-oss-120b: reasoning_effort 支持 low/medium/high（无 none，关闭态发 low）。
    // qwen-3.8-27b: 支持设置 reasoning_effort 为 none 禁用思考，走 reasoningEffortOrNone。
    models: [
      { label: "GPT-OSS 120B", value: "gpt-oss-120b", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "Qwen 3.8 27B", value: "qwen-3.8-27b", thinking: true },
    ],
  },
  siliconflow: {
    kind: "openai-compat",
    category: "aggregator",
    label: "SiliconFlow",
    endpoint: "https://api.siliconflow.cn/v1/chat/completions",
    defaultModel: "deepseek-ai/DeepSeek-V4-Flash",
    defaultTemperature: 0.7,
    docs: "https://docs.siliconflow.cn/docs/api/chat-completions-post",
    apiKeyUrl: "https://cloud.siliconflow.cn/me/account/ak",
    defaultUseRelay: false,
    // 模型列表依据线上实拉目录。
    // 思考开关走 SiliconFlow 自定义布尔参数 enable_thinking（详见 services/llm.ts）。
    // 已下架或仅在 Pro 专属通道提供的旧型号已清理。
    models: [
      { label: "DeepSeek V4 Flash", value: "deepseek-ai/DeepSeek-V4-Flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-ai/DeepSeek-V4-Pro", thinking: true },
      { label: "GLM-5.3", value: "zai-org/GLM-5.3" },
      { label: "Qwen3.8 27B", value: "Qwen/Qwen3.8-27B" },
    ],
  },
  // Atlas Cloud 与 GitHub Models 已下线/退役，不收录。
  nvidia: {
    kind: "custom",
    category: "aggregator",
    label: "Nvidia NIM",
    docs: "https://build.nvidia.com/explore/discover",
    apiKeyUrl: "https://build.nvidia.com/",
    defaults: { url: "", apiKey: "", model: "deepseek-ai/deepseek-v4.1-flash", temperature: 0.7, thinkingEffort: {}, batchSize: 20, contextBatchSize: 3, contextWindow: 50 },
    // 模型 ID 以 integrate.api.nvidia.com/v1/models 免 key 实拉为准（展示页 slug 与 API ID 不完全相同）。
    // 选品规则：从公共免费端点池（nimType=nim_type_preview）中精选高质量主流文本对话模型。
    // ⚠ 2026-11-16 实拉：目录只剩 33 条（2026-11-11 还有 84 条，NVIDIA 本轮清掉 51 条旧型号）。
    //   在册的 google/diffusiongemma-26b-a4b-it 与 meta/llama-3.2-90b-vision-instruct 已不在
    //   目录里（前者连 build.nvidia.com 的免费端点页也撤了；后者展示页还挂着卡片，但 API
    //   目录没有 = 打过去 404）⇒ 按条目自己写的判据撤下。models[] 只是下拉候选不是白名单，
    //   真还活着的 id 用户手填即可回来。
    // 默认选用 deepseek-ai/deepseek-v4.1-flash（开箱可用且为免费端点）。
    // 思考控制：DeepSeek 模型通过 chat_template_kwargs.thinking 控制，NIM 侧无档位映射，归入 BINARY_EFFORT_VENDORS。
    models: [
      { label: "Nemotron 3 Ultra 550B", value: "nvidia/nemotron-3-ultra-550b-a55b" },
      { label: "Nemotron 3.5 Super VL 120B", value: "nvidia/nemotron-3.5-super-vl-120b-a12b" },
      { label: "Nemotron 3.5 Lightning 30B", value: "nvidia/nemotron-3.5-lightning-30b-a3b" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-ai/deepseek-v4.1-flash", thinking: true },
      { label: "MiniMax M3.1 Flash", value: "minimaxai/minimax-m3.1-flash" },
      { label: "GPT-OSS 20B", value: "openai/gpt-oss-20b" },
      { label: "Gemma 4 31B IT", value: "google/gemma-4-31b-it" },
      { label: "GLM-5.3 Flash", value: "z-ai/glm-5.3-flash" },
    ],
  },
  azureopenai: {
    kind: "openai-compat",
    category: "aggregator",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/azure/foundry/foundry-models/concepts/models-sold-directly-by-azure",
    // endpoint 留空：由用户填入各自的 Azure 资源地址，由 wireUrlNormalizer 补全 /openai/v1/chat/completions。
    endpoint: "",
    // 无 defaultTemperature：官方将 temperature 列入 reasoning 模型不受支持清单，统一不下发。
    defaultModel: "gpt-6.1-sol",
    // 默认选用 gpt-6.1-sol（最新代且无需额外配额审批）。
    // GPT-6 Astra 与 GPT-6.1 Sol 官方不支持 none 档位，声明 thinkingLevels: ["low", "medium", "high"]，关闭态发 low。
    // 其余型号支持 none（关闭态发 none）。gpt-chat-latest 思考固定且不支持 reasoning_effort 参数，故不打标。
    models: [
      { label: "GPT-6 Astra", value: "gpt-6-astra", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-6.1 Sol", value: "gpt-6.1-sol", thinking: true, thinkingLevels: ["low", "medium", "high"] },
      { label: "GPT-6 Luna", value: "gpt-6-luna", thinking: true },
      { label: "GPT-5.6 Sol", value: "gpt-5.6-sol", thinking: true },
      { label: "GPT-5.6 Terra", value: "gpt-5.6-terra", thinking: true },
      { label: "GPT-5.6 Luna", value: "gpt-5.6-luna", thinking: true },
      { label: "GPT-chat-latest", value: "gpt-chat-latest" },
      { label: "GPT-5.4 Mini", value: "gpt-5.4-mini", thinking: true },
    ],
  },
  llm: {
    kind: "custom",
    category: "aggregator",
    label: "Custom (OpenAI-compatible)",
    // 通用 OpenAI 兼容端点（本地运行如 Ollama / LM Studio / vLLM 或自建代理 / LiteLLM 等）。
    // defaults.url 留空由用户自选或手动填入。
    // sendSystemPrompt 默认开启，若本地模型拒绝 system 角色可在设置中关闭。
    // maxTokens 作为本地模型防重复输出的安全保护。
    defaults: { url: "", apiKey: "", model: "", temperature: 0.7, maxTokens: 0, sendSystemPrompt: true, useRelay: false, batchSize: 10, contextBatchSize: 1, contextWindow: 30 },
    endpoints: [
      ...LOCAL_RUNTIME_ENDPOINTS,
      { label: "LiteLLM", url: "http://127.0.0.1:4000/v1/chat/completions", docs: "https://docs.litellm.ai/docs/" },
      { label: "9Router", url: "http://127.0.0.1:20127/v1/chat/completions", docs: "https://github.com/decolua/9router" },
      { label: "OmniRoute", url: "http://127.0.0.1:20128/v1/chat/completions", docs: "https://github.com/cheaper-inference/OmniRoute" },
      { label: "Together AI", url: "https://api.together.ai/v1/chat/completions", docs: "https://docs.together.ai/docs/inference/openai-compatibility" },
      { label: "Fireworks AI", url: "https://api.fireworks.ai/inference/v1/chat/completions", docs: "https://docs.fireworks.ai/tools-sdks/openai-compatibility" },
    ],
  },

  // ── Hidden providers（UI 默认不显示，见 BaseProvider.hidden）──────────────
  // 订阅套餐端点（火山 Coding Plan、阿里 Token Plan）。非编程工具调用有封号风险，
  // 默认在 UI 隐藏，仅在高级设置显式开启后可用。
  volcengine: {
    kind: "openai-compat",
    category: "llm",
    hidden: true,
    label: "Volcengine Coding Plan",
    endpoint: "https://ark.cn-beijing.volces.com/api/coding/v3/chat/completions",
    defaultModel: "doubao-seed-evolving",
    defaultTemperature: 0.7,
    docs: "https://docs.volcengine.com/docs/ark/coding-plan-personal-get-started",
    apiKeyUrl: "https://console.volcengine.com/ark/region:ark+cn-beijing/apiKey",
    defaultUseRelay: true,
    // 模型列表依据官方 Coding Plan 个人版 Model Name 表。
    // Doubao 与 DeepSeek 支持 thinking 开关；
    // GLM-5.3 与 Kimi 系列官方声明「默认开启思考，不支持关闭思考」，故保持不打标以走服务端默认。
    models: [
      { label: "Doubao Seed Evolving", value: "doubao-seed-evolving", thinking: true },
      { label: "Doubao Seed 2.1 Pro", value: "doubao-seed-2.1-pro", thinking: true },
      { label: "Doubao Seed 2.1 Lite", value: "doubao-seed-2.1-lite", thinking: true },
      { label: "Doubao Seed 2.0 Mini", value: "doubao-seed-2.0-mini", thinking: true },
      { label: "GLM-5.3 (glm-latest)", value: "glm-5.3" },
      { label: "GLM-5.3 Flash", value: "glm-5.3-flash" },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash", thinking: true },
      { label: "DeepSeek V4 Flash", value: "deepseek-v4-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
      { label: "Kimi K3", value: "kimi-k3" },
      { label: "Kimi K3.1 Pro", value: "kimi-k3.1-pro" },
    ],
  },
  alibaba: {
    kind: "openai-compat",
    category: "llm",
    hidden: true,
    label: "Alibaba Bailian Token Plan",
    endpoint: "https://token-plan.cn-beijing.maas.aliyuncs.com/compatible-mode/v1/chat/completions",
    defaultModel: "qwen3.8-flash",
    defaultTemperature: 0.7,
    docs: "https://help.aliyun.com/model-studio/token-plan-personal-overview",
    apiKeyUrl: "https://bailian.console.aliyun.com/cn-beijing/subscription/token-plan/personal",
    defaultUseRelay: true,
    // 模型列表依据 Token Plan 个人版模型清单。
    // 2026-11-16 复核：Token Plan 页已列 qwen4-max（官方逐型号页 qwen4-max 能力表「深度思考 支持」），
    // 与 Qwen 3.8 同走 enable_thinking 开关（deep-thinking 页：Qwen4 系列混合思考、默认开启）。
    // Qwen 3.8 系列与 DeepSeek 系列支持 enable_thinking 开关。
    // GLM-5.3 为仅思考模型且无法关闭，提供 low/high/max 推理强度，声明 thinkingLevels: ["low", "high"]，关闭态发 low。
    models: [
      { label: "Qwen4 Max", value: "qwen4-max", thinking: true },
      { label: "Qwen 3.8 Max", value: "qwen3.8-max", thinking: true },
      { label: "Qwen 3.8 Flash", value: "qwen3.8-flash", thinking: true },
      { label: "DeepSeek V4.1 Flash", value: "deepseek-v4.1-flash", thinking: true },
      { label: "DeepSeek V4 Pro", value: "deepseek-v4-pro", thinking: true },
      { label: "DeepSeek V4 Pro 0813", value: "deepseek-v4-pro-0813", thinking: true },
      { label: "DeepSeek V4 Flash 0731", value: "deepseek-v4-flash-0731", thinking: true },
      { label: "GLM-5.3", value: "glm-5.3", thinking: true, thinkingLevels: ["low", "high"] },
    ],
  },
} as const satisfies Record<string, ProviderSpec>;

// 退役 id 的处置 = 【直接删，不迁移】。不设迁移表、不记退役账（已定案）：
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
 * 而且要能稳定地跑。opencodeZen 曾短暂进过这个集合:console 的 *-free SKU 匿名直连实测
 * 200(2026-08-06),看起来完美符合。但 console 的免费档本来就很容易 429(实测撞到过
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
  // Keep the former quick pick's parameter-free behavior for saved selections.
  if (service === "minimax" && model === "MiniMax-M2.7") return false;
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
// ⚠ haiku-5 分支是官方 Haiku 5.5 换代到 adaptive 世代时补的（见 models 处）。
// 分支名写 `haiku-5` 而不是 `haiku-5-5`，好让带日期的快照 id（claude-haiku-5-5-2026xxxx
// / -5-5-20251001）照样命中 —— 与 sonnet-5 / fable-5 同一写法。Haiku 4.5 含 "haiku-4"
// 而非 "haiku-5"，仍归 extended 世代，两代互不干扰。
export const ADAPTIVE_THINKING_CLAUDE_RE = /claude-(opus-5|opus-4-[78]|sonnet-5|fable-5|mythos|haiku-5)/;
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
 * 所以 Sonnet 5.5【有关得掉的最低档】（区别于 Opus 5.5 / Fable 5.x 的"根本关不掉"），
 * 但那一档的名字是 between_tools，不是 disabled。
 * ⚠ 官方同时写明 between_tools 只在 low/medium/high 档被接受，xhigh/max 下发它会 400
 * —— 关闭态本来就不带 effort，所以只在【没有 effort】时走这条（见 buildClaudeThinkingBody）。
 */
export const BETWEEN_TOOLS_OFF_CLAUDE_RE = /claude-sonnet-5-5/;
export const isBetweenToolsOffClaude = (model: string): boolean => BETWEEN_TOOLS_OFF_CLAUDE_RE.test(model);

/**
 * 「关不掉思考」的两族 (官方标 enabled(不支持关闭)):GLM-5.3 系与 Kimi K3 ——
 * 关闭态只能发官方最低档 reasoning_effort，发 thinking.type:"disabled" 是不收的值。
 * 原文与通道见 tokenhub / alibaba 条目注释。⚠ 正则与 THINKING_SHAPE_RULES 共用同一份，
 * 别在 builder 里另抄一份 —— 抄一份就是两份真相，目录与运行时各判各的正是本仓要消灭的漂移。
 */
export const GLM_5_3_ALWAYS_THINKING_RE = /glm-5\.3/;
export const TOKENHUB_ALWAYS_THINKING_RE = /glm-5\.3|kimi-k3/;
/** TokenHub 的 minimax-m3 族：官方只接受 adaptive / disabled(发 enabled 直接 400)。 */
export const TOKENHUB_ADAPTIVE_RE = /minimax-m3/;

/**
 * 【思考形态按名字分代】的有序规则。手填的快照 id（`claude-sonnet-5-5-20261101` 这种）不在
 * 任何 models[] 清单里，只能按名字判代 —— 而发错一代的关闭值就是【每请求 400】。
 * 三个消费方，所以这张表只能有一份：
 *   · scripts/sync-provider-catalog.ts 按它下发 thinkingWireIf；
 *   · services/__tests__/thinking.test.ts 断言「按顺序取首个匹配解出的形态 == 运行时对
 *     同一个 id 真正发出的形态」；
 *   · registry 自己的档位表解析（tableModel：这一代的档位表挂在哪个在册型号上）——
 *     以及 runtime 侧的形态分流（services/llm.ts 的 moonshot 行读同一张表，不再自己
 *     抄一份 /kimi-k3/：抄一份就是两份真相，目录与运行时各判各的正是本仓要消灭的漂移）。
 * ⚠ 顺序即优先级，而且它不是审美问题，是由【哪个正则是谁的子集】决定的：always-on 的正则是
 * adaptive 的子集，反过来排 fable-5/mythos 会先命中 adaptive、拿到它们 400 的 disabled；
 * between_tools 同理必须排在 adaptive 之前（sonnet-5-5 两条都命中，adaptive 那条的关闭值是
 * disabled）。这一条曾经就是漏发的形态：目录只带两形态时，手填的 sonnet-5-5 快照拿到 disabled。
 * sentinel 是【故意不在册】的假 id，只用来取该代的真实形态（走运行时同一个 builder）。
 * ⚠ tableModel 只在「这一代的档位表挂在某个在册型号上」时才有（moonshot 的 k3 族）——
 *   claude 那三条只管关闭形态，档位不由它们决定。
 */
export const THINKING_SHAPE_RULES: ReadonlyArray<{ provider: string; pattern: RegExp; sentinel: string; tableModel?: string }> = [
  { provider: "claude", pattern: ALWAYS_THINKING_CLAUDE_RE, sentinel: "claude-fable-5-__unlisted__" },
  { provider: "claude", pattern: BETWEEN_TOOLS_OFF_CLAUDE_RE, sentinel: "claude-sonnet-5-5-__unlisted__" },
  { provider: "claude", pattern: ADAPTIVE_THINKING_CLAUDE_RE, sentinel: "claude-opus-5-__unlisted__" },
  // moonshot 只有一条：k3 吃顶层 reasoning_effort、不吃 thinking:{type}，K2.x 正好反过来。
  // tableModel：k3 那一族的档位表挂在在册的 "kimi-k3" 上（low/high）—— 手填的 k3 快照
  // 按族名归到它那张表，否则会掉进通用回落集合（含 medium）发出 k3 不收的档。
  { provider: "moonshot", pattern: /kimi-k3/, sentinel: "kimi-k3-__unlisted__", tableModel: "kimi-k3" },
  // cerebras:gpt-oss 族【没有 none 关闭值】(官方逐模型表 inference-docs.cerebras.ai/
  // capabilities/reasoning 逐字「gpt-oss-120b | medium | low, medium, high | Not
  // supported」—— 第三列就是 none 那一档，写的是 Not supported)。
  // 手填的 gpt-oss 快照 id 落进 custom 分支时，旧判据只查【在册清单】⇒ 查不到 ⇒ 走
  // reasoningEffortOrNone 发 none ⇒ gpt-oss 不收 none = 每请求 400。
  // tableModel 让它按族名归到 gpt-oss-120b 的表 (low/medium/high)⇒ 关闭态发最低档 low。
  { provider: "cerebras", pattern: /gpt-oss/, sentinel: "gpt-oss-120b-__unlisted__", tableModel: "gpt-oss-120b" },
  // alibaba:glm-5.3 系是「仅思考模式」(关不掉)⇒ 关闭态发官方最低档 reasoning_effort,
  // 绝不发 enable_thinking:false(官方两页对 false 的后果口径不一，见 alibaba 条目注释)。
  // tableModel 让手填的 glm-5.3-xxx 快照按族名归到在册 glm-5.3 的那张表 (low/high)。
  { provider: "alibaba", pattern: GLM_5_3_ALWAYS_THINKING_RE, sentinel: "glm-5.3-__unlisted__", tableModel: "glm-5.3" },
  // TokenHub 两条 (官方逐型号表，2026-10-21):
  //   · minimax-m3 族：只收 adaptive / disabled(发 enabled 直接 400)⇒ 形态自适应。
  //   · glm-5.3 / kimi-k3 族：官方「enabled(不支持关闭)」⇒ 关闭态发最低档 effort,
  //     不发 thinking 参数。两族档位表相同 (官方 low/high/max)⇒ 共用 glm-5.3 那张表。
  // tableModel 给的是「这一族的手填快照 id 该用哪张档位表」—— 族名不是 id:手填的
  // glm-5.3-2026xxxx 不在清单里，按族名归到代表型号的表，否则会掉进通用回落集合
  // (含 medium) 发出这两族不收的档。
  { provider: "tokenhub", pattern: TOKENHUB_ADAPTIVE_RE, sentinel: "minimax-m3-__unlisted__" },
  { provider: "tokenhub", pattern: TOKENHUB_ALWAYS_THINKING_RE, sentinel: "glm-5.3-__unlisted__", tableModel: "glm-5.3" },
];

/** 按【顺序取首个匹配】解出该 id 命中的那条规则；不匹配 = undefined（走 provider 级兜底）。 */
export const resolveThinkingShapeRule = (provider: string, model: string): (typeof THINKING_SHAPE_RULES)[number] | undefined =>
  THINKING_SHAPE_RULES.find((r) => r.provider === provider && r.pattern.test(model));

/** 按【顺序取首个匹配】解出该 id 该走的 sentinel；都不匹配 = undefined（走 provider 级兜底）。 */
export const resolveThinkingShapeSentinel = (provider: string, model: string): string | undefined => resolveThinkingShapeRule(provider, model)?.sentinel;

/**
 * 这个 id 是不是【某个按名字认出来的世代】—— runtime 侧的形态分流用它，
 * 别在 builder 里另抄一份正则（目录与运行时各判各的 = 本仓要消灭的那种漂移）。
 */
export const matchesThinkingGeneration = (provider: string, model: string): boolean => !!resolveThinkingShapeRule(provider, model);

const THINKING_LEVEL_ORDER: ReadonlyArray<EffortLevel> = ["minimal", "low", "medium", "high"];
/**
 * 未列出的 SKU(用户手填) 的回落档位。三家的官方表里在列模型都收这三档，所以
 * 是同一个默认值 —— 曾经给每家包了一个只是换服务名的 helper，三份完全一样。
 * 哪家将来出现不同的回落集合，给它单独传 fallback 即可。
 */
const DEFAULT_THINKING_LEVELS: ReadonlyArray<EffortLevel> = ["low", "medium", "high"];

/**
 * 【档位表按名字分族】—— 复用 THINKING_SHAPE_RULES 的 tableModel 字段，不另开一张表：
 * 「这个 id 属于哪一代」是同一个判断，形态与档位表都是它的下游。
 * ⚠ 族名用 /kimi-k3/ 而不是传入的 id：按 id 查会掉进通用回落集合（含 medium）
 *   ⇒ 发出 k3 不收的 medium = 每请求 400。
 */

/**
 * 【这一支的档位表从哪来】—— 三级优先，线格式与界面下拉共用这一个判据：
 *   ① 在册型号自己声明的表（effortLevels ?? thinkingLevels）；
 *   ② 按名字分族（THINKING_LEVEL_TABLE_RULES）→ 族代表型号的表；
 *   ③ provider 级兜底（spec.unlistedEffortLevels ?? 通用三档）。
 *
 * ⚠ ② 与 ③ 是【手填型号】才走到的分支，而它们以前只存在于线格式一侧：zhipu 的
 *   ["low","high"] 是 llm.ts 里的行内字面量、moonshot 的族名查找写在 builder 里。
 *   界面拿不到 ⇒ 界面显示 Medium、线上发 low（用户拨的档与实际跑的档不是一档）。
 *   数据挪进 registry 之后，两边读的是同一张表。
 */
export const resolveLevelsTable = (service: string, model: string): ReadonlyArray<EffortLevel> => {
  const entry = getProviderModels(service).find((m) => m.value === model);
  const own = entry?.effortLevels ?? entry?.thinkingLevels;
  if (own?.length) return own;
  // ② 按名字分族 → 族代表型号的表（THINKING_SHAPE_RULES 的 tableModel）
  const rule = resolveThinkingShapeRule(service, model);
  if (rule?.tableModel) {
    const rep = getProviderModels(service).find((m) => m.value === rule.tableModel);
    const table = rep?.effortLevels ?? rep?.thinkingLevels;
    if (table?.length) return table;
  }
  return getUnlistedEffortLevels(service);
};

/** provider 级兜底表：手填型号（不在 models[] 里的 SKU）用的那一套档位。 */
const getUnlistedEffortLevels = (service: string): ReadonlyArray<EffortLevel> => (PROVIDERS[service as ProviderKey] as ProviderSpec | undefined)?.unlistedEffortLevels ?? DEFAULT_THINKING_LEVELS;

/**
 * 在【给定档位集】里取「不高于 want 的最高档」；want 就在集内则原样返回。
 * 泛型 L 让调用方拿到自己那一层的类型（厂商档位 EffortLevel / 我们发得出的
 * ReasoningEffort），不用在外面再 `as` 一次。
 */
const clampToLevels = <L extends EffortLevel>(levels: ReadonlyArray<L>, want: ReasoningEffort): L => {
  // ⚠ 用 find 而不是 levels.includes(want)：includes 只能把 want 留在 ReasoningEffort，
  //   交不回去（levels 可能是更窄的子类型）；find 的 type predicate 保住 L。
  const exact = levels.find((l): l is L => l === want);
  if (exact !== undefined) return exact;
  const wantIdx = THINKING_LEVEL_ORDER.indexOf(want);
  const lower = levels.filter((l) => THINKING_LEVEL_ORDER.indexOf(l) <= wantIdx);
  return lower.length ? lower[lower.length - 1] : levels[0];
};

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
 * ⚠ 返回的是【厂商档位 EffortLevel】而不是 ReasoningEffort:关闭态取的就是厂商表里
 *   的最低档,而那可能是一档我们界面发不出的 minimal(gemini-3.5-flash-lite 就是
 *   ["minimal","low","medium","high"])—— 线上发 minimal 合法,把它硬说成
 *   ReasoningEffort 只会逼着调用方在外面 `as` 一次,那个断言迟早骗人。
 *   要「我们发得出的那一档」请用 resolveEffortForModel(它在交集里钳)。
 * ⚠ 未列出的 SKU(用户手填) 走 resolveLevelsTable 的 ②③ 分支：按名字分族，或用
 *   provider 级兜底集合(unlistedEffortLevels)。⚠ 那条收窄【不是】"硬降用户显式选的
 *   档位"——厂商枚举里真没有那一档(发出去是每请求 400)，所以是必要的；
 *   界面那一侧读的是同一张表，用户看到的与发出去的是一档。
 * ⚠ 曾用正则近似这些表 (按名字判 -pro / 硬编码 grok-4.3),两个毛病：按名字归并
 * 会把合法档位静默降级 (gemini 3.1-pro 的 medium 官方接受，却被降成 low);而且
 * 其中一个词边界转义在搬迁中被写成了不可见控制字符，那个分支从此静默失效。
 * 表就在数据里，别再回到正则。
 */
export const pickThinkingLevel = (service: string, model: string, want?: ReasoningEffort): EffortLevel => {
  const levels = resolveLevelsTable(service, model);
  if (!want) return levels[0];
  return clampToLevels(levels, want);
};

/**
 * 该 SKU【实际能收到】的 effort：声明了档位表 (effortLevels 或 thinkingLevels) 就钳到表内
 * (取不高于所求档的那一档)，没声明就原样 —— 线格式与界面下拉【共用这一个判据】。
 *
 * 为什么要有这个而不是各自调 pickThinkingLevel：后者在没声明表时回落到通用三档，而通用三档
 * 是「我们发得出什么」，不是「这一支收不收」。钳位这件事只有一处真相才有意义 ——
 * 下拉按表收窄、请求按原值发出去，网关就把越界档【就近映射】(OpenRouter 文档口径)，
 * 用户看到 High、跑的是别的档。
 *
 * ⚠ 钳位的目标是【厂商收 ∩ 我们发得出】：用户只拨得出 low/medium/high，而厂商表里
 *   可能多一档 minimal(gemini-3.5-flash-lite)。所以只在交集里钳，返回值必然是
 *   ReasoningEffort —— 界面拿它当显示值、线上拿它当要发的档，两边同一件事。
 *   交集为空 (厂商只收 minimal 这类我们发不出的档) 时【不钳】：原样发，让网关就近映射
 *   —— 那里没有更好的选择，也不能假装我们发得准。
 */
export const resolveEffortForModel = (service: string, model: string, want?: ReasoningEffort): ReasoningEffort | undefined => {
  if (!want) return want;
  const levels = resolveLevelsTable(service, model);
  const sendable = levels.filter((l): l is ReasoningEffort => l !== "minimal");
  if (!sendable.length) return want;
  return clampToLevels(sendable, want);
};

/**
 * 该 provider【能不能真的关掉】思考。
 *
 * 判据从 models[].thinkingLevels 派生，不另立手维护清单：声明了档位表 =
 * 这家把思考表达成"档位"而【没有关闭值】(gemini / grok / groq 的官方文档都
 * 明确如此),我们能做到的最"关"就是发最低档 —— 仍在推理、仍在计费。
 *
 * 界面据此把该档标成「最低」而不是「关闭」:用户关思考的动机正是省时间和
 * token，标成 Off 却照常推理是在撒谎，而且是计费可见的那种。
 * 其余厂商有真正的关闭值 (reasoning_effort:"none" / thinking:{type:"disabled"}
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
 *
 * ⚠ 在册 SKU 读【它自己那条】声明，不再一律跟随 provider 级 —— 2026-10-13 起
 *   openai / azureopenai 出现【同一家内两种关闭能力】:gpt-6-luna 与 gpt-5.6-*
 *   收 none(真关闭),gpt-6-astra 与 gpt-6.1-sol 只收 low/medium/high/xhigh/max
 *   (官方逐字「The none and minimal reasoning efforts are not supported」)。
 *   按 provider 级一刀切会给 luna 也贴上「关不掉」——反过来撒谎;而继续一律发
 *   none 则给 astra 每请求 400(见 services/llm.ts 的 openaiEffort)。
 * 用户手填的 SKU(不在册) 回落 provider 级 —— 整家都没有关闭值的那几家
 * (gemini / grok / groq),一支没登记的 SKU 不该被判成「关得掉」。
 */
export const canDisableThinkingForModel = (service: string, model: string): boolean => {
  const declared = getProviderModels(service).find((m) => m.value === model);
  // Adding an always-thinking Flash quick pick must not relabel custom models'
  // existing Off/On/Auto controls as Lowest/On/Auto.
  const skusCanDisable = declared ? !declared.thinkingLevels?.length : service === "minimax" || service === "openrouter" || canDisableThinking(service);
  return skusCanDisable && !(service === "claude" && isAlwaysThinkingClaude(model));
};

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
// 与真分级 SKU(k3 的 reasoning_effort low/high)。集合是 provider 级的，但
// **档位下拉已经按型号给了**（2026-10-21，四个仓同一口径）：k2.x 给 [On/Off]
// （三档折叠成开/关 —— Medium 与 High 同效，摆出来是摆设），k3 给 [低/高]
// （反过来只给 Off/On 则 k3 的 high 永远选不到）。thinking.test 的「三档形态 ↔
// 声明一致」不变量抓住了这次矛盾。
// volcengine(方舟 Coding Plan)= 扁平 thinking:{type},alibaba(百炼 Token Plan)
// = 裸 enable_thinking，都是二元形态;两家是 hidden provider，登记规则不变。
// ⚠ alibaba 并非每个在册 SKU 都打 thinking 标:glm-5.3 因官方 GLM 页明写「不支持关闭思考、传
// enable_thinking=false 不会生效」而不发（qwen3.8-* 依「混合思考、默开」原文补标，
// deepseek-v4.1-flash 依适用句原文补标）—— 理由逐条见该条目注释。volcengine 的
// glm-5.3*/kimi-k3/kimi-k2.7-code 同判撤标或不标 (官方把后两者列在「仅思考模式」行)。
// ⚠ zhipu 已移出：GLM-5.3 系官方有档位表（low/high/max），打标后 wire 是分级形态
// （low/medium/high 三挡里 medium 由 pickThinkingLevel 降到 low），与"二元"声明矛盾;
// 同 moonshot 的处置——给三档，折叠掉的那一档无害，反过来会把官方有的档位锁死。
// MiniMax now includes Flash with graded effort; M3 still folds levels to on/off.
// ⚠ doubao 已移出（2026-10-20）：三档现在真分开了 —— 官方 Chat API 的顶层
// reasoning_effort，low/medium/high 发出去是三个不同值。二元声明会让界面只给
// Off/On，那是把官方真有的档位锁死（同 qwen —— 它本来就分级，没在二元集合里）。
//
// ⚠ 2026-10-21：集合的【语义】改窄了一层 —— 它现在说的是「这一家【没有档位表的
// 型号】只有开/关」，不再是「整家折叠成开/关」。因为同一个 provider 里可以有两种
// 形态（moonshot：k3 有表 ⇒ 分级 / K2.x 没表 ⇒ 二元；minimax：M3.1-Flash 有表 ⇒
// 分级 / M3 没表 ⇒ 二元；nvidia：chat_template_kwargs 形态表达不了档位 ⇒ 二元），
// 而「整家二元」这个说法对它们不成立。**有档位表的型号一律分级**（表优先）。
// ⇒ 集合 = 「没表 ⇒ 二元」的 provider 名单；不在集合里的 provider，没表的型号走
//   通用三档（openrouter 的 claude-sonnet-5/openai 的 gpt-6-luna 等就是这一类）。
// ⚠ 危害不是「白给一个选项」：二元的那支摆出 Low/Medium/High 三档是**摆设** ——
//   线上三档发出去的 body 完全相同（档位被丢掉），用户拨 Low 以为省了 token，实际
//   拿到的是模型的默认思考（比 Low 多）。界面声称的档位与真实状态不一致，正是本仓
//   要消灭的那种撒谎。
export const BINARY_EFFORT_VENDORS: ReadonlySet<string> = new Set([
  "deepseek",
  "mimo",
  "siliconflow",
  "cohere",
  "qianfan",
  "mistral",
  "volcengine",
  "alibaba",
  // 同一 provider 内两种形态的：没表的那支是二元的。
  "minimax",
  "moonshot",
  // TokenHub：hy3 / deepseek-v4-pro 有逐型号档位表 (分级)，kimi-k2.6 / minimax-m3
  // 没有 (官方推理深度表里没列)⇒ 二元。同一家两种形态，表优先。
  "tokenhub",
  // NIM 的思考形态只表达开关（chat_template_kwargs 里没有档位那个字段）。
  "nvidia",
]);

/**
 * 这一支有没有【自己的】档位表（在册声明的，或按名字分族到某个族代表的）：
 * 有 = 分级形态（线格式会带上 effort，档位是真的能调）；没有 = 走 provider 级默认形态。
 *
 * ⚠ 线格式侧也要用它：手填的快照 id 按族名归到代表型号的表 (THINKING_SHAPE_RULES 的
 *   tableModel) 时，档位表存在但【不在 models[] 里】—— 只查 models[] 会判成"没表"
 *   ⇒ 发出去的 body 三档相同 (看着像二元) 或漏掉档位。
 */
export const hasOwnLevelsTable = (service: string, model: string): boolean => {
  const entry = getProviderModels(service).find((m) => m.value === model);
  if (entry?.effortLevels?.length || entry?.thinkingLevels?.length) return true;
  return !!resolveThinkingShapeRule(service, model)?.tableModel;
};

/**
 * 这一支的思考形态是【二元的】吗（二元 = 只有开/关，没有档位可选）。
 *
 * 判据两行，与 resolveLevelsTable 同一套来源：
 *   ① 这一支有自己的档位表（在册声明的，或按名字分族到某个族代表的）⇒ 分级，不是；
 *   ② 没有 ⇒ 看 provider：BINARY_EFFORT_VENDORS 里的 ⇒ 二元；其余 ⇒ 通用三档。
 *
 * ⚠ 为什么要有这个：界面的档位下拉本来是 provider 级的，而同一个 provider 里
 *   可以有两种形态（moonshot：k3 分级 / K2.x 二元；minimax：M3.1-Flash 分级 / M3 二元；
 *   nvidia：形态只表达开关）。二元的那支摆出 Low/Medium/High 三档是【摆设】——
 *   线上三档发出去的 body 完全相同（档位被丢掉），用户拨 Low 以为省了 token，
 *   实际拿到模型的默认思考（比 Low 多）。
 */
export const isBinaryThinking = (service: string, model: string): boolean => (hasOwnLevelsTable(service, model) ? false : BINARY_EFFORT_VENDORS.has(service));

/**
 * 界面上思考档位下拉【可以拨到的档位】。与该型号的档位表同源，所以用户拨不到
 * 官方没有的档（网关虽会「就近映射」，那是降级不是那一档）。
 *
 * ⚠ 两个表都收窄：effortLevels（关得掉但档位受限）与 thinkingLevels（没有关闭值、
 *   档位也受限）—— 少看一个就是让用户在 glm-5.3 / kimi-k3 上拨出一个官方不收的
 *   Medium（那支只收 low/high）。
 * ⚠ minimal 不在里面：厂商表里有（gemini-3.5-flash-lite），但【我们发不出】——
 *   存档的 ThinkingDirective 只有 low/medium/high/auto，界面存不下它。
 * ⚠ 二元 provider（BINARY_EFFORT_VENDORS）不在这里渲染：厂商层面就是把三档折叠成
 *   开/关，界面给 [On] 才不谎报粒度。
 */
export const getSelectableThinkingLevels = (service: string, model: string): ReadonlyArray<ReasoningEffort> => {
  const levels = resolveLevelsTable(service, model);
  return levels.filter((l): l is ReasoningEffort => l !== "minimal");
};

/**
 * 界面上思考档位下拉的【显示值】。判据只有一条：显示的必须与【线上真正会发的那一档】
 * 一致 —— 界面声称的状态必须与真实状态一致。
 *
 * 为什么不自己判一遍 "auto"，而要过 deriveThinkingParams：线上真正用的是哪一个，
 * 只有那个函数说了算，两种情况在线上 body 完全不同：
 *   · 在册型号存了 "auto" ⇒ deriveThinkingParams 把它归一成 undefined ⇒ 线上发【禁用】
 *     ⇒ 显示必须是 Off（显示 Auto 会让用户以为「参数被省略」，那是另一种状态）。
 *   · 手填型号存了 "auto" ⇒ 透传 ⇒ 线上【省略思考参数】、跟服务端默认走
 *     ⇒ 显示必须是 Auto —— 省略 ≠ 禁用，很多厂商的省略就是「默认在想、照常计费」。
 *
 * ⚠ 别把 "auto" 当成「没有值」直接丢掉：那样手填型号的 Auto 会显示成 Off，而线上
 *   仍在思考并计费 —— 正是本仓要消灭的那种撒谎。
 */
export const resolveThinkingSelectValue = (service: string, model: string, stored?: ThinkingDirective): "auto" | "off" | "on" | ReasoningEffort => {
  // 线上真正会用的指令 = deriveThinkingParams 的判据（唯一真相源）。造一份只带
  // 这两个字段的 config：那个函数只读 model 与 thinkingEffort。
  const effective = deriveThinkingParams(service, { model, thinkingEffort: stored ? { [model]: stored } : undefined });
  if (effective === undefined) return "off";
  if (effective === "auto") return "auto";
  // 二元形态（厂商把档位折叠成开/关，线上不带走 effort）：界面只给 On/Off ——
  // 低/中/高在这里没有意义，界面给三档就是摆设（用户拨 Low 以为省了 token）。
  if (isBinaryThinking(service, model)) return "on";
  // 分级：显示值过一遍档位表钳位，与线上发的那一档同源。
  return resolveEffortForModel(service, model, effective) ?? "off";
};

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
 * 内置公共中转【实际声明了哪些路由】—— 派生而不是手列，漏一个就红。
 *
 * 集合 = ① 带 `defaultUseRelay` 的 openai-compat(工厂据此配发 useRelay 字段)
 *        + ② 手写 kind 但自带中转的 claude / yandex
 *        + ③ llm(Custom)—— 见下面的分类说明。
 * workerParity.test.ts 也从这一个来源取键名去比对 Worker 的 PROVIDER_URLS。
 *
 * ⚠ 这里最容易画错的一条线是【Custom 整体进不进内置中转】。答案是**按芯片分**,
 *   不是按 provider 分 —— Custom 的 endpoints[] 里两类东西混在一起:
 *     · 七个本地运行时 (LM Studio / Ollama / llama.cpp / koboldcpp / LiteLLM /
 *       9Router / OmniRoute，全是 127.0.0.1):结构上【永远】不能中转，远端够不着，
 *       转发过去就是把请求变成探测 Worker 自身内网的探针;
 *     · 两个第三方聚合 (Together AI / Fireworks AI):固定、公开、HTTPS，与
 *       siliconflow / groq / cerebras 同型，理应和它们一样拿到逃生口
 *       路由 (origin 层封禁不可预测，deepseek WAF-403 就是先例)。
 *   所以判定不写死"llm 在/不在",而是交给 getBuiltinRelayAllowlist 逐条过滤 ——
 *   芯片增删时它自己是对的那一份，不需要人来同步这张名单。
 */
export const BUILTIN_RELAY_PROVIDERS: ReadonlySet<string> = new Set<string>([...OPENAI_COMPAT_KEYS.filter((k) => OPENAI_COMPAT_PROVIDERS[k].defaultUseRelay !== undefined), "claude", "yandex", "llm"]);

/**
 * 内置中转对某个 provider【允许转发到哪里】—— getRelayAllowlist 再滤掉
 * 「中转结构上到不了」的地址 (环回/内网，见 isPrivateEndpoint)。
 *
 * 对既有 provider 这层过滤是恒等的 (它们的 endpoints[] 全是公开 HTTPS 端点),
 * 所以它不改变任何现有行为 —— 它只为 Custom 的芯片表而存在：那 9 条里 7 条是
 * 本地运行时，进了 allowlist 就是把不可达的目标声明给中转。
 *
 * ⚠ 这【不是】安全边界本身：真正的边界是 worker 侧那份【部署者声明的、有限的、
 *   精确匹配】的 PROVIDER_URLS(调用方只能从集合里挑，不能自带)。本函数是它的
 *   客户端镜像 —— 两边由 workerParity.test.ts 钉住必须逐字一致。
 *   workerParity 另外单独钉住「llm 的 allowlist 里不许出现私有地址」。
 */
export const getBuiltinRelayAllowlist = (service: string): readonly string[] => getRelayAllowlist(service).filter((url) => !isPrivateEndpoint(url));

/**
 * 「中转【结构上】能不能到达这个地址」—— 与 relayBase 无关的独立一条判据。
 * 环回/内网地址只有用户自己那台机器够得着，远端 Worker 要么连不上 (它眼里的
 * 127.0.0.1 是它自己)、要么把请求变成探测自身内网的探针。
 *
 * 界面用它选提示文案 (不能对着一个拨了也不会生效的开关说「勾上就能用」),
 * relayWouldServe 用它退回直连。同一个判据，两处不重算。
 */
export const isPrivateRelayTarget = (service: string, url: string | undefined): boolean => {
  const trimmed = typeof url === "string" ? url.trim() : undefined;
  if (!trimmed) return false;
  return isPrivateEndpoint(wireUrlNormalizer(service)(trimmed));
};

/**
 * 「开中转对这组配置有没有效果」—— resolveWireEndpoint 的放行判据，也是
 * services/llm.ts「建议打开中转」提示的前置条件(指人去开一个开了也没用的
 * 开关，比不提示更糟)。
 *
 * 两条【结构性】否决先于一切，它们与"用户填了哪个地址"无关：
 *
 * ① 环回/内网目标 → 直连。中转到不了那里 (见 isPrivateRelayTarget)。
 * ② 内置公共中转【声明不了】这个目标 → 直连。这是两条独立的检查，别混成一条:
 *    · provider 不在 BUILTIN_RELAY_PROVIDERS 里 → 内置中转根本没有这条路由，
 *      发过去只会换一个无信息量的 400「Unsupported provider」,顺带把整条 URL
 *      (自建网关常带 ?token=SECRET) 留在那台机器的日志里;
 *    · provider 在集合里、但这个 url 判成 custom(不在它声明的端点集合内)→ 同样
 *      直连。**Custom 靠的是这一条**:llm【在】BUILTIN_RELAY_PROVIDERS 里 (它那两枚
 *      公开芯片确实有内置路由),挡住用户任意自填地址的是 classifyEndpointUrl 的
 *      custom 判定，不是"provider 不在集合"—— 早先的注释在这里写错过一次。
 *
 * ⚠ 【不把用户自填的地址发给内置公共中转】。内置中转只转发它声明过的端点，
 * 自填地址必然 400 —— 发过去毫无用处，却会把整条 URL 留在一台用户没打算牵涉的
 * 机器的日志里。这【不是】把「地址」「开关」两轴绑回去：开关照旧有效，只是这一种
 * 组合无处可去。
 * 用户自己的中转 (usesBuiltinRelay=false) 是另一回事：那台机器归他所有、
 * allowlist 由他声明 —— 这正是解耦要支持的场景，照发。
 * 「是不是官方地址」直接问 classifyEndpointUrl —— 与界面同一个判据，不重算。
 * ⚠ 它与 getBuiltinRelayAllowlist(worker 侧集合的客户端镜像) 必须永远一致 ——
 *   registry.test.ts 有一条等价性断言钉住这一点，别让「可中转」长出第二份定义。
 */
export const relayWouldServe = (service: string, opts: { url?: string; relayBase?: string }): boolean => {
  if (isPrivateRelayTarget(service, opts.url)) return false;
  if (!usesBuiltinRelay(opts.relayBase)) return true;
  return BUILTIN_RELAY_PROVIDERS.has(service) && classifyEndpointUrl(service, opts.url).kind !== "custom";
};

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
