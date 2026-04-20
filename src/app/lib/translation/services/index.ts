// Translation services index

import type { TranslationMethod, TranslationService } from "../types";
import * as traditional from "./traditional";
import * as llm from "./llm";

// Combine all translation services with type-safe keys
export const translationServices: Record<TranslationMethod, TranslationService> = {
  // Traditional APIs
  gtxFreeAPI: traditional.gtxFreeAPI,
  google: traditional.google,
  deepl: traditional.deepl,
  deeplx: traditional.deeplx,
  azure: traditional.azure,
  webgoogletranslate: traditional.webgoogletranslate,
  qwenMt: traditional.qwenMt,

  // LLM APIs — 12 OpenAI-compatible services auto-registered from OPENAI_COMPAT_PROVIDERS
  ...llm.openAICompatServices,

  // LLM APIs — special-case providers that don't fit the OpenAI-compatible shape
  claude: llm.claude,
  gemini: llm.gemini,
  azureopenai: llm.azureopenai,
  nvidia: llm.nvidia,
  llm: llm.llm,
};

// Re-export individual services for direct imports
export * from "./traditional";
export * from "./llm";
