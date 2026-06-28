export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === "string") return error;
  try {
    return JSON.stringify(error) ?? "Unknown error";
  } catch {
    return "Unknown error";
  }
};

export const isNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  if (error.name !== "TypeError") return false;
  const msg = error.message.toLowerCase();
  return msg.includes("failed to fetch") || msg.includes("networkerror") || msg.includes("load failed");
};

export const isAbortError = (error: unknown): boolean => {
  return error instanceof Error && error.name === "AbortError";
};

export const isCascadedAbort = (error: unknown): boolean => {
  return error instanceof Error && error.message === "Translation aborted";
};
