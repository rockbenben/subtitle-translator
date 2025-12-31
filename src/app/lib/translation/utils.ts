// Translation utility functions

import { languages, isMethodSupportedForLanguage } from "./languages-data";
import type { TranslationMethod } from "./types";

/**
 * Get language name from language code
 */
export const getLanguageName = (value: string): string => {
  const language = languages.find((lang) => lang.value === value);
  return language ? language.name : value;
};

/**
 * Check if a value is a valid language code
 */
const validLanguageCodes = new Set(languages.map((lang) => lang.value));
export const isValidLanguageValue = (testValue: string): boolean => {
  return validLanguageCodes.has(testValue);
};

/**
 * Check if a translation method supports the given source and target languages
 * Returns { supported: boolean, errorMessage?: string }
 */
export const checkLanguageSupport = (translationMethod: TranslationMethod, sourceLanguage: string, targetLanguage: string): { supported: boolean; errorMessage?: string } => {
  const sourceLang = languages.find((lang) => lang.value === sourceLanguage);
  const targetLang = languages.find((lang) => lang.value === targetLanguage);

  if (!sourceLang || !targetLang) {
    console.error("Invalid language code provided");
    return { supported: false, errorMessage: "Invalid language code provided" };
  }

  const isSourceSupported = isMethodSupportedForLanguage(translationMethod, sourceLanguage);
  const isTargetSupported = isMethodSupportedForLanguage(translationMethod, targetLanguage);

  if (!isSourceSupported) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} doesn't support ${sourceLang.name}. Switching to free GTX API now.`,
    };
  }
  if (!isTargetSupported) {
    return {
      supported: false,
      errorMessage: `${translationMethod.toUpperCase()} doesn't support ${targetLang.name}. Switching to free GTX API now.`,
    };
  }

  return { supported: true };
};

/**
 * Split text into chunks for batch translation
 */
export const splitTextIntoChunks = (text: string, maxLength: number, delimiter: string): string[] => {
  const chunks: string[] = [];
  let currentChunk = "";

  text.split(delimiter).forEach((line) => {
    if (currentChunk.length + line.length + 1 > maxLength) {
      chunks.push(currentChunk);
      currentChunk = line;
    } else {
      currentChunk += currentChunk ? delimiter + line : line;
    }
  });

  if (currentChunk) {
    chunks.push(currentChunk);
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
  prompt = prompt.replace("${sourceLanguage}", getLanguageName(sourceLanguage)).replace("${targetLanguage}", getLanguageName(targetLanguage)).replace("${content}", content);

  // Only replace ${fullText} if it's actually used in the prompt
  if (prompt.includes("${fullText}")) {
    prompt = prompt.replace("${fullText}", fullText || content);
  }

  return prompt;
};

/**
 * Clean HTML entities from translated text
 */
export const cleanTranslatedText = (text: string): string => {
  return text
    .replace(/&#39;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
};
