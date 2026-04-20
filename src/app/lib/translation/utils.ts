// Translation utility functions

import { languages, isMethodSupportedForLanguage } from "./languages-data";
import type { TranslationMethod } from "./types";

// Pre-computed lookup maps for O(1) language access
const languageNameMap = new Map(languages.map((lang) => [lang.value, lang.name]));
const validLanguageCodes = new Set(languages.map((lang) => lang.value));

/**
 * Get language name from language code (O(1) Map lookup)
 */
export const getLanguageName = (value: string): string => {
  return languageNameMap.get(value) ?? value;
};

/**
 * Check if a value is a valid language code
 */
export const isValidLanguageValue = (testValue: string): boolean => {
  return validLanguageCodes.has(testValue);
};

/**
 * Check if a translation method supports the given source and target languages
 */

export const checkLanguageSupport = (translationMethod: TranslationMethod, sourceLanguage: string, targetLanguage: string): { supported: boolean; errorMessage?: string } => {
  const sourceName = languageNameMap.get(sourceLanguage);
  const targetName = languageNameMap.get(targetLanguage);

  if (!sourceName || !targetName) {
    return { supported: false, errorMessage: "Invalid language code provided" };
  }

  if (!isMethodSupportedForLanguage(translationMethod, sourceLanguage)) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} doesn't support ${sourceName}. Switching to free GTX API now.`,
    };
  }
  if (!isMethodSupportedForLanguage(translationMethod, targetLanguage)) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} doesn't support ${targetName}. Switching to free GTX API now.`,
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
 */
export const getAIModelPrompt = (content: string, userPrompt: string, targetLanguage: string, sourceLanguage: string, fullText?: string): string => {
  let prompt = userPrompt;
  if (sourceLanguage === "auto") {
    prompt = prompt.replace(/from \${sourceLanguage} (to|into)/g, "into");
  }

  const vars: Record<string, string> = {
    "${sourceLanguage}": getLanguageName(sourceLanguage),
    "${targetLanguage}": getLanguageName(targetLanguage),
    "${content}": content,
  };
  if (prompt.includes("${fullText}")) {
    vars["${fullText}"] = fullText || content;
  }

  for (const [key, value] of Object.entries(vars)) {
    prompt = prompt.replaceAll(key, value);
  }
  return prompt;
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
