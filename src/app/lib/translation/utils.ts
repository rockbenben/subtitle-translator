import { languages, isMethodSupportedForLanguage, REQUIRES_EXPLICIT_SOURCE } from "./languages-data";
import { findMethodLabel } from "./registry";
import type { TranslationMethod } from "./types";

// Pre-computed lookup maps for O(1) language access
const languageNameMap = new Map(languages.map((lang) => [lang.value, lang.name]));
const validLanguageCodes = new Set(languages.map((lang) => lang.value));

export const getLanguageName = (value: string): string => {
  return languageNameMap.get(value) ?? value;
};

export const isValidLanguageValue = (testValue: string): boolean => {
  return validLanguageCodes.has(testValue);
};

export const checkLanguageSupport = (translationMethod: TranslationMethod, sourceLanguage: string, targetLanguage: string): { supported: boolean; errorMessage?: string } => {
  const sourceName = languageNameMap.get(sourceLanguage);
  const targetName = languageNameMap.get(targetLanguage);

  if (!sourceName || !targetName) {
    return { supported: false, errorMessage: "Invalid language code provided" };
  }

  // Curated display name ("TranslateGemma", "Qwen-MT", …) — never the raw
  // uppercased internal key ("TRANSLATEGEMMA", "QWENMT") in user-facing copy.
  const methodLabel = findMethodLabel(translationMethod);

  // Methods that need explicit source (no auto-detect mode in the model). Keep
  // this check ahead of UNSUPPORTED_LANGS so the user sees a fix-the-source
  // hint instead of the misleading "doesn't support Auto" wording.
  if (sourceLanguage === "auto" && REQUIRES_EXPLICIT_SOURCE.has(translationMethod)) {
    return {
      supported: false,
      errorMessage: `${methodLabel} requires an explicit source language (no auto-detect). Please select a specific source language. / ${methodLabel} 不支持自动检测源语言，请明确选择一个源语言。`,
    };
  }

  if (!isMethodSupportedForLanguage(translationMethod, sourceLanguage)) {
    return {
      supported: false,
      errorMessage: `${methodLabel} doesn't support ${sourceName}. Please pick another language or translation method.`,
    };
  }
  if (!isMethodSupportedForLanguage(translationMethod, targetLanguage)) {
    return {
      supported: false,
      errorMessage: `${methodLabel} doesn't support ${targetName}. Please pick another language or translation method.`,
    };
  }

  return { supported: true };
};

/**
 * Split text into chunks for batch translation (array join avoids O(n^2) string concat)
 */
export const splitTextIntoChunks = (text: string, maxLength: number, delimiter: string): string[] => {
  const chunks: string[] = [];
  const parts: string[] = [];
  let currentLength = 0;

  for (const line of text.split(delimiter)) {
    const addedLength = parts.length > 0 ? delimiter.length + line.length : line.length;
    if (currentLength + addedLength > maxLength && parts.length > 0) {
      chunks.push(parts.join(delimiter));
      parts.length = 0;
      currentLength = 0;
    }
    parts.push(line);
    currentLength += parts.length === 1 ? line.length : delimiter.length + line.length;
  }

  if (parts.length > 0) {
    chunks.push(parts.join(delimiter));
  }

  return chunks;
};

export type PromptParts = { prefix: string; suffix: string };

/**
 * Build AI model prompt with variable substitution, returned SPLIT at the
 * template's first ${content}: `prefix` is everything rendered before it (the
 * user's instructions, ${fullText}, the context-batch preamble) and is
 * byte-identical across requests; `suffix` is the content plus whatever
 * follows. Provider prefix caching keys on exactly this boundary
 * (subtitle-translator#53): Claude marks `prefix` with cache_control,
 * OpenAI-compat providers match the byte prefix automatically. A template
 * without ${content} renders entirely into `prefix`.
 * @param fullText - Optional: complete text for ${fullText} variable (only processed when prompt contains ${fullText})
 *
 * Two invariants here are load-bearing (both shipped corrupted output before):
 *
 * 1. SUBSTITUTION ORDER — every template variable resolves BEFORE ${content}
 *    is inserted, so tokens occurring literally inside user content are never
 *    treated as variables. Previously a doc line containing `${fullText}`
 *    injected the entire document into its own position (token blowup →
 *    context-length failure), and `${targetLanguage}` inside content was
 *    silently rewritten to a language name before translation.
 *
 * 2. FUNCTION-FORM REPLACEMENTS for user-controlled values — a string passed
 *    as `.replace`/`.replaceAll`'s second arg undergoes GetSubstitution:
 *    `$$` collapses to `$` (LaTeX `$$E=mc^2$$` → `$E=mc^2$`), `$'` deletes
 *    itself + swallows context, $` duplicates the preceding text, `$&`
 *    re-injects the match. `() => value` is inserted verbatim.
 */
export const getAIModelPromptParts = (content: string, userPrompt: string, targetLanguage: string, sourceLanguage: string, fullText?: string): PromptParts => {
  let prompt = userPrompt;
  if (sourceLanguage === "auto") {
    prompt = prompt.replace(/from \${sourceLanguage} (to|into)/g, "into");
  }

  prompt = prompt.replaceAll("${sourceLanguage}", getLanguageName(sourceLanguage));
  prompt = prompt.replaceAll("${targetLanguage}", getLanguageName(targetLanguage));
  // ${fullText} gate checked on the WHOLE template BEFORE content insertion —
  // only the user's own template can opt in, never a literal token inside the
  // document body.
  // ${fullText} 与 ${content} 必须【单趟】替换:先插全文再扫 ${content} 会把
  // 文档正文里的字面 ${content}(讲模板/提示词的文档)当变量展开 —— 当前
  // 待译块被拼进上下文,且坏 prompt 的产出会进缓存(违反不变量 #1)。
  // 切分同样在【模板】上做(渲染前):全文正文里的字面 ${content} 不能成为切点。
  const usesFullText = prompt.includes("${fullText}");
  const full = fullText || content;
  const render = (tpl: string): string =>
    usesFullText ? tpl.replace(/\$\{(?:fullText|content)\}/g, (m) => (m === "${fullText}" ? full : content)) : tpl.replaceAll("${content}", () => content);
  const at = prompt.indexOf("${content}");
  if (at < 0) return { prefix: render(prompt), suffix: "" };
  return { prefix: render(prompt.slice(0, at)), suffix: render(prompt.slice(at)) };
};

export const getAIModelPrompt = (content: string, userPrompt: string, targetLanguage: string, sourceLanguage: string, fullText?: string): string => {
  const { prefix, suffix } = getAIModelPromptParts(content, userPrompt, targetLanguage, sourceLanguage, fullText);
  return prefix + suffix;
};

/**
 * Clean HTML entities from translated text (single-pass replacement)
 */
const HTML_ENTITY_MAP: Record<string, string> = {
  "&#39;": "'",
  "&quot;": '"',
  "&apos;": "'",
  "&amp;": "&",
  "&lt;": "<",
  "&gt;": ">",
};
const HTML_ENTITY_RE = /&#39;|&quot;|&apos;|&amp;|&lt;|&gt;/g;

export const cleanTranslatedText = (text: string): string => {
  return text.replace(HTML_ENTITY_RE, (match) => HTML_ENTITY_MAP[match]);
};
