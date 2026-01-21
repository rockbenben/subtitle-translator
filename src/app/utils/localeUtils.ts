/**
 * Locale Utilities
 * 语言/区域相关工具函数
 */

/**
 * 判断是否为中文区域 (简体/繁体)
 * Check if locale is Chinese (Simplified or Traditional)
 */
export const isChineseLocale = (locale: string): boolean => {
  return locale === "zh" || locale === "zh-hant";
};

/**
 * 获取文档 URL（通用）
 * Get documentation URL with locale-aware prefix
 * @param path - 文档路径 (e.g., "guide/translation/json-translate/index.html")
 * @param locale - 当前语言
 * @returns 完整的文档 URL
 */
export const getDocUrl = (path: string, locale: string): string => {
  const langPrefix = isChineseLocale(locale) ? "" : "en/";
  return `https://docs.newzone.top/${langPrefix}${path}`;
};
