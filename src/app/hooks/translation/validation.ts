// Pure synchronous portion of pre-translation validation. Decoupled from
// useTranslationState's hook scope so it can be unit-tested without React/antd
// providers. The async test-ping stays inside the hook because it needs message
// + setTranslationMethod (deeplx auto-fallback).

import { checkLanguageSupport, URL_IS_PRIMARY_CRED, type TranslationConfig } from "@/app/lib/translation";

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
 * Sync validation: credentials present, URL present (for URL-primary services),
 * source/target language pairs supported by the chosen method.
 *
 * Returns:
 *   - { ok: true } when everything checks out
 *   - { ok: false, errorKey } for missing creds — caller surfaces via t(errorKey)
 *   - { ok: false, errorMessage } for unsupported language — pre-localized string
 */
export const validateTranslationInputs = (opts: ValidateInputsOpts): ValidateInputsResult => {
  const { config, method, sourceLanguage, targetLanguage, multiLanguageMode, targetLanguages } = opts;

  // URL_IS_PRIMARY_CRED services treat URL as the credential — apiKey is
  // optional/absent (local LM Studio / llama.cpp typically need no key).
  if (config && "apiKey" in config && !config.apiKey && !URL_IS_PRIMARY_CRED.has(method)) {
    return { ok: false, errorKey: "enterApiKey" };
  }

  if (URL_IS_PRIMARY_CRED.has(method) && !String(config.url ?? "").trim()) {
    return { ok: false, errorKey: "enterApiUrl" };
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
