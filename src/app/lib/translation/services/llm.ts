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
// 思考档位定义与官方文档统一收敛在 registry.ts，此处按各厂商线格式协议分流。

// Binary `thinking: {type}` — Moonshot (Kimi), Doubao (Seed), Zhipu (GLM), MiMo.
const thinkingType: EffortShape = (e) => ({ thinking: { type: e ? "enabled" : "disabled" } });

// Binary `enable_thinking` boolean — SiliconFlow / 阿里百炼 Token Plan / Baidu ERNIE (Qianfan).
// 官方参数为顶层 enable_thinking 布尔值（非 thinking 对象）。
const enableThinking: EffortShape = (e) => ({ enable_thinking: !!e });

// 厂商无关闭值的型号：关闭态发该 SKU 官方最低档 effort（如 grok、groq、stepfun、kimi-k3 等）。
const lowestTierOnly =
  (service: OpenAICompatProviderKey): EffortShape =>
  (e, model) => ({ reasoning_effort: pickThinkingLevel(service, model ?? OPENAI_COMPAT_PROVIDERS[service].defaultModel, e) });

// 「thinking: { type: "adaptive" }」族：MiniMax M3 / TokenHub minimax-m3。
const adaptiveThinking: EffortShape = (e) => ({ thinking: { type: e ? "adaptive" : "disabled" } });

// 支持显式 "none" 关闭的型号（如 Qwen 3.8 / Cerebras qwen）。
const reasoningEffortOrNone: EffortShape = (e) => ({ reasoning_effort: e ?? "none" });

// OpenAI / Azure OpenAI：根据 SKU 是否声明 thinkingLevels 决定关闭值。
// 声明档位表者官方无 none，关闭态取最低档；未声明者发显式 "none"。
const openaiEffort =
  (service: OpenAICompatProviderKey): EffortShape =>
  (e, model) => {
    const sku = model ?? OPENAI_COMPAT_PROVIDERS[service].defaultModel;
    const levels = getProviderModels(service).find((m) => m.value === sku)?.thinkingLevels;
    return { reasoning_effort: levels?.length ? pickThinkingLevel(service, sku, e) : e ?? "none" };
  };

// `reasoning_effort` binary high|none — Cohere (command-a-reasoning) + Mistral.
const reasoningEffortBinary: EffortShape = (e) => ({ reasoning_effort: e ? "high" : "none" });

// Qwen3.8 (DashScope)：开启态发 reasoning_effort（枚举映射：high -> xhigh），关闭态发 enable_thinking: false。
const QWEN_EFFORT: Record<ReasoningEffort, string> = { low: "low", medium: "medium", high: "xhigh" };
const qwenThinking: EffortShape = (e) => (e ? { reasoning_effort: QWEN_EFFORT[e] } : { enable_thinking: false });

// 火山方舟（豆包按量线）：开启态发顶层 reasoning_effort，关闭态发 thinking: { type: "disabled" }。
const doubaoThinking: EffortShape = (e) => (e ? { reasoning_effort: e } : { thinking: { type: "disabled" } });

// DeepSeek V4: thinking:{type} + reasoning_effort (always "high" tier).
// Exported for the "10M tokens" regression test.
export const buildDeepseekExtraBody: EffortShape = (e) => (e ? { thinking: { type: "enabled" }, reasoning_effort: "high" } : { thinking: { type: "disabled" } });

// MiniMax：M3.1 Flash 强制思考（adaptive + reasoning_effort，不收 disabled）；M3 支持 disabled 关闭。
const minimaxThinking: EffortShape = (e, model) =>
  model === "MiniMax-M3.1-Flash"
    ? { thinking: { type: "adaptive" }, reasoning_effort: pickThinkingLevel("minimax", model, e) }
    : adaptiveThinking(e);

// TokenHub（腾讯）：分流规则与 registry 保持一致。
// ① minimax-m3 族：仅接受 adaptive/disabled；
// ② 官方不支持关闭族（glm-5.3 / kimi-k3）：发官方最低档 reasoning_effort；
// ③ 其它可开关型号：发 thinking: { type: "enabled" | "disabled" }。
const tokenhubThinking: EffortShape = (e, model) => {
  const id = model ?? OPENAI_COMPAT_PROVIDERS.tokenhub.defaultModel;
  if (TOKENHUB_ADAPTIVE_RE.test(id)) return adaptiveThinking(e);
  if (TOKENHUB_ALWAYS_THINKING_RE.test(id)) return lowestTierOnly("tokenhub")(e, id);
  return thinkingType(e);
};

// (No temperature handling here: providers whose lineup rejects/locks the param
// simply omit `defaultTemperature` in their registry spec — the factory then
// never sends it. See OpenAICompatProviderSpec.defaultTemperature.)

const THINKING_BUILDERS: Partial<Record<OpenAICompatProviderKey, ExtraBodyBuilder>> = {
  // `reasoning_effort` enum, explicit "none" off (server-default-ON)
  openai: gated("openai", openaiEffort("openai")),
  // Azure 镜像 openai 同形态（部署名映射同一批 GPT-5 SKU）。
  azureopenai: gated("azureopenai", openaiEffort("azureopenai")),
  // Grok: 官方无 none，关闭态发最低档 low。
  grok: gated("grok", lowestTierOnly("grok")),
  // DeepSeek V4: thinking:{type} + reasoning_effort (always "high" tier)
  deepseek: gated("deepseek", buildDeepseekExtraBody),
  // Qwen3: enable_thinking + reasoning_effort
  qwen: gated("qwen", qwenThinking),
  // Moonshot: K2.x 用 thinking:{type}；kimi-k3 仅思考模式，关闭态发最低档 low。
  moonshot: gated("moonshot", (e, model) =>
    matchesThinkingGeneration("moonshot", model ?? "")
      ? lowestTierOnly("moonshot")(e, model!)
      : thinkingType(e),
  ),
  doubao: gated("doubao", doubaoThinking),
  // GLM-5.3 系仅接受 thinking:{type:"enabled"} 配 reasoning_effort，关闭态映射到最低档 low。
  zhipu: gated("zhipu", (e, model) => ({ thinking: { type: "enabled" }, reasoning_effort: pickThinkingLevel("zhipu", model!, e) })),
  // Step 3.7 Flash: 官方无 none/disabled，关闭态发最低档。
  stepfun: gated("stepfun", lowestTierOnly("stepfun")),
  mimo: gated("mimo", thinkingType),
  minimax: gated("minimax", minimaxThinking),
  // SiliconFlow / 千帆: 顶层 enable_thinking 布尔值。
  siliconflow: gated("siliconflow", enableThinking),
  qianfan: gated("qianfan", enableThinking),
  // Binary reasoning_effort high|none (server-default-ON): Cohere + Mistral.
  cohere: gated("cohere", reasoningEffortBinary),
  mistral: gated("mistral", reasoningEffortBinary),
  // OpenRouter: 统一 reasoning 对象。关不掉的型号发最低档 effort，可关闭型号发 { enabled: false }。
  openrouter: gated("openrouter", (e, model) => {
    const mandatory = !!getProviderModels("openrouter").find((m) => m.value === model)?.thinkingLevels?.length;
    if (!e) return { reasoning: mandatory ? { effort: pickThinkingLevel("openrouter", model!, undefined) } : { enabled: false } };
    return { reasoning: { effort: resolveEffortForModel("openrouter", model!, e) } };
  }),
  // Groq: gpt-oss 官方无 none，关闭态发最低档 low。
  groq: gated("groq", lowestTierOnly("groq")),
  // Cerebras: gpt-oss 关不掉（发最低档 low）；qwen-3.8-27b 支持 none 关闭。
  cerebras: gated("cerebras", (e, model) =>
    hasOwnLevelsTable("cerebras", model ?? OPENAI_COMPAT_PROVIDERS.cerebras.defaultModel)
      ? lowestTierOnly("cerebras")(e, model!)
      : reasoningEffortOrNone(e),
  ),
  volcengine: gated("volcengine", thinkingType),
  // 阿里百炼 Token Plan: 裸 enable_thinking 布尔值；glm-5.3 系仅思考模式，发最低档 reasoning_effort。
  alibaba: gated("alibaba", (e, model) =>
    GLM_5_3_ALWAYS_THINKING_RE.test(model ?? OPENAI_COMPAT_PROVIDERS.alibaba.defaultModel)
      ? lowestTierOnly("alibaba")(e, model!)
      : enableThinking(e),
  ),
  // TokenHub: 腾讯大模型服务平台（逐型号分流规则见 tokenhubThinking）。
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

// NVIDIA NIM 的思考参数通过 chat_template_kwargs 传递。
// 仅对打标且非空的 DeepSeek 思考模型发送 chat_template_kwargs: { thinking: true }。
export const buildNvidiaThinkingParams = (reasoningEffort: ThinkingDirective | undefined, model: string): Record<string, unknown> => {
  if (!isThinkingModel("nvidia", model)) return {};
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
  // Custom 无默认端点，requireUrl 为必经校验（防空地址回退到 allowlist[0]）。
  requireUrl(serviceName, url);
  // 出口地址计算（由 registry.resolveWireEndpoint 统一处理中转判定与地址补全）。
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
 * Gemini 的 generationConfig 构造（具名导出供 provider catalog 同步）。
 * 档位表在 registry 的 gemini.models[].thinkingLevels，关闭态映射到最低档。
 */
export const buildGeminiThinkingConfig = (model: string, directive: ThinkingDirective | undefined): Record<string, unknown> => {
  // thinkingLevel 是 Gemini 3.x 起的字段，2.x/1.x 旧世代或手填模型不发思考参数。
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

// Request-shaping for Claude's thinking generations — exported for thinking.test.ts.
// - Adaptive gen: effort → thinking:{type:"adaptive"} + output_config.effort;
//   关闭态分三种：Always-on（不发 thinking）、Sonnet 5.5（发 between_tools）、其余老世代（发 disabled）。
// - Extended gen (Haiku 4.5, Sonnet 4.6): effort → thinking:{type:"enabled", budget_tokens}。
export const buildClaudeThinkingBody = (model: string, directive: ThinkingDirective | undefined): { maxTokens: number; body: Record<string, unknown> } => {
  const adaptive = isAdaptiveThinkingClaude(model);
  const alwaysOn = isAlwaysThinkingClaude(model);
  const autoDirective = directive === "auto";
  const effort: ReasoningEffort | undefined = autoDirective ? undefined : directive;
  const betweenToolsOff = adaptive && !effort && !autoDirective && !alwaysOn && isBetweenToolsOffClaude(model);
  // Anthropic requires budget_tokens < max_tokens. When thinking may engage, raise max_tokens to 16384.
  const mayThink = !!effort || (adaptive && (autoDirective || alwaysOn || betweenToolsOff));
  const body: Record<string, unknown> = {};
  if (adaptive) {
    if (effort) {
      body.thinking = { type: "adaptive" };
      body.output_config = { effort };
    } else if (!autoDirective) {
      if (alwaysOn) {
        // Always-on SKU: omit thinking param
      } else if (betweenToolsOff) {
        body.thinking = { type: "between_tools" };
      } else {
        body.thinking = { type: "disabled" };
      }
    }
  } else if (effort) {
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
