// HTTP status → common 命名空间里的提示键。服务层(纯 TS,拿不到 locale)只
// 负责在错误上附着 .status(fetchJSON / gtxFreeAPI 已做);展示层经
// describeError 把它翻成当前语言的可行动提示 —— 这是错误提示走 i18n 的
// 关键分界:文案不在 throw 时烤进 message,而在显示时查表。
const STATUS_HINT_KEYS: Record<number, string> = {
  400: "errorHint400",
  401: "errorHint401",
  402: "errorHint402",
  403: "errorHint403",
  404: "errorHint404",
  408: "errorHint408",
  413: "errorHint413",
  422: "errorHint422",
  429: "errorHint429",
  456: "errorHint456",
};

/**
 * common 命名空间提示键。覆盖三类:HTTP status(按映射表 + 5xx 兜底)、
 * 浏览器网络错误(无 status 的 fetch TypeError → 复用既有 networkUnavailable
 * 键)、超时中止(AbortError → translationTimeout)。全部经同一张表维护,
 * 无映射 → null。
 */
export const getErrorHintKey = (error: unknown): string | null => {
  const status = (error as { status?: number } | null)?.status;
  if (typeof status === "number") {
    return STATUS_HINT_KEYS[status] ?? (status >= 500 && status < 600 ? "errorHint5xx" : null);
  }
  if (isNetworkError(error)) return "networkUnavailable";
  if (isAbortError(error)) return "translationTimeout";
  return null;
};

// 提示是否【替代】原始 message 而非追加:浏览器网络/中止错误的原文
// ("Failed to fetch"/"Load failed"/"The operation was aborted")是各浏览器
// 各语言的黑话,对用户零信息量 —— 只显示提示。HTTP 错误的原文携带服务器
// 返回的真实诊断("[429] quota exceeded for model X"),保留 + 追加提示。
const HINT_REPLACES_MESSAGE = new Set(["networkUnavailable", "translationTimeout"]);

/**
 * 面向用户的错误描述:原始 message + 本地化的可行动提示(HTTP status 映射),
 * 或纯提示(网络/超时 —— 原文无信息量)。`t` 传 useTranslations("common")
 * 的返回值。所有把错误写到界面的出口(失败面板 reason、工具 toast、Test
 * 按钮)统一走这里,提示文案只维护一份 i18n。
 */
export const describeError = (error: unknown, t: (key: string) => string): string => {
  const hintKey = getErrorHintKey(error);
  if (!hintKey) return getErrorMessage(error);
  return HINT_REPLACES_MESSAGE.has(hintKey) ? t(hintKey) : `${getErrorMessage(error)} — ${t(hintKey)}`;
};

export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) {
    return error.message;
  }

  if (typeof error === "string") {
    return error;
  }

  try {
    // JSON.stringify returns `undefined` (not a string) for undefined/function/symbol
    // inputs — guard so this never leaks a literal "undefined" into an error toast.
    return JSON.stringify(error) ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
};

/**
 * True when the error is a browser-native fetch network failure (no response
 * received: network outage, DNS, CORS, server unreachable). The locale-dependent
 * raw messages — Firefox "NetworkError when attempting to fetch resource",
 * Chrome "Failed to fetch", Safari "Load failed" — are gibberish to non-tech
 * users, so callers should surface a friendly localized message instead via
 * `t("networkUnavailable")`.
 *
 * HTTP errors (4xx/5xx) are wrapped by fetchJSON into normal `Error` instances
 * with formatted status strings — those carry actionable info and should pass
 * through unchanged.
 */
export const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name !== "TypeError") return false;
  const msg = error.message.toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
};

/**
 * True when fetch was aborted by a per-request timeout (createTimeoutController
 * firing setTimeout → controller.abort() → fetch throws DOMException with
 * name="AbortError"). Distinguished from `isCascadedAbort` (peer auth-error
 * cascading through the shared abortController) — that case is silent at the
 * translator catch since the real auth error surfaces via the other rejection.
 *
 * Callers should surface `t("translationTimeout")` for this case.
 */
export const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === "AbortError";
};

/**
 * True when the error is the explicit "Translation aborted" thrown by
 * translateSingle / pRetry's pre-attempt guard after the shared abortController
 * was tripped (auth error in a peer request). The real error already surfaced
 * via the peer's rejection — treat this as silent noise at the translator
 * catch to avoid a confusing secondary toast.
 */
export const isCascadedAbort = (error: unknown): boolean => {
  return error instanceof Error && error.message === "Translation aborted";
};
