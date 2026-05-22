// Pure synchronous portion of pre-translation validation. Decoupled from
// useTranslationState's hook scope so it can be unit-tested without React/antd
// providers. The async test-ping stays inside the hook because it needs message
// + setTranslationMethod (deeplx auto-fallback).

import { checkLanguageSupport, getConfigStatus, URL_ALSO_REQUIRED, URL_IS_PRIMARY_CRED, type TranslationConfig } from "@/app/lib/translation";

export type ValidateInputsResult = { ok: true } | { ok: false; errorKey: "enterApiKey" | "enterApiUrl" } | { ok: false; errorMessage: string };

export interface ValidateInputsOpts {
  config: TranslationConfig;
  method: string;
  sourceLanguage: string;
  targetLanguage: string;
  multiLanguageMode: boolean;
  targetLanguages: string[];
}

/**
 * Sync validation: credentials complete (delegates to registry's getConfigStatus
 * so this stays in lockstep with ApiStatusBlock's tag and the chips row), then
 * source/target language pairs supported by the chosen method.
 *
 * Returns:
 *   - { ok: true } when everything checks out
 *   - { ok: false, errorKey } for missing creds — caller surfaces via t(errorKey)
 *   - { ok: false, errorMessage } for unsupported language OR missing Azure
 *     region (pre-localized bilingual string — no shared i18n key for region)
 */
export const validateTranslationInputs = (opts: ValidateInputsOpts): ValidateInputsResult => {
  const { config, method, sourceLanguage, targetLanguage, multiLanguageMode, targetLanguages } = opts;

  // Single source of truth — same predicate the status tag uses. Replaces the
  // previous apiKey+URL_IS_PRIMARY_CRED-only check; now also catches:
  //   - URL_ALSO_REQUIRED with empty URL (azureopenai with apiKey but no URL)
  //   - missing region (azure)
  // before the request hits pRetry and burns 3 attempts with a confusing error.
  if (getConfigStatus(method, config) === "needs-config") {
    if (URL_IS_PRIMARY_CRED.has(method)) {
      return { ok: false, errorKey: "enterApiUrl" };
    }
    if (URL_ALSO_REQUIRED.has(method) && !String(config?.url ?? "").trim()) {
      return { ok: false, errorKey: "enterApiUrl" };
    }
    if (config?.region !== undefined && !String(config.region ?? "").trim()) {
      // No shared i18n key for region (one rare service uses it). Bilingual
      // hardcoded message matches the style of service-thrown messages (see
      // TranslateGemma's auto-source error).
      return { ok: false, errorMessage: "Azure region is required. / 请填写 Azure Region。" };
    }
    return { ok: false, errorKey: "enterApiKey" };
  }

  if (!multiLanguageMode) {
    const result = checkLanguageSupport(method, sourceLanguage, targetLanguage);
    if (!result.supported) {
      return { ok: false, errorMessage: result.errorMessage ?? "" };
    }
  } else {
    for (const lang of targetLanguages) {
      const result = checkLanguageSupport(method, sourceLanguage, lang);
      if (!result.supported) {
        return { ok: false, errorMessage: result.errorMessage ?? "" };
      }
    }
  }

  return { ok: true };
};
