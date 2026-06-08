import { languages, isMethodSupportedForLanguage, REQUIRES_EXPLICIT_SOURCE } from "./languages-data";
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

  // Methods that need explicit source (no auto-detect mode in the model). Keep
  // this check ahead of UNSUPPORTED_LANGS so the user sees a fix-the-source
  // hint instead of the misleading "doesn't support Auto" wording.
  if (sourceLanguage === "auto" && REQUIRES_EXPLICIT_SOURCE.has(translationMethod)) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} requires an explicit source language (no auto-detect). Please select a specific source language. / ${translationMethod.toUpperCase()} 不支持自动检测源语言，请明确选择一个源语言。`,
    };
  }

  if (!isMethodSupportedForLanguage(translationMethod, sourceLanguage)) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} doesn't support ${sourceName}. Please pick another language or translation method.`,
    };
  }
  if (!isMethodSupportedForLanguage(translationMethod, targetLanguage)) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} doesn't support ${targetName}. Please pick another language or translation method.`,
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

/**
 * Build AI model prompt with variable substitution
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
export const getAIModelPrompt = (content: string, userPrompt: string, targetLanguage: string, sourceLanguage: string, fullText?: string): string => {
  let prompt = userPrompt;
  if (sourceLanguage === "auto") {
    prompt = prompt.replace(/from \${sourceLanguage} (to|into)/g, "into");
  }

  prompt = prompt.replaceAll("${sourceLanguage}", getLanguageName(sourceLanguage));
  prompt = prompt.replaceAll("${targetLanguage}", getLanguageName(targetLanguage));
  // ${fullText} gate checked BEFORE content insertion — only the user's own
  // template can opt in, never a literal token inside the document body.
  if (prompt.includes("${fullText}")) {
    const full = fullText || content;
    prompt = prompt.replaceAll("${fullText}", () => full);
  }
  return prompt.replaceAll("${content}", () => content);
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
