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
