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
 * 用户指南 URL 路径映射
 * User guide URL path mapping
 */
const USER_GUIDE_PATHS: Record<string, string> = {
  // 翻译工具
  "json-translate": "translation/json-translate/index",
  "subtitle-translator": "translation/subtitle-translator/index",
  "md-translator": "translation/md-translator/index",
  // 文本工具
  "text-splitter": "tools/text-splitter",
  // JSON 工具
  "json-value-extractor": "json/json-value-extractor",
  "json-node-edit": "json/json-node-edit",
  "json-value-transformer": "json/json-value-transformer",
  "json-value-swapper": "json/json-value-swapper",
  "json-node-inserter": "json/json-node-inserter",
  "json-sort-classify": "json/json-sort-classify",
  "json-match-update": "json/json-match-update",
};

/**
 * 获取用户指南 URL
 * Get user guide URL based on tool key and locale
 * @param toolKey - 工具标识符 (e.g., "json-translate", "text-splitter")
 * @param locale - 当前语言
 * @returns 完整的用户指南 URL
 */
export const getUserGuideUrl = (toolKey: string, locale: string): string => {
  const path = USER_GUIDE_PATHS[toolKey];
  if (!path) return "#";

  const langPrefix = isChineseLocale(locale) ? "" : "en/";
  return `https://docs.newzone.top/${langPrefix}guide/${path}.html`;
};
