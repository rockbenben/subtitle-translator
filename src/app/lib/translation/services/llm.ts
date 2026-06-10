// Translation services - LLM APIs (OpenAI, DeepSeek, Gemini, etc.)

import type { ReasoningEffort, ThinkingDirective, TranslateTextParams, TranslationService } from "../types";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "../config";
import { defaultConfigs, isCustomModel, isThinkingModel, OPENAI_COMPAT_KEYS, OPENAI_COMPAT_PROVIDERS, type OpenAICompatProviderKey, type OpenAICompatProviderSpec } from "../registry";
import { getAIModelPrompt } from "../utils";

import { fetchJSON, normalizeNumber, normalizePrompt, relayUrl, requireApiKey, requireUrl, completeOpenAICompatUrl, PROXY_ENDPOINTS, getOpenAICompatContent, getClaudeContent } from "./shared";

// Prepare prompts common to all LLM services
const preparePrompts = (params: { text: string; targetLanguage: string; sourceLanguage: string; systemPrompt?: string; userPrompt?: string; fullText?: string }) => {
  const effectiveSystemPrompt = normalizePrompt(params.systemPrompt, DEFAULT_SYSTEM_PROMPT);
  const effectiveUserPrompt = normalizePrompt(params.userPrompt, DEFAULT_USER_PROMPT);
  const prompt = getAIModelPrompt(params.text, effectiveUserPrompt, params.targetLanguage, params.sourceLanguage, params.fullText);
  return { effectiveSystemPrompt, prompt };
};

// Common OpenAI-compatible request helper (named-parameter config object)
type OpenAICompatRequestConfig = {
  params: TranslateTextParams;
  serviceName: string;
  endpoint: string;
  defaultModel: string;
  defaultTemperature: number;
  extraHeaders?: Record<string, string>;
  extraBody?: Record<string, unknown>;
};

const openAICompatRequest = async (cfg: OpenAICompatRequestConfig): Promise<string> => {
  const { params, serviceName, endpoint, defaultModel, defaultTemperature, extraHeaders, extraBody } = cfg;
  const { apiKey, model, temperature } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const key = requireApiKey(serviceName, apiKey);

  const data = await fetchJSON(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      ...extraHeaders,
    },
    body: JSON.stringify({
      messages: [
        { role: "system", content: effectiveSystemPrompt },
        { role: "user", content: prompt },
      ],
      model: model || defaultModel,
      temperature: normalizeNumber(temperature, defaultTemperature),
      stream: false,
      // No max_tokens — cloud models don't repeat-loop. Only `llm` Custom exposes it.
      ...extraBody,
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, serviceName);
};

// Resolve the endpoint for a provider with allowCustomUrl / allowRelay priority:
// user-supplied URL > relay (when useRelay toggled) > default endpoint.
// completeOpenAICompatUrl normalizes user-supplied URLs (bare host, /v1, wrong
// /v1/responses or /v1/completions paths) — safety net for settings imported
// from file or hand-edited localStorage that bypass the UI's onBlur fix.
const resolveEndpoint = (key: OpenAICompatProviderKey, spec: OpenAICompatProviderSpec, params: TranslateTextParams): string => {
  const customUrl = params.url?.trim();
  if (spec.allowCustomUrl && customUrl) return completeOpenAICompatUrl(customUrl);
  if (spec.allowRelay && params.useRelay) return relayUrl(key);
  return spec.endpoint;
};

// ═════════════════════════════════════════════════════════════════════════
// Two-tier OpenAI-compat service generation:
//   - TIER 1 (thinking-aware): registered in THINKING_BUILDERS below. Each
//     entry is `gated(service, shape)` — the shared gate + one effort→wire shape.
//   - TIER 2 (base / no builder): providers with no thinking-tagged SKUs in the
//     registry (perplexity). Factory returns a pass-through service.
// Adding a thinking-capable provider = tag its SKU(s) in the registry + add one
// `gated(...)` entry here. Service implementation is auto-derived.
// ═════════════════════════════════════════════════════════════════════════

type ExtraBodyBuilder = (params: TranslateTextParams) => Record<string, unknown>;

// An effort→wire-payload shape. `effort` is the orchestrator-derived reasoning
// level: a value = thinking ON, undefined = OFF. For server-default-ON vendors the
// OFF branch MUST return an EXPLICIT disable, never `{}` — omitting silently bills
// reasoning tokens (the DeepSeek "10M tokens" MD-translation report).
type EffortShape = (effort: ReasoningEffort | undefined) => Record<string, unknown>;

// The gate every thinking-aware OpenAI-compat provider shares: inject a payload
// ONLY for a registry-tagged (= known) model — untagged user-typed SKUs are left
// alone because we don't know their protocol (forcing a param could break an
// unrelated model). Factors the per-vendor `isThinkingModel(...) ? shape : {}`
// boilerplate into one place so each provider only declares its wire shape.
//
// Custom (untagged) models on a thinking-capable provider: the user MAY opt into
// thinking on an unlisted SKU (deriveThinkingParams now lets effort through for
// custom-on-capable). When they do, we send the ENABLE shape; when they don't
// (effort undefined = default off), we OMIT — never an explicit disable. Rationale
// (verified 2026-05 audit): most providers 422/400 on reasoning params for models
// that don't support them, so a proactive disable would break plain translations on
// STRICT providers; omitting keeps them safe. A 422/400 when the user DID opt into
// thinking on an unsupported SKU is their call ("选了 custom 就自己搞"). Listed-but-
// untagged models (mistral-large-3) never reach here with an effort — deriveThinking
// Params returns undefined for them. Tagged models keep full control (disable when off).
const gated =
  (service: OpenAICompatProviderKey, shape: EffortShape): ExtraBodyBuilder =>
  (p) => {
    const model = p.model || OPENAI_COMPAT_PROVIDERS[service].defaultModel;
    const effort = p.reasoningEffort;
    // Tagged model: 2-state (absence → disable, effort → enable).
    if (isThinkingModel(service, model)) return shape(effort === "auto" ? undefined : effort);
    // Custom model: 3-state Off/On/Auto. DEFAULT (absence → undefined) is Off → send
    // the explicit disable; "auto" → omit (the escape for SKUs a STRICT provider would
    // 422 on the disable); effort → enable. The disable/enable are the user's call —
    // a 422 from an unsupported SKU surfaces as a translation error.
    if (isCustomModel(service, model)) {
      if (effort === "auto") return {};
      return shape(effort); // undefined (default Off) → disable; effort → enable
    }
    // Listed-but-untagged model (e.g. mistral-large-3): known non-thinking → OMIT.
    return {};
  };

// ── Shared wire shapes (reused across vendors with identical protocols) ──────
// Binary `thinking: {type}` — Moonshot (Kimi), Doubao (Seed), Zhipu (GLM), MiMo.
// Docs: volcengine.com/docs/82379, docs.bigmodel.cn, platform.moonshot.cn,
// platform.xiaomimimo.com/docs/zh-CN/api/chat/openai-api.
const thinkingType: EffortShape = (e) => ({ thinking: { type: e ? "enabled" : "disabled" } });
// Binary `enable_thinking` boolean — SiliconFlow (default TRUE), Baidu ERNIE/Qianfan.
const enableThinking: EffortShape = (e) => ({ enable_thinking: !!e });
// `reasoning_effort` enum with explicit "none" off — OpenAI GPT-5.x (omit-default
// medium on 5.5) + Grok (omit-default "low"). Also reused by Azure (custom service).
const reasoningEffortOrNone: EffortShape = (e) => ({ reasoning_effort: e ?? "none" });
// `reasoning_effort` binary high|none — Cohere (command-a-reasoning) + Mistral
// (adjustable medium/small). Vendor exposes only two effective tiers, so any "on"
// effort collapses to "high"; off sends an explicit "none" (both server-default-ON).
const reasoningEffortBinary: EffortShape = (e) => ({ reasoning_effort: e ? "high" : "none" });
// `reasoning_effort` graded, OMIT when off — Groq gpt-oss + Perplexity deep-research.
// Reasoning is undisableable on these, so off can't send a real disable; we omit and
// let the server keep its default. On forwards the chosen low/medium/high verbatim.
const reasoningEffortGraded: EffortShape = (e) => (e ? { reasoning_effort: e } : {});
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

// MiniMax & Hunyuan deliberately have NO thinking builder (untagged → no dead UI
// toggle): MiniMax M2.x thinking is intrinsic/unclosable — the only hosted knob,
// `reasoning_split`, just switches output FORMAT (`reasoning_details` vs inline
// `<think>`), it can't turn reasoning off; Hunyuan's `enable_enhancement` is a
// WEB-SEARCH toggle, not thinking, and the OpenAI-compat path exposes no documented
// thinking field (the native-API `EnableThinking` is hunyuan-a13b-only). NVIDIA NIM
// omits too — vLLM defaults DeepSeek reasoning OFF (opt-in), so there's nothing to disable.

const THINKING_BUILDERS: Partial<Record<OpenAICompatProviderKey, ExtraBodyBuilder>> = {
  // `reasoning_effort` enum, explicit "none" off (server-default-ON)
  openai: gated("openai", reasoningEffortOrNone),
  // Grok: xAI's chat/completions accepts ONLY low/high (registry.ts documents
  // the two-tier rule) — medium maps to low here. Sending "medium" verbatim
  // (the old reasoningEffortOrNone shape) made the UI-offered Medium level a
  // deterministic 4xx on every request.
  grok: gated("grok", (e) => ({ reasoning_effort: e ? (e === "high" ? "high" : "low") : "none" })),
  // DeepSeek V4: thinking:{type} + reasoning_effort (always "high" tier)
  deepseek: gated("deepseek", buildDeepseekExtraBody),
  // Qwen3: enable_thinking + graded thinking_budget
  qwen: gated("qwen", qwenThinking),
  // Binary thinking:{type} (server-default-ON)
  moonshot: gated("moonshot", thinkingType),
  doubao: gated("doubao", thinkingType),
  zhipu: gated("zhipu", thinkingType),
  mimo: gated("mimo", thinkingType),
  // Binary enable_thinking bool (server-default-ON)
  siliconflow: gated("siliconflow", enableThinking),
  qianfan: gated("qianfan", enableThinking),
  // Binary reasoning_effort high|none (server-default-ON): Cohere (command-a-reasoning),
  // Mistral (adjustable medium/small; Magistral stays untagged = native always-on).
  cohere: gated("cohere", reasoningEffortBinary),
  mistral: gated("mistral", reasoningEffortBinary),
  // OpenRouter: graded effort when on; universal `reasoning:{enabled:false}` off for
  // tagged upstream reasoning SKUs (untagged free models omit via the gate).
  openrouter: gated("openrouter", (e) => (e ? { reasoning_effort: e } : { reasoning: { enabled: false } })),
  // Graded reasoning_effort, OMIT off (undisableable): Groq gpt-oss, Perplexity
  // sonar-deep-research (research model, server-default medium; sonar-reasoning-pro
  // stays intrinsic = untagged → gate returns {}).
  perplexity: gated("perplexity", reasoningEffortGraded),
  groq: gated("groq", reasoningEffortGraded),
  // (minimax / hunyuan intentionally absent — see note above)
};

// Exposed for the SERVER_DEFAULT_THINKING_ON invariant test: the thinking extra
// body a provider injects for given params (so tests can assert OFF → non-empty
// disable payload). Returns {} for providers with no builder.
export const buildThinkingExtraBody = (service: OpenAICompatProviderKey, params: TranslateTextParams): Record<string, unknown> => THINKING_BUILDERS[service]?.(params) ?? {};

// Shared relay-hint message: browser-direct calls to a relay-capable provider
// hit the same CORS wall and surface a raw `TypeError: Failed to fetch` (no
// status → retry.ts would wrongly retry it 3×). The "enable 'API Relay'" marker
// is what retry.ts matches to treat it as non-retryable, so retrying a doomed
// CORS error is avoided. Hardcoded bilingual to match existing precedent.
export const RELAY_HINT_MESSAGE = "Network error (possibly CORS). Please enable 'API Relay' in API Settings. / 网络错误（可能是 CORS 限制），请在 API 设置中开启「中转 API」。";

// True when an error is the browser's CORS/network `TypeError: Failed to fetch`.
const isFailedToFetch = (error: unknown): error is TypeError => error instanceof TypeError && error.message.includes("Failed to fetch");

// Wrap a relay-capable provider's service so a `Failed to fetch` (CORS) error
// with relay OFF is rewritten into the actionable relay hint. Applied generically
// to every `allowRelay` provider — not just DeepSeek — so they all get the hint
// (and the non-retryable classification) instead of a raw doomed retry.
const withRelayHint = (service: TranslationService): TranslationService => async (params) => {
  try {
    return await service(params);
  } catch (error) {
    if (!params.useRelay && isFailedToFetch(error)) {
      throw new Error(RELAY_HINT_MESSAGE);
    }
    throw error;
  }
};

// Factory: generate a TranslationService from a provider spec key, optionally
// wiring in a thinking extra-body builder. Relay-capable providers are wrapped
// with the shared CORS → relay-hint rewriter.
const makeOpenAICompat = (key: OpenAICompatProviderKey, extraBodyBuilder?: ExtraBodyBuilder): TranslationService => {
  const spec = OPENAI_COMPAT_PROVIDERS[key] as OpenAICompatProviderSpec;
  const base: TranslationService = async (params) =>
    openAICompatRequest({
      params,
      serviceName: spec.label,
      endpoint: resolveEndpoint(key, spec, params),
      defaultModel: spec.defaultModel,
      defaultTemperature: spec.defaultTemperature,
      extraHeaders: spec.extraHeaders,
      extraBody: extraBodyBuilder?.(params),
    });
  return spec.allowRelay ? withRelayHint(base) : base;
};

// Auto-generate every OpenAI-compat service: each provider gets a base service,
// thinking-aware ones additionally pick up their builder from the registry.
const openAICompatServicesBase = Object.fromEntries(OPENAI_COMPAT_KEYS.map((k) => [k, makeOpenAICompat(k, THINKING_BUILDERS[k])])) as Record<OpenAICompatProviderKey, TranslationService>;

// DeepSeek extra wrap: the generic relay-hint (CORS → "API Relay") already comes
// from the factory; DeepSeek additionally rewrites a 403 (its direct endpoint
// blocks some browser origins outright) into the same relay remediation hint.
export const deepseek: TranslationService = async (params) => {
  try {
    return await openAICompatServicesBase.deepseek(params);
  } catch (error) {
    // 按 .status 数值判 403,不靠 message 里的 "[403]" 字面 —— 非 JSON 的
    // 403 响应体(WAF/origin 拦截页是 HTML)formatHttpError 不会嵌 "[403]",
    // 字面匹配漏掉的恰是最常见的浏览器源被拦场景。fetchJSON 已 Object.assign
    // 附 status。
    const status = (error as { status?: number } | null)?.status;
    if (!params.useRelay && (status === 403 || (error instanceof Error && error.message.includes("[403]")))) {
      throw new Error("DeepSeek API returned 403 Forbidden. Please enable 'API Relay' in API Settings. / DeepSeek API 返回 403 禁止访问，请在 API 设置中开启「中转 API」。");
    }
    throw error;
  }
};

// Direct exports — every provider in OPENAI_COMPAT_KEYS gets one for
// backwards-compatible imports elsewhere. Generated from the factory map so
// adding a provider needs no edit here.
export const openai = openAICompatServicesBase.openai;
export const moonshot = openAICompatServicesBase.moonshot;
export const openrouter = openAICompatServicesBase.openrouter;
export const groq = openAICompatServicesBase.groq;
export const grok = openAICompatServicesBase.grok;
export const siliconflow = openAICompatServicesBase.siliconflow;
export const qwen = openAICompatServicesBase.qwen;
export const doubao = openAICompatServicesBase.doubao;
export const zhipu = openAICompatServicesBase.zhipu;
export const minimax = openAICompatServicesBase.minimax;
export const hunyuan = openAICompatServicesBase.hunyuan;
export const perplexity = openAICompatServicesBase.perplexity;
export const mistral = openAICompatServicesBase.mistral;
export const cohere = openAICompatServicesBase.cohere;
export const qianfan = openAICompatServicesBase.qianfan;

// Dispatch map — base services + deepseek override (with CORS error rewrite).
export const openAICompatServices: Record<OpenAICompatProviderKey, TranslationService> = {
  ...openAICompatServicesBase,
  deepseek,
};

// --- Special-case services that don't fit the OpenAI-compatible pattern ---

export const gemini: TranslationService = async (params) => {
  const { apiKey, model, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const key = requireApiKey("Gemini", apiKey);
  const effectiveModel = model || defaultConfigs.gemini.model!;

  // Gemini 3.x thinking control: `generationConfig.thinkingConfig.thinkingLevel`
  // enum (minimal/low/medium/high). Gemini is the ONLY provider whose server
  // defaults thinking ON, so for thinking-tagged models we MUST send an
  // explicit level even when the user picked Off (otherwise server keeps
  // thinking on). For a custom (unlisted) SKU we send the level ONLY on opt-in
  // (effort set) and omit otherwise — mirrors gated(): off → server default kept
  // (400-safe), on → user's call if the model rejects it.
  const generationConfig: Record<string, unknown> = {
    temperature: normalizeNumber(temperature, defaultConfigs.gemini.temperature),
  };
  // Pro-tier 3.x models accept only low/high thinking levels — "minimal" is a
  // Flash-only state (the registry audit note concedes Pro "can't fully
  // disable"). Sending "minimal" to a Pro SKU 400s its untouched DEFAULT
  // config; "low" is the lowest level Pro actually accepts.
  const disableLevel = (m: string): string => (/-pro\b|-pro-/.test(m) ? "low" : "minimal");
  if (isThinkingModel("gemini", effectiveModel)) {
    generationConfig.thinkingConfig = { thinkingLevel: reasoningEffort && reasoningEffort !== "auto" ? reasoningEffort : disableLevel(effectiveModel) };
  } else if (isCustomModel("gemini", effectiveModel) && reasoningEffort !== "auto") {
    // Custom model 3-state: default Off (undefined) → lowest accepted level;
    // effort → that level; "auto" → omit (skip thinkingConfig, follow server default).
    generationConfig.thinkingConfig = { thinkingLevel: reasoningEffort ?? disableLevel(effectiveModel) };
  }

  const data = (await fetchJSON(`https://generativelanguage.googleapis.com/v1beta/models/${effectiveModel}:generateContent?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      systemInstruction: { parts: [{ text: effectiveSystemPrompt }] },
      generationConfig,
    }),
    signal: params.signal,
  })) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } ; finishReason?: string }> };

  const candidate = data.candidates?.[0];
  // Gemini's equivalent of finish_reason==="length". Server default
  // maxOutputTokens (~8192) can overflow on long inputs. Same "max_tokens
  // reached" marker → non-retryable in retry.ts.
  if (candidate?.finishReason === "MAX_TOKENS") {
    throw new Error("Gemini response truncated — max_tokens reached. Split input into smaller chunks.");
  }
  const text = candidate?.content?.parts?.[0]?.text;
  if (typeof text !== "string") {
    throw new Error("Invalid response format from Gemini API");
  }
  return text.trim();
};

// Azure mirrors OpenAI's reasoning behavior (deployments map to GPT-5 SKUs), so it
// reuses the same `reasoningEffortOrNone` shape: gpt-5.5 / gpt-chat-latest omit→
// "medium" (ON) means a tagged deployment must send explicit "none" when off. A
// custom (unlisted) deployment instead sends the effort ONLY on opt-in and omits
// otherwise — same custom-model policy as gated() (off → 400-safe omit, on → user's
// call). (Azure is a custom service, not in OPENAI_COMPAT_KEYS, so it can't use gated.)
export const buildAzureReasoningBody = (deployment: string | undefined, reasoningEffort: ThinkingDirective | undefined): Record<string, unknown> => {
  const model = deployment || (defaultConfigs.azureopenai.model as string);
  // Tagged: 2-state (undefined → "none" disable, effort → that effort).
  if (isThinkingModel("azureopenai", model)) return reasoningEffortOrNone(reasoningEffort === "auto" ? undefined : reasoningEffort);
  // Custom deployment 3-state: "auto" → omit; default Off (undefined) → "none"; effort → that effort.
  if (isCustomModel("azureopenai", model)) {
    if (reasoningEffort === "auto") return {};
    return reasoningEffortOrNone(reasoningEffort);
  }
  return {}; // listed-but-untagged → omit
};

export const azureopenai: TranslationService = async (params) => {
  const { apiKey, url, model, apiVersion, temperature, reasoningEffort } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);
  const endpoint = requireUrl("Azure OpenAI", url);
  const deployment = model || defaultConfigs.azureopenai.model!;
  const version = apiVersion || defaultConfigs.azureopenai.apiVersion!;
  const requestUrl = `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`;

  const key = requireApiKey("Azure OpenAI", apiKey);

  // Azure deployment names mirror OpenAI model IDs; GPT-5 family supports
  // `reasoning_effort` per docs.microsoft.com/azure/.../foundry-models-sold-by-azure.
  // Orchestrator gates effort on (thinking-tagged ∧ user picked an effort).
  // No max_tokens passthrough — same rationale as openAICompatRequest above.
  const requestBody: Record<string, unknown> = {
    messages: [
      { role: "system", content: effectiveSystemPrompt },
      { role: "user", content: prompt },
    ],
    temperature: normalizeNumber(temperature, defaultConfigs.azureopenai.temperature),
    ...buildAzureReasoningBody(deployment, reasoningEffort),
  };

  const data = await fetchJSON(requestUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": key,
    },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Azure OpenAI");
};

// Yandex AI Studio — protocol-wise plain OpenAI-compat chat/completions, but a
// custom service for two reasons the factory can't express:
//   1. Model IDs are per-tenant URIs (gpt://<folder_id>/<model>/latest) assembled
//      from the dedicated `folderId` config field at request time. A full gpt://
//      URI typed into the model field passes through verbatim (power-user escape;
//      also how configs imported from the pre-folderId era keep working).
//   2. Requests route UNCONDITIONALLY through the Cloudflare relay — the upstream
//      llm.api.cloud.yandex.net sends no CORS headers (verified 2026-06: preflight
//      OPTIONS is parsed as a JSON body → 400), so browser-direct calls always
//      fail. Same always-proxy posture as Nvidia NIM's default path; no useRelay
//      toggle whose OFF state would be permanently broken.
// Pure URI assembly, exported for unit tests (same pattern as buildAzureReasoningBody).
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

export const yandex: TranslationService = async (params) => {
  const model = buildYandexModelUri(params.model, params.folderId);
  return openAICompatRequest({
    params: { ...params, model },
    serviceName: "Yandex",
    endpoint: relayUrl("yandex"),
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

  // Direct call (custom URL) vs proxy call (default Nvidia API, avoids CORS)
  const isDirectCall = !!url;
  const fetchUrl = isDirectCall ? completeOpenAICompatUrl(url) : PROXY_ENDPOINTS.nvidia;
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
  // prepended to the user message. The glossary block lives ONLY in the system
  // prompt (per-request composition in translateSingle), so dropping the
  // message entirely silently disabled the glossary's primary mechanism for
  // the exact audience the toggle exists for. undefined defaults to include
  // (pre-toggle configs).
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

export const claude: TranslationService = withRelayHint(async (params) => {
  const { apiKey, model, temperature, reasoningEffort, useRelay } = params;
  const { effectiveSystemPrompt, prompt } = preparePrompts(params);

  const key = requireApiKey("Claude", apiKey);
  const effectiveModel = model || defaultConfigs.claude.model!;
  // Claude's server default is thinking OFF, so default-Off (undefined) and "auto"
  // both = no thinking block (omitting already yields off). Only a real effort enables.
  const effort: ReasoningEffort | undefined = reasoningEffort === "auto" ? undefined : reasoningEffort;

  // Anthropic requires budget_tokens < max_tokens. When thinking is on we
  // reserve 10K for reasoning + ~6K for the visible response, so max_tokens
  // must grow. Plain (non-thinking) requests stay at the original 8096 cap.
  //
  // `system` as a block array (not a plain string) is the form that accepts
  // `cache_control` — required since Claude is the ONLY provider where prompt
  // caching is off by default. Anthropic silently no-ops the marker when the
  // prompt is below the cacheable threshold (~1024 tokens for Sonnet/Haiku,
  // 2048 for Opus), so short default prompts cost nothing extra; long custom
  // prompts (glossaries, style guides) get ~90% input discount on cache hits.
  // Doc: docs.anthropic.com/en/docs/build-with-claude/prompt-caching
  const requestBody: Record<string, unknown> = {
    model: effectiveModel,
    system: [{ type: "text", text: effectiveSystemPrompt, cache_control: { type: "ephemeral" } }],
    messages: [{ role: "user", content: prompt }],
    max_tokens: effort ? 16384 : 8096,
  };

  if (effort) {
    // Claude's "thinking level" is a token budget (integer), not enum. Map our
    // user-facing low/medium/high to concrete budgets. Per Anthropic docs
    // budget_tokens must be < max_tokens (we use 16384 above when thinking,
    // so cap budget at ~12000 to leave room for the visible response).
    const CLAUDE_BUDGET: Record<ReasoningEffort, number> = { low: 4096, medium: 10000, high: 12000 };
    requestBody.thinking = { type: "enabled", budget_tokens: CLAUDE_BUDGET[effort] };
  } else {
    requestBody.temperature = normalizeNumber(temperature, defaultConfigs.claude.temperature);
  }

  // Direct-to-Anthropic from the browser requires the explicit opt-in CORS
  // header since 2024-08 (bring-your-own-key apps). When proxied through the
  // Cloudflare relay the header is harmless but unnecessary — we keep it
  // unconditionally to avoid branching.
  const endpoint = useRelay ? relayUrl("claude") : "https://api.anthropic.com/v1/messages";

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
  return getClaudeContent(data, !!effort);
});
