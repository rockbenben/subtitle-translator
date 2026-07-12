import { getErrorMessage } from "@subtitle-translator/translation-core";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status = 400,
    readonly code = "BAD_REQUEST",
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const toErrorResponse = (error: unknown) => {
  const status = error instanceof ApiError ? error.status : ((error as { status?: number } | null)?.status ?? 400);
  const code = error instanceof ApiError ? error.code : status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST";
  return {
    status,
    body: {
      error: {
        code,
        message: getErrorMessage(error),
        status,
        ...(error instanceof ApiError && error.details !== undefined ? { details: error.details } : {}),
      },
    },
  };
};

export const requireString = (value: unknown, name: string): string => {
  if (typeof value !== "string") throw new ApiError(`${name} must be a string`, 400, "VALIDATION_ERROR");
  return value;
};

export const requireStringArray = (value: unknown, name: string): string[] => {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    throw new ApiError(`${name} must be an array of strings`, 400, "VALIDATION_ERROR");
  }
  return value;
};
