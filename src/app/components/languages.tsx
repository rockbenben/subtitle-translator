interface LanguageOption {
  value: string;
  labelKey: string;
  nativeLabel: string;
  name: string;
  unsupportedMethods?: string[];
}

// 部分语言不支持的翻译方法
const DEEPL_METHODS = ["deepl", "deeplx"];
const Azure_DEEPL_METHODS = ["deepl", "deeplx", "azure"];

//autocorrect:false
export const languages: LanguageOption[] = [
  { value: "auto", labelKey: "languages.auto", nativeLabel: "Auto", name: "Auto" },
  { value: "en", labelKey: "languages.english", nativeLabel: "English", name: "English" },
  { value: "zh", labelKey: "languages.chinese", nativeLabel: "简体", name: "Simplified Chinese" },
  { value: "zh-hant", labelKey: "languages.traditionalChinese", nativeLabel: "繁體", name: "Traditional Chinese" },
  { value: "es", labelKey: "languages.spanish", nativeLabel: "Español", name: "Spanish" },
  { value: "de", labelKey: "languages.german", nativeLabel: "Deutsch", name: "German" },
  { value: "pt-br", labelKey: "languages.portugueseBrazil", nativeLabel: "Português (Brasil)", name: "Portuguese (Brazil)" },
  { value: "pt-pt", labelKey: "languages.portuguesePortugal", nativeLabel: "Português (Portugal)", name: "Portuguese (Portugal)" },
  { value: "ar", labelKey: "languages.arabic", nativeLabel: "العربية", name: "Arabic" },
  { value: "ja", labelKey: "languages.japanese", nativeLabel: "日本語", name: "Japanese" },
  { value: "ko", labelKey: "languages.korean", nativeLabel: "한국어", name: "Korean" },
  { value: "ru", labelKey: "languages.russian", nativeLabel: "Русский", name: "Russian" },
  { value: "fr", labelKey: "languages.french", nativeLabel: "Français", name: "French" },
  { value: "it", labelKey: "languages.italian", nativeLabel: "Italiano", name: "Italian" },
  { value: "tr", labelKey: "languages.turkish", nativeLabel: "Türkçe", name: "Turkish" },
  { value: "pl", labelKey: "languages.polish", nativeLabel: "Polski", name: "Polish" },
  { value: "uk", labelKey: "languages.ukrainian", nativeLabel: "Українська", name: "Ukrainian" },
  { value: "ro", labelKey: "languages.romanian", nativeLabel: "Română", name: "Romanian" },
  { value: "hu", labelKey: "languages.hungarian", nativeLabel: "Magyar", name: "Hungarian" },
  { value: "cs", labelKey: "languages.czech", nativeLabel: "Čeština", name: "Czech" },
  { value: "sk", labelKey: "languages.slovak", nativeLabel: "Slovenčina", name: "Slovak" },
  { value: "bg", labelKey: "languages.bulgarian", nativeLabel: "Български", name: "Bulgarian" },
  { value: "sv", labelKey: "languages.swedish", nativeLabel: "Svenska", name: "Swedish" },
  { value: "da", labelKey: "languages.danish", nativeLabel: "Dansk", name: "Danish" },
  { value: "fi", labelKey: "languages.finnish", nativeLabel: "Suomi", name: "Finnish" },
  { value: "nb", labelKey: "languages.norwegian", nativeLabel: "Norsk bokmål", name: "Norwegian" },
  { value: "lt", labelKey: "languages.lithuanian", nativeLabel: "Lietuvių", name: "Lithuanian" },
  { value: "lv", labelKey: "languages.latvian", nativeLabel: "Latviešu", name: "Latvian" },
  { value: "et", labelKey: "languages.estonian", nativeLabel: "Eesti", name: "Estonian" },
  { value: "el", labelKey: "languages.greek", nativeLabel: "Ελληνικά", name: "Greek" },
  { value: "sl", labelKey: "languages.slovenian", nativeLabel: "Slovenščina", name: "Slovenian" },
  { value: "nl", labelKey: "languages.dutch", nativeLabel: "Nederlands", name: "Dutch" },
  { value: "id", labelKey: "languages.indonesian", nativeLabel: "Bahasa Indonesia", name: "Indonesian" },
  { value: "ms", labelKey: "languages.malay", nativeLabel: "Bahasa Melayu", name: "Malay", unsupportedMethods: DEEPL_METHODS },
  { value: "vi", labelKey: "languages.vietnamese", nativeLabel: "Tiếng Việt", name: "Vietnamese", unsupportedMethods: DEEPL_METHODS },
  { value: "hi", labelKey: "languages.hindi", nativeLabel: "हिन्दी", name: "Hindi", unsupportedMethods: DEEPL_METHODS },
  { value: "bn", labelKey: "languages.bengali", nativeLabel: "বাংলা", name: "Bengali", unsupportedMethods: DEEPL_METHODS },
  { value: "bho", labelKey: "languages.bhojpuri", nativeLabel: "भोजपुरी", name: "Bhojpuri", unsupportedMethods: DEEPL_METHODS },
  { value: "mr", labelKey: "languages.marathi", nativeLabel: "मराठी", name: "Marathi", unsupportedMethods: DEEPL_METHODS },
  { value: "gu", labelKey: "languages.gujarati", nativeLabel: "ગુજરાતી", name: "Gujarati", unsupportedMethods: DEEPL_METHODS },
  { value: "ta", labelKey: "languages.tamil", nativeLabel: "தமிழ்", name: "Tamil", unsupportedMethods: DEEPL_METHODS },
  { value: "te", labelKey: "languages.telugu", nativeLabel: "తెలుగు", name: "Telugu", unsupportedMethods: DEEPL_METHODS },
  { value: "kn", labelKey: "languages.kannada", nativeLabel: "ಕನ್ನಡ", name: "Kannada", unsupportedMethods: DEEPL_METHODS },
  { value: "th", labelKey: "languages.thai", nativeLabel: "ไทย", name: "Thai", unsupportedMethods: DEEPL_METHODS },
  { value: "fil", labelKey: "languages.filipino", nativeLabel: "Filipino", name: "Filipino(Tagalog)", unsupportedMethods: DEEPL_METHODS },
  { value: "jv", labelKey: "languages.javanese", nativeLabel: "Basa Jawa", name: "Javanese", unsupportedMethods: Azure_DEEPL_METHODS },
  { value: "he", labelKey: "languages.hebrew", nativeLabel: "עברית", name: "Hebrew", unsupportedMethods: DEEPL_METHODS },
  { value: "am", labelKey: "languages.amharic", nativeLabel: "አማርኛ", name: "Amharic", unsupportedMethods: DEEPL_METHODS },
  { value: "fa", labelKey: "languages.persian", nativeLabel: "فارسی", name: "Persian", unsupportedMethods: DEEPL_METHODS },
  { value: "ug", labelKey: "languages.uyghur", nativeLabel: "ئۇيغۇرچە", name: "Uyghur", unsupportedMethods: DEEPL_METHODS },
  { value: "ha", labelKey: "languages.hausa", nativeLabel: "هَرْشٜىٰن هَوْسَا", name: "Hausa", unsupportedMethods: DEEPL_METHODS },
  { value: "sw", labelKey: "languages.swahili", nativeLabel: "Kiswahili", name: "Swahili", unsupportedMethods: DEEPL_METHODS },
  { value: "uz", labelKey: "languages.uzbek", nativeLabel: "Oʻzbekcha", name: "Uzbek", unsupportedMethods: DEEPL_METHODS },
  { value: "kk", labelKey: "languages.kazakh", nativeLabel: "Қазақ тілі", name: "Kazakh", unsupportedMethods: DEEPL_METHODS },
  { value: "ky", labelKey: "languages.kyrgyz", nativeLabel: "Кыргызча", name: "Kyrgyz", unsupportedMethods: DEEPL_METHODS },
  { value: "tk", labelKey: "languages.turkmen", nativeLabel: "Türkmençe", name: "Turkmen", unsupportedMethods: DEEPL_METHODS },
  { value: "ur", labelKey: "languages.urdu", nativeLabel: "اردو", name: "Urdu", unsupportedMethods: DEEPL_METHODS },
  { value: "hr", labelKey: "languages.croatian", nativeLabel: "Hrvatski", name: "Croatian", unsupportedMethods: DEEPL_METHODS },
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
