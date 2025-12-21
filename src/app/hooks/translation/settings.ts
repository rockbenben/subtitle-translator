// Translation settings export/import utilities

import { downloadFile } from "@/app/utils";
import type { TranslationConfig } from "@/app/lib/translation";

export interface TranslationSettings {
  translationConfigs: Record<string, TranslationConfig>;
  sysPrompt: string;
  userPrompt: string;
  translationMethod: string;
  sourceLanguage: string;
  targetLanguage: string;
  target_langs: string[];
  multiLanguageMode: boolean;
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
 * Create file input and read JSON settings file
 * Returns parsed settings, throws error on failure
 */
export const createSettingsFileInput = (
  onSettingsLoaded: (settings: TranslationSettings) => void,
  readFile: (file: File, callback: (content: string) => void) => void
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
          const settings = JSON.parse(content) as TranslationSettings;

          if (!settings || typeof settings !== "object") {
            throw new Error("Invalid settings format");
          }

          onSettingsLoaded(settings);
          resolve(settings);
        } catch (parseError) {
          console.error("Parse error:", parseError);
          reject(new Error("Failed to parse settings file"));
        }
      });
    };

    fileInput.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    document.body.appendChild(fileInput);
    fileInput.click();

    // Cleanup DOM element
    const cleanup = () => {
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput);
      }
    };

    setTimeout(cleanup, 100);
    fileInput.addEventListener("change", cleanup, { once: true });
  });
};
