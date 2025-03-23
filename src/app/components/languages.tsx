interface LanguageOption {
  value: string;
  labelKey: string;
  nativeLabel: string;
  name: string;
  unsupportedMethods?: string[];
}

// 部分语言不支持的翻译方法
const UNSUPPORTED_METHODS = ["deepl", "deeplx"];

//autocorrect:false
export const languages: LanguageOption[] = [
  { value: "auto", labelKey: "languages.auto", nativeLabel: "Auto", name: "Auto" },
  { value: "en", labelKey: "languages.english", nativeLabel: "English", name: "English" },
  { value: "zh", labelKey: "languages.chinese", nativeLabel: "简体", name: "Simplified Chinese" },
  { value: "zh-hant", labelKey: "languages.traditionalChinese", nativeLabel: "繁體", name: "Traditional Chinese" },
  { value: "pt", labelKey: "languages.portuguese", nativeLabel: "Português", name: "Portuguese" },
  { value: "it", labelKey: "languages.italian", nativeLabel: "Italiano", name: "Italian" },
  { value: "de", labelKey: "languages.german", nativeLabel: "Deutsch", name: "German" },
  { value: "ru", labelKey: "languages.russian", nativeLabel: "Русский", name: "Russian" },
  { value: "es", labelKey: "languages.spanish", nativeLabel: "Español", name: "Spanish" },
  { value: "fr", labelKey: "languages.french", nativeLabel: "Français", name: "French" },
  { value: "ja", labelKey: "languages.japanese", nativeLabel: "日本語", name: "Japanese" },
  { value: "ko", labelKey: "languages.korean", nativeLabel: "한국어", name: "Korean" },
  { value: "ar", labelKey: "languages.arabic", nativeLabel: "العربية", name: "Arabic" },
  { value: "tr", labelKey: "languages.turkish", nativeLabel: "Türkçe", name: "Turkish" },
  { value: "pl", labelKey: "languages.polish", nativeLabel: "Polski", name: "Polish" },
  { value: "uk", labelKey: "languages.ukrainian", nativeLabel: "Українська", name: "Ukrainian" },
  { value: "nl", labelKey: "languages.dutch", nativeLabel: "Nederlands", name: "Dutch" },
  { value: "el", labelKey: "languages.greek", nativeLabel: "Ελληνικά", name: "Greek" },
  { value: "hu", labelKey: "languages.hungarian", nativeLabel: "Magyar", name: "Hungarian" },
  { value: "sv", labelKey: "languages.swedish", nativeLabel: "Svenska", name: "Swedish" },
  { value: "da", labelKey: "languages.danish", nativeLabel: "Dansk", name: "Danish" },
  { value: "fi", labelKey: "languages.finnish", nativeLabel: "Suomi", name: "Finnish" },
  { value: "cs", labelKey: "languages.czech", nativeLabel: "Čeština", name: "Czech" },
  { value: "sk", labelKey: "languages.slovak", nativeLabel: "Slovenčina", name: "Slovak" },
  { value: "bg", labelKey: "languages.bulgarian", nativeLabel: "Български", name: "Bulgarian" },
  { value: "sl", labelKey: "languages.slovenian", nativeLabel: "Slovenščina", name: "Slovenian" },
  { value: "lt", labelKey: "languages.lithuanian", nativeLabel: "Lietuvių", name: "Lithuanian" },
  { value: "lv", labelKey: "languages.latvian", nativeLabel: "Latviešu", name: "Latvian" },
  { value: "ro", labelKey: "languages.romanian", nativeLabel: "Română", name: "Romanian" },
  { value: "et", labelKey: "languages.estonian", nativeLabel: "Eesti", name: "Estonian" },
  { value: "id", labelKey: "languages.indonesian", nativeLabel: "Bahasa Indonesia", name: "Indonesian" },
  { value: "hi", labelKey: "languages.hindi", nativeLabel: "हिन्दी", name: "Hindi", unsupportedMethods: UNSUPPORTED_METHODS },
  { value: "bn", labelKey: "languages.bengali", nativeLabel: "বাংলা", name: "Bengali", unsupportedMethods: UNSUPPORTED_METHODS },
  { value: "vi", labelKey: "languages.vietnamese", nativeLabel: "Tiếng Việt", name: "Vietnamese", unsupportedMethods: UNSUPPORTED_METHODS },
  { value: "no", labelKey: "languages.norwegian", nativeLabel: "Norsk", name: "Norwegian", unsupportedMethods: UNSUPPORTED_METHODS },
  { value: "he", labelKey: "languages.hebrew", nativeLabel: "עברית", name: "Hebrew", unsupportedMethods: UNSUPPORTED_METHODS },
  { value: "th", labelKey: "languages.thai", nativeLabel: "ไทย", name: "Thai", unsupportedMethods: UNSUPPORTED_METHODS },
  { value: "fil", labelKey: "languages.filipino", nativeLabel: "Filipino", name: "Filipino", unsupportedMethods: UNSUPPORTED_METHODS },
];

import { useTranslations } from "next-intl";

export const useLanguageOptions = () => {
  const t = useTranslations();

  // Create source options with translations
  const sourceOptions = languages.map((language) => ({
    ...language,
    label: `${t(language.labelKey)} (${language.nativeLabel})`,
  }));

  // Create target options with translations (excluding "auto")
  const targetOptions = languages
    .filter((language) => language.value !== "auto")
    .map((language) => ({
      ...language,
      label: `${t(language.labelKey)} (${language.nativeLabel})`,
    }));

  return { sourceOptions, targetOptions };
};

const normalizeText = (text = "") => text.trim().toLowerCase();

export const filterLanguageOption = ({ input, option }) => {
  const normalizedInput = normalizeText(input);
  const normalizedLabel = normalizeText(option?.label);
  const normalizedName = normalizeText(option?.name);

  // 如果 label 或 name 包含输入的内容，则返回 true
  return normalizedLabel.includes(normalizedInput) || normalizedName.includes(normalizedInput);
};
