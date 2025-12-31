// Translation service types

export interface TranslationServiceInfo {
  value: string;
  label: string;
  docs?: string;
  apiKeyUrl?: string;
}

export type TranslationMethod = string;

export interface TranslateTextParams {
  text: string;
  cacheSuffix: string;
  translationMethod: string;
  targetLanguage: string;
  sourceLanguage: string;
  useCache?: boolean;
  apiKey?: string;
  region?: string;
  url?: string;
  model?: string;
  apiVersion?: string;
  temperature?: number;
  sysPrompt?: string;
  userPrompt?: string;
  useRelay?: boolean;
  fullText?: string; // Optional: complete text for ${fullText} variable
  signal?: AbortSignal; // Optional: for request cancellation
}

export type TranslationService = (params: TranslateTextParams) => Promise<string>;

export interface TranslationConfig {
  apiKey?: string;
  url?: string;
  region?: string;
  model?: string;
  apiVersion?: string;
  temperature?: number;
  chunkSize?: number;
  delayTime?: number;
  batchSize?: number;
  contextWindow?: number;
  sysPrompt?: string;
  userPrompt?: string;
  useRelay?: boolean;
}
