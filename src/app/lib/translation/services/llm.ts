// Translation services - LLM APIs (OpenAI, DeepSeek, Gemini, etc.)

import type { ReasoningEffort, ThinkingDirective, TranslateTextParams, TranslationService } from "../types";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../config";
import {
  defaultConfigs,
  isAdaptiveThinkingClaude,
  isAlwaysThinkingClaude,
  isBetweenToolsOffClaude,
  isCustomModel,
  isThinkingModel,
  isApiKeyOptional,
  pickThinkingLevel,
  relayHintWouldHelp,
  resolveWireEndpoint,
  OPENAI_COMPAT_KEYS,
  OPENAI_COMPAT_PROVIDERS,
  getProviderEndpoints,
  getProviderModels,
  type OpenAICompatProviderKey,
  type OpenAICompatProviderSpec,
} from "../registry";
import { getAIModelPromptParts } from "../utils";
import { isNetworkError } from "@/app/utils/errorUtils";

import { fetchJSON, normalizeNumber, normalizePrompt, requireApiKey, requireUrl, completeOpenAICompatUrl, PROXY_ENDPOINTS, getOpenAICompatContent, getClaudeContent, RELAY_HINT_MARKER } from "./shared";

// Prepare prompts common to all LLM services. The user prompt comes back both
// joined (`prompt`) and split at ${content} (`promptPrefix` / `promptSuffix`):
// the prefix is byte-stable across requests and is what provider prefix
// caching keys on (subtitle-translator#53). Anything per-request — today the
// glossary block — goes on the suffix side, never into the prefix or system.
const preparePrompts = (params: { text: string; targetLanguage: string; sourceLanguage: string; systemPrompt?: string; userPrompt?: string; fullText?: string; glossaryBlock?: string }) => {
  const effectiveSystemPrompt = normalizePrompt(params.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  const effectiveUserPrompt = normalizePrompt(params.userPrompt, DEFAULT_USER_PROMPT);
  const { prefix: promptPrefix, suffix } = getAIModelPromptParts(params.text, effectiveUserPrompt, params.targetLanguage, params.sourceLanguage, params.fullText);
  const promptSuffix = params.glossaryBlock ? `${params.glossaryBlock}\n\n${suffix}` : suffix;
  return { effectiveSystemPrompt, prompt: promptPrefix + promptSuffix, promptPrefix, promptSuffix };
};

// Common OpenAI-compatible request helper (named-parameter config object)
type OpenAICompatRequestConfig = {
  params: TranslateTextParams;
  serviceName: string;
  endpoint: string;
  defaultModel: string;
  /** Absent = provider never sends temperature (locked/rejected upstream — see registry spec). */
  defaultTemperature?: number;
  extraHeaders?: Record<string, string>;
  /**
   * 这个 provider 要求把本轮会话 id 放进哪个请求头（registry 声明头名）。
   * 值取自 `params.sessionId` —— 流水线每轮生成一次，轮内稳定。
   */
  sessionHeader?: string;
  extraBody?: Record<string, unknown>;
};

const openAICompatRequest = async (cfg: OpenAICompatRequestConfig): Promise<string> => {
  const { params, serviceName, endpoint, defaultModel, defaultTemperature, extraHeaders, sessionHeader, extraBody } = cfg;
  const { apiKey, model, temperature } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  // apiKey 可选的服务跳过 requireApiKey —— 判据查 registry 的 isApiKeyOptional,
  // 与 getConfigStatus(驱动 UI 标签与 validate)是同一个,不在这里重拼一遍 OR。
  // 拦下一个 UI 刚标成「无需配置」的服务,是自相矛盾。
  const key = isApiKeyOptional(params.translationMethod) ? apiKey?.trim() : requireApiKey(serviceName, apiKey);
  // Model 字段：用户填的 model 与 spec 的 defaultModel 都为空时【整个字段省略】，
  // 让服务端自己的默认（网关启动参数 / completion_model 那类）生效。发空串只在
  // 少数会把 falsy 值当"未提供"的网关上等效，省略才是规范做法。自建网关型 service
  // 走同一语义。其余 provider 都有非空 defaultModel ⇒ 该字段恒在。
  const effectiveModel = model || defaultModel;

  const data = await fetchJSON(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(key ? { Authorization: `Bearer ${key}` } : {}),
      ...extraHeaders,
      // 会话 id 按 registry 声明的头名发（只在这两者都在时才发）。放在 extraHeaders
      // 之后，免得被同名的静态头覆盖。
      ...(sessionHeader && params.sessionId ? { [sessionHeader]: params.sessionId } : {}),
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSystemPrompt },
        { role: "user", content: prompt },
      ],
      ...(effectiveModel ? { model: effectiveModel } : {}),
      // Providers whose spec omits defaultTemperature never send the param —
      // their lineup rejects/locks it (GPT-5.x 400s, kimi-k2.x errors); the
      // server default applies. Everyone else keeps the normal tunable value.
      ...(defaultTemperature !== undefined ? { temperature: normalizeNumber(temperature, defaultTemperature) } : {}),
      stream: false,
      // No max_tokens — cloud models don't repeat-loop. Only `llm` Custom exposes it.
      ...extraBody,
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, serviceName);
};

// Factory adapter over registry.resolveWireEndpoint(唯一的出口地址计算,
// 补全器/allowlist/「能不能走内置中转」全在 registry 一处,与界面同判据)。
// 这里只做一件事:没有中转能力的 provider(defaultUseRelay 缺省)强制 useRelay=false。
const resolveEndpoint = (key: OpenAICompatProviderKey, spec: OpenAICompatProviderSpec, params: TranslateTextParams): string =>
  resolveWireEndpoint(key, { url: params.url, useRelay: spec.defaultUseRelay !== undefined && params.useRelay, relayBase: params.relayBase });

// ═════════════════════════════════════════════════════════════════════════
// Two-tier OpenAI-compat service generation:
//   - TIER 1 (thinking-aware): registered in THINKING_BUILDERS below. Each
//     entry is `gated(service, shape)` — the shared gate + one effort→wire shape.
//   - TIER 2 (base / no builder): OPENAI_COMPAT provider 里【没有】THINKING_BUILDERS
//     条目的那些 —— 名单由这两处派生，别在这里重列（重列过一次就漂过一次）。Factory returns
//     a pass-through service. isThinkingCapableProvider is false for these, so the
//     UI offers no thinking control at all — including on custom SKUs.
// Adding a thinking-capable provider = tag its SKU(s) in the registry + add one
// `gated(...)` entry here. Service implementation is auto-derived.
// ═════════════════════════════════════════════════════════════════════════

type ExtraBodyBuilder = (params: TranslateTextParams) => Record<string, unknown>;

// An effort→wire-payload shape. `effort` is the orchestrator-derived reasoning
// level: a value = thinking ON, undefined = OFF. For server-default-ON vendors the
// OFF branch MUST return an EXPLICIT disable, never `{}` — omitting silently bills
// reasoning tokens (the DeepSeek "10M tokens" MD-translation report).
type EffortShape = (effort: ReasoningEffort | undefined, model?: string) => Record<string, unknown>;

// The gate every thinking-aware OpenAI-compat provider shares: inject a payload
// ONLY for a registry-tagged (= known) model — untagged user-typed SKUs are left
// alone because we don't know their protocol (forcing a param could break an
// unrelated model). Factors the per-vendor `isThinkingModel(...) ? shape : {}`
// boilerplate into one place so each provider only declares its wire shape.
//
// Custom (untagged) models on a thinking-capable provider get the 3-state
// Off/On/Auto control (default Off):
//   - Off(默认)→ 发【显式 disable】:server-default-ON 的 custom SKU(mimo-v2-omni
//     这类)只有显式关才真的关,省略会静默烧推理 token(DeepSeek「10M tokens」事故)。
//   - effort → ENABLE shape;Auto → 完全省略(逃生口)。
// ⚠ 这个默认对「拒绝 thinking 参数」的新旗舰是已知代价:手填 kimi-k3(只收顶层
// reasoning_effort)在没碰过任何开关的默认态就会收到 thinking:{type:"disabled"}
// 而 4xx —— 逃生口是把思考档切到 Auto。这不是漏洞是取舍:未知 SKU 无从判断
// 「省略安全」还是「显式关才安全」,两边都有真实事故,选了防静默计费的那边。
// Listed-but-untagged models (mistral-large-latest) never reach here with an
// effort — deriveThinkingParams returns undefined for them. Tagged models keep
// full control (disable when off).
const gated =
  (service: OpenAICompatProviderKey, shape: EffortShape): ExtraBodyBuilder =>
  (p) => {
    const model = p.model || OPENAI_COMPAT_PROVIDERS[service].defaultModel;
    const effort = p.reasoningEffort;
    // Tagged model: 2-state (absence → disable, effort → enable).
    if (isThinkingModel(service, model)) return shape(effort === "auto" ? undefined : effort, model);
    // Custom model: 3-state Off/On/Auto. DEFAULT (absence → undefined) is Off → send
    // the explicit disable; "auto" → omit (the escape for SKUs a STRICT provider would
    // 422 on the disable); effort → enable. The disable/enable are the user's call —
    // a 422 from an unsupported SKU surfaces as a translation error.
    if (isCustomModel(service, model)) {
      if (effort === "auto") return {};
      return shape(effort, model); // undefined (default Off) → disable; effort → enable
    }
    // Listed-but-untagged model (e.g. mistral-large-latest): known non-thinking → OMIT.
    return {};
  };

// ── Shared wire shapes (reused across vendors with identical protocols) ──────
//
// 【思考参数的官方出处】2026-08-20 逐家核对过一轮,改形态前先读对应页,别猜:
//   deepseek     api-docs.deepseek.com/zh-cn/guides/thinking_mode
//                (thinking:{type} + reasoning_effort:low/high/max —— 无 medium)
//   openai/azure developers.openai.com/api/docs/guides/reasoning
//                (none/minimal/low/medium/high/xhigh/max,逐模型有子集)
//   claude       platform.claude.com/docs/en/build-with-claude/thinking
//                (thinking:{type:adaptive|disabled} + output_config.effort)
//   gemini       ai.google.dev/gemini-api/docs/thinking(逐模型档位表,无关闭)
//   grok         docs.x.ai/docs/guides/reasoning(low/medium/high/xhigh,无关闭;
//                另:presence/frequency penalty 与 stop 与推理【互斥会报错】)
//   groq         console.groq.com/docs/reasoning(gpt-oss 只有 low/medium/high)
//   qwen         help.aliyun.com/zh/model-studio/deep-thinking
//                (enable_thinking + thinking_budget 1~32768)
//   moonshot     platform.kimi.com/docs/api/chat(k2.6/k2.5 thinking:{type},默认开)
//   doubao       volcengine.com/docs/82379/1449737(thinking:{type},默认开)
//   zhipu        docs.bigmodel.cn(thinking:{type},默认开)
//   mimo         mimo.mi.com/docs/zh-CN/api/chat/openai-api(thinking:{type},默认开;
//                思考模式下 temperature/top_p 被强制默认值,我们发的会被忽略)
//   minimax      platform.minimax.io/docs/api-reference/text-chat-openai
//                (M3 adaptive|disabled;M2.x 收下 disabled 但仍会思考 → 不标记)
//   siliconflow  docs.siliconflow.cn/api-reference/chat-completions/chat-completions
//   qianfan      cloud.baidu.com/doc/qianfan-docs/s/Wm95lyynv
//   mistral      docs.mistral.ai/capabilities/reasoning/(仅 none/high 两档)
//   cohere       docs.cohere.com/docs/compatibility-api(兼容端点仅 none/high)
//   openrouter   openrouter.ai/docs/use-cases/reasoning-tokens(统一 reasoning 对象)
// Binary `thinking: {type}` — Moonshot (Kimi), Doubao (Seed), Zhipu (GLM), MiMo.
// Docs: volcengine.com/docs/82379, docs.bigmodel.cn, platform.moonshot.cn,
// platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api.
const thinkingType: EffortShape = (e) => ({ thinking: { type: e ? "enabled" : "disabled" } });
// Binary `enable_thinking` boolean — Baidu ERNIE/Qianfan
// (cloud.baidu.com/doc/qianfan-docs/s/Wm95lyynv:多数混合模型默认 false,
// 而 ernie-5.0-thinking 默认 true,所以关闭态必须显式发 false)。
// ⚠ SiliconFlow 【不】用这个形态(理由见 THINKING_BUILDERS 里 siliconflow 行的注释)。
const enableThinking: EffortShape = (e) => ({ enable_thinking: !!e });

// `reasoning_effort` enum with explicit "none" off — OpenAI GPT-5.x (omit-default
// medium on 5.5) + Grok (omit-default "low"). Azure mirrors openai exactly (its
// deployments map to the same GPT-5 SKUs) — see its gated() entry below.
const reasoningEffortOrNone: EffortShape = (e) => ({ reasoning_effort: e ?? "none" });
// `reasoning_effort` binary high|none — Cohere (command-a-reasoning) + Mistral
// (adjustable medium/small). Vendor exposes only two effective tiers, so any "on"
// effort collapses to "high"; off sends an explicit "none" (both server-default-ON).
const reasoningEffortBinary: EffortShape = (e) => ({ reasoning_effort: e ? "high" : "none" });
// Groq gpt-oss:官方只收 low/medium/high,没有 none(console.groq.com/docs/reasoning)。
// 关闭态发【最低档】而不是省略 —— 省略是落到未文档化的服务端默认(惯例 medium),
// 用户点了"关"反而按中档计费。同 gemini/grok,详见 pickThinkingLevel。
const groqEffort: EffortShape = (e, model) => ({ reasoning_effort: pickThinkingLevel("groq", model ?? OPENAI_COMPAT_PROVIDERS.groq.defaultModel, e) });
// Qwen3 (DashScope): `enable_thinking` + graded `thinking_budget`.
const QWEN_THINKING_BUDGET: Record<ReasoningEffort, number> = { low: 1024, medium: 4096, high: 8192 };
const qwenThinking: EffortShape = (e) => (e ? { enable_thinking: true, thinking_budget: QWEN_THINKING_BUDGET[e] } : { enable_thinking: false });

// DeepSeek V4: `thinking:{type}` + `reasoning_effort` (distinct from NVIDIA NIM,
// which nests both inside `chat_template_kwargs`). Server-defaults thinking ON, so
// OFF sends an explicit `{type:"disabled"}`. Always "high" when on — DeepSeek's
// "max" tier is for heavy agentic work, not translation, so the UI dial is
// effectively on/off. Exported for the "10M tokens" regression test.
// Doc: api-docs.deepseek.com/zh-cn/guides/thinking_mode ("默认思考开关为 enabled").
export const buildDeepseekExtraBody: EffortShape = (e) => (e ? { thinking: { type: "enabled" }, reasoning_effort: "high" } : { thinking: { type: "disabled" } });

// MiniMax M3: first hosted SKU with a real toggle — `thinking:{type:"adaptive"|"disabled"}`,
// server-default adaptive (ON) → off MUST send explicit disabled. M2.x stays
// intrinsic/unclosable (untagged → gate omits; the only hosted knob there,
// `reasoning_split`, just switches output FORMAT, it can't turn reasoning off).
// Doc: platform.minimax.io/docs/api-reference/text-chat-openai.
const minimaxThinking: EffortShape = (e) => ({ thinking: { type: e ? "adaptive" : "disabled" } });

// TokenHub deliberately has NO thinking builder — 不是"不能关",而是
// "本来就是关的":TokenHub 文档(1823/135872)给 hy3 的 thinking.type 三个合法
// 取值 enabled/disabled/adaptive,但明写「默认关闭思考」,省略参数 = 不推理 =
// 翻译要的行为。加开关的完整步骤见 registry.ts tokenhub models 上方的 playbook
// (含 ⚠ 别用 reasoning_effort:"none")。NVIDIA NIM 的 thinking 不走本表 —— 它的
// chat_template_kwargs 注入在 service 里内联 (buildNvidiaThinkingParams)；
// 2026-09-25 随 deepseek-v4.1-flash 上架重新启用，NIM 默认关思考、省略=关，
// 所以它既不需要显式 disable、也不进 SERVER_DEFAULT_THINKING_ON。

// (No temperature handling here: providers whose lineup rejects/locks the param
// simply omit `defaultTemperature` in their registry spec — the factory then
// never sends it. See OpenAICompatProviderSpec.defaultTemperature.)

const THINKING_BUILDERS: Partial<Record<OpenAICompatProviderKey, ExtraBodyBuilder>> = {
  // `reasoning_effort` enum, explicit "none" off (server-default-ON)
  openai: gated("openai", reasoningEffortOrNone),
  // Azure 镜像 openai 同形态（部署名映射同一批 GPT-5 SKU，GPT-5.x omit→medium
  // 意味着关闭态必须发显式 "none"）。gpt-chat-latest 在 registry 不打标签 →
  // 走 listed-but-untagged 省略分支。旧版是手写 buildAzureReasoningBody，
  // 2026-09-26 并入工厂后与 gated() 逐分支同构（tagged 2 态 / custom 3 态 / 省略）。
  azureopenai: gated("azureopenai", reasoningEffortOrNone),
  // Grok:档位表在 registry 的 grok.models[].thinkingLevels(官方逐模型表)。
  // ⚠ off 态发【最低档 low】而不是 "none":官方枚举只有 low/medium/high/xhigh,
  // 并明写 "Reasoning cannot be disabled"。发 "none" 两种结局都坏 —— 被拒则
  // 默认态每请求 400,被忽略则按服务端默认(high)静默计费。详见 pickThinkingLevel。
  grok: gated("grok", (e, model) => ({ reasoning_effort: pickThinkingLevel("grok", model ?? OPENAI_COMPAT_PROVIDERS.grok.defaultModel, e) })),
  // DeepSeek V4: thinking:{type} + reasoning_effort (always "high" tier)
  deepseek: gated("deepseek", buildDeepseekExtraBody),
  // Qwen3: enable_thinking + graded thinking_budget
  qwen: gated("qwen", qwenThinking),
  // Binary thinking:{type} (server-default-ON)
  // ⚠ Moonshot 是唯一【同一 provider 内两种协议】的:K2.x 用扁平 thinking:{type},
  // 而 kimi-k3 仅思考模式、不接受 thinking 参数,改用顶层 reasoning_effort
  // (low/high/max,默认 max)。发错形状 = 4xx,所以按 SKU 分流,不能只留一个 shape。
  // k3 没有关闭值,走逐 SKU 档位表(registry 的 thinkingLevels + pickThinkingLevel):
  // 关闭态发它收得下的最低档 low —— 同 gemini/grok/groq 那一族的处理。
  moonshot: gated("moonshot", (e, model) =>
    /kimi-k3/.test(model ?? "") ? { reasoning_effort: pickThinkingLevel("moonshot", model!, e) } : thinkingType(e),
  ),
  doubao: gated("doubao", thinkingType),
  // GLM-5.3 系不是扁平 thinking:{type} 那一条：官方只接受 `thinking:{type:"enabled"}` 配
  // `reasoning_effort`(low/high/max,默认 max)，并明写「不再支持 thinking.type:"disabled"」
  // 「否则请求将失败」(docs.bigmodel.cn/cn/guide/models/text/glm-5.3.md)。所以关闭态按官方
  // 迁移原句映射到最低档 low，而不是发一个会被拒的 disabled。老世代 GLM 未打标 → gated 省略。
  zhipu: gated("zhipu", (e, model) => ({ thinking: { type: "enabled" }, reasoning_effort: pickThinkingLevel("zhipu", model!, e) })),
  // Step 3.7 Flash 官方专节「支持三档推理强度」low/medium/high（medium 默认），全篇无
  // none/disabled 关闭值 ⇒ 关闭态发最低档，绝不发厂商没写的值。未打标的 SKU 由 gated 省略。
  stepfun: gated("stepfun", (e, model) => ({ reasoning_effort: pickThinkingLevel("stepfun", model!, e) })),
  mimo: gated("mimo", thinkingType),
  // MiniMax M3: thinking:{type:"adaptive"|"disabled"} (server-default adaptive = ON)
  minimax: gated("minimax", minimaxThinking),
  // Binary enable_thinking bool (server-default-ON)
  // ⚠ SiliconFlow 用的是【上游原生】形态(与 moonshot 等共用 thinkingType),不是
  // 它自家的 enable_thinking:官方参数表把 enable_thinking 的适用模型限定在
  // V3.2/V3.1/GLM/Qwen3,【不含 V4】,而我们标记的是 DeepSeek-V4-* 与 Kimi-K2.6,
  // 这两家原生开关正是 thinking:{type}(registry 注释也写明是原生协议透传)。
  // 参数不被认的最坏结局是【被忽略】——用户关了思考却照常推理照常计费。
  siliconflow: gated("siliconflow", thinkingType),
  qianfan: gated("qianfan", enableThinking),
  // Binary reasoning_effort high|none (server-default-ON): Cohere (command-a-reasoning),
  // Mistral (adjustable medium/small; Magistral stays untagged = native always-on).
  cohere: gated("cohere", reasoningEffortBinary),
  mistral: gated("mistral", reasoningEffortBinary),
  // OpenRouter: graded effort when on; universal `reasoning:{enabled:false}` off for
  // tagged upstream reasoning SKUs (untagged free models omit via the gate).
  // OpenRouter:官方【统一参数】是 reasoning 对象(openrouter.ai/docs/use-cases/
  // reasoning-tokens,2026-08-20 核对),effort 取 max/xhigh/high/medium/low/
  // minimal/none。开关两态都用同一个对象 —— 曾经开启态发顶层 reasoning_effort、
  // 关闭态发 reasoning:{enabled:false},两种写法混用:文档只把统一对象列为推荐
  // 形态,顶层别名没有成文保证,一旦它不再被识别,开启态就静默失效(而关闭态
  // 照常工作),表现为"开了思考没反应"这种最难查的形态。
  openrouter: gated("openrouter", (e) => ({ reasoning: e ? { effort: e } : { enabled: false } })),
  // Graded reasoning_effort, OMIT off (undisableable): Groq gpt-oss.
  groq: gated("groq", groqEffort),
  // Cerebras:两个公共模型的 reasoning_effort 取值【不同】,必须按 SKU 分流
  // (inference-docs.cerebras.ai/api-reference/chat-completions,2026-08-20):
  //   · gpt-oss-120b: low/medium(默认)/high —— 无 none,关不掉 → 走档位表,
  //     关闭态发最低档 low(registry 的 thinkingLevels 已声明)
  //   · gemma-4-31b:  none(默认)/low/medium/high —— 有真正的关闭值,
  //     关闭态发 none,与 openai 同形态
  // ⚠ 未声明 thinkingLevels 的 SKU(含用户手填)走 reasoningEffortOrNone:
  // 发 "none" 是它们那一档的合法关闭值。别统一成一个 shape —— 给 gpt-oss
  // 发 none 会撞上"该 SKU 无此取值"。
  cerebras: gated("cerebras", (e, model) =>
    getProviderModels("cerebras").find((m) => m.value === model)?.thinkingLevels?.length
      ? { reasoning_effort: pickThinkingLevel("cerebras", model!, e) }
      : reasoningEffortOrNone(e),
  ),
  // 订阅套餐端点(registry 里 hidden,UI 默认不显示):火山 Coding Plan 与 doubao
  // 按量线同为扁平 thinking:{type};阿里百炼线(2026-09 起为 Token Plan 端点)
  // 与 qianfan 同为裸 enable_thinking —— 不能用 qwenThinking,那个 on 档额外带
  // thinking_budget,且 qwen3.8 系列等在册 SKU 根本不吃 enable_thinking(registry
  // 里未打 thinking 标,gated 对它们不发任何思考参数)。按 method key 分流。
  volcengine: gated("volcengine", thinkingType),
  alibaba: gated("alibaba", enableThinking),
  // (tokenhub intentionally absent — see note above)
};

// Exposed for the SERVER_DEFAULT_THINKING_ON invariant test: the thinking extra
// body a provider injects for given params (so tests can assert OFF → non-empty
// disable payload). Returns {} for providers with no builder.
export const buildThinkingExtraBody = (service: OpenAICompatProviderKey, params: TranslateTextParams): Record<string, unknown> => THINKING_BUILDERS[service]?.(params) ?? {};

// Factory: generate a TranslationService from a provider spec key, optionally
// wiring in a thinking extra-body builder. 网络错误 → 可行动提示的改写不在
// 这里 —— 它对每个服务都一样,统一在 withNetworkHint(services/index.ts)。
const makeOpenAICompat = (key: OpenAICompatProviderKey, extraBodyBuilder?: ExtraBodyBuilder): TranslationService => {
  const spec = OPENAI_COMPAT_PROVIDERS[key] as OpenAICompatProviderSpec;
  return async (params) =>
    openAICompatRequest({
      params,
      serviceName: spec.label,
      endpoint: resolveEndpoint(key, spec, params),
      defaultModel: spec.defaultModel,
      defaultTemperature: spec.defaultTemperature,
      extraHeaders: spec.extraHeaders,
      sessionHeader: spec.sessionHeader,
      extraBody: extraBodyBuilder?.(params),
    });
};

// Auto-generate every OpenAI-compat service: each provider gets a base service,
// thinking-aware ones additionally pick up their builder from the registry.
const openAICompatServicesBase = Object.fromEntries(OPENAI_COMPAT_KEYS.map((k) => [k, makeOpenAICompat(k, THINKING_BUILDERS[k])])) as Record<OpenAICompatProviderKey, TranslationService>;

// DeepSeek extra wrap: the generic relay-hint (CORS → "API Relay") already comes
// from withNetworkHint (services/index.ts); DeepSeek additionally rewrites a 403
// (its direct endpoint blocks some browser origins outright) into the same relay
// remediation hint — a 403 is NOT a network error, so that wrapper never sees it.
export const deepseek: TranslationService = async (params) => {
  try {
    return await openAICompatServicesBase.deepseek(params);
  } catch (error) {
    // 按 .status 数值判 403,不靠 message 里的 "[403]" 字面 —— 非 JSON 的
    // 403 响应体(WAF/origin 拦截页是 HTML)formatHttpError 不会嵌 "[403]",
    // 字面匹配漏掉的恰是最常见的浏览器源被拦场景。fetchJSON 已 Object.assign
    // 附 status。
    const status = (error as { status?: number } | null)?.status;
    if (relayHintWouldHelp("deepseek", params) && (status === 403 || (error instanceof Error && error.message.includes("[403]")))) {
      // ⚠ 【status 必须带上】。这里换了一个新 Error,原来的 status 就丢了 ——
      // 而整轮凭据快停(isDefiniteAuthFailure)只认数值 401/403,不认消息文本
      // (消息里一个 "Forbidden" 就掐掉整批太危险,见 retry.ts 那段注释)。
      // 不带 status 的话,这个【被本注释称为 load-bearing 的旗舰场景】——浏览器
      // 源被 DeepSeek 拦——反而不触发快停:10 文件 × 3 语言各打一轮注定失败的请求。
      // 消息里的 "Forbidden" 仍保留,它负责 isAuthError 的单行分类;
      // errorHintKey 给显示层本地化的中转补救提示。三者各司其职。
      throw Object.assign(new Error(`DeepSeek API returned 403 Forbidden. Please ${RELAY_HINT_MARKER} in API Settings.`), { status: 403, errorHintKey: "errorHintRelay403" });
    }
    throw error;
  }
};

// Azure —— 工厂服务 + 一层 requireUrl 守卫。2026-09-26 并入 openai-compat 工厂
// （前提事实：v1 API 接受裸 api-key 走 Authorization: Bearer，官方 key 认证示例
// 就是裸 OpenAI 客户端 —— 见 registry azureopenai 条目注释）。守卫拦的是
// 空/纯空白 URL：工厂对 openai-compat 的「留空 = 官方默认」兜底在这里不存在
// （endpoint 恒空），fetch("") 会打到当前页面、被当可重试错误烧预算（机制见
// 下方 nvidia 的 !!url?.trim() 注释）。URL_ALSO_REQUIRED 已在验证层拦过，
// 这是第二道（手改存储/直调路径）。
export const azureopenai: TranslationService = async (params) => {
  requireUrl("Azure OpenAI", params.url);
  return openAICompatServicesBase.azureopenai(params);
};

// Dispatch map — base services + deepseek override (with CORS error rewrite)
// + azureopenai override (with requireUrl guard)。
export const openAICompatServices: Record<OpenAICompatProviderKey, TranslationService> = {
  ...openAICompatServicesBase,
  deepseek,
  azureopenai,
};

// --- Special-case services that don't fit the OpenAI-compatible pattern ---

export const gemini: TranslationService = async (params) => {
  const { apiKey, model, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const key = requireApiKey("Gemini", apiKey);
  const effectiveModel = model || defaultConfigs.gemini.model!;

  // Gemini 3.x thinking control lives in buildGeminiThinkingConfig — read the
  // three-state behaviour there, not here (a duplicated summary drifted once
  // already: it claimed unlisted SKUs omit the level on Off, while the builder
  // sends the lowest level; only "auto" omits).
  //
  // No temperature: Gemini 3.x strongly recommends the default (1.0; lower
  // values risk looping/degraded reasoning) — the config has no temperature
  // field (registry), so the request omits it and the server default applies.
  const generationConfig: Record<string, unknown> = buildGeminiThinkingConfig(effectiveModel, reasoningEffort);

  // Auth via x-goog-api-key header — the only form the official docs still
  // document (the ?key= query param has been removed from ai.google.dev's
  // api-key page, 2026-06); also keeps the key out of URLs/logs.
  const data = (await fetchJSON(`https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": key },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
      generationConfig,
    }),
    signal: params.signal,
  }).catch((error) => {
    // 2026-06-19 起 Gemini API 拒绝「无限制 API Key」的请求(官方公告 + api-key
    // 文档双确认;2026-09 起 standard key 全面停用)。被 edge 拒绝的请求常无
    // CORS 头收场 → 浏览器只见 TypeError,通用 networkUnavailable 提示会把用户
    // 引去排查网络;403 同因。两者都换成「重新生成/限制 key」的定向补救。
    if ((error as { status?: number } | null)?.status === 403 || isNetworkError(error)) {
      throw Object.assign(error as Error, { errorHintKey: "errorHintGeminiKey" });
    }
    throw error;
  })) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string; thought?: boolean }> }; finishReason?: string }> };

  const candidate = data.candidates?.[0];
  // Gemini's equivalent of finish_reason==="length". Server default
  // maxOutputTokens (~8192) can overflow on long inputs. Same "max_tokens
  // reached" marker → non-retryable in retry.ts.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response truncated — max_tokens reached. Split input into smaller chunks.");
  }
  // ⚠ 拼接【全部】text part,不是取 parts[0]:官方允许把一条回复拆成多个连续
  // text part(官方 SDK 的 .text 访问器就是全量拼接)。只取第一个 = 长输出被
  // 静默截断 —— 上下文批(几十行带编号标记)正是长输出,截断后编号缺失会被
  // 回填守卫当"缺口"整批清空重试,查起来只会看到"上下文翻译莫名失败"。
  // ⚠ 同时按 thought 标志过滤:思考对 Gemini 永远开着(无关闭值),thought
  // summaries 理论上只在 includeThoughts:true 时返回(我们不开),但已有实报
  // 某些 SKU 忽略该开关照样返回 thought part(google-gemini/cookbook#1198)——
  // 混进译文的是英文推理段落,还会进缓存。防御性过滤,零成本。
  const parts = candidate?.content?.parts;
  const text = Array.isArray(parts) ? parts.filter((p) => p.thought !== true && typeof p.text === "string").map((p) => p.text).join("") : undefined;
  if (typeof text !== "string" || (!text && !parts?.length)) {
    throw new Error("Invalid response format from Gemini API");
  }
  return text.trim();
};

// Yandex AI Studio — protocol-wise plain OpenAI-compat chat/completions, but a
// custom service because the factory can't assemble per-tenant model URIs:
// gpt://<folder_id>/<model>/latest is built from the dedicated `folderId`
// config field at request time. A full gpt:// URI typed into the model field
// passes through verbatim (power-user escape; also how configs imported from
// the pre-folderId era keep working).
//
// Relay: useRelay defaults ON in registry defaults (upstream sends no CORS
// headers as of 2026-06 — preflight OPTIONS is parsed as a JSON body → 400),
// but the toggle stays user-controllable like every relay-capable provider.
// Pure URI assembly, exported for unit tests (same pattern as buildGeminiThinkingConfig).
export const buildYandexModelUri = (model: string | undefined, folderId: string | undefined): string => {
  // Trim BEFORE the fallback: a whitespace-only model is truthy, so `model || default`
  // would "fall back" to "" and ship a malformed `gpt://<folder>/` to the wire.
  const shortModel = (model ?? "").trim() || (defaultConfigs.yandex.model as string);
  // Full model URIs pass through verbatim: gpt:// (foundation models) and
  // ds:// (DataSphere fine-tunes — Yandex's other model-URI scheme).
  // Case-insensitive so a pasted "GPT://..." isn't double-wrapped.
  const lower = shortModel.toLowerCase();
  if (lower.startsWith("gpt://") || lower.startsWith("ds://")) return shortModel;
  const folder = folderId?.trim();
  // Defense-in-depth: validation.ts pre-flight blocks empty folderId for batch
  // runs, but the Test button / direct service calls bypass it.
  if (!folder) throw new Error("Yandex Folder ID is required. / 请填写 Yandex Folder ID。");
  return `gpt://${folder}/${shortModel}`;
};

// 官方直连地址的唯一来源是 registry 的 endpoints[0] —— 那一份同时被
// classifyEndpointUrl(界面判"是不是官方地址")与 workerParity(中转 allowlist)
// 使用。这里派生而不是再抄一遍字面量,三处就不可能漂移。
export const YANDEX_DIRECT_ENDPOINT = getProviderEndpoints("yandex")![0].url;

export const yandex: TranslationService = async (params) => {
  const model = buildYandexModelUri(params.model, params.folderId);
  return openAICompatRequest({
    params: { ...params, model },
    serviceName: "Yandex",
    endpoint: resolveWireEndpoint("yandex", { url: params.url, useRelay: params.useRelay, relayBase: params.relayBase }),
    defaultModel: model,
    defaultTemperature: defaultConfigs.yandex.temperature as number,
  });
};

// NVIDIA NIM wraps thinking params in `chat_template_kwargs` (vs native APIs
// which use top-level `reasoning_effort` / `thinking`). Orchestrator-level gate
// in useTranslationState ensures reasoningEffort is only set for thinking-tagged
// models the user picked an effort for.
const buildNvidiaThinkingParams = (reasoningEffort: ThinkingDirective | undefined): Record<string, unknown> => {
  // NIM defaults reasoning OFF, so the default-Off (undefined) and "auto" both map to
  // omit — omitting already yields "off", there's nothing to disable. Only a real
  // effort enables.
  if (!reasoningEffort || reasoningEffort === "auto") return {};
  return { chat_template_kwargs: { thinking: true, reasoning_effort: reasoningEffort } };
};

export const nvidia: TranslationService = async (params) => {
  const { apiKey, url, model, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const effectiveModel = model || defaultConfigs.nvidia.model!;
  const thinkingParams = buildNvidiaThinkingParams(reasoningEffort);

  const requestBody: Record<string, unknown> = {
    messages: [
      { role: "system", content: effectiveSystemPrompt },
      { role: "user", content: prompt },
    ],
    model: effectiveModel,
    temperature: normalizeNumber(temperature, defaultConfigs.nvidia.temperature),
    ...thinkingParams,
  };

  // Direct call (custom endpoint) vs proxy call (default Nvidia API, avoids CORS)
  // !!url?.trim() 同 deepl/deeplx:纯空白 URL(" ")是 truthy,
  // completeOpenAICompatUrl 把它 trim 成 "" 后 fetch("") 打到当前页面 ——
  // HTML 响应让 ok 路径的 response.json() 抛无 status 的 SyntaxError,被当
  // 可重试错误烧光重试预算,而不是回落默认代理端点。
  const trimmedUrl = url?.trim();
  const isDirectCall = !!trimmedUrl;
  const fetchUrl = isDirectCall ? completeOpenAICompatUrl(trimmedUrl) : PROXY_ENDPOINTS.nvidia;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  let body: Record<string, unknown> = requestBody;

  if (isDirectCall) {
    const key = requireApiKey("Nvidia", apiKey);
    headers.Authorization = `Bearer ${key}`;
  } else {
    body = { apiKey, ...requestBody };
  }

  const data = await fetchJSON(fetchUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(body),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Nvidia");
};

export const llm: TranslationService = async (params) => {
  const { apiKey, url, model, temperature, sendSystemPrompt, maxTokens } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const serviceName = "Custom (OpenAI-compatible)";
  // Belt-and-suspenders: UI auto-completes on blur, but settings imported from
  // file or edited via localStorage may bypass that — re-normalize here.
  const apiEndpoint = completeOpenAICompatUrl(requireUrl(serviceName, url));

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  // sendSystemPrompt=false: omit the system ROLE for chat templates that
  // reject it (Gemma family) — but the system prompt's CONTENT must survive,
  // prepended to the user message: dropping the message entirely once
  // silently disabled the glossary (then composed into system) for the exact
  // audience the toggle exists for. undefined defaults to include (pre-toggle
  // configs).
  const messages =
    sendSystemPrompt === false
      ? [{ role: "user", content: `${effectiveSystemPrompt}\n\n${prompt}` }]
      : [
          { role: "system", content: effectiveSystemPrompt },
          { role: "user", content: prompt },
        ];

  // Model optional: single-model endpoints (vLLM / llama.cpp) ignore or reject
  // the field. Send only when user-supplied; let server error if required.
  const requestBody: Record<string, unknown> = {
    messages,
    temperature: normalizeNumber(temperature, defaultConfigs.llm.temperature),
  };
  const effectiveModel = model?.trim();
  if (effectiveModel) {
    requestBody.model = effectiveModel;
  }
  // Opt-in cap, safety net for runaway local-model generation.
  if (maxTokens && maxTokens > 0) {
    requestBody.max_tokens = maxTokens;
  }

  const data = await fetchJSON(apiEndpoint, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, serviceName);
};

// 同 YANDEX_DIRECT_ENDPOINT:派生自 registry.endpoints[0]。
// workerParity.test.ts 再拿它去钉 Worker 的 PROVIDER_URLS。
export const CLAUDE_DIRECT_ENDPOINT = getProviderEndpoints("claude")![0].url;

/**
 * Gemini 的 generationConfig 构造。抽成具名导出而不是内联，
 * 是为了让【同步给下游的 provider 目录】能直接求值拿到这份线格式 —— 手抄一份
 * 到下游就会分叉，而这两家没有 THINKING_BUILDERS 条目可调（它们是 custom
 * service，思考参数写在实现里）。
 *
 * 档位表在 registry 的 gemini.models[].thinkingLevels(官方逐模型表),
 * 解析统一走 pickThinkingLevel(与 grok/groq 同一个):省略档位 = 关闭态取最低档
 * (Gemini 3 官方没有关闭开关),给了档位但该 SKU 不收则降到最近的更低档。
 * disable 路径的杀伤力:enable 至少要用户主动选,disable 是所有人的默认态。
 */
export const buildGeminiThinkingConfig = (model: string, directive: ThinkingDirective | undefined): Record<string, unknown> => {
  // thinkingLevel 是 Gemini 3.x 起才有的字段,打到 2.x/1.x 上是 400
  // "Thinking level is not supported for this model."(2026-09-01 实测 gemini-2.5-flash)。
  // ⚠ 别照 docs/thinking 那张档位表判 —— 它把 2.5 列成支持 low/medium/high,但那页写的是
  // Interactions API(/v1beta/interactions,扁平 generation_config.thinking_level,服务端
  // 替你映射成 budget);本仓走 generateContent,那里的字段参考写的是 "Use with earlier
  // models results in an error"。两页都是官方且同期更新,取哪页看打的是哪个端点。
  // 旧世代已从 models[] 移除,只可能是用户手填 —— 一律不发思考参数、跟服务端默认走,
  // 不做 budget mapping(那正是当初移除 2.5 时刻意避开的复杂度)。
  // 代价:界面那个档位下拉对 2.x 是空操作(手填 SKU 本来就是"自己负责"那一档)。
  if (/^gemini-[12]\./.test(model)) return {};
  const out: Record<string, unknown> = {};
  const level = (want?: ReasoningEffort) => pickThinkingLevel("gemini", model, want);
  if (isThinkingModel("gemini", model)) {
    out.thinkingConfig = { thinkingLevel: level(directive && directive !== "auto" ? directive : undefined) };
  } else if (isCustomModel("gemini", model) && directive !== "auto") {
    // Custom model 3-state: default Off (undefined) → lowest accepted level;
    // effort → that level; "auto" → omit (skip thinkingConfig, follow server default).
    out.thinkingConfig = { thinkingLevel: level(directive || undefined) };
  }
  return out;
};

// Pure request-shaping for Claude's two thinking generations — exported for
// thinking.test.ts (same pattern as buildYandexModelUri). Membership
// predicate lives in the registry (isAdaptiveThinkingClaude).
//   - Adaptive gen (Opus 4.7/4.8/5/5.5, Sonnet 5/5.5, Fable 5/5.1, Mythos): effort →
//     thinking:{type:"adaptive"} + output_config.effort; "auto" → omit
//     entirely and follow the server default. Legacy budget_tokens shape 400s.
//     ⚠ 这一代的【关闭档】按官方逐模型表分三种形态，发错就是每请求 400（2026-10-02 逐页核原文）：
//       · Opus 5.5 / Fable 5.x / Mythos = "Always on" → 连 disabled 也 400，「关」只能整个字段不发
//         (isAlwaysThinkingClaude)；
//       · Sonnet 5.5 → 发 disabled 会 400，官方的最低档是 between_tools (isBetweenToolsOffClaude)，
//         且它在 xhigh/max effort 下发会 400 —— 只在【不带 effort】的关闭态发；
//       · 老世代(Sonnet 5 / Opus 5 / Opus 4.7-4.8) → 仍发 disabled。
//   - Extended gen (Haiku 4.5, Sonnet 4.6): effort → enabled + budget_tokens
//     (integer budget, not enum); off/auto → omit (server default is off).
// `directive` comes from deriveThinkingParams, which normalizes tagged-model
// "auto" to undefined — "auto" here always means a CUSTOM model delegating to
// the server default.
// No temperature on any branch — adaptive models 400 on non-default values
// (provider-level omit, config has no temperature field); legacy SKUs simply
// use the server default.
export const buildClaudeThinkingBody = (model: string, directive: ThinkingDirective | undefined): { maxTokens: number; body: Record<string, unknown> } => {
  const adaptive = isAdaptiveThinkingClaude(model);
  const alwaysOn = isAlwaysThinkingClaude(model);
  const autoDirective = directive === "auto";
  const effort: ReasoningEffort | undefined = autoDirective ? undefined : directive;
  // 关闭态里 Sonnet 5.5 要发 between_tools —— 它仍是"会产出 thinking 块"的一档
  // （工具调用之间的进度文本以 thinking 块回来），所以输出上限按可能思考来留。
  const betweenToolsOff = adaptive && !effort && !autoDirective && !alwaysOn && isBetweenToolsOffClaude(model);
  // Anthropic requires budget_tokens < max_tokens. When thinking may engage —
  // an explicit effort, an adaptive model left on "auto" (the server may then
  // think on its own), an always-on SKU whose "off" we can't actually honor,
  // or a between_tools off —
  // we raise max_tokens to 16384 so CLAUDE_BUDGET 的每一档都严格小于它，思考预算
  // 与可见回复都有空间。Plain
  // requests stay at the original 8096 cap.
  const mayThink = !!effort || (adaptive && (autoDirective || alwaysOn || betweenToolsOff));
  const body: Record<string, unknown> = {};
  if (adaptive) {
    if (effort) {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort };
    } else if (!autoDirective) {
      // 三种官方关闭形态之一：always-on 的那几支整个字段不发；Sonnet 5.5 发
      // between_tools（disabled 会被拒）；其余老世代发 disabled。
      if (alwaysOn) {
        // 不发 thinking —— 它照样会想，max_tokens 已经留了余量。
      } else if (betweenToolsOff) {
        body.thinking = { type: "between_tools" };
      } else {
        body.thinking = { type: "disabled" };
      }
    }
  } else if (effort) {
    // Cap budget at ~12000 to leave room for the visible response under 16384.
    const CLAUDE_BUDGET: Record<ReasoningEffort, number> = { low: 4096, medium: 10000, high: 12000 };
    body.thinking = { type: "enabled", budget_tokens: CLAUDE_BUDGET[effort] };
  }
  return { maxTokens: mayThink ? 16384 : 8096, body };
};

export const claude: TranslationService = async (params) => {
  const { apiKey, model, reasoningEffort, useRelay } = params;
  const { effectiveSystemPrompt, promptPrefix, promptSuffix } = preparePrompts(params);

  const key = requireApiKey("Claude", apiKey);
  const effectiveModel = model || defaultConfigs.claude.model!;
  const { maxTokens, body: thinkingBody } = buildClaudeThinkingBody(effectiveModel, reasoningEffort);

  // Block arrays (not plain strings) are the form that accepts `cache_control`
  // — required since Claude is the ONLY provider where prompt caching is off
  // by default. Two breakpoints: the system prompt, and the STATIC prefix of
  // the user message (everything the template renders before ${content} —
  // with ${fullText} that is the whole episode, resent on every batch;
  // subtitle-translator#53). The dynamic tail (glossary block + content) stays
  // unmarked. Anthropic silently no-ops a marker below the per-model cacheable
  // minimum, so short prompts cost nothing extra; hits are ~90% off input.
  // Empty text blocks are rejected (400), hence the guards.
  // Doc: docs.anthropic.com/en/docs/build-with-claude/prompt-caching
  const userContent = [
    ...(promptPrefix ? [{ type: "text", text: promptPrefix, cache_control: { type: "ephemeral" } }] : []),
    ...(promptSuffix ? [{ type: "text", text: promptSuffix }] : []),
  ];
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    system: [{ type: "text", text: effectiveSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: userContent }],
    max_tokens: maxTokens,
    ...thinkingBody,
  };

  // Direct-to-Anthropic from the browser requires the explicit opt-in CORS
  // header since 2024-08 (bring-your-own-key apps). When proxied through the
  // Cloudflare relay the header is harmless but unnecessary — we keep it
  // unconditionally to avoid branching.
  // Claude 的 Messages 协议补全(bare host → /v1/messages)由 registry 的
  // wireUrlNormalizer("claude") 在 resolveWireEndpoint 内部选择,这里不用传。
  const endpoint = resolveWireEndpoint("claude", { url: params.url, useRelay, relayBase: params.relayBase });

  const data = await fetchJSON(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  return getClaudeContent(data);
};
