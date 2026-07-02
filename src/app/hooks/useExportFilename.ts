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
   * @param disambiguateLang - true in multi-language mode: inject `_{lang}` before the
   *   extension when the pattern doesn't already vary by {lang}, so N target languages
   *   don't collide into one filename. Single-language exports stay clean ({name}.{ext}).
   */
  generateFileName: (originalFileName: string, langCode: string, defaultExt?: string, disambiguateLang?: boolean) => string;
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
  // Default is the CLEAN `{name}.{ext}` — most exports are single-language and
  // users expect the original name. Multi-language collisions are handled by the
  // `disambiguateLang` arg (auto-injects _{lang}), NOT by baking {lang} into the
  // default (which made every single-language export needlessly verbose).
  const [customFileName, setCustomFileName] = useLocalStorage<string>(storageKey, "{name}.{ext}");

  const generateFileName = (originalFileName: string, langCode: string, defaultExt?: string, disambiguateLang = false): string => {
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
    // en-CA 给出本地日历日的 YYYY-MM-DD:toISOString 是 UTC 日期,与下面的
    // 本地 {time} 错位 —— UTC+8(本站主用户群)在 0-8 点导出时 {date} 落在
    // 【昨天】,{date}_{time} 组合自相矛盾。
    const dateStr = new Intl.DateTimeFormat("en-CA").format(now); // YYYY-MM-DD
    const timeStr = now.toTimeString().slice(0, 8).replace(/:/g, ""); // HHMMss

    // Replace placeholders。函数形式替换:文件名常含 $ 字符($&/$'/$$ 会被
    // GetSubstitution 解释,产生损坏的下载名,$' 还会把后文吞进去)。
    // 单趟替换:链式 replace 会把【上一步展开文本里】的字面占位符再展开 ——
    // 文件名本身含 "{lang}"/"{date}"(i18n 模板文件 strings_{lang}.json、
    // 媒体名 "Movie {2023}")时 {name} 展开出的 token 被二次替换,下载名被改写。
    const pattern = customFileName.trim() || "{name}.{ext}";
    const tokens: Record<string, string> = { name: baseName, lang: langCode, ext, date: dateStr, time: timeStr };
    let result = pattern.replace(/\{(name|lang|ext|date|time)\}/gi, (_, p: string) => tokens[p.toLowerCase()]);

    // Ensure the result has an extension. 是否"已带扩展名"必须基于【用户的
    // pattern】判断,而不是展开后的结果末段:{name} 展开出的点分基名尾段
    // ("My.Show" 的 "Show"、"s01.e05" 的 "e05")会被结果级启发式误判成扩展名,
    // 于是该补的扩展名不补 —— 下载出无扩展名(字幕场景尤其常见,download 组
    // 文件名几乎都点分)。pattern 已以 {ext} 占位符或字面 ".xxx"(1-4 位) 结尾
    // 才算用户已指定扩展名;否则一律补 ext。endsWithTargetExt 仍保留:结果恰好
    // 已以目标扩展名结尾(基名自带 / 重复 .markdown)时不重复追加。
    const patternSpecifiesExt = /\{ext\}$/i.test(pattern) || /\.[a-z0-9]{1,4}$/i.test(pattern);
    const endsWithTargetExt = result.toLowerCase().endsWith(`.${ext.toLowerCase()}`);
    if (!endsWithTargetExt && !patternSpecifiesExt) {
      result = `${result}.${ext}`;
    }

    // Multi-language collision guard: when several target languages are exported
    // from ONE source, their names would otherwise be identical (browser appends
    // " (1)"/" (2)"). Inject _{lang} before the extension — but ONLY when the
    // pattern doesn't already carry {lang} (else double-tag), so a user who wrote
    // their own {lang} pattern, and every single-language export, are untouched.
    if (disambiguateLang && !/\{lang\}/i.test(pattern)) {
      const dot = result.lastIndexOf(".");
      result = dot > 0 ? `${result.slice(0, dot)}_${langCode}${result.slice(dot)}` : `${result}_${langCode}`;
    }

    return result;
  };

  return {
    customFileName,
    setCustomFileName,
    generateFileName,
  };
};

export default useExportFilename;
