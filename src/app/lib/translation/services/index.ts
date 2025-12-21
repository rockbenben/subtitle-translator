// Translation services index

import type { TranslationService } from "../types";
import * as traditional from "./traditional";
import * as llm from "./llm";

// Combine all translation services
export const translationServices: Record<string, TranslationService> = {
  // Traditional APIs
  gtxFreeAPI: traditional.gtxFreeAPI,
  google: traditional.google,
  deepl: traditional.deepl,
  deeplx: traditional.deeplx,
  azure: traditional.azure,
  webgoogletranslate: traditional.webgoogletranslate,

  // LLM APIs
  deepseek: llm.deepseek,
  openai: llm.openai,
  gemini: llm.gemini,
  perplexity: llm.perplexity,
  azureopenai: llm.azureopenai,
  siliconflow: llm.siliconflow,
  groq: llm.groq,
  openrouter: llm.openrouter,
  llm: llm.llm,
};

// Re-export individual services for direct imports
export * from "./traditional";
export * from "./llm";
