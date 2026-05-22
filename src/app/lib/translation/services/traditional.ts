// Translation services - Traditional APIs (GTX, Google, DeepL, Azure)

import type { TranslationService } from "../types";
import { defaultConfigs } from "../registry";
import { isMethodSupportedForLanguage } from "../languages-data";
import { getLanguageName } from "../utils";
import { fetchJSON, requireApiKey, requireUrl, completeOpenAICompatUrl, PROXY_ENDPOINTS, THIRD_PARTY_ENDPOINTS, getOpenAICompatContent } from "./shared";

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

export const gtxFreeAPI: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage } = params;
  const apiEndpoint = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLanguage}&tl=${targetLanguage}&dt=t&q=${encodeURIComponent(text)}`;
  const response = await fetch(apiEndpoint, { signal: params.signal });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const data = await response.json();
  // GTX wraps translations in data[0] as Array<[translated, original, ...]>.
  // Empty input or auth wall returns a non-array root — fall back to "" instead
  // of throwing TypeError on .map.
  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  return segments
    .map((part: unknown) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
    .join("");
};

export const google: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, apiKey } = params;
  const key = requireApiKey("Google Translate", apiKey);
  const requestBody = {
    q: text,
    target: targetLanguage,
    ...(sourceLanguage !== "auto" && { source: sourceLanguage }),
  };

  const data = (await fetchJSON(`https://translation.googleapis.com/language/translate/v2?key=${key}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { data: { translations: Array<{ translatedText: string }> } };
  return data.data.translations[0].translatedText;
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

  const data = (await fetchJSON(url || PROXY_ENDPOINTS.deepl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { translations: Array<{ text: string }> };
  return data.translations[0].text;
};

export const deeplx: TranslationService = async (params) => {
  const { text, targetLanguage, sourceLanguage, url } = params;
  const requestBody = {
    text,
    target_lang: toDeepLTarget(targetLanguage),
    ...(sourceLanguage !== "auto" && { source_lang: toDeepLSource(sourceLanguage) }),
  };

  const data = (await fetchJSON(url || THIRD_PARTY_ENDPOINTS.deeplx, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(requestBody),
    signal: params.signal,
  })) as { data: string };
  return data.data;
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
  })) as Array<{ translations: Array<{ text: string }> }>;
  return data[0].translations[0].text;
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
  const { text, targetLanguage, sourceLanguage, apiKey, url, model, domains } = params;

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

  const translationOptions: Record<string, string> = {
    source_lang: sourceLangCode,
    target_lang: targetLangCode,
  };

  if (domains && domains.trim()) {
    translationOptions.domains = domains.trim();
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
      stream: false,
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

/**
 * Lightweight reachability check for the local TranslateGemma server. Hits
 * the OpenAI-spec /models listing endpoint (sibling of /chat/completions on
 * every OpenAI-compat server) instead of running an actual inference. Catches
 * the common "server not running" case (connection refused in <100ms) without
 * waiting for first-request model loading (5-30s on cold start). Used by
 * validate's pre-flight.
 *
 * Edge case it doesn't catch: server up but the configured model isn't loaded
 * — that surfaces during the actual translation as a clearer model-specific
 * error from the runtime, which is acceptable.
 *
 * URL handling preserves the user's path prefix so it works for non-/v1/
 * deployments (e.g. self-hosted vLLM at /api/v3/chat/completions → probes
 * /api/v3/models, not /api/v3/chat/completions/v1/models).
 */
export const translategemmaHealthCheck = async (url: string, signal?: AbortSignal): Promise<boolean> => {
  try {
    const baseUrl = url.trim().replace(/\/(chat\/)?completions\/?$/, "");
    const response = await fetch(`${baseUrl}/models`, {
      method: "GET",
      signal: signal ?? AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
};

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

  const requestBody: Record<string, unknown> = {
    prompt,
    // Hardcoded greedy decoding — matches Google's official `do_sample=False`
    // recipe. Sent explicitly so OpenAI-compat servers (LM Studio etc.) don't
    // fall back to their UI default temperature.
    temperature: 0,
    // 2048 covers translations up to ~6KB of text. Anything longer is unusual
    // for a single batch entry and would benefit from chunking upstream.
    max_tokens: 2048,
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

  const responseText = (data as { choices?: Array<{ text?: string }> } | null)?.choices?.[0]?.text;
  if (typeof responseText !== "string") {
    throw new Error("Invalid response format from TranslateGemma");
  }
  return responseText.trim();
};
