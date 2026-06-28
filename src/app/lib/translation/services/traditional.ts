// Translation services - Traditional APIs (GTX, Google, DeepL, Azure)

import type { TranslationService } from "../types";
import { defaultConfigs } from "../registry";
import { isMethodSupportedForLanguage } from "../languages-data";
import { getLanguageName } from "../utils";
import { fetchJSON, formatHttpError, parseRetryAfterMs, requireApiKey, requireUrl, completeOpenAICompatUrl, PROXY_ENDPOINTS, THIRD_PARTY_ENDPOINTS, getOpenAICompatContent } from "./shared";

// DeepL source language: Chinese variants → ZH, Portuguese variants → PT, fil → TL
const DEEPL_SOURCE_MAP: Record<string, string> = {
  "zh-hant": "ZH",
  "pt-br": "PT",
  "pt-pt": "PT",
  fil: "TL",
};

// DeepL target language: zh → ZH-HANS, zh-hant → ZH-HANT, fil → TL
const DEEPL_TARGET_MAP: Record<string, string> = {
  en: "EN-US",
  zh: "ZH-HANS",
  "zh-hant": "ZH-HANT",
  fil: "TL",
};

const toDeepLSource = (lang: string): string => DEEPL_SOURCE_MAP[lang] ?? lang.toUpperCase();

const toDeepLTarget = (lang: string): string => DEEPL_TARGET_MAP[lang] ?? lang.toUpperCase();

const getAzureRegion = (region: string | undefined): string => {
  const value = region?.trim();
  if (!value) {
    throw new Error("Azure Translate region is required");
  }
  return value;
};

// Azure Translator uses non-standard codes for some languages. Our master list
// (languages-data.ts) uses BCP-47 / ISO-639 conventions; remap before sending.
//   ckb (Central Kurdish / Sorani) → Azure uses `ku`
// See https://learn.microsoft.com/zh-cn/azure/ai-services/translator/language-support
// for the canonical Azure code table.
const AZURE_LANG_MAP: Record<string, string> = {
  ckb: "ku",
};
const toAzureCode = (lang: string): string => AZURE_LANG_MAP[lang] ?? lang;

// Google's NMT backend uses non-standard codes for some languages. Our master
// list uses `prs` for Dari; Google rejects it (400) but accepts `fa-AF` —
// live-verified 2026-06-07 against translate.googleapis.com in BOTH directions.
// Applied to gtxFreeAPI and the official google service (same backend).
const GOOGLE_LANG_MAP: Record<string, string> = {
  prs: "fa-AF",
};
const toGoogleCode = (lang: string): string => GOOGLE_LANG_MAP[lang] ?? lang;

// translate-pa is the API gateway behind Google's own website-translation
// widget (Translate Element / te_lib). The legacy translate_a/single?client=gtx
// family fell behind Google's anti-abuse wall in 2026-06: every request 302s
// to google.com/sorry, which the browser surfaces as a CORS error. translate-pa
// is a proper CORS gateway (ACAO reflects Origin, OPTIONS preflight allows
// content-type + x-goog-api-key) and answers 200 even from IPs that
// translate_a walls — all live-verified 2026-06-10, incl. sl=auto.
const GTX_ENDPOINT = "https://translate-pa.googleapis.com/v1/translateHtml";
// Public API key embedded in Google's te_lib loader — same "shared free
// backend" semantics as the old client=gtx param, not a user secret.
const GTX_PUBLIC_KEY = "AIzaSyATBXajvzQLTDHEQbcpq0Ihe0vWDHmO520";

// translateHtml parses input as HTML: raw & / < are treated as markup and can
// derail the translation (live-verified: "5 < 6" mistranslated). Escape on the
// way in; the output keeps entities (&lt; stays &lt;), which index.ts's
// HTML_ENCODING_METHODS pipeline already decodes for gtxFreeAPI.
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// Shared error shape for the raw-fetch free services (gtx both gateways, edge):
// .status drives retry.ts's classification + the errorHint i18n keys — without
// it a deterministic 4xx burns the full retry budget (2-60s backoff) per line.
// 429 透传 Retry-After 给共享冷却闸(同 fetchJSON 的契约)。
const httpStatusError = (response: Response): Error => {
  const error = Object.assign(new Error(formatHttpError(null, response.status)), { status: response.status });
  if (response.status === 429) {
    const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
    if (retryAfterMs !== undefined) Object.assign(error, { retryAfterMs });
  }
  return error;
};

// Legacy translate_a gateway (the pre-2026-06 default). Google's anti-abuse
// wall 302s it to google.com/sorry for many IPs now, but the wall is
// IP-reputation-based — some regions/IPs still pass, so it stays selectable
// as an endpoint preset. POST with the text in the form body, NOT a GET query
// param: percent-encoded CJK inflates 9x and the endpoint caps URLs at ~16KB.
//
// STRICTLY ONE LINE PER REQUEST. This protocol was only ever validated
// single-line in this codebase (the pre-chunk line path sent one line per
// request), and whether dt=t preserves \n across a multi-line body is
// unverifiable from behind the abuse wall — don't bet line alignment on it.
// The chunk path's multi-line blocks are split back into parallel per-line
// requests here (same flood profile as the historical batchSize-100 line path).
const gtxLegacy = async (endpoint: string, params: Parameters<TranslationService>[0]): Promise<string> => {
  const { text, targetLanguage, sourceLanguage } = params;
  const apiEndpoint = `${endpoint}?client=gtx&sl=${toGoogleCode(sourceLanguage)}&tl=${toGoogleCode(targetLanguage)}&dt=t`;

  const requestOne = async (line: string): Promise<string> => {
    const response = await fetch(apiEndpoint, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `q=${encodeURIComponent(line)}`,
      signal: params.signal,
    });
    if (!response.ok) throw httpStatusError(response);

    const data = await response.json();
    // Legacy shape: data[0] = Array<[translated, original, ...]>. A non-array
    // root means a 200-OK that ISN'T a translation (auth wall / shape drift):
    // THROW (like every sibling MT service) so retry + soft-fill-with-original
    // runs. Returning "" here instead silently blanks the line — and across a
    // multi-line chunk the all-"" join is truthy, so index.ts ships it as a
    // cached "success" (total silent data loss; also breaks this path's own
    // "a failed line rejects the whole chunk" contract).
    if (!Array.isArray(data?.[0])) throw new Error("Invalid response format from Google Translate (gtx)");
    return data[0].map((part: unknown) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : "")).join("");
  };

  const lines = text.split("\n");
  if (lines.length === 1) return requestOne(text);
  // Blank lines pass through untouched — preserves count for the chunk
  // path's join/split realignment. A failed line rejects the whole chunk;
  // the chunk path soft-fails it as a unit (same as any other MT error).
  const results = await Promise.all(lines.map((line) => (line.trim() ? requestOne(line) : Promise.resolve(line))));
  return results.join("\n");
};

export const gtxFreeAPI: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, url } = params;
  // Gateway switch by URL shape: /translate_a/ → legacy form protocol
  // (official legacy host or a user-hosted mirror); anything else → the
  // translate-pa array protocol (official default or a same-protocol mirror).
  const endpoint = url?.trim() || GTX_ENDPOINT;
  if (endpoint.includes("/translate_a/")) return gtxLegacy(endpoint, params);

  // HTML semantics collapse \n to spaces (live-verified), which would wreck
  // the multi-line chunk path. translateHtml natively takes an ARRAY of texts,
  // so send one element per line and rejoin. Blank elements 400
  // ("invalid argument") — skip them and re-insert by position.
  const lines = text.split("\n");
  const sentIndices: number[] = [];
  const payload: string[] = [];
  lines.forEach((line, i) => {
    if (line.trim()) {
      sentIndices.push(i);
      payload.push(escapeHtml(line));
    }
  });
  if (payload.length === 0) return text;

  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json+protobuf", "X-Goog-API-Key": GTX_PUBLIC_KEY },
    body: JSON.stringify([[payload, toGoogleCode(sourceLanguage), toGoogleCode(targetLanguage)], "te_lib"]),
    signal: params.signal,
  });
  if (!response.ok) throw httpStatusError(response);

  const data = await response.json();
  // Response: data[0] = translations array, parallel to the request payload
  // (data[1] = detected source langs, only present with sl=auto). A non-array
  // root means a 200-OK that ISN'T a translation (auth wall / shape drift):
  // THROW (like every sibling MT service) so retry + soft-fill-with-original
  // runs. Falling back to "" per line silently blanks EVERY sent line — and the
  // all-"" join is truthy, so index.ts ships the blanked chunk as a cached
  // "success" (total, silent data loss the user only sees on opening the file).
  if (!Array.isArray(data?.[0])) throw new Error("Invalid response format from Google Translate (gtx)");
  const translated = data[0];
  const out = [...lines];
  sentIndices.forEach((lineIdx, j) => {
    // Parallel-array contract: one string per sent line. A SHORT array
    // (translated[j] === undefined) or a HOLEY one (a non-string element) must
    // THROW like the non-array guard above — not fall back to "". Blanking only
    // the affected line(s) while the other lines stay populated makes the
    // out.join("\n") truthy, so index.ts ships the chunk as a cached "success"
    // (silent, persisted data loss the user only sees on opening the file).
    // Throwing routes the whole chunk through retry + soft-fill-with-original,
    // matching every sibling MT service's "a bad response rejects the chunk".
    const t = translated[j];
    if (typeof t !== "string") {
      throw new Error("Invalid response format from Google Translate (gtx) — missing translation for a sent line");
    }
    out[lineIdx] = t;
  });
  return out.join("\n");
};

// ===== Edge API (Free) — Microsoft Edge's built-in translator backend =====
// Same engine as Azure Translator, fronted by Edge's free auth endpoint:
// GET edge.microsoft.com/translate/auth issues a ~10-min JWT accepted by
// api-edge.cognitive.microsofttranslator.com. CORS fully open (ACAO *) on
// both endpoints, \n preserved, raw & / < untouched (plain-text mode), and
// our master codes (zh / zh-hant) accepted as-is — live-verified 2026-06-10.
const EDGE_AUTH_ENDPOINT = "https://edge.microsoft.com/translate/auth";
const EDGE_TRANSLATE_ENDPOINT = "https://api-edge.cognitive.microsofttranslator.com/translate?api-version=3.0";

// Token cache: refresh at 8 min (2-min safety margin on the ~10-min JWT).
// The in-flight promise is shared (single-flight) so a 100-line batch fires ONE
// auth request, not 100 — both on cold start AND on a 401 storm (the whole
// concurrent batch sees the same expired token at once and asks to refresh).
let edgeTokenCache: { value: string; expiresAt: number } | null = null;
let edgeTokenInflight: Promise<string> | null = null;

// `staleToken` (optional) = the token the caller just saw rejected (401/403).
// We hand back the cache only if it has already moved PAST that token; otherwise
// we refresh. A concurrent refresh is joined rather than duplicated, so 100 lines
// 401-ing on the same token collapse to a single auth fetch.
const getEdgeToken = (signal: AbortSignal | undefined, staleToken?: string): Promise<string> => {
  if (edgeTokenCache && edgeTokenCache.value !== staleToken && Date.now() < edgeTokenCache.expiresAt) {
    return Promise.resolve(edgeTokenCache.value);
  }
  if (edgeTokenInflight) return edgeTokenInflight;
  const inflight = (async () => {
    // signal: ties the auth fetch to the initiating line's abort/timeout so a
    // hung auth endpoint can't wedge the run. Peers awaiting this promise see
    // an AbortError on cancel — handled as a cascaded abort by the translator.
    const response = await fetch(EDGE_AUTH_ENDPOINT, { signal });
    if (!response.ok) {
      throw Object.assign(new Error(formatHttpError(null, response.status)), { status: response.status });
    }
    const value = (await response.text()).trim();
    edgeTokenCache = { value, expiresAt: Date.now() + 8 * 60_000 };
    return value;
  })().finally(() => {
    edgeTokenInflight = null;
  });
  edgeTokenInflight = inflight;
  return inflight;
};

export const edgeFreeAPI: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage } = params;
  // Edge backend = Azure Translator → reuse the Azure code remaps (ckb → ku).
  const target = toAzureCode(targetLanguage);
  const source = sourceLanguage !== "auto" ? toAzureCode(sourceLanguage) : null;
  const endpoint = `${EDGE_TRANSLATE_ENDPOINT}&to=${target}${source ? `&from=${source}` : ""}`;

  const doRequest = async (token: string) =>
    fetch(endpoint, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify([{ Text: text }]),
      signal: params.signal,
    });

  const token = await getEdgeToken(params.signal);
  let response = await doRequest(token);
  // Expired/revoked JWT mid-run → ONE transparent refresh+retry. Without it a
  // 401 classifies as an auth error and fast-aborts the whole batch, killing
  // every run longer than the ~10-min token lifetime. Passing the rejected
  // `token` as stale makes the refresh single-flight across the whole batch.
  if (response.status === 401 || response.status === 403) {
    response = await doRequest(await getEdgeToken(params.signal, token));
  }

  if (!response.ok) throw httpStatusError(response);

  const data = (await response.json()) as Array<{ translations?: Array<{ text?: string }> }> | null;
  const translatedText = data?.[0]?.translations?.[0]?.text;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from Edge Translate");
  }
  return translatedText;
};

export const google: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey } = params;
  const key = requireApiKey("Google Translate", apiKey);
  const requestBody = {
    q: text,
    target: toGoogleCode(targetLanguage),
    ...(sourceLanguage !== "auto" && { source: toGoogleCode(sourceLanguage) }),
  };

  const data = (await fetchJSON(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { data?: { translations?: Array<{ translatedText?: string }> } } | null;
  // A 200-OK with an unexpected/empty body would throw a raw TypeError (no
  // status → wrongly retried). Guard the shape and throw a definitive error.
  const translatedText = data?.data?.translations?.[0]?.translatedText;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from Google Translate");
  }
  return translatedText;
};

export const deepl: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, url, apiKey } = params;
  const key = requireApiKey("DeepL", apiKey);
  const requestBody = {
    text,
    target_lang: toDeepLTarget(targetLanguage),
    authKey: key,
    tag_handling: "html",
    ...(sourceLanguage !== "auto" && { source_lang: toDeepLSource(sourceLanguage) }),
  };

  // url?.trim():纯空白 URL(" ")是 truthy,fetch(" ") 会解析到当前页面,
  // 返回的 HTML 让 ok 路径的 response.json() 抛无 status 的 SyntaxError ——
  // 被当可重试错误烧光重试预算,还报 "Unexpected token '<'" 而非回落默认端点。
  const data = (await fetchJSON(url?.trim() || PROXY_ENDPOINTS.deepl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { translations?: Array<{ text?: string }> } | null;
  const translatedText = data?.translations?.[0]?.text;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from DeepL");
  }
  return translatedText;
};

export const deeplx: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, url } = params;
  const requestBody = {
    text,
    target_lang: toDeepLTarget(targetLanguage),
    ...(sourceLanguage !== "auto" && { source_lang: toDeepLSource(sourceLanguage) }),
  };

  // url?.trim() 同 deepl:空白 URL 回落默认端点而非劫持到当前页面。
  const data = (await fetchJSON(url?.trim() || THIRD_PARTY_ENDPOINTS.deeplx, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { data?: string } | null;
  // Self-hosted DeepLX forks / proxies can 200 with a non-string `data` (array,
  // object) or a null body. Guard like the sibling MT services above, else a
  // truthy non-string slips past index.ts's `!translatedText` check into the
  // cache + downstream string ops, and a null body throws a status-less
  // TypeError that gets wrongly retried.
  const translatedText = data?.data;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from DeepLX");
  }
  return translatedText;
};

export const azure: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, region } = params;
  const azureTarget = toAzureCode(targetLanguage);
  const azureSource = sourceLanguage !== "auto" ? toAzureCode(sourceLanguage) : null;
  const apiEndpoint = `https://api.cognitive.microsofttranslator.com/translate?api-version=3.0&to=${azureTarget}${azureSource ? `&from=${azureSource}` : ""}`;

  const key = requireApiKey("Azure Translate", apiKey);
  const resolvedRegion = getAzureRegion(region);

  const data = (await fetchJSON(apiEndpoint, {
    method: "POST",
    headers: {
      "Ocp-Apim-Subscription-Key": key,
      "Ocp-Apim-Subscription-Region": resolvedRegion,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([{ Text: text }]),
    signal: params.signal,
  })) as Array<{ translations?: Array<{ text?: string }> }> | null;
  const translatedText = data?.[0]?.translations?.[0]?.text;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from Azure Translate");
  }
  return translatedText;
};

export const webgoogletranslate: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage } = params;
  const requestBody = {
    q: text,
    target: targetLanguage,
    ...(sourceLanguage !== "auto" && { source: sourceLanguage }),
  };

  const data = (await fetchJSON("api/webgoogletranslate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { translatedText?: string } | null;

  const translatedText = data?.translatedText;
  if (typeof translatedText !== "string") {
    throw new Error("Invalid response format from webgoogletranslate");
  }
  return translatedText;
};

export const qwenMt: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey, url, model, domains, glossaryTerms } = params;

  const key = requireApiKey("Qwen-MT", apiKey);
  const apiUrl = completeOpenAICompatUrl(url?.trim() || defaultConfigs.qwenMt.url!);

  // Qwen-MT accepts both English names and codes. Using mapped codes is more precise.
  const getQwenMtLangCode = (lang: string) => {
    if (lang === "auto") return "auto";
    const mapping: Record<string, string> = {
      "zh-hant": "zh_tw",
      "pt-br": "pt",
      "pt-pt": "pt",
      fil: "tl",
    };
    return mapping[lang] || lang;
  };

  const sourceLangCode = getQwenMtLangCode(sourceLanguage);
  const targetLangCode = getQwenMtLangCode(targetLanguage);

  const translationOptions: Record<string, unknown> = {
    source_lang: sourceLangCode,
    target_lang: targetLangCode,
  };

  if (domains && domains.trim()) {
    translationOptions.domains = domains.trim();
  }

  // Native terminology intervention — the model applies the terms in-context
  // (prevents mistranslation, unlike the post-hoc leak-through which only
  // fixes verbatim leftovers). Omit entirely when empty.
  if (glossaryTerms && glossaryTerms.length > 0) {
    translationOptions.terms = glossaryTerms;
  }

  const data = await fetchJSON(apiUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      messages: [{ role: "user", content: text }],
      model: model || defaultConfigs.qwenMt.model!,
      translation_options: translationOptions,
    }),
    signal: params.signal,
  });
  return getOpenAICompatContent(data, "Qwen-MT");
};

// ─── TranslateGemma ─────────────────────────────────────────────────────────
// Google's TranslateGemma family — translation-specialized Gemma derivative.
// Categorized as machine-translation (not LLM) because it's purely seq2seq:
// no context-aware translation, no system/user prompts, only one task per call.
// Supported-language denylist lives in languages-data.ts (UNSUPPORTED_LANGS).

// Only declare codes/names that DIFFER from our standard languages-data
// (region-script variants where TranslateGemma uses BCP-47 form, plus a few
// short-name variants). Any code not listed passes through using its `value`
// as-is and `languages[].name` for the prompt name. Adding a new TranslateGemma
// override here is the only place to touch — no parallel LANG_INFO to maintain.
const TRANSLATEGEMMA_OVERRIDES: Record<string, { code?: string; name?: string }> = {
  zh: { code: "zh-Hans", name: "Chinese" }, // ours: "Simplified Chinese"
  "zh-hant": { code: "zh-Hant", name: "Chinese" }, // ours: "Traditional Chinese"
  "pt-br": { code: "pt-BR", name: "Portuguese" }, // ours: "Portuguese (Brazil)"
  "pt-pt": { code: "pt-PT", name: "Portuguese" }, // ours: "Portuguese (Portugal)"
  fil: { code: "fil-PH", name: "Filipino" }, // ours: "Filipino(Tagalog)"
};

// Defense-in-depth: validate already blocks `auto`, yue, and bho
// before we get here, but a future code path (direct API consumer, CLI, etc.)
// could bypass it. Throws with bilingual message for direct visibility.
const getTranslategemmaLangInfo = (code: string): { code: string; name: string } => {
  if (code === "auto") {
    throw new Error("TranslateGemma requires an explicit source language (auto-detect not supported). / TranslateGemma 不支持自动检测源语言，请明确选择源语言。");
  }
  if (!isMethodSupportedForLanguage("translategemma", code)) {
    throw new Error(`TranslateGemma does not support language code "${code}". / TranslateGemma 不支持该语言代码：${code}`);
  }
  const override = TRANSLATEGEMMA_OVERRIDES[code];
  return {
    code: override?.code ?? code,
    name: override?.name ?? getLanguageName(code),
  };
};

// Verbatim re-rendering of TranslateGemma's chat template (text path). We do
// it ourselves so we can POST to /v1/completions instead of /v1/chat/completions
// — bypassing servers (notably LM Studio) that flatten our multimodal content
// array per OpenAI's text-model spec, stripping `source_lang_code`/`target_lang_code`
// before the model's jinja runs. Runtimes that DO preserve the structure
// (vLLM, llama.cpp server, HF TGI) accept this same pre-rendered prompt
// equivalently, so this single path works everywhere.
const buildTranslategemmaPrompt = (source: { code: string; name: string }, target: { code: string; name: string }, text: string): string => {
  return `<bos><start_of_turn>user
You are a professional ${source.name} (${source.code}) to ${target.name} (${target.code}) translator. Your goal is to accurately convey the meaning and nuances of the original ${source.name} text while adhering to ${target.name} grammar, vocabulary, and cultural sensitivities.
Produce only the ${target.name} translation, without any additional explanations or commentary. Please translate the following ${source.name} text into ${target.name}:


${text.trim()}<end_of_turn>
<start_of_turn>model
`;
};

// TranslateGemma is invoked one source segment per request — the registry sets
// no chunkSize, so useTranslationState ALWAYS takes the line-by-line path
// (one request per content line). The official model card defines the output
// as a single string ("Output: Text translated into the target language") and
// documents no candidate-list behavior. But the 4B model, prompted off its
// native chat template (we pre-render to /v1/completions to survive LM Studio),
// occasionally spills a newline-separated list of synonyms for short/ambiguous
// inputs (可能 / 也许 / 大概 / 八成 / 好像). Left verbatim, that multi-line block
// lands in ONE line-slot and downstream assembly renders it as several lines,
// shifting bilingual/subtitle output. Since every request carries exactly one
// segment, any newline in the output is a candidate separator, never a second
// translation — keep only the first non-empty candidate to enforce the
// documented single-translation contract.
export const firstTranslategemmaCandidate = (raw: string): string => {
  return (
    raw
      .trim()
      .split(/\r?\n/)
      .map((line) => line.trim())
      .find((line) => line !== "") ?? ""
  );
};

// NOTE: the former GET /models health check was removed deliberately — some
// LM Studio builds don't route GET /v1/models at all ("Unexpected endpoint or
// method... Returning 200 anyway", with no CORS headers on the fallback), so
// the probe hard-blocked translation while the server and Test both worked.
// translategemma now goes through the same runReachabilityProbe as every other
// probed method (a real /v1/completions request — identical wire path to the
// Test button).
//
// ⚠️ DO NOT switch this to /v1/chat/completions with structured `content`.
//
// Empirically tested 2026-05-06 against LM Studio + translategemma-4b-it:
// even though the request body is correctly received (LM Studio's debug log
// shows `content` as our [{type, source_lang_code, target_lang_code, text}]
// array intact), the chat template's first validator still rejects with:
//   "User role must provide `content` as an iterable with exactly one item.
//    That item must be a `mapping(type:'text' | 'image', source_lang_code,
//    target_lang_code, text:string|none, image:string|none)`."
//
// Likely cause: LM Studio's OpenAI-compat layer flattens multimodal `content`
// arrays into a single string before invoking the chat template (text-only-
// model back-compat — OpenAI spec says non-vision models receive string
// content). The string IS iterable in jinja/minja, but its length is the
// character count (e.g. "Hello, world!" → 13), failing `length != 1`.
// Adding `image: null` doesn't help — also tested.
//
// /v1/completions bypasses the chat template entirely: we pre-render the
// prompt (buildTranslategemmaPrompt) and the runtime tokenizes it as-is.
// Works uniformly in LM Studio, llama.cpp server, vLLM, HF TGI.
export const translategemma: TranslationService = async (params) => {
  const { url, apiKey, model, sourceLanguage, targetLanguage, text } = params;
  const serviceName = "TranslateGemma";
  const apiEndpoint = completeOpenAICompatUrl(requireUrl(serviceName, url));
  // /v1/chat/completions and /v1/completions are siblings on every OpenAI-compat
  // server we care about (LM Studio, vLLM, llama.cpp, HF TGI). The user's URL
  // points at chat; rewrite to the legacy completions endpoint where prompts
  // pass through untouched (no chat template applied server-side).
  const completionsUrl = apiEndpoint.replace(/\/chat\/completions$/, "/completions");

  const sourceInfo = getTranslategemmaLangInfo(sourceLanguage);
  const targetInfo = getTranslategemmaLangInfo(targetLanguage);
  const prompt = buildTranslategemmaPrompt(sourceInfo, targetInfo, text);

  // Local LM Studio / llama.cpp typically don't require a key — only attach
  // Authorization when the user provides one (hosted setups, gated proxies).
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (apiKey?.trim()) {
    headers.Authorization = `Bearer ${apiKey}`;
  }

  // Cap the output budget to ~2× the input length (+headroom), clamped to
  // [64, 2048]. A translation never legitimately runs much longer than its
  // source, so this generous ceiling is invisible on the happy path. Its real
  // job is bounding the WORST case: greedy decoding (temperature 0, no
  // sampling to escape a loop) on out-of-distribution input — most often a
  // source-language mismatch, since TranslateGemma has no auto-detect and
  // bakes the declared source_lang into the prompt — can fail to emit
  // <end_of_turn> and run away toward the token budget. At a flat 2048 on a
  // local 12B (a few tok/s), that runaway burns the FULL per-request timeout
  // (180–300s) before aborting. Scaling the cap to the input means a runaway
  // hits finish_reason==="length" in seconds → the existing "max_tokens
  // reached" soft-fail fires fast instead of grinding for minutes. Genuinely
  // long inputs (≥~1KB) still get the full 2048 (clamp), unchanged from before.
  const maxTokens = Math.min(2048, Math.max(64, Math.ceil(text.length * 2) + 32));

  const requestBody: Record<string, unknown> = {
    prompt,
    // Hardcoded greedy decoding — matches Google's official `do_sample=False`
    // recipe. Sent explicitly so OpenAI-compat servers (LM Studio etc.) don't
    // fall back to their UI default temperature.
    temperature: 0,
    max_tokens: maxTokens,
    // Hard stop at the turn boundary — without it, some runtimes keep
    // generating past the answer (echoing example pairs, role tokens, etc).
    stop: ["<end_of_turn>"],
  };
  const effectiveModel = model?.trim() || defaultConfigs.translategemma.model;
  if (effectiveModel) requestBody.model = effectiveModel;

  const data = await fetchJSON(completionsUrl, {
    method: "POST",
    headers,
    body: JSON.stringify(requestBody),
    signal: params.signal,
  });

  const choice = (data as { choices?: Array<{ text?: string; finish_reason?: string }> } | null)?.choices?.[0];
  const responseText = choice?.text;
  if (typeof responseText !== "string") {
    throw new Error("Invalid response format from TranslateGemma");
  }
  // finish_reason === "length" 表示 max_tokens 截断 —— 抛错(让重试/失败面板
  // 接管),否则截断的半截译文被当成功结果返回并缓存,用户无从察觉。
  if (choice?.finish_reason === "length") {
    throw new Error("TranslateGemma output truncated (max_tokens reached) — text too long for one batch");
  }
  // Collapse any newline-separated candidate list to the first translation —
  // see firstTranslategemmaCandidate for why this is safe (one segment/request).
  return firstTranslategemmaCandidate(responseText);
};
