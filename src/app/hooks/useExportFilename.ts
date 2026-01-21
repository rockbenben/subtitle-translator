"use client";

import { useLocalStorage } from "./useLocalStorage";

interface ExportFilenameConfig {
  /** User-defined custom filename pattern */
  customFileName: string;
  /** Setter for the custom filename */
  setCustomFileName: (value: string) => void;
  /**
   * Generate the final filename based on the custom pattern or fallback to default
   * @param originalFileName - Original filename (can include extension)
   * @param langCode - Target language code
   * @param defaultExt - Force extension (e.g., 'ass' for bilingual subtitles), undefined to keep original
   */
  generateFileName: (originalFileName: string, langCode: string, defaultExt?: string) => string;
}

/**
 * Hook for managing custom export filename with localStorage persistence.
 *
 * @param toolKey - Unique key for the tool (e.g., 'subtitle', 'md', 'json') to store separate patterns
 *
 * Supports placeholders:
 * - {name} - original filename without extension
 * - {lang} - target language code
 * - {ext} - file extension (can be forced via defaultExt)
 * - {date} - current date (YYYY-MM-DD)
 * - {time} - current time (HHMMss)
 */
export const useExportFilename = (toolKey: string = "default"): ExportFilenameConfig => {
  const storageKey = `exportFileName_${toolKey}`;
  const [customFileName, setCustomFileName] = useLocalStorage<string>(storageKey, "{name}_{lang}.{ext}");

  const generateFileName = (originalFileName: string, langCode: string, defaultExt?: string): string => {
    // Extract name and extension from original filename
    const lastDotIndex = originalFileName.lastIndexOf(".");
    let baseName: string;
    let originalExt: string;

    if (lastDotIndex !== -1 && lastDotIndex > 0) {
      baseName = originalFileName.slice(0, lastDotIndex);
      originalExt = originalFileName.slice(lastDotIndex + 1);
    } else {
      baseName = originalFileName || "translated";
      originalExt = "txt";
    }

    // Use defaultExt if provided (e.g., forced 'ass' for bilingual subtitles)
    const ext = defaultExt || originalExt;

    // Generate date and time strings
    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ""); // HHMMss

    // Replace placeholders
    if (customFileName.trim()) {
      let result = customFileName
        .replace(/\{name\}/gi, baseName)
        .replace(/\{lang\}/gi, langCode)
        .replace(/\{ext\}/gi, ext)
        .replace(/\{date\}/gi, dateStr)
        .replace(/\{time\}/gi, timeStr);

      // Ensure the result has an extension
      if (!result.includes(".")) {
        result = `${result}.${ext}`;
      }

      return result;
    }

    // Default pattern
    return `${baseName}_${langCode}.${ext}`;
  };

  return {
    customFileName,
    setCustomFileName,
    generateFileName,
  };
};

export default useExportFilename;
