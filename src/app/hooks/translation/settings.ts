// Translation settings export/import utilities

import { downloadFile } from "@/app/utils";
import type { TranslationConfig } from "@/app/lib/translation";
import type { GlossaryPreset } from "@/app/lib/translation/glossary";

export interface TranslationSettings {
  translationConfigs: Record<string, TranslationConfig>;
  systemPrompt: string;
  userPrompt: string;
  translationMethod: string;
  sourceLanguage: string;
  targetLanguage: string;
  targetLanguages: string[];
  multiLanguageMode: boolean;
  llmPresets?: Array<{ id: string; name: string; config: TranslationConfig }>;
  activeLlmPresetId?: string;
  promptPresets?: Array<{ id: string; name: string; systemPrompt: string; userPrompt: string }>;
  activePromptPresetId?: string;
  glossaryPresets?: GlossaryPreset[];
  activeGlossaryPresetId?: string;
  glossaryEnabled?: boolean;
  // 翻译行为调优项,跨设备同步时这些数值也要带上；默认使用缓存，不记忆
  retryCount?: number;
  requestTimeoutSec?: number;
  removeChars?: string;
  exportDate?: string;
  version?: string;
}

/**
 * Export translation settings to a JSON file
 * Returns true on success, throws error on failure
 */
export const exportTranslationSettings = async (settings: Omit<TranslationSettings, "exportDate" | "version">): Promise<void> => {
  const exportData: TranslationSettings = {
    ...settings,
    exportDate: new Date().toISOString(),
    version: "1.0",
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  const fileName = `translation-settings-${new Date().toISOString().split("T")[0]}.json`;

  await downloadFile(jsonString, fileName, "application/json");
};

/**
 * Light structural sanity check: a parseable JSON object is not necessarily a
 * settings file. Verify a couple of expected top-level keys/types so we reject
 * foreign/malformed JSON instead of applying it and showing a false success.
 */
const isTranslationSettings = (value: unknown): value is TranslationSettings => {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.translationMethod === "string" &&
    typeof obj.translationConfigs === "object" &&
    obj.translationConfigs !== null &&
    Array.isArray(obj.targetLanguages)
  );
};

// Per-field expected types. Import applies fields individually with
// `!== undefined` gates, so a wrong-typed field (systemPrompt: null,
// glossaryPresets: {} — hand-edited or corrupted files) would land in
// localStorage as-is and persistently crash every consumer of that value
// until storage is hand-cleared. Sanitizing drops the bad field — the import
// simply skips it, keeping the user's existing value.
const FIELD_KINDS: Record<keyof Omit<TranslationSettings, "translationMethod" | "translationConfigs" | "targetLanguages">, "string" | "boolean" | "number" | "array"> = {
  systemPrompt: "string",
  userPrompt: "string",
  sourceLanguage: "string",
  targetLanguage: "string",
  multiLanguageMode: "boolean",
  llmPresets: "array",
  activeLlmPresetId: "string",
  promptPresets: "array",
  activePromptPresetId: "string",
  glossaryPresets: "array",
  activeGlossaryPresetId: "string",
  glossaryEnabled: "boolean",
  retryCount: "number",
  requestTimeoutSec: "number",
  removeChars: "string",
  exportDate: "string",
  version: "string",
};

const matchesKind = (value: unknown, kind: "string" | "boolean" | "number" | "array"): boolean => (kind === "array" ? Array.isArray(value) : typeof value === kind);

const sanitizeSettings = (settings: TranslationSettings): TranslationSettings => {
  const out = { ...settings } as Record<string, unknown>;
  for (const [field, kind] of Object.entries(FIELD_KINDS)) {
    if (out[field] !== undefined && !matchesKind(out[field], kind)) {
      delete out[field];
    }
  }
  // glossaryPresets 深度校验:Array.isArray 不够 —— terms 里混入非字符串
  // source/target(手编文件、坏导出、改名前 {from,to} 形状的旧文件)会进
  // localStorage,后续 term.source.trim() 在每次翻译时抛 TypeError,工具
  // 持久性白屏直到手清存储。不合形状的词条直接丢弃(不做 from/to 迁移)。
  if (Array.isArray(out.glossaryPresets)) {
    out.glossaryPresets = (out.glossaryPresets as unknown[])
      .filter((p): p is { id: string; name: string; terms: unknown } => typeof p === "object" && p !== null && typeof (p as { id?: unknown }).id === "string" && typeof (p as { name?: unknown }).name === "string")
      .map((p) => ({
        ...p,
        terms: Array.isArray(p.terms)
          ? (p.terms as unknown[]).filter(
              (t): t is { source: string; target: string; targetLang: string } =>
                typeof t === "object" && t !== null && typeof (t as { source?: unknown }).source === "string" && typeof (t as { target?: unknown }).target === "string" && typeof (t as { targetLang?: unknown }).targetLang === "string",
            )
          : [],
      }));
  }
  return out as unknown as TranslationSettings;
};

/**
 * Create file input and read JSON settings file
 * Returns parsed settings, throws error on failure
 */
export const createSettingsFileInput = (
  onSettingsLoaded: (settings: TranslationSettings) => void,
  readFile: (file: File, callback: (content: string) => void) => void,
): Promise<TranslationSettings> => {
  return new Promise((resolve, reject) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";

    fileInput.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      readFile(file, (content) => {
        try {
          const parsed = JSON.parse(content) as unknown;

          if (!isTranslationSettings(parsed)) {
            reject(new Error("Not a valid translation settings file. / 不是有效的翻译设置文件。"));
            return;
          }

          const sanitized = sanitizeSettings(parsed);
          onSettingsLoaded(sanitized);
          resolve(sanitized);
        } catch (parseError) {
          console.error("Parse error:", parseError);
          reject(new Error("Failed to parse settings file. / 无法解析设置文件。"));
        }
      });
    };

    fileInput.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    document.body.appendChild(fileInput);
    fileInput.click();

    // Cleanup DOM element after change fires or after user cancels (no change event)
    const cleanup = () => {
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput);
      }
    };

    // Use change event for cleanup after file selection; use focusback for cancel detection
    fileInput.addEventListener("change", () => setTimeout(cleanup, 0), { once: true });
    window.addEventListener("focus", () => setTimeout(cleanup, 300), { once: true });
  });
};
