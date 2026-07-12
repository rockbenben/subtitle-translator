// ============================================================================
// Endpoint configuration & URL resolution
//
// The editable hosts a fork / self-hoster repoints live at the TOP of this block
// (LLM_RELAY_BASE, THIRD_PARTY_ENDPOINTS, PROXY_ENDPOINTS) — change one there and
// every service picks it up. BELOW them sit the helpers that turn a raw/partial
// user-supplied URL into the address actually fetched (relayUrl,
// completeOpenAICompatUrl, resolveRelayableEndpoint). Ordered so each line only
// depends on what's above it: env flag → relay base + builder → endpoint maps →
// URL-completion helper → the precedence rule that ties them together.
// ============================================================================

// Use local API for: dev mode OR Docker (USE_LOCAL_API=true)
// Use remote API for: static export (production without USE_LOCAL_API)
export const useLocalApi = true;

// Cloudflare Worker that proxies all OpenAI-compatible providers + Claude,
// strips CORS, forwards Authorization/x-api-key/anthropic-version headers, and
// routes by provider name under /api/{provider}. Users toggle this via the
// per-provider "useRelay" switch in API Settings when the browser can't reach
// the upstream directly.
export const LLM_RELAY_BASE = "https://llm-proxy.api2026.workers.dev";

/** Build the relay URL for a given provider key (e.g. `relayUrl("openai")`). */
export const relayUrl = (provider: string): string => `${LLM_RELAY_BASE}/api/${provider}`;

// Third-party proxy services (community-maintained endpoints)
// These are external proxy/relay services that provide:
//   - Free or alternative access to paid APIs
//   - CORS-friendly endpoints for browser-based applications
//   - Regional access optimization or rate limit workarounds
export const THIRD_PARTY_ENDPOINTS = {
  deeplx: "https://deeplx-serverless.api2026.workers.dev/translate",
  deepseekRelay: relayUrl("deepseek"),
} as const;

// Proxy endpoints for services that need CORS bypass
// These services are proxied through Next.js API routes (dev) or EdgeOne (prod)
// Used when:
//   - Official APIs have CORS restrictions in browser environments
//   - Need server-side API key handling for security
//   - Static export deployment requires edge function proxies
export const PROXY_ENDPOINTS = {
  deepl: "https://api-free.deepl.com/v2/translate",
  nvidia: "https://integrate.api.nvidia.com/v1/chat/completions",
} as const;

/**
 * Auto-complete a user-supplied OpenAI-compatible URL to its full
 * /v1/chat/completions endpoint. Handles common copy-paste shortcuts AND
 * fixes the two wrong-endpoint mistakes users commonly make:
 *   http://host:port            → http://host:port/v1/chat/completions
 *   http://host:port/v1         → http://host:port/v1/chat/completions
 *   http://host:port/v1/responses    → http://host:port/v1/chat/completions
 *     (Responses API, 2025 — different request shape, would 400)
 *   http://host:port/v1/completions  → http://host:port/v1/chat/completions
 *     (legacy text-completion API — takes 'prompt', not 'messages', 400s)
 * URLs that already end with /chat/completions or have a non-standard path
 * (Fireworks /inference/v1, custom proxies, etc.) are returned unchanged —
 * those users know what they're doing.
 */
export const completeOpenAICompatUrl = (url: string): string => {
  const cleaned = url.trim().replace(/\/+$/, "");
  if (!cleaned) return cleaned;
  if (cleaned.endsWith("/chat/completions")) return cleaned;
  // Rewrite OpenAI's other top-level endpoints (Responses / legacy completions)
  // to chat/completions. Strict /v\d+/ prefix so we don't mangle custom paths
  // like /custom/responses that happen to end the same way.
  if (/\/v\d+\/(responses|completions)$/.test(cleaned)) {
    return cleaned.replace(/\/(responses|completions)$/, "/chat/completions");
  }
  if (/\/v\d+$/.test(cleaned)) return `${cleaned}/chat/completions`;
  try {
    const parsed = new URL(cleaned);
    if (parsed.pathname === "" || parsed.pathname === "/") {
      return `${cleaned}/v1/chat/completions`;
    }
  } catch {
    // Invalid URL — leave alone, requireUrl/fetch will throw a clearer error
  }
  return cleaned;
};

/**
 * THE endpoint precedence for every relay-capable service — single
 * implementation, consumed by the openai-compat factory (resolveEndpoint)
 * and the custom claude / yandex services:
 *   1. custom URL set      → use it (self-hosted relay or alternate direct
 *                            endpoint), normalized by `normalize`
 *   2. useRelay ON, no URL → the shared Cloudflare relay (LLM_RELAY_BASE)
 *   3. otherwise           → the official direct endpoint
 */
export const resolveRelayableEndpoint = (relayKey: string, opts: { customUrl?: string; useRelay?: boolean; direct: string; normalize?: (url: string) => string }): string => {
  const customUrl = opts.customUrl?.trim();
  if (customUrl) return (opts.normalize ?? completeOpenAICompatUrl)(customUrl);
  if (opts.useRelay) return relayUrl(relayKey);
  return opts.direct;
};

// ============================================================================
// Relay-hint error markers
// ============================================================================

/**
 * The marker substring retry.ts keys on to classify a relay-remediation error
 * as NON-retryable (a doomed CORS error must not burn 3 retries). Single source
 * of truth: every message that should get that classification embeds this
 * marker (RELAY_HINT_MESSAGE below + the DeepSeek 403 rewrite in llm.ts) —
 * rewording a message can't silently break the classification.
 */
export const RELAY_HINT_MARKER = "enable 'API Relay'";

// Browser-direct calls to a relay-capable provider hit the CORS wall as a raw
// `TypeError` (no status). withRelayHint (llm.ts) rewrites it into this message
// AND attaches `errorHintKey: "errorHintRelay"` — the display layer
// (describeError) swaps the message for the localized common.errorHintRelay
// text, so this English form only reaches console logs / non-UI consumers.
export const RELAY_HINT_MESSAGE = `Network error (possibly CORS). Please ${RELAY_HINT_MARKER} in API Settings.`;

// ============================================================================
// Config value normalization & required-field validation
// ============================================================================

export const normalizePrompt = (value: string | undefined, fallback: string): string => (typeof value === "string" && value.trim() ? value : fallback);

export const normalizeNumber = (value: unknown, fallback: number | undefined): number => {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : (fallback ?? 0);
};

export const requireApiKey = (serviceName: string, apiKey: string | undefined): string => {
  const key = apiKey?.trim();
  if (!key) {
    throw new Error(`${serviceName} API Key is required`);
  }
  return key;
};

export const requireUrl = (serviceName: string, url: string | undefined): string => {
  const endpoint = url?.trim().replace(/\/+$/, "");
  if (!endpoint) {
    throw new Error(`${serviceName} endpoint URL is required`);
  }
  return endpoint;
};

// ============================================================================
// HTTP requests & error handling
// ============================================================================

// 注意:这里【不再】拼接用户提示文案。每个状态码代表的可行动问题由展示层
// 的 describeError(utils/errorUtils.ts)按错误对象的 .status 查 i18n 键
// (common.errorHint*)生成 —— 纯 TS 的 service 层拿不到 locale,文案烤进
// message 只能双语硬编码,搬到显示侧后 18 语种全覆盖。本函数只负责把
// 响应体里的真实错误信息提炼成 `[status] message` 形态。
export const formatHttpError = (data: unknown, status: number): string => {
  const obj = data as Record<string, unknown> | null;
  const errorObj = obj?.error as Record<string, unknown> | string | undefined;

  // Nested: { error: { message: "...", code: 123 } }
  if (errorObj && typeof errorObj === "object") {
    const msg = errorObj.message;
    const code = (typeof errorObj.code === "number" ? errorObj.code : null) ?? status;
    if (typeof msg === "string" && msg.trim()) {
      return `[${code}] ${msg}`;
    }
  }

  // Top-level: { error: "..." } or { message: "..." }
  const topLevel = (typeof errorObj === "string" ? errorObj : null) ?? (typeof obj?.message === "string" ? (obj.message as string) : null);
  if (topLevel?.trim()) {
    return `[${status}] ${topLevel}`;
  }

  return `HTTP error! status: ${status}`;
};

/**
 * Parse a Retry-After header (delta-seconds or HTTP-date form) to milliseconds.
 * Returns undefined for absent/unparsable/non-positive values. Clamped to 120s —
 * a buggy or hostile header must not park the cooldown gate for hours.
 */
export const parseRetryAfterMs = (header: string | null): number | undefined => {
  if (!header) return undefined;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : new Date(header).getTime() - Date.now();
  if (!Number.isFinite(ms) || ms <= 0) return undefined;
  return Math.min(ms, 120_000);
};

/**
 * fetch + JSON parse + ok-check in one call. On non-ok, throws an Error built
 * by formatHttpError (defensively catches JSON parse failures on the error
 * path so a non-JSON error body still produces a clean status-based message).
 */
export const fetchJSON = async (url: string, init?: RequestInit): Promise<unknown> => {
  const response = await fetch(url, init);
  if (!response.ok) {
    const data = await response.json().catch(() => null);
    // Attach the HTTP status as a property: retry.ts's classification reads
    // `(error as {status}).status` — without this, isAuthError's 401/403 branch
    // and isRetryableError's `status >= 500 || status === 429` rule NEVER
    // execute in production (only tests fabricated .status), so a relay-forwarded
    // Yandex 401 ("Unauthenticated"/"Unknown api key" — no keyword match) evaded
    // the auth-abort cascade and a deterministic 400 (bad folderId → invalid
    // model URI) burned the full retry budget on every batch.
    const error = Object.assign(new Error(formatHttpError(data, response.status)), { status: response.status });
    // 429: surface the server's own Retry-After so the shared cooldown gate
    // (hooks/translation/retry.ts) waits exactly as told instead of guessing.
    if (response.status === 429) {
      const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
      if (retryAfterMs !== undefined) Object.assign(error, { retryAfterMs });
    }
    throw error;
  }
  return response.json();
};

// ============================================================================
// Response content extraction
// ============================================================================

// Intrinsic-reasoning models (Perplexity sonar-reasoning-pro, DeepSeek-R1-style
// SKUs on aggregators/self-hosted) inline their chain-of-thought as a leading
// <think>…</think> block INSIDE message.content. That's reasoning, not
// translation — without stripping, paragraphs of English CoT ship as the
// translated line and get persisted in the cache. Anchored to the start so a
// legitimate literal "<think>" later in translated text is never touched.
const LEADING_THINK_BLOCK_RE = /^\s*<think>[\s\S]*?<\/think>\s*/i;

export const getOpenAICompatContent = (data: unknown, serviceName: string): string => {
  const choice = (data as { choices?: Array<{ message?: { content?: string }; finish_reason?: string }> } | null)?.choices?.[0];
  const content = choice?.message?.content;
  if (typeof content !== "string") {
    throw new Error(`Invalid response format from ${serviceName} API`);
  }
  // finish_reason==="length" = truncated at max_tokens. content is a half
  // translation; returning it would silently poison the cache. Throw with
  // "max_tokens reached" marker → retry.ts treats it as non-retryable.
  if (choice?.finish_reason === "length") {
    throw new Error(`${serviceName} response truncated — max_tokens reached. Raise maxTokens or split input.`);
  }
  return content.replace(LEADING_THINK_BLOCK_RE, "").trim();
};

export const getClaudeContent = (data: unknown): string => {
  const response = data as { content?: Array<{ type?: string; text?: string }>; stop_reason?: string } | null;
  const contentArray = response?.content;
  if (!Array.isArray(contentArray) || contentArray.length === 0) {
    throw new Error("Invalid response format from Claude API");
  }
  // Anthropic's equivalent of finish_reason==="length". Claude's max_tokens is
  // hardcoded in the service (Anthropic API requires it); long inputs can still
  // overflow. Same "max_tokens reached" marker → non-retryable in retry.ts.
  if (response?.stop_reason === "max_tokens") {
    throw new Error("Claude response truncated — max_tokens reached. Split input into smaller chunks.");
  }
  // Always locate the text block by type: thinking/adaptive responses can lead
  // with non-text blocks and do not guarantee positional ordering.
  const textBlock = contentArray.find((block) => block.type === "text");
  if (!textBlock || typeof textBlock.text !== "string") {
    throw new Error("Invalid response format from Claude API (no text block found)");
  }
  return textBlock.text.trim();
};
