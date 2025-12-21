/**
 * Navigation Configuration Constants
 * 导航栏配置常量 - 方便复用到其他项目
 */

// ============ 语言配置 ============

export interface Language {
  key: string;
  label: string;
}

/**
 * 支持的语言列表
 * Supported languages list
 */
export const LANGUAGES: readonly Language[] = [
  { key: "zh", label: "中文" },
  { key: "en", label: "English" },
  { key: "es", label: "Español" },
  { key: "hi", label: "हिन्दी" },
  { key: "ar", label: "العربية" },
  { key: "pt", label: "Português" },
  { key: "fr", label: "Français" },
  { key: "de", label: "Deutsch" },
  { key: "ja", label: "日本語" },
  { key: "ko", label: "한국어" },
  { key: "ru", label: "Русский" },
  { key: "vi", label: "Tiếng Việt" },
  { key: "tr", label: "Türkçe" },
  { key: "zh-hant", label: "繁体中文" },
  { key: "bn", label: "বাংলা" },
  { key: "id", label: "Indonesia" },
  { key: "it", label: "Italiano" },
] as const;

// ============ 社交链接配置 ============

/**
 * 社交链接配置
 * Social links configuration
 */
export const SOCIAL_LINKS = {
  github: "https://github.com/rockbenben/subtitle-translator",
  discord: "https://discord.gg/PZTQfJ4GjX",
  telegram: "https://t.me/aishort_top",
  qq: "https://qm.qq.com/q/qvephMO8q4",
} as const;
