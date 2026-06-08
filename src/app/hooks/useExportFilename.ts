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
 * @param toolKey - Unique key for the tool (e.g., 'subtitle-translator', 'md-translator', 'json-translate') to store separate patterns
 *
 * Supports placeholders:
 * - {name} - original filename without extension
 * - {lang} - target language code
 * - {ext} - file extension (can be forced via defaultExt)
 * - {date} - current date (YYYY-MM-DD)
 * - {time} - current time (HHMMss)
 */
export const useExportFilename = (toolKey: string = "default"): ExportFilenameConfig => {
  const storageKey = `${toolKey}-exportFileName`;
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

    // Replace placeholders。函数形式替换:文件名常含 $ 字符($&/$'/$$ 会被
    // GetSubstitution 解释,产生损坏的下载名,$' 还会把后文吞进去)。
    if (customFileName.trim()) {
      let result = customFileName
        .replace(/\{name\}/gi, () => baseName)
        .replace(/\{lang\}/gi, () => langCode)
        .replace(/\{ext\}/gi, () => ext)
        .replace(/\{date\}/gi, () => dateStr)
        .replace(/\{time\}/gi, () => timeStr);

      // Ensure the result has an extension — 检查【最后一段】而不是任意位置的
      // 点:字幕发布组习惯的 "My.Show.S01E01" 基名会让 includes(".") 误判。
      // 已以目标扩展名结尾则不再追加(".markdown" 等长扩展曾被 5 字符上限
      // 误判成"非扩展名"而重复追加成 .markdown.markdown)。
      // 长扩展名(markdown)走 endsWithTargetExt;泛化的"末段像扩展名"收窄到
      // ≤4 字符,否则点分基名段(My.Show.S01E01 的 "S01E01" 6 字符)被误判成
      // 扩展名,该补的扩展名反而不补,下载文件无扩展名。
      const lastSegment = result.slice(result.lastIndexOf(".") + 1);
      const endsWithTargetExt = result.toLowerCase().endsWith(`.${ext.toLowerCase()}`);
      const looksLikeExt = result.includes(".") && /^[a-z0-9]{1,4}$/i.test(lastSegment);
      if (!endsWithTargetExt && !looksLikeExt) {
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
