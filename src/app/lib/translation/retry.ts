// Translation retry configuration and utilities

// Submodule imports (not the "@/app/lib/translation" barrel, not "@/app/utils"):
// this file must stay importable from Node (CLI/server) — the barrels carry
// "use client" / browser-only modules (file-saver) that a Node entry must not pull.
import { LLM_MODELS } from "./registry";
import { RELAY_HINT_MARKER, RELAY_BASE_INVALID_MARKER } from "./services/shared";
import { isAbortError, isCascadedAbort } from "@/app/utils/errorUtils";

// MT-categorized services that actually delegate to an LLM runtime under the
// hood (Qwen-MT → Qwen, translategemma → Gemma 3). They share LLM-style
// retry semantics: context-length errors aren't retryable, since the next
// attempt sends the same payload and hits the same limit.
const LLM_BACKED_MT_SERVICES: ReadonlySet<string> = new Set(["qwenMt", "translategemma"]);

// User-configurable defaults (in seconds for timeout)
export const DEFAULT_RETRY_COUNT = 3;
/** 逐行/逐值翻译的默认并发。引擎与 JSON 工具各有一条循环,共用这个数。 */
export const DEFAULT_BATCH_SIZE = 10;
export const DEFAULT_RETRY_TIMEOUT = 180; // seconds — covers P99 of LLM thinking + typical batches; power users bump via Advanced Settings

export interface RetryConfig {
  retries: number;
  factor: number;
  minTimeout: number;
  maxTimeout: number;
  randomize: boolean;
  shouldRetry?: (params: { error: unknown }) => boolean;
}

export interface UserRetryConfig {
  retryCount?: number;
  requestTimeoutSec?: number; // per-request timeout, in seconds
}

// Extract status and message from error once, reuse across checks
const getErrorInfo = (error: unknown): { status: number | undefined; message: string } => ({
  status: (error as { status?: number })?.status,
  message: ((error as Error)?.message || "").toLowerCase(),
});

/**
 * Check if error is a non-retryable authentication/authorization error
 * Exported for use in abort logic
 */
export const isAuthError = (error: unknown): boolean => {
  const { status, message } = getErrorInfo(error);
  if (status === 401 || status === 403) return true;
  return message.includes("unauthorized") || message.includes("invalid api key") || message.includes("authentication") || message.includes("forbidden");
};

/**
 * 凭据【确定】失效 —— 只认协议事实(HTTP 401/403),不认消息文本。
 *
 * isAuthError 比它宽:为了兜住不返回 status 的 provider,它还匹配消息子串
 * ("unauthorized" / "forbidden" …)。那对"这一行别重试"来说够用 —— 猜错的代价
 * 是少重试一行。但用来决定【整轮生死】就不成比例了:Cloudflare 的机器人挑战页、
 * 公司代理的错误页、provider 返回 200 但正文是 HTML —— 正文里出现一个
 * "Forbidden" 就会让 10 个文件的批量任务在第 3 个上提前终止,后面 7 个零请求。
 *
 * 两种错误的代价不对称,所以两个判据分开:
 *   · 该停没停 = 多打几轮注定失败的请求,用户看失败面板点重试即可(而且现在
 *     那些轮次会被正确记账,不再静默丢结果);
 *   · 不该停停了 = 一次瞬时故障让整批提前结束,用户得从头再来。
 * 用协议事实控整轮,用宽判据控单行。
 */
export const isDefiniteAuthFailure = (error: unknown): boolean => {
  const { status } = getErrorInfo(error);
  return status === 401 || status === 403;
};

/**
 * Errors that retrying won't fix — bail out immediately so the user isn't stuck
 * at 0% for 30-60s of doomed retries. These are thrown by service layers when the
 * next attempt will fail the same way — notably the shared CORS → "enable API
 * Relay" rewrite (withRelayHint in services/llm.ts), which fires for EVERY
 * relay-capable provider (not just DeepSeek) on a network/CORS TypeError with
 * relay off. The relay entry derives from RELAY_HINT_MARKER (services/shared.ts)
 * — the same constant embedded in every relay-remediation message — so rewording
 * a message can't silently break this classification. The Chinese entry is a
 * redundant second net over the same messages' zh half.
 *
 * "max_tokens reached" is the marker getOpenAICompatContent throws when a
 * response has finish_reason==="length" — same input + same max_tokens
 * truncates at the same boundary every time, so retries are pure waste.
 */
const NON_RETRYABLE_MESSAGES = [RELAY_HINT_MARKER.toLowerCase(), "请在 api 设置中开启", "max_tokens reached", RELAY_BASE_INVALID_MARKER.toLowerCase()];

/**
 * Check if error is retryable (server errors or rate limits).
 *
 * Also drives the translator's pre-flight reachability gate: the gate hard-blocks
 * a translation only when this returns false (auth / CORS-needs-relay / aborts /
 * other definitively-unrecoverable), and otherwise lets the resilient per-line
 * pRetry + soft-fail handle it — so a single-shot probe is never stricter than
 * the translation it guards.
 */
export const isRetryableError = (error: unknown): boolean => {
  if (isAuthError(error)) return false;
  // Aborts are non-recoverable by retry:
  //   - AbortError: per-request timeout fired (createTimeoutController's
  //     setTimeout → controller.abort). Next attempt has its own fresh
  //     timeout but will hit the same upstream slowness — at 180s × 3
  //     attempts that's 9 minutes of dead waiting before the user sees
  //     anything. Fast-fail instead.
  //   - "Translation aborted": shared abortControllerRef tripped (auth error
  //     in a peer). pRetry's pre-attempt guard would re-throw the same
  //     message — pointless retry loop.
  if (isAbortError(error) || isCascadedAbort(error)) return false;
  const { status, message } = getErrorInfo(error);
  if (NON_RETRYABLE_MESSAGES.some((m) => message.includes(m))) return false;
  // 408 (Request Timeout) and 425 (Too Early) are the two canonical RETRYABLE
  // 4xx statuses — proxies/load-balancers emit them for transient conditions.
  // Without these, the .status hardening (fetchJSON now attaches status) would
  // over-reach and fast-fail recoverable blips that used to be retried.
  return !status || status >= 500 || status === 429 || status === 408 || status === 425;
};

/**
 * Get optimized retry configuration based on translation method
 * Note: Request timeout is handled separately via AbortController in useTranslationState
 * These minTimeout/maxTimeout are for RETRY INTERVALS, not request timeout
 * @param translationMethod - The translation API method
 * @param userConfig - Optional user-defined retry count
 */
export const getRetryConfig = (translationMethod: string, userConfig?: UserRetryConfig): RetryConfig => {
  const userRetries = userConfig?.retryCount ?? DEFAULT_RETRY_COUNT;

  const baseConfig: RetryConfig = {
    retries: userRetries,
    factor: 2,
    minTimeout: 1000, // 1s minimum wait between retries
    maxTimeout: 30000, // 30s maximum wait between retries
    randomize: true,
    shouldRetry: ({ error }) => isRetryableError(error),
  };

  if (translationMethod === "gtxFreeAPI") {
    return { ...baseConfig, minTimeout: 2000, maxTimeout: 60000 };
  }

  if (LLM_MODELS.includes(translationMethod) || LLM_BACKED_MT_SERVICES.has(translationMethod)) {
    return {
      ...baseConfig,
      shouldRetry: ({ error }: { error: unknown }) => {
        const { message } = getErrorInfo(error);
        if (message.includes("context length") || message.includes("token limit")) return false;
        return isRetryableError(error);
      },
    };
  }

  return baseConfig;
};

/**
 * setTimeout 的延时是 32 位有符号毫秒:超过 2^31-1(约 24.8 天)会【溢出成 1ms】
 * 并打一条 TimeoutOverflowWarning。delayTime 的 UI 只有 min 没有 max、
 * sanitizeSettings 的上界也有意是 Infinity,所以用户填个 3000000000 是够得着的
 * —— 那一刻每个行间/批间暂停全部消失,整轮以满并发打向那个【本来正是要限速的】
 * provider,换回一批 429 软失败。夹到上限而不是丢弃:用户的意图是"尽量慢",
 * 给他能表达的最慢值,比悄悄退回默认间隔更接近他要的东西。
 */
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

/**
 * Delay helper function
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, Math.min(ms, MAX_TIMEOUT_MS)));
};

/**
 * 可被 run signal 提前叫醒的 sleep。取消的响应速度取决于最长的不可中断等待:
 * 自动重试的 10s 喘息、用户自配的 delayTime(无上限)都坐在翻译循环里,
 * 裸 delay 会让取消按钮干转到睡满为止。
 * 叫醒时【resolve 而非 reject】:每个调用点的下一行本就是 signal 检查/入口守卫,
 * 由它们决定退出路径;在这里 reject 反而多一条要处理的异常形态。
 * (translateLines 线路径的 delayTime 节流直接依赖这一条:它睡在【译文已写入
 * 槽位之后】的任务内,reject 会让 Promise.all 把一批成功翻译整体打成异常。)
 *
 * 同 delay:夹到 setTimeout 的 32 位上限,详见 MAX_TIMEOUT_MS。
 */
export const abortableSleep = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve) => {
    if (signal?.aborted) return resolve();
    const timer = setTimeout(done, Math.min(ms, MAX_TIMEOUT_MS));
    function done() {
      signal?.removeEventListener("abort", done);
      clearTimeout(timer);
      resolve();
    }
    signal?.addEventListener("abort", done, { once: true });
  });

// ─── Shared 429 cooldown gate ────────────────────────────────────────────────
// Per-method, module-level: when any request hits 429, ALL of that method's
// queued lines + in-flight retries pause until the cooldown ends — instead of
// 100 concurrent lines each retrying on independent pRetry schedules (a
// thundering herd that keeps the provider rate-limiting until every line's
// retry budget burns out). This is what lets gtxFreeAPI keep its fast
// batchSize=100 default: full speed while the provider allows it, automatic
// duty-cycling the moment it doesn't.
//
// Escalation: a burst that starts within ESCALATION_WINDOW of the previous
// cooldown's END means the provider is still limiting → double the cooldown
// (1s → 2s → … → 60s cap); a burst long after resets to base. Within-burst
// trips (the 100 concurrent 429s that arrive together) neither extend nor
// escalate — see trip(). A server-sent Retry-After overrides the heuristic.
// Module-level (session-scoped) by design: rate-limit state IS cross-run
// reality, a new run against a still-limited provider should start slow.
type GateState = { until: number; cooldownMs: number };
const gateStates = new Map<string, GateState>();

// 业界惯例对齐(Google API client / AWS SDK / OpenAI cookbook):base ~1s、
// factor 2、cap 60s、优先尊重 Retry-After。1s 起步 = 快速试探恢复;真没
// 恢复会沿 1→2→4→…→60s 自动爬升,不会反复轰炸。
export const RATE_LIMIT_BASE_COOLDOWN_MS = 1_000;
export const RATE_LIMIT_MAX_COOLDOWN_MS = 60_000;
const ESCALATION_WINDOW_MS = 30_000;
// 放行抖动:冷却结束时所有等待者若同刻恢复,等于再来一次满并发突发,大概率
// 立刻二次 429。每个等待者随机多等 0–1s,把恢复瞬间摊开(AWS "full jitter"
// 的同款动机,作用在共享闸的出口侧)。冷却期外到达的请求不付此开销。
export const RATE_LIMIT_RESUME_JITTER_MS = 1_000;

// Same rejection message as the run-abort path ("Translation aborted") so the
// existing classification chain (isCascadedAbort → silent, non-retryable)
// handles a mid-wait cancel without new plumbing.
const abortableDelay = (ms: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error("Translation aborted"));
    const onAbort = () => {
      clearTimeout(timer);
      reject(new Error("Translation aborted"));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    signal?.addEventListener("abort", onAbort, { once: true });
  });

export const rateLimitGate = {
  /**
   * Block until the method's active cooldown (if any) has passed. Loops after
   * waking: a fresh burst can start a NEW cooldown between this waiter's
   * wake-up and its dispatch. Rejects with "Translation aborted" when the
   * run's signal fires mid-wait.
   */
  async wait(method: string, signal?: AbortSignal): Promise<void> {
    for (;;) {
      const remaining = (gateStates.get(method)?.until ?? 0) - Date.now();
      if (remaining <= 0) return;
      await abortableDelay(remaining + Math.random() * RATE_LIMIT_RESUME_JITTER_MS, signal);
    }
  },

  /**
   * Record a 429. Returns true when this call STARTED a cooldown — callers can
   * surface ONE user-facing notice per burst. Returns false for within-burst
   * duplicates (concurrent 429s landing while already cooling down): counting
   * those would escalate base × 2^100 on the first burst.
   */
  trip(method: string, retryAfterMs?: number): boolean {
    const now = Date.now();
    const prev = gateStates.get(method);
    if (prev && now < prev.until) return false;
    // 升级【不得缩短】上一次的冷却。RATE_LIMIT_MAX_COOLDOWN_MS 是我们自己
    // 递增阶梯的天花板(1s→2s→…→60s),不是给服务器指令封顶用的:上一次冷却
    // 若来自 `Retry-After: 120`,裸 Math.min 会把「升级后」算成 60s —— 客户端
    // 以一半的间隔反复去撞一个明确说了要等两分钟的 provider,在严格 provider
    // 或共享免费端点上只会延长/加重限流,本轮软失败的行反而更多。
    // 外层 Math.max 只在 prev 超过天花板时起作用(即只可能由 Retry-After 造成),
    // 常规阶梯 1→2→4→…→60 完全不受影响。
    const escalated = prev && now - prev.until < ESCALATION_WINDOW_MS ? Math.max(prev.cooldownMs, Math.min(prev.cooldownMs * 2, RATE_LIMIT_MAX_COOLDOWN_MS)) : RATE_LIMIT_BASE_COOLDOWN_MS;
    const cooldownMs = retryAfterMs ?? escalated;
    gateStates.set(method, { until: now + cooldownMs, cooldownMs });
    return true;
  },

  /** Test hook — clears all cooldown state. */
  _reset(): void {
    gateStates.clear();
  },
};
