export interface LanguageOption {
  value: string;
  name: string;
  nativelabel: string;
}

//autocorrect:false
export const languages: LanguageOption[] = [
  { value: "auto", name: "Auto", nativelabel: "Auto" },
  { value: "en", name: "English", nativelabel: "English" },
  { value: "zh", name: "Simplified Chinese", nativelabel: "简体" },
  { value: "zh-hant", name: "Traditional Chinese", nativelabel: "繁體" },
  { value: "es", name: "Spanish", nativelabel: "Español" },
  { value: "de", name: "German", nativelabel: "Deutsch" },
  { value: "pt-br", name: "Portuguese (Brazil)", nativelabel: "Português (Brasil)" },
  { value: "pt-pt", name: "Portuguese (Portugal)", nativelabel: "Português (Portugal)" },
  { value: "ar", name: "Arabic", nativelabel: "العربية" },
  { value: "ja", name: "Japanese", nativelabel: "日本語" },
  { value: "ko", name: "Korean", nativelabel: "한국어" },
  { value: "ru", name: "Russian", nativelabel: "Русский" },
  { value: "fr", name: "French", nativelabel: "Français" },
  { value: "it", name: "Italian", nativelabel: "Italiano" },
  { value: "tr", name: "Turkish", nativelabel: "Türkçe" },
  { value: "pl", name: "Polish", nativelabel: "Polski" },
  { value: "uk", name: "Ukrainian", nativelabel: "Українська" },
  { value: "ro", name: "Romanian", nativelabel: "Română" },
  { value: "hu", name: "Hungarian", nativelabel: "Magyar" },
  { value: "cs", name: "Czech", nativelabel: "Čeština" },
  { value: "sk", name: "Slovak", nativelabel: "Slovenčina" },
  { value: "bg", name: "Bulgarian", nativelabel: "Български" },
  { value: "sv", name: "Swedish", nativelabel: "Svenska" },
  { value: "da", name: "Danish", nativelabel: "Dansk" },
  { value: "fi", name: "Finnish", nativelabel: "Suomi" },
  { value: "nb", name: "Norwegian", nativelabel: "Norsk bokmål" },
  { value: "lt", name: "Lithuanian", nativelabel: "Lietuvių" },
  { value: "lv", name: "Latvian", nativelabel: "Latviešu" },
  { value: "et", name: "Estonian", nativelabel: "Eesti" },
  { value: "el", name: "Greek", nativelabel: "Ελληνικά" },
  { value: "sl", name: "Slovenian", nativelabel: "Slovenščina" },
  { value: "nl", name: "Dutch", nativelabel: "Nederlands" },
  { value: "id", name: "Indonesian", nativelabel: "Bahasa Indonesia" },
  { value: "ms", name: "Malay", nativelabel: "Bahasa Melayu" },
  { value: "vi", name: "Vietnamese", nativelabel: "Tiếng Việt" },
  { value: "hi", name: "Hindi", nativelabel: "हिन्दी" },
  { value: "bn", name: "Bengali", nativelabel: "বাংলা" },
  { value: "bho", name: "Bhojpuri", nativelabel: "भोजपुरी" },
  { value: "mr", name: "Marathi", nativelabel: "मराठी" },
  { value: "gu", name: "Gujarati", nativelabel: "ગુજરાતી" },
  { value: "ta", name: "Tamil", nativelabel: "தமிழ்" },
  { value: "te", name: "Telugu", nativelabel: "తెలుగు" },
  { value: "kn", name: "Kannada", nativelabel: "ಕನ್ನಡ" },
  { value: "th", name: "Thai", nativelabel: "ไทย" },
  { value: "fil", name: "Filipino(Tagalog)", nativelabel: "Filipino" },
  { value: "jv", name: "Javanese", nativelabel: "Basa Jawa" },
  { value: "he", name: "Hebrew", nativelabel: "עברית" },
  { value: "am", name: "Amharic", nativelabel: "አማርኛ" },
  { value: "fa", name: "Persian", nativelabel: "فارسی" },
  { value: "ug", name: "Uyghur", nativelabel: "ئۇيغۇرچە" },
  { value: "ha", name: "Hausa", nativelabel: "هَرْشٜىٰن هَوْسَا" },
  { value: "sw", name: "Swahili", nativelabel: "Kiswahili" },
  { value: "uz", name: "Uzbek", nativelabel: "Oʻzbekcha" },
  { value: "kk", name: "Kazakh", nativelabel: "Қазақ тілі" },
  { value: "ky", name: "Kyrgyz", nativelabel: "Кыргызча" },
  { value: "tk", name: "Turkmen", nativelabel: "Türkmençe" },
  { value: "ur", name: "Urdu", nativelabel: "اردو" },
  { value: "hr", name: "Croatian", nativelabel: "Hrvatski" },
];

// DeepL/DeepLX 不支持的语言
const DEEPL_UNSUPPORTED_LANGS = new Set(["ms", "vi", "hi", "bn", "bho", "mr", "gu", "ta", "te", "kn", "th", "fil", "jv", "he", "am", "fa", "ug", "ha", "sw", "uz", "kk", "ky", "tk", "ur", "hr"]);

// Azure 不支持的语言（仅 jv）
const AZURE_UNSUPPORTED_LANGS = new Set(["jv"]);

/**
 * 检查翻译方法是否支持指定语言
 */
export function isMethodSupportedForLanguage(method: string, lang: string): boolean {
  if (method === "deepl" || method === "deeplx") {
    return !DEEPL_UNSUPPORTED_LANGS.has(lang);
  }
  if (method === "azure") {
    return !AZURE_UNSUPPORTED_LANGS.has(lang);
  }
  return true; // GTX, Google, LLM 等都支持所有语言
}
