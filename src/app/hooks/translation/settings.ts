// Translation settings export/import utilities

import { downloadFile } from "@/app/utils";
import type { TranslationConfig } from "@/app/lib/translation";

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
  promptPresets?: Array<{ id: string; name: string; systemPrompt: string; userPrompt: string }>;
  activePromptPresetId?: string;
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

          onSettingsLoaded(parsed);
          resolve(parsed);
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
