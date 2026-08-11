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
export const useLocalApi = process.env.NODE_ENV === "development" || process.env.NEXT_PUBLIC_USE_LOCAL_API === "true";

// Cloudflare Worker that proxies all OpenAI-compatible providers + Claude,
// strips CORS, forwards Authorization/x-api-key/anthropic-version headers, and
// routes by provider name under /api/{provider}. Users toggle this via the
// per-provider "useRelay" switch in API Settings when the browser can't reach
// the upstream directly.
export const LLM_RELAY_BASE = "https://llm-proxy.api2026.workers.dev";

/**
 * Build the relay URL for a provider key (e.g. `relayUrl("openai")`).
 *
 * `base` is the user's own relay, empty/absent = the built-in one. Only the
 * ORIGIN is user-supplied — the `/api/{provider}` path is a protocol contract
 * between this client and scripts/llm-proxy-worker.js, so a self-hosted relay
 * is a deploy of that same Worker source, not an arbitrary endpoint. That's
 * exactly what makes ONE base cover every relay provider at once; per-provider
 * endpoints that don't follow the contract belong in the custom-URL field,
 * which outranks the relay entirely.
 */
export const relayUrl = (provider: string, base?: string): string => {
  // 【拼接必须用 normalizeRelayBase 的产物,不能用原始串】—— 校验与拼接必须对
  // 同一个输入有同一种理解,否则界面绿灯而运行时打错地方。
  // (历史:带 `?token=` 的 base 曾经【通过】校验,裸拼得到
  // `…?token=abc/api/openai`,整个 /api/{provider} 落进查询串、fetch 打到根路径,
  // Worker 对每个 provider 都回 400。现在 normalizeRelayBase 直接拒掉带
  // search/hash 的 base,那条路走不到了 —— 但"用产物拼"这条纪律仍然要守:
  // 下一个被加进 normalizeRelayBase 的规范化步骤同样得作用于拼接。)
  const trimmed = base?.trim();
  if (!trimmed) return `${LLM_RELAY_BASE}/api/${provider}`;
  const normalized = normalizeRelayBase(trimmed);
  // ⚠ 【非空但不合法 ≠ 没填】,绝不静默回落到内置中转。这个字段决定 apiKey
  // 发到【哪台机器】:自建中转的用户填错(把 base 写成 `…/api`、漏掉 scheme)
  // 时若回落,他的 key 就被送到他正要避开的那台公共 Worker 上,而翻译照常成功
  // ——唯一的信号是折叠抽屉里一个红框。宁可整轮翻译失败也不能悄悄换目的地。
  // 空串是另一回事:那是"用内置中转"的正常表达,上面已直接回落。
  if (!normalized) {
    throw new Error(`${RELAY_BASE_INVALID_MARKER}: ${trimmed} — fix it in API Settings, or clear it to use the built-in relay`);
  }
  return `${normalized}/api/${provider}`;
};

/**
 * 中转地址不合法的分类标记 —— 同 RELAY_HINT_MARKER 的用法:消息里嵌它,
 * retry.ts 的 NON_RETRYABLE_MESSAGES 引它,改措辞不会静默破坏分类。
 *
 * 必须【不可重试】:这是配置错误,不是瞬时故障。下一次尝试读的是同一个
 * localStorage 值,必然同样失败 —— 不标的话(错误无 status → isRetryableError
 * 的 `!status` 判真)每一行都会烧满重试预算,几百行的文件要转很久才报出
 * 一个用户改一下输入框就能解决的问题。
 */
export const RELAY_BASE_INVALID_MARKER = "relay base is not a usable http(s) origin";

/**
 * 把用户填的 relay base 规范化成 `origin + pathname`(去尾斜杠);不合法返回
 * undefined。
 *
 * 带 search/hash 的一律【拒绝】,不是静默丢弃。relayUrl 要在 base 后面接
 * `/api/{provider}`,查询串会把那个路径段吞掉,所以它在这个位置确实没有意义 ——
 * 但"没有意义"不等于"可以当它不存在":`https://gw.example.com/relay/?k=SECRET`
 * 正是带共享密钥的自建 Worker 的典型形状,悄悄抹掉 `?k=` 之后请求会打到用户
 * 自己的机器上却【没有那把钥匙】,一路 401/403,整份文档软失败进面板报一堆
 * 原始 HTTP 错误,而设置界面上那行 URL 连同 token 还原样显示着 —— 屏幕上没有
 * 任何东西指向真正的原因。拒绝掉,红框当场说清楚。
 */
const normalizeRelayBase = (base: string): string | undefined => {
  const cleaned = base.trim();
  if (!cleaned) return undefined;
  let parsed: URL;
  try {
    parsed = new URL(cleaned);
  } catch {
    return undefined;
  }
  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return undefined;
  if (parsed.search || parsed.hash) return undefined;
  const path = parsed.pathname.replace(/\/+$/, "");
  // base 不是 endpoint:relayUrl 会自己拼 /api/{provider}(理由见 isValidRelayBase)。
  if (/\/api(\/|$)/.test(path)) return undefined;
  return `${parsed.origin}${path}`;
};

/**
 * relayBase 【能不能用】—— 运行时(relayUrl 拼不出地址就抛)与 UI 即时校验
 * (TranslationSettings 的红框)共用这一条,两者必须同判据,否则界面绿灯而
 * 运行时报错。
 *
 * ⚠ 设置导入(sanitizeSettings)【不用】它,用的是 isSafeRelayBaseProtocol ——
 * 那里问的是另一个问题「能不能收进设置」,只看协议安全。理由见那个函数的注释:
 * 按"能不能用"丢字段会把 `…/relay/?k=SECRET` 这类合法自建地址静默删掉,而同
 * 一份文件里的 useRelay 与 apiKey 照常导入,key 就去了内置公共中转。
 *
 * 只放行可解析的 http(s):裸域名会变成打向本站的相对路径(见 relayUrl),
 * javascript:/data: 则是注入面 —— 而这个字段决定 apiKey 发到哪台机器,
 * 所以三个入口不能各写一半。空串【不算非法】,它是"用内置中转"的正常表达,
 * 由调用方各自处理(relayUrl 回落、sanitize 保留、UI 不报错)。
 *
 * 实现直接复用 normalizeRelayBase,于是【校验通过 ⇔ 拼得出地址】恒成立。
 * 分成两份写过一次:那时校验看解析后的 URL、拼接用原始串,`?token=abc` 校验
 * 绿灯却拼出 `…?token=abc/api/openai`(路径段被查询串吞掉)。
 */
export const isValidRelayBase = (base: string): boolean => normalizeRelayBase(base) !== undefined;

/**
 * 只问一件事:这个值【危险】吗 —— 即它会不会把 apiKey 送到 http(s) 之外的地方。
 *
 * 与 isValidRelayBase 分开,因为两者服务于不同的判断:
 *   · isValidRelayBase = "能不能用"(还要求无查询串、不是 /api 端点)——
 *     驱动 UI 红框与运行时抛错,用户看得见、改得动。
 *   · 本函数 = "能不能收进设置"—— sanitizeSettings 用它决定是否【丢字段】。
 * 只按前者丢字段会造成一个更糟的洞:分享来的设置里 `…/relay/?k=SECRET` 这种
 * 合法自建地址被静默删掉,而同一份文件里的 useRelay:true 和 apiKey 照常导入 ——
 * 接收方看到绿色"导入成功",之后每次翻译都把 key 发到内置公共中转。
 * 保留它:红框会说地址不可用,运行时也会抛,两处都看得见;而 javascript:/data:
 * 这类真正危险的值仍然被丢掉。
 */
export const isSafeRelayBaseProtocol = (base: string): boolean => {
  try {
    const { protocol } = new URL(base.trim());
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
};

// Third-party proxy services (community-maintained endpoints)
// These are external proxy/relay services that provide:
//   - Free or alternative access to paid APIs
//   - CORS-friendly endpoints for browser-based applications
//   - Regional access optimization or rate limit workarounds
export const THIRD_PARTY_ENDPOINTS = {
  deeplx: "https://deeplx-serverless.api2026.workers.dev/translate",
} as const;

// Proxy endpoints for services that need CORS bypass
// These services are proxied through Next.js API routes (dev) or EdgeOne (prod)
// Used when:
//   - Official APIs have CORS restrictions in browser environments
//   - Need server-side API key handling for security
//   - Static export deployment requires edge function proxies
export const PROXY_ENDPOINTS = {
  deepl: useLocalApi ? "/api/deepl" : "https://api-edgeone.newzone.top/api/deepl",
  nvidia: useLocalApi ? "/api/nvidia" : "https://api-edgeone.newzone.top/api/nvidia",
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
 *   2. useRelay ON, no URL → a relay: the user's `relayBase` if they set one,
 *                            otherwise the built-in LLM_RELAY_BASE
 *   3. otherwise           → the official direct endpoint
 *
 * Tiers 1 and 2 are both "somewhere other than the vendor", but they are NOT
 * redundant: the custom URL is one provider's full endpoint and bypasses the
 * relay contract, while relayBase swaps the relay host for EVERY provider at
 * once and keeps the /api/{provider} routing. Hence custom URL still wins —
 * it's the more specific statement.
 */
export const resolveRelayableEndpoint = (relayKey: string, opts: { customUrl?: string; useRelay?: boolean; relayBase?: string; direct: string; normalize?: (url: string) => string }): string => {
  const customUrl = opts.customUrl?.trim();
  if (customUrl) return (opts.normalize ?? completeOpenAICompatUrl)(customUrl);
  if (opts.useRelay) return relayUrl(relayKey, opts.relayBase);
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
    // (lib/translation/retry.ts) waits exactly as told instead of guessing.
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
  // Always locate the text block by type rather than by position: thinking
  // responses lead with thinking blocks, and adaptive-thinking models don't
  // guarantee block order — positional [0] is only safe on plain responses.
  const textBlock = contentArray.find((block) => block.type === "text");
  if (!textBlock || typeof textBlock.text !== "string") {
    throw new Error("Invalid response format from Claude API (no text block found)");
  }
  return textBlock.text.trim();
};
