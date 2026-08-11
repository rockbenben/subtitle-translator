// Pure synchronous portion of pre-translation validation. Decoupled from
// useTranslationState's hook scope so it can be unit-tested without React/antd
// providers. The async test-ping stays inside the hook because it needs message
// + setTranslationMethod (deeplx auto-fallback).

// 子模块导入(不走 "@/app/lib/translation" barrel):barrel 会拖进
// indexedDBStorage 等浏览器专属模块,而本文件是纯函数,CLI(Node)的翻译前
// 校验直接复用它 —— 同 lib/translation/retry.ts 的导入纪律。
import { checkLanguageSupport } from "@/app/lib/translation/utils";
import { getConfigStatus, URL_ALSO_REQUIRED, URL_IS_PRIMARY_CRED } from "@/app/lib/translation/registry";
import type { TranslationConfig } from "@/app/lib/translation/types";

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
    if (config?.folderId !== undefined && !String(config.folderId ?? "").trim()) {
      // Yandex: folder ID is the per-tenant scope assembled into gpt:// model
      // URIs. Same bilingual-hardcoded pattern as the region message above.
      return { ok: false, errorMessage: "Yandex Folder ID is required. / 请填写 Yandex Folder ID。" };
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

/**
 * Signature over the credential / reachability-relevant config fields. validate()
 * keys its in-memory, session-scoped probe memo on this to SKIP re-probing a
 * config it already reachability-checked, and to force an immediate re-probe the
 * moment any of these change (new key / url / model / relay / method). Prompts and
 * temperature are intentionally excluded — they don't affect whether the endpoint
 * is reachable or the credentials valid, so editing them shouldn't re-probe.
 * Plain JSON string — the memo is an in-memory Set, so no hashing is needed.
 */
export const pingSignature = (method: string, config: (TranslationConfig & { relayBase?: string }) | undefined): string =>
  JSON.stringify({
    method,
    url: config?.url ?? "",
    apiKey: config?.apiKey ?? "",
    model: config?.model ?? "",
    // region / apiVersion(Azure)与 folderId(Yandex)决定这次探测【实际打到
    // 哪个租户/部署】—— 换了它们,旧探测的结论对新目标不成立。
    region: config?.region ?? "",
    apiVersion: config?.apiVersion ?? "",
    folderId: config?.folderId ?? "",
    // useRelay 换掉整条 wire path,而且翻转它正是浏览器直连撞 CORS 时的官方
    // 修法 —— 用户照做之后,红色 failed 徽章绝不能还挂着。
    useRelay: config?.useRelay ?? false,
    // Global setting merged in by the caller (it lives OUTSIDE per-provider
    // config — see PipelineRuntimeConfig). Changing the relay host is changing
    // which server answers the probe; a pass against the old relay must not
    // be replayed for the new one.
    relayBase: config?.relayBase ?? "",
    // Request-shape field, not a prompt: flips a Gemma-served backend between
    // 200 and a deterministic 400 ("system role not supported"), so a probe
    // pass from the other toggle state must not be replayed.
    sendSystemPrompt: config?.sendSystemPrompt ?? true,
  });
