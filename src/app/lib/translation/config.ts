// Translation service configuration

import type { TranslationServiceInfo } from "./types";

export const DEFAULT_SYS_PROMPT = "You are a professional translator. Respond only with the content, either translated or rewritten. Do not add explanations, comments, or any extra text.";
export const DEFAULT_USER_PROMPT = "Please respect the original meaning, maintain the original format, and rewrite the following content in ${targetLanguage}.\n\n${content}";

export const TRANSLATION_SERVICES: TranslationServiceInfo[] = [
  { value: "gtxFreeAPI", label: "GTX API (Free)" },
  {
    value: "google",
    label: "Google Translate",
    docs: "https://docs.cloud.google.com/translate/docs/setup",
  },
  {
    value: "deepl",
    label: "DeepL",
    docs: "https://developers.deepl.com/docs/api-reference/translate",
    apiKeyUrl: "https://www.deepl.com/your-account/keys",
  },
  {
    value: "azure",
    label: "Azure Translate",
    docs: "https://learn.microsoft.com/azure/ai-services/translator/text-translation/reference/v3/translate",
  },
  {
    value: "deeplx",
    label: "DeepLX (Free)",
    docs: "https://deeplx.owo.network/endpoints/free.html",
  },
  {
    value: "deepseek",
    label: "DeepSeek",
    docs: "https://api-docs.deepseek.com/zh-cn/",
    apiKeyUrl: "https://platform.deepseek.com/api_keys",
  },
  {
    value: "openai",
    label: "OpenAI",
    docs: "https://platform.openai.com/docs/api-reference/chat",
    apiKeyUrl: "https://platform.openai.com/api-keys",
  },
  {
    value: "gemini",
    label: "Gemini",
    docs: "https://ai.google.dev/gemini-api/docs/text-generation",
    apiKeyUrl: "https://aistudio.google.com/app/api-keys",
  },
  {
    value: "perplexity",
    label: "Perplexity",
    docs: "https://docs.perplexity.ai/api-reference/chat-completions-post",
    apiKeyUrl: "https://www.perplexity.ai/account/api/keys",
  },
  {
    value: "azureopenai",
    label: "Azure OpenAI",
    docs: "https://learn.microsoft.com/azure/ai-foundry/foundry-models/concepts/models-sold-directly-by-azure",
  },
  {
    value: "siliconflow",
    label: "SiliconFlow",
    docs: "https://docs.siliconflow.cn/api-reference/chat-completions/chat-completions",
    apiKeyUrl: "https://cloud.siliconflow.cn/me/account/ak",
  },
  {
    value: "groq",
    label: "Groq",
    docs: "https://console.groq.com/docs/text-chat",
    apiKeyUrl: "https://console.groq.com/keys",
  },
  {
    value: "openrouter",
    label: "OpenRouter",
    docs: "https://openrouter.ai/models?q=free",
    apiKeyUrl: "https://openrouter.ai/settings/keys",
  },
  { value: "llm", label: "Custom LLM" },
];

export const LLM_MODELS = ["deepseek", "openai", "gemini", "perplexity", "azureopenai", "siliconflow", "groq", "openrouter", "llm"];

export const categorizedOptions = [
  ...TRANSLATION_SERVICES.filter((s) => !LLM_MODELS.includes(s.value)).map((s) => ({
    label: s.label,
    value: s.value,
  })),
  {
    label: "AI LLM Models",
    options: TRANSLATION_SERVICES.filter((s) => LLM_MODELS.includes(s.value)).map((s) => ({
      label: s.label,
      value: s.value,
    })),
  },
];

export const defaultConfigs = {
  gtxFreeAPI: {
    batchSize: 100,
  },
  deeplx: {
    url: "",
    chunkSize: 1000,
    delayTime: 200,
    batchSize: 10,
  },
  deepl: {
    url: "",
    apiKey: "",
    chunkSize: 5000,
    delayTime: 200,
    batchSize: 20,
  },
  deepseek: {
    apiKey: "",
    model: "deepseek-chat",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
    useRelay: false,
  },
  openai: {
    apiKey: "",
    model: "gpt-5-mini",
    temperature: 1,
    batchSize: 20,
    contextWindow: 50,
  },
  gemini: {
    apiKey: "",
    model: "gemini-2.5-flash",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  perplexity: {
    apiKey: "",
    model: "sonar",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  azureopenai: {
    url: "",
    apiKey: "",
    model: "gpt-5-mini",
    apiVersion: "2025-08-07",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  siliconflow: {
    apiKey: "",
    model: "deepseek-ai/DeepSeek-V3",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  groq: {
    apiKey: "",
    model: "openai/gpt-oss-20b",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  openrouter: {
    apiKey: "",
    model: "mistralai/devstral-2512:free",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  llm: {
    url: "http://127.0.0.1:11434/v1/chat/completions",
    apiKey: "",
    model: "llama3.2",
    temperature: 0.7,
    batchSize: 20,
    contextWindow: 50,
  },
  azure: {
    apiKey: "",
    chunkSize: 10000,
    delayTime: 200,
    region: "eastasia",
    batchSize: 100,
  },
  google: {
    apiKey: "",
    delayTime: 200,
    batchSize: 100,
  },
  webgoogletranslate: {
    batchSize: 1,
  },
} as const;

export const findMethodLabel = (method: string): string => {
  const service = TRANSLATION_SERVICES.find((s) => s.value === method);
  return service ? service.label : method;
};

export const isConfigStructureValid = (config: Record<string, unknown>, defaultConfig: Record<string, unknown>): boolean => {
  const configKeys = Object.keys(config).sort();
  const defaultKeys = Object.keys(defaultConfig).sort();
  return JSON.stringify(configKeys) === JSON.stringify(defaultKeys);
};
