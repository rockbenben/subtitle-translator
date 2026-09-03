// Translation settings export/import utilities (browser side).
// 形状定义与 sanitizeSettings 住在 lib/translation/settingsSchema(CLI 的 -s
// 入口共用同一份消毒),这里只用不转发 —— 需要那些符号的地方请直接从
// lib/translation/settingsSchema 导入,别让同一个类型有两条活的导入路径。
// 本文件只留浏览器专属的导出下载与文件选择器。

import { downloadFile, readTextFile } from "@/app/utils";
import {
  isTranslationSettings,
  sanitizeSettings,
  type TranslationSettings,
} from "@/app/lib/translation/settingsSchema";

/**
 * Export translation settings to a JSON file
 * Returns true on success, throws error on failure
 */
export const exportTranslationSettings = async (
  settings: Omit<TranslationSettings, "exportDate" | "version">,
): Promise<void> => {
  const exportData: TranslationSettings = {
    ...settings,
    exportDate: new Date().toISOString(),
    version: "1.0",
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  // en-CA = 本地日历日 YYYY-MM-DD:toISOString 是 UTC 日期,UTC+8 用户 0-8 点
  // 导出时文件名落在【昨天】(exportDate 字段保留完整 ISO 时间戳,不受影响)。
  const fileName = `translation-settings-${new Intl.DateTimeFormat("en-CA").format(new Date())}.json`;

  await downloadFile(jsonString, fileName, "application/json");
};


/**
 * Create file input and read JSON settings file
 * Returns parsed settings, throws error on failure
 */
export const createSettingsFileInput = (onSettingsLoaded: (settings: TranslationSettings) => void): Promise<TranslationSettings> => {
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
      // readTextFile 走编码自适应解码;解码失败 / 非法 JSON / 形状不对都从这里 reject,
      // 调用方的 .catch 才跑得到(曾经只接成功回调,解码失败时 Promise 永不 settle)。
      readTextFile(file)
        .then((content) => {
          const parsed = JSON.parse(content) as unknown;
          if (!isTranslationSettings(parsed)) throw new Error("Not a valid translation settings file. / 不是有效的翻译设置文件。");
          const sanitized = sanitizeSettings(parsed);
          onSettingsLoaded(sanitized);
          resolve(sanitized);
        })
        .catch(reject);
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
    fileInput.addEventListener("change", () => setTimeout(cleanup, 0), {
      once: true,
    });
    window.addEventListener("focus", () => setTimeout(cleanup, 300), {
      once: true,
    });
  });
};
