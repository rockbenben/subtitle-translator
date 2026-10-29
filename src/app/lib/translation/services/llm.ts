// Translation services - LLM APIs (OpenAI, DeepSeek, Gemini, etc.)

import type { ReasoningEffort, ThinkingDirective, TranslateTextParams, TranslationService } from "../types";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../config";
import {
  defaultConfigs,
  hasOwnLevelsTable,
  GLM_5_3_ALWAYS_THINKING_RE,
  isAdaptiveThinkingClaude,
  isAlwaysThinkingClaude,
  isBetweenToolsOffClaude,
  isCustomModel,
  isThinkingModel,
  isApiKeyOptional,
  matchesThinkingGeneration,
  pickThinkingLevel,
  resolveEffortForModel,
  relayHintWouldHelp,
  resolveWireEndpoint,
  TOKENHUB_ADAPTIVE_RE,
  TOKENHUB_ALWAYS_THINKING_RE,
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
// 【思考参数的官方出处】逐家核对过一轮,改形态前先读对应页,别猜:
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
//   qwen         help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions
//                (顶层 reasoning_effort:xhigh(默认)/medium/low;max、high 都映射 xhigh,
//                minimal→low,none→enable_thinking=False;与 thinking_budget 不可同时设置;
//                档位↔预算映射 low=4096 medium=16384 xhigh=262144)
//   moonshot     platform.kimi.com/docs/api/chat(k2.6/k2.5 thinking:{type},默认开)
//   doubao       volcengine.com/docs/82379/1449737(thinking:{type},默认开)
//   zhipu        docs.bigmodel.cn(thinking:{type},默认开)
//   mimo         mimo.mi.com/docs/zh-CN/api/chat/openai-api(thinking:{type},默认开;
//                思考模式下 temperature/top_p 被强制默认值,我们发的会被忽略)
//   minimax      platform.minimax.io/docs/api-reference/text-chat-openai
//                (M3 adaptive|disabled;M2.x 收下 disabled 但仍会思考 → 不标记)
//   siliconflow  docs.siliconflow.cn/api-reference/chat-completions/chat-completions
//   tokenhub     cloud.tencent.com/document/product/1823/131208《深度思考》两张逐型号表
//                + 1823/135872 字段说明(thinking.type 三取值;minimax-m3 只收 adaptive/
//                disabled;glm-5.3/kimi-k3 是「不支持关闭」那一族,关闭态发最低档 effort)
//   cerebras     inference-docs.cerebras.ai/capabilities/reasoning
//                (gpt-oss 无 none → 最低档;qwen-3.8-27b 有 none → 真关)
//   alibaba      help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions
//                + .../model-studio/glm(裸 enable_thinking;glm-5.3 系是「仅思考模式」,
//                官方两页对 false 的后果口径不一 ⇒ 一律不发 false)
//   qianfan      cloud.baidu.com/doc/qianfan-docs/s/Wm95lyynv
//   mistral      docs.mistral.ai/capabilities/reasoning/(仅 none/high 两档)
//   cohere       docs.cohere.com/docs/compatibility-api(兼容端点仅 none/high)
//   openrouter   openrouter.ai/docs/use-cases/reasoning-tokens(统一 reasoning 对象)
// Binary `thinking: {type}` — Moonshot (Kimi), Doubao (Seed), Zhipu (GLM), MiMo.
// Docs: volcengine.com/docs/82379, docs.bigmodel.cn, platform.moonshot.cn,
// platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api.
const thinkingType: EffortShape = (e) => ({ thinking: { type: e ? "enabled" : "disabled" } });
// Binary `enable_thinking` boolean — SiliconFlow / 阿里百炼 Token Plan / Baidu ERNIE(Qianfan)
// 三家共用这一条形状 ⇒ 收成一个,别各写一遍字面量(写歪了就是"用户以为关了、实际在烧钱")。
//   · 阿里百炼(help.aliyun.com/zh/model-studio/qwen-api-via-openai-chat-completions):混合
//     思考模型可关;⚠ glm-5.3 系是「仅思考模式」,官方明写 false 会导致请求失败 ⇒ 那一族
//     走 zhipu 同款(见 THINKING_BUILDERS 的 alibaba 行)。
//   · 千帆(cloud.baidu.com/doc/qianfan-docs/s/Wm95lyynv):多数混合模型默认 false。
//   · SiliconFlow(docs.siliconflow.cn/docs/api/chat-completions-post):官方 API 参考的
//     思考参数只有 enable_thinking / thinking_budget / reasoning_effort 三个,**没有 thinking
//     对象** ⇒ 发 thinking:{type} 等于发一个不存在的参数 = 开关空转。
const enableThinking: EffortShape = (e) => ({ enable_thinking: !!e });

// 「厂商没有关闭值」那一族:关闭态发该 SKU 的官方最低档 effort(仍在推理、仍在计费)。
// grok / groq / stepfun / cerebras(gpt-oss) / moonshot(k3) / tokenhub 的关不掉两支 /
// 阿里 glm-5.3 都是这一条 —— 同一条形状写七遍,就多七份「写歪」的机会,故收成一个。
// ⚠ zhipu 不是这一条(它多带一个 thinking:{type:"enabled"}),别顺手改。
const lowestTierOnly =
  (service: OpenAICompatProviderKey): EffortShape =>
  (e, model) => ({ reasoning_effort: pickThinkingLevel(service, model ?? OPENAI_COMPAT_PROVIDERS[service].defaultModel, e) });

// 「thinking:{type:"adaptive"}」那一族:minimax 的 M3 / TokenHub 的 minimax-m3。
// ⚠ minimax 的 M3.1-Flash 不是这一条(它强制思考,发的是 adaptive + 最低档 effort)。
const adaptiveThinking: EffortShape = (e) => ({ thinking: { type: e ? "adaptive" : "disabled" } });

// ⚠ reasoningEffortOrNone 只适用于【收 none 的 family】(GPT-5.x / Grok 系)。
//   openai 与 azureopenai 不能直接用它 —— 这两个
//   provider 内部就有两种关闭能力(见下面 openaiEffort)。
const reasoningEffortOrNone: EffortShape = (e) => ({ reasoning_effort: e ?? "none" });

// OpenAI / Azure OpenAI:关闭态按【SKU】发,不能一刀切 none。
// 逐型号页(developers.openai.com/api/docs/models/<id>.md,curl 直出):
//   gpt-6-luna / gpt-6-sol / gpt-5.6-* / gpt-5.4-mini 收 none(5.4-mini 的 none 还是默认值)
//   gpt-6-astra  「supports low, medium, high, xhigh, and max」—— 【没有 none】
//   gpt-6.1-sol  「The none and minimal reasoning efforts are not supported」
// 一刀切发 none ⇒ astra / 6.1-sol 上【每请求 400】(DeepSeek「10M tokens」事故的同款形态:
// 发一个厂商枚举里没有的值当"关",要么被拒、要么被忽略后按服务端默认静默计费)。
// 一刀切发最低档 ⇒ 反向出错:luna 明明支持 none 却照常推理,用户关了思考仍在烧钱。
// 所以判据是【该 SKU 有没有声明 thinkingLevels】—— 声明了 = 官方没有关闭值,
// 能做到的"最关"就是最低档;没声明 = none 是真关闭值。数据在 registry,这里不按名字猜。
const openaiEffort =
  (service: OpenAICompatProviderKey): EffortShape =>
  (e, model) => {
    const sku = model ?? OPENAI_COMPAT_PROVIDERS[service].defaultModel;
    const levels = getProviderModels(service).find((m) => m.value === sku)?.thinkingLevels;
    return { reasoning_effort: levels?.length ? pickThinkingLevel(service, sku, e) : e ?? "none" };
  };

// `reasoning_effort` binary high|none — Cohere (command-a-reasoning) + Mistral
// (adjustable medium/small). Vendor exposes only two effective tiers, so any "on"
// effort collapses to "high"; off sends an explicit "none" (both server-default-ON).
const reasoningEffortBinary: EffortShape = (e) => ({ reasoning_effort: e ? "high" : "none" });
// Qwen3.8 (DashScope): 思考深度走顶层 `reasoning_effort`。
// ⚠ 为什么不再用 thinking_budget(2026-10-20 改):官方档位↔预算的映射表只出现在
// OpenAI 兼容字段参考页(「low 对应 4096,medium 对应 16384,xhigh 对应 262144」),
// 而控制台提示的 thinking_budget 取值范围是 1~32768 —— 两处对不上,数值这条路
// 不碰。走 effort 的理由是它是【枚举】、无上界争议:官方 Qwen3.8 的可选值是
// xhigh(默认)/medium/low,且 high→xhigh、minimal→low、none→enable_thinking=False。
// 官方另明写「不支持 reasoning_effort 与 thinking_budget 同时设置」⇒ 只发一个。
// 关闭态仍发 enable_thinking:false(与 effort=none 等价,且不与 effort 混发)。
const QWEN_EFFORT: Record<ReasoningEffort, string> = { low: "low", medium: "medium", high: "xhigh" };
const qwenThinking: EffortShape = (e) => (e ? { reasoning_effort: QWEN_EFFORT[e] } : { enable_thinking: false });

// 火山方舟(豆包按量线): 关闭态发 `thinking:{type:"disabled"}`(官方《深度思考》页
// 逐字「Chat API 传入 thinking.type=disabled」),开启态发顶层 `reasoning_effort`
// (官方 7 档 none/minimal/low/medium/high/xhigh/max,默认 high;其中 minimal 才是
// 「关思考」那一档,所以关闭值仍用 thinking.type)。
// ⚠ 【两者不同时发】:官方只把「thinking.type × reasoning_effort」的相互关系指向
// 深度思考页,没逐字写「可以同时设置」⇒ 只发一个,不做未验证的组合。
// (火山 Coding Plan 那条线 —— volcengine —— 的在册型号不同,逐档支持没核过,仍用
//  扁平 thinking:{type},见上面的 volcengine 行。)
const doubaoThinking: EffortShape = (e) => (e ? { reasoning_effort: e } : { thinking: { type: "disabled" } });

// DeepSeek V4: `thinking:{type}` + `reasoning_effort` (distinct from NVIDIA NIM,
// which nests both inside `chat_template_kwargs`). Server-defaults thinking ON, so
// OFF sends an explicit `{type:"disabled"}`. Always "high" when on — DeepSeek's
// "max" tier is for heavy agentic work, not translation, so the UI dial is
// effectively on/off. Exported for the "10M tokens" regression test.
// Doc: api-docs.deepseek.com/zh-cn/guides/thinking_mode ("默认思考开关为 enabled").
export const buildDeepseekExtraBody: EffortShape = (e) => (e ? { thinking: { type: "enabled" }, reasoning_effort: "high" } : { thinking: { type: "disabled" } });

// MiniMax 的思考形态【逐 SKU 不同】(官方 OpenAPI 逐字,platform.minimax.io/docs/
// api-reference/text-chat-openai):
//   · M3.1 Flash:thinking:{type:"adaptive"} 是它**唯一**接受的值,传 disabled
//     **返回 HTTP 400** —— 强制思考,深度只能靠 reasoning_effort 调(low/medium/high/
//     xhigh/max,默认 max;none 不接受,传了 400)。所以这里发 adaptive + reasoning_effort,
//     **永不发 disabled**;界面最低档(它关不掉)落到 low。
//   · M3:adaptive 默认开,disabled 真能关 → 二态照旧。
//   · M2.x:关不掉,disabled 被接收但不生效 → 不打标、wire 省略;手填 M2.x 旧 id 走
//     custom 分支(Off 态发 disabled,被接收但不生效),逃生口 = 思考档切 Auto。
// ⚠ 别把 M3 的形态套到 Flash 上:一个 disabled 就是 400。
// M2.7 存量请求保持无参数(见 registry.ts 的 isCustomModel 特判)。
const minimaxThinking: EffortShape = (e, model) =>
  model === "MiniMax-M3.1-Flash"
    ? { thinking: { type: "adaptive" }, reasoning_effort: pickThinkingLevel("minimax", model, e) }
    : adaptiveThinking(e);

// TokenHub(腾讯)的思考形态【逐型号不同】,2026-10-21 按官方逐型号表重做 ——
// 依据与通道(1823/131208《深度思考》两张逐型号表、1823/135872 字段说明、
// 1823/132248《DeepSeek 调用指南》)的原文逐字记在 registry.ts 的 tokenhub 条目注释里。
//
// ⚠ 旧注释整段是错的:它说 hy3「默认关闭思考」⇒「省略参数 = 不推理 = 翻译要的行为」。
//   那句在 135872 上已经查不到(该文现在只说「不同模型的默认思考开关不同」),
//   而 131208 的逐型号表写明 hy3 默认 = enabled、reasoning_effort 默认 = high;
//   132248 对 DeepSeek 写「可开关(默认开启)」。
//   ⇒ 旧结论的后果是【静默烧推理 token】:不发参 = 服务端默认全程高强度推理跑翻译,
//     与 DeepSeek「10M tokens」事故同款形态。所以现在有关闭态,而且必须发【显式关闭】。
//
// 三种形态,按【型号】分(判据是 registry 的逐型号表 + 两个族正则,别在这里另抄一份):
//   ① minimax-m3 族:135872 明写它【只接受 adaptive 与 disabled】,发 enabled 直接 400。
//   ② 关不掉(官方「enabled(不支持关闭)」:glm-5.3 / kimi-k3):只能降到官方最低档 low,
//      不发明 thinking 参数 —— 给它们发 disabled 是不收的值。
//   ③ 关得掉(多数型号):thinking:{type:"enabled"|"disabled"}。
const tokenhubThinking: EffortShape = (e, model) => {
  const id = model ?? OPENAI_COMPAT_PROVIDERS.tokenhub.defaultModel;
  // ⚠ 分流顺序必须与 registry 的 THINKING_SHAPE_RULES 那两条一致(目录按那个顺序
  //   下发 thinkingWireIf)—— 运行时按另一个顺序就成"目录与运行时各判各的"。
  // ① minimax-m3 族:官方只接受 adaptive / disabled(发 enabled 直接 400)。
  if (TOKENHUB_ADAPTIVE_RE.test(id)) return adaptiveThinking(e);
  // ② 关不掉(官方 enabled(不支持关闭)):只能降到官方最低档,不发明 thinking 参数。
  if (TOKENHUB_ALWAYS_THINKING_RE.test(id)) return lowestTierOnly("tokenhub")(e, id);
  // ③ 其余:官方没写档位表的型号不给档位(摆三档就是摆设),发一个开关就够。
  return thinkingType(e);
};

// (No temperature handling here: providers whose lineup rejects/locks the param
// simply omit `defaultTemperature` in their registry spec — the factory then
// never sends it. See OpenAICompatProviderSpec.defaultTemperature.)

const THINKING_BUILDERS: Partial<Record<OpenAICompatProviderKey, ExtraBodyBuilder>> = {
  // `reasoning_effort` enum, explicit "none" off (server-default-ON)
  openai: gated("openai", openaiEffort("openai")),
  // Azure 镜像 openai 同形态（部署名映射同一批 GPT-5 SKU，GPT-5.x omit→medium
  // 意味着关闭态必须发显式 "none"）。gpt-chat-latest 在 registry 不打标签 →
  // 走 listed-but-untagged 省略分支。旧版是手写 buildAzureReasoningBody，
  // 并入工厂后与 gated() 逐分支同构（tagged 2 态 / custom 3 态 / 省略）。
  azureopenai: gated("azureopenai", openaiEffort("azureopenai")),
  // Grok:档位表在 registry 的 grok.models[].thinkingLevels(官方逐模型表)。
  // ⚠ off 态发【最低档 low】而不是 "none":官方枚举只有 low/medium/high/xhigh,
  // 并明写 "Reasoning cannot be disabled"。发 "none" 两种结局都坏 —— 被拒则
  // 默认态每请求 400,被忽略则按服务端默认(high)静默计费。详见 pickThinkingLevel。
  grok: gated("grok", lowestTierOnly("grok")),
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
    // ⚠ 形态按名字分代 —— 判据在 registry 的 THINKING_SHAPE_RULES（moonshot 那条
    //   /kimi-k3/），这里【不】自己再抄一份正则：抄一份就是两份真相（目录按它下发
    //   thinkingWireIf、运行时按它发线格式，各判各的正是本仓要消灭的那种漂移）。
    matchesThinkingGeneration("moonshot", model ?? "")
      // k3 只收 reasoning_effort(官方逐模型表:low/high/max,默认 max)。档位按 k3
      // 自己的集合夹,不取通用回落集合(那份含 medium —— 对 k3 是枚举外的值)。
      // ⚠ 查表按【族名】kimi-k3 而不是传入的 id:手填的快照 id(kimi-k3-2026xxxx)
      //   不在清单里 —— registry 的分族规则(tableModel)会把它归到 kimi-k3 那张表。
      ? lowestTierOnly("moonshot")(e, model!)
      : thinkingType(e),
  ),
  doubao: gated("doubao", doubaoThinking),
  // GLM-5.3 系不是扁平 thinking:{type} 那一条：官方只接受 `thinking:{type:"enabled"}` 配
  // `reasoning_effort`(low/high/max,默认 max)，并明写「不再支持 thinking.type:"disabled"」
  // 「否则请求将失败」(docs.bigmodel.cn/cn/guide/models/text/glm-5.3.md)。所以关闭态按官方
  // 迁移原句映射到最低档 low，而不是发一个会被拒的 disabled。老世代 GLM 未打标 → gated 省略。
  // ⚠ 2026-10-20:回落集合显式给 ["low","high"],不用通用那份 [low,medium,high] ——
  // 通用集合里的 medium 不在 GLM-5.3 的官方枚举(max/high/low)里,手填的 glm-5.3
  // 快照 id 走 custom 分支时就会发出 medium = 每请求 400。那份回落集合现在住在
  // registry 的 zhipu 条目(unlistedEffortLevels),线格式与界面下拉读同一张表 ——
  // 在册型号走 models[] 里声明的档位表(同样 low/high),两者一致。
  zhipu: gated("zhipu", (e, model) => ({ thinking: { type: "enabled" }, reasoning_effort: pickThinkingLevel("zhipu", model!, e) })),
  // Step 3.7 Flash 官方专节「支持三档推理强度」low/medium/high（medium 默认），全篇无
  // none/disabled 关闭值 ⇒ 关闭态发最低档，绝不发厂商没写的值。未打标的 SKU 由 gated 省略。
  stepfun: gated("stepfun", lowestTierOnly("stepfun")),
  mimo: gated("mimo", thinkingType),
  // The registry preserves the former M2.7 quick pick's parameter-free behavior.
  minimax: gated("minimax", minimaxThinking),
  // Binary enable_thinking bool (server-default varies by model)
  // ⚠ 2026-10-21 复核【改了这行】：以前发 thinking:{type:"enabled"|"disabled"}，理由是
  // 「官方参数表把 enable_thinking 限定在 V3.2/V3.1/GLM/Qwen3，不含 V4」—— 那句话在
  // 现行官方页上【查不到】（V3.2/V3.1 全页 0 命中），现文是「适用于大多数推理模型」。
  // 而官方 API 参考与【逐型号 schema】里思考参数只有三个：enable_thinking(布尔) /
  // thinking_budget / reasoning_effort —— **根本没有 thinking 对象**。
  // ⇒ 以前那个参数名不存在于 SiliconFlow 文档 ⇒ 开关极可能是空操作：界面显示"关"，
  //   上游照常推理，而 SiliconFlow 对思考模式的输出按思考价计费（官方逐字「模型输出了
  //   思考过程时，所有输出 Token（含思考 Token）均按思考模式的输出价格计费」）⇒
  //   用户以为省了钱、实际多花了钱。这与 DeepSeek「10M tokens」是同一类事故。
  // ⇒ 现在发官方那一份：enable_thinking 布尔（开态不发明 reasoning_effort —— 逐型号
  //   effort 集合各不相同，由模型自己的默认档兜底；要分级得先按 SKU 建表）。
  siliconflow: gated("siliconflow", enableThinking),
  qianfan: gated("qianfan", enableThinking),
  // Binary reasoning_effort high|none (server-default-ON): Cohere (command-a-reasoning),
  // Mistral (adjustable medium/small; Magistral stays untagged = native always-on).
  cohere: gated("cohere", reasoningEffortBinary),
  mistral: gated("mistral", reasoningEffortBinary),
  // OpenRouter: graded effort when on; universal `reasoning:{enabled:false}` off for
  // tagged upstream reasoning SKUs (untagged free models omit via the gate).
  // OpenRouter:官方【统一参数】是 reasoning 对象(openrouter.ai/docs/use-cases/
  // reasoning-tokens),effort 取 max/xhigh/high/medium/low/
  // minimal/none。开关两态都用同一个对象 —— 曾经开启态发顶层 reasoning_effort、
  // 关闭态发 reasoning:{enabled:false},两种写法混用:文档只把统一对象列为推荐
  // 形态,顶层别名没有成文保证,一旦它不再被识别,开启态就静默失效(而关闭态
  // 照常工作),表现为"开了思考没反应"这种最难查的形态。
  // OpenRouter 的统一 reasoning 对象。⚠ 关闭态【不能一律发 enabled:false】——
  // 官方逐模型表(GET /api/v1/models 的 reasoning 对象)里 mandatory:true 的那几支
  // 官方明写「reasoning cannot be disabled」,对它们发禁用请求是非法的(每请求 400)。
  // 判据改成【这一支声明了档位表 = 关不掉】(registry 里 thinkingLevels 的语义
  // 正是「厂商没有关闭开关」):声明了就发【最低档 effort】而不是禁用;没声明
  // (即官方收 none 的那几支)才发 enabled:false。
  // ⚠ 两轴的判据【不是同一个】,别合成一个条件：
  //   · 关不关得掉 = 只看 thinkingLevels(它的语义就是「厂商没有关闭值」)。effortLevels
  //     那批(官方 supported_efforts 里【有】none)必须继续发 enabled:false —— 把
  //     effortLevels 也当成「关不掉」,就把 kimi-k3 / hy3 / deepseek-v4.1-flash 变成
  //     永远在想、照常计费,而界面写着 Min。
  //   · 开启态发哪一档 = 两个表都算数，一律过 resolveEffortForModel。官方
  //     supported_efforts 逐型号不同(有的没有 medium、有的没有 high),越界的档不是 400
  //     而是被网关【就近映射】(官方文档口径)—— 不钳就是用户选 High、实际跑别的档,
  //     而界面上没有任何痕迹。未声明表的 SKU 与手填 id 原样发(那才是"收全部档")。
  openrouter: gated("openrouter", (e, model) => {
    const mandatory = !!getProviderModels("openrouter").find((m) => m.value === model)?.thinkingLevels?.length;
    if (!e) return { reasoning: mandatory ? { effort: pickThinkingLevel("openrouter", model!, undefined) } : { enabled: false } };
    return { reasoning: { effort: resolveEffortForModel("openrouter", model!, e) } };
  }),
  // Graded reasoning_effort, OMIT off (undisableable): Groq gpt-oss.
  // ⚠ gpt-oss 官方只收 low/medium/high、没有 none(console.groq.com/docs/reasoning):
  //   关闭态发【最低档】而不是省略 —— 省略是落到未文档化的服务端默认(惯例 medium),
  //   用户点了「关」反而按中档计费。同 gemini/grok,详见 pickThinkingLevel。
  groq: gated("groq", lowestTierOnly("groq")),
  // Cerebras:两个公共模型的 reasoning_effort 取值【不同】,必须按 SKU 分流
  // (inference-docs.cerebras.ai/capabilities/reasoning):
  //   · gpt-oss-120b: low/medium(默认)/high —— 无 none,关不掉 → 走档位表,
  //     关闭态发最低档 low(registry 的 thinkingLevels 已声明)
  //   · qwen-3.8-27b: none(默认)/low/medium/high —— 有真正的关闭值,
  //     关闭态发 none,与 openai 同形态
  // ⚠ 2026-10-21 复核:第二条原来是 gemma-4-31b,但官方自 2026-09-03 起已把 gemma-4-31b
  //   从 Shared Inference 下线,公共端点现在【恰好两条】= gpt-oss-120b + qwen-3.8-27b。
  //   另注:qwen 的 high 官方逐字是「Selects Qwen's native xhigh mode and is the default」
  //   ⇒ 我们标 High 实际跑的是 Qwen 原生 xhigh（比标称更深，但正是厂商默认，不算撒谎）。
  // ⚠ 未声明 thinkingLevels 的 SKU(含用户手填)走 reasoningEffortOrNone:
  // 发 "none" 是它们那一档的合法关闭值。别统一成一个 shape —— 给 gpt-oss
  // 发 none 会撞上"该 SKU 无此取值"。
  // ⚠ 2026-10-21 复核【改了这行判据】:以前只看【在册清单】,手填的 gpt-oss 快照 id
  //   (gpt-oss-120b-20991231 这种)查不到 ⇒ 落进 reasoningEffortOrNone ⇒ 关态发 none
  //   ⇒ gpt-oss 不收 none = 每请求 400。改判 hasOwnLevelsTable —— 它连【按族名归表】
  //   一起算(registry 的 THINKING_SHAPE_RULES 给 cerebras 的 gpt-oss 族留了
  //   tableModel:gpt-oss-120b)⇒ 手填快照按族名归到那张 low/medium/high 的表,
  //   关闭态发最低档 low。在册两条的行为不变(各自本来就声明/不声明档位表)。
  cerebras: gated("cerebras", (e, model) =>
    hasOwnLevelsTable("cerebras", model ?? OPENAI_COMPAT_PROVIDERS.cerebras.defaultModel)
      ? lowestTierOnly("cerebras")(e, model!)
      : reasoningEffortOrNone(e),
  ),
  // 订阅套餐端点(registry 里 hidden,UI 默认不显示):火山 Coding Plan 与 doubao
  // 按量线同为扁平 thinking:{type};阿里百炼线(2026-09 起为 Token Plan 端点)
  // 与 qianfan 同为裸 enable_thinking —— 不能用 qwenThinking,那个 on 档额外带
  // thinking_budget,且 qwen3.8 系列等在册 SKU 根本不吃 enable_thinking(registry
  // 里未打 thinking 标,gated 对它们不发任何思考参数)。按 method key 分流。
  volcengine: gated("volcengine", thinkingType),
  // 阿里百炼 Token Plan:裸 enable_thinking 布尔 —— 但 glm-5.3 系是「仅思考模式」
  // (关不掉),且官方两页对 enable_thinking=false 的后果口径不一(《OpenAI兼容-Chat》
  // 说「会导致 API 请求失败」、《GLM》模型页说「不会生效」)⇒ 两种口径下都别发 false。
  // 这一族改走 zhipu 同款:关闭态发官方最低档 reasoning_effort(low/high)。
  alibaba: gated("alibaba", (e, model) =>
    GLM_5_3_ALWAYS_THINKING_RE.test(model ?? OPENAI_COMPAT_PROVIDERS.alibaba.defaultModel)
      ? lowestTierOnly("alibaba")(e, model!)
      : enableThinking(e),
  ),
  // TokenHub:形态逐型号不同(见上面 tokenhubThinking 的注释),关闭态必须发显式关闭 ——
  // 服务端默认是「enabled + 默认 high 档」,省略参数 = 静默按高强度推理跑翻译。
  tokenhub: gated("tokenhub", tokenhubThinking),
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

// Azure —— 工厂服务 + 一层 requireUrl 守卫。并入 openai-compat 工厂
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

// NVIDIA NIM 的思考参数走 `chat_template_kwargs` 顶层字段（不是原生 API 的
// reasoning_effort / thinking）。但**里面装什么，按型号/族不同** —— 官方模型卡片
// 各自写明：
//   · Qwen3 族：chat_template_kwargs.thinking
//   · Nemotron 族：chat_template_kwargs.enable_thinking（medium 档再加 medium_effort）
//   · 顶层的 reasoning_effort 是【独立输入参数】：官方示例代码自己把它翻译成上面
//     那些键 —— 它**从来没有被嵌进** chat_template_kwargs。我们以前嵌了，等于给
//     模板发一个它不认的键（实测被静默忽略 = 档位压根没生效，界面却在给三档）。
//
// ⚠ 形态表只收【官方卡片上出现过旋钮】的型号；没写进表里的型号一律不发思考参数
//   （错形状 = 被忽略或每请求 400）。这张表是"许可清单"：目录里打了 thinking 标、
//   表里却没有的型号 = 声明了形态却没实现 ⇒ thinking.test.ts 有证人钉住双向一致。
// ⚠ DeepSeek 那支的形态是【推断 + 未实测】：NIM 卡片本身零旋钮（整张卡片里
//   chat_template_kwargs / enable_thinking / "thinking" 各 0 命中；对照组
//   qwen3-235b-a22b 的卡片 chat_template_kwargs 28 命中 ⇒ 抓取方法有效），
//   这里用的是 DeepSeek 自家模板的 thinking 开关。档位在 NIM 侧表达不了
//   （卡片只提到参考实现的 1~100 数字档）⇒ 目录标 binaryThinking，界面只给 [Off/On]。
//   ⚠ 下次带 key 实测出可用的形态后，按实测改这一行 + 目录那一行（形态 + 档位表）。
//
// Orchestrator-level gate in useTranslationState ensures reasoningEffort is only
// set for thinking-tagged models the user picked an effort for.
// ⚠ 导出给 sync-provider-catalog 用:目录生成器要下发的就是本仓真正发出去的那份 body
// (它的契约原话「下游拿到的就是本仓真正发出去的那份 body」),所以形状只能在这里有一份
// 事实来源,不能另抄一遍。NIM 默认关思考 ⇒ 关闭态省略(省略即关),只有真 effort 才开。
//
// ⚠【只对打了 thinking 标的那一支发】—— chat_template_kwargs.thinking 是 DeepSeek
//   自家模板的键,registry 里写明「发给非 DeepSeek 型号是错误形状」(要么 400,要么被
//   静默忽略 = 开关空转)。手填/未在册的 id 无从判断属于哪一家 ⇒ 不发。
//   这条判据与目录生成器是【同一个】(那边也调本函数),否则目录说"宁可不说"、
//   运行时却照说,同一件事两份真相。
export const buildNvidiaThinkingParams = (reasoningEffort: ThinkingDirective | undefined, model: string): Record<string, unknown> => {
  if (!isThinkingModel("nvidia", model)) return {};
  // NIM defaults reasoning OFF, so the default-Off (undefined) and "auto" both map to
  // omit — omitting already yields "off", there's nothing to disable. Only a real
  // effort enables.
  if (!reasoningEffort || reasoningEffort === "auto") return {};
  return { chat_template_kwargs: { thinking: true } };
};

export const nvidia: TranslationService = async (params) => {
  const { apiKey, url, model, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const effectiveModel = model || defaultConfigs.nvidia.model!;
  const thinkingParams = buildNvidiaThinkingParams(reasoningEffort, effectiveModel);

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
  const { apiKey, url, model, temperature, sendSystemPrompt, maxTokens, useRelay, relayBase } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const serviceName = "Custom (OpenAI-compatible)";
  // Custom 没有隐式默认端点(URL 即凭证),所以 requireUrl 这道守卫是【承重】的,
  // 不能因为「resolveWireEndpoint 已经会补全」就删。⚠ llm 的 getRelayAllowlist
  // 【不是空的】—— 它先读 spec.endpoints,所以 [0] 是那枚 LM Studio 芯片
  // (http://127.0.0.1:1234/v1/chat/completions,实测 9 条)。少了这道守卫,空地址
  // 会走 resolveWireEndpoint 的「空 url → allowlist[0]」兜底,静默打向一个用户
  // 从没选过的本地运行时 —— 比抛错糟得多。
  requireUrl(serviceName, url);
  // 出口地址与所有中转能力服务共用一条咽喉(registry.resolveWireEndpoint):
  // 补全器、allowlist、「能不能走中转」全在 registry 一处,与界面同判据。
  //
  // ⚠ Custom 在这里能走通中转,靠的是【用户自己的 relayBase】+ 他自己那份 Worker
  // 里声明的 `llm` allowlist。四种组合的落点(全在 relayWouldServe 里判):
  //   · 直连                       → 直接打用户填的地址
  //   · 自建 relayBase             → {base}/api/llm?endpoint=<用户地址>
  //   · 内置公共中转 + 任意自填地址 → 退回直连。内置 Worker 的 llm allowlist 只声明了
  //                                   那两枚公开芯片(Together / Fireworks),自填地址不在
  //                                   其中,发过去只会换一个 400,还把 ?token=SECRET
  //                                   留在别人的日志里。
  //   · 环回/内网地址(本地运行时) → 退回直连(远端够不着 127.0.0.1)
  const apiEndpoint = resolveWireEndpoint("llm", { url, useRelay, relayBase });

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
  // "Thinking level is not supported for this model."(实测 gemini-2.5-flash)。
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
//     ⚠ 这一代的【关闭档】按官方逐模型表分三种形态，发错就是每请求 400（逐页核原文）：
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
