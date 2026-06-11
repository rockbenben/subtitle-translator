// Translation retry configuration and utilities

import { LLM_MODELS } from "@/app/lib/translation";
import { isAbortError, isCascadedAbort } from "@/app/utils";

// MT-categorized services that actually delegate to an LLM runtime under the
// hood (Qwen-MT → Qwen, translategemma → Gemma 3). They share LLM-style
// retry semantics: context-length errors aren't retryable, since the next
// attempt sends the same payload and hits the same limit.
const LLM_BACKED_MT_SERVICES: ReadonlySet<string> = new Set(["qwenMt", "translategemma"]);

// User-configurable defaults (in seconds for timeout)
export const DEFAULT_RETRY_COUNT = 3;
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
 * Errors that retrying won't fix — bail out immediately so the user isn't stuck
 * at 0% for 30-60s of doomed retries. These are thrown by service layers when the
 * next attempt will fail the same way — notably the shared CORS → "enable API
 * Relay" rewrite (withRelayHint in services/llm.ts), which now fires for EVERY
 * relay-capable provider (not just DeepSeek) on a `Failed to fetch` with relay
 * off. The "enable 'api relay'" marker below is what classifies them as
 * non-retryable, so a doomed CORS error never burns 3 retries.
 *
 * "max_tokens reached" is the marker getOpenAICompatContent throws when a
 * response has finish_reason==="length" — same input + same max_tokens
 * truncates at the same boundary every time, so retries are pure waste.
 */
const NON_RETRYABLE_MESSAGES = ["enable 'api relay'", "请在 api 设置中开启", "max_tokens reached"];

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
 * Delay helper function
 */
export const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

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
    const escalated = prev && now - prev.until < ESCALATION_WINDOW_MS ? Math.min(prev.cooldownMs * 2, RATE_LIMIT_MAX_COOLDOWN_MS) : RATE_LIMIT_BASE_COOLDOWN_MS;
    const cooldownMs = retryAfterMs ?? escalated;
    gateStates.set(method, { until: now + cooldownMs, cooldownMs });
    return true;
  },

  /** Test hook — clears all cooldown state. */
  _reset(): void {
    gateStates.clear();
  },
};
