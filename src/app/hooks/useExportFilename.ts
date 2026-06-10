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

      // Ensure the result has an extension. 是否"已带扩展名"必须基于【用户的
      // pattern】判断,而不是展开后的结果末段:{name} 展开出的点分基名尾段
      // ("My.Show" 的 "Show"、"s01.e05" 的 "e05")会被结果级启发式误判成扩展名,
      // 于是该补的扩展名不补 —— 下载出无扩展名(字幕场景尤其常见,download 组
      // 文件名几乎都点分)。pattern 已以 {ext} 占位符或字面 ".xxx"(1-4 位) 结尾
      // 才算用户已指定扩展名;否则一律补 ext。endsWithTargetExt 仍保留:结果恰好
      // 已以目标扩展名结尾(基名自带 / 重复 .markdown)时不重复追加。
      const trimmedPattern = customFileName.trim();
      const patternSpecifiesExt = /\{ext\}$/i.test(trimmedPattern) || /\.[a-z0-9]{1,4}$/i.test(trimmedPattern);
      const endsWithTargetExt = result.toLowerCase().endsWith(`.${ext.toLowerCase()}`);
      if (!endsWithTargetExt && !patternSpecifiesExt) {
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
