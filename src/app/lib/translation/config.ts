// Config migration utilities. Provider data lives in `./registry`.

import type { TranslationConfig } from "./types";

export const DEFAULT_SYS_PROMPT = "You are a professional translator. Respond only with the content, either translated or rewritten. Do not add explanations, comments, or any extra text.";
export const DEFAULT_USER_PROMPT = "Please respect the original meaning, maintain the original format, and rewrite the following content in ${targetLanguage}.\n\n${content}";

// Fields to preserve when resetting config to defaults (user credentials should not be lost).
// apiVersion (Azure OpenAI) and region (Azure Translate) are effectively credential-adjacent —
// users set them once per Azure deployment and don't expect a reset to forget them.
const PRESERVE_FIELDS: (keyof TranslationConfig)[] = ["apiKey", "url", "apiVersion", "region"];

/**
 * Reset config to defaults while preserving user credential fields (apiKey, url, apiVersion, region).
 * Used by the explicit "Reset" button.
 */
export const resetConfigWithCredentials = (currentConfig: TranslationConfig | undefined, defaultConfig: TranslationConfig | undefined): TranslationConfig => {
  const preserved: Partial<TranslationConfig> = {};
  if (currentConfig) {
    for (const field of PRESERVE_FIELDS) {
      if (currentConfig[field] !== undefined) {
        (preserved as Record<string, unknown>)[field] = currentConfig[field];
      }
    }
  }
  return { ...defaultConfig, ...preserved };
};

/**
 * Legacy structure validator — kept for any external consumer that might still
 * reference it. All in-repo callers migrated to `migrateConfig` below.
 */
export const isConfigStructureValid = (config: Record<string, unknown>, defaultConfig: Record<string, unknown>): boolean => {
  const configKeys = Object.keys(config);
  const defaultKeys = Object.keys(defaultConfig);
  if (configKeys.length !== defaultKeys.length) return false;
  const keySet = new Set(configKeys);
  return defaultKeys.every((key) => keySet.has(key));
};

/**
 * Graceful config migration for stored user configs.
 *
 * When defaults evolve (new fields added, old fields removed), this merges
 * defaults into the saved config so missing fields get backfilled and obsolete
 * fields get pruned — without resetting the user's valid choices (model,
 * temperature, apiKey, ...). Explicit user-initiated resets should still call
 * resetConfigWithCredentials.
 */
export const migrateConfig = (saved: TranslationConfig | undefined, defaults: TranslationConfig | undefined): TranslationConfig => {
  if (!defaults) return { ...(saved ?? {}) };
  if (!saved) return { ...defaults };
  const merged: Record<string, unknown> = { ...defaults, ...saved };
  // Drop keys that no longer exist in defaults (removed fields)
  for (const key of Object.keys(merged)) {
    if (!(key in defaults)) delete merged[key];
  }
  return merged as TranslationConfig;
};
