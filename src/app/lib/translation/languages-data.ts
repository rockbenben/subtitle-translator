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
  { value: "fr", name: "French", nativelabel: "Français" },
  { value: "ja", name: "Japanese", nativelabel: "日本語" },
  { value: "ko", name: "Korean", nativelabel: "한국어" },
  { value: "ru", name: "Russian", nativelabel: "Русский" },
  { value: "it", name: "Italian", nativelabel: "Italiano" },
  { value: "ar", name: "Arabic", nativelabel: "العربية" },
  { value: "vi", name: "Vietnamese", nativelabel: "Tiếng Việt" },
  { value: "hi", name: "Hindi", nativelabel: "हिन्दी" },
  { value: "id", name: "Indonesian", nativelabel: "Bahasa Indonesia" },
  { value: "yue", name: "Cantonese", nativelabel: "粵語" },
  { value: "nl", name: "Dutch", nativelabel: "Nederlands" },
  { value: "sv", name: "Swedish", nativelabel: "Svenska" },
  { value: "da", name: "Danish", nativelabel: "Dansk" },
  { value: "nb", name: "Norwegian", nativelabel: "Norsk bokmål" },
  { value: "is", name: "Icelandic", nativelabel: "Íslenska" },
  { value: "af", name: "Afrikaans", nativelabel: "Afrikaans" },
  { value: "ro", name: "Romanian", nativelabel: "Română" },
  { value: "ca", name: "Catalan", nativelabel: "Català" },
  { value: "uk", name: "Ukrainian", nativelabel: "Українська" },
  { value: "pl", name: "Polish", nativelabel: "Polski" },
  { value: "cs", name: "Czech", nativelabel: "Čeština" },
  { value: "sk", name: "Slovak", nativelabel: "Slovenčina" },
  { value: "bg", name: "Bulgarian", nativelabel: "Български" },
  { value: "sr", name: "Serbian", nativelabel: "Српски" },
  { value: "hr", name: "Croatian", nativelabel: "Hrvatski" },
  { value: "bs", name: "Bosnian", nativelabel: "Bosanski" },
  { value: "sl", name: "Slovenian", nativelabel: "Slovenščina" },
  { value: "mk", name: "Macedonian", nativelabel: "Македонски" },
  { value: "be", name: "Belarusian", nativelabel: "Беларуская" },
  { value: "el", name: "Greek", nativelabel: "Ελληνικά" },
  { value: "hu", name: "Hungarian", nativelabel: "Magyar" },
  { value: "fi", name: "Finnish", nativelabel: "Suomi" },
  { value: "lt", name: "Lithuanian", nativelabel: "Lietuvių" },
  { value: "lv", name: "Latvian", nativelabel: "Latviešu" },
  { value: "et", name: "Estonian", nativelabel: "Eesti" },
  { value: "sq", name: "Albanian", nativelabel: "Shqip" },
  { value: "mt", name: "Maltese", nativelabel: "Malti" },
  { value: "hy", name: "Armenian", nativelabel: "Հայերեն" },
  { value: "ka", name: "Georgian", nativelabel: "ქართული" },
  { value: "tr", name: "Turkish", nativelabel: "Türkçe" },
  { value: "he", name: "Hebrew", nativelabel: "עברית" },
  { value: "fa", name: "Persian", nativelabel: "فارسی" },
  { value: "ur", name: "Urdu", nativelabel: "اردو" },
  { value: "uz", name: "Uzbek", nativelabel: "Oʻzbekcha" },
  { value: "kk", name: "Kazakh", nativelabel: "Қазақ тілі" },
  { value: "ky", name: "Kyrgyz", nativelabel: "Кыргызча" },
  { value: "tk", name: "Turkmen", nativelabel: "Türkmençe" },
  { value: "az", name: "Azerbaijani", nativelabel: "Azərbaycan" },
  { value: "tg", name: "Tajik", nativelabel: "Тоҷикӣ" },
  { value: "mn", name: "Mongolian", nativelabel: "Монгол" },
  { value: "bn", name: "Bengali", nativelabel: "বাংলা" },
  { value: "mr", name: "Marathi", nativelabel: "मराठी" },
  { value: "ta", name: "Tamil", nativelabel: "தமிழ்" },
  { value: "te", name: "Telugu", nativelabel: "తెలుగు" },
  { value: "gu", name: "Gujarati", nativelabel: "ગુજરાતી" },
  { value: "kn", name: "Kannada", nativelabel: "ಕನ್ನಡ" },
  { value: "ml", name: "Malayalam", nativelabel: "മലയാളം" },
  { value: "pa", name: "Punjabi", nativelabel: "ਪੰਜਾਬੀ" },
  { value: "ne", name: "Nepali", nativelabel: "नेपाली" },
  { value: "bho", name: "Bhojpuri", nativelabel: "भोजपुरी" },
  { value: "th", name: "Thai", nativelabel: "ไทย" },
  { value: "lo", name: "Lao", nativelabel: "ລາວ" },
  { value: "my", name: "Burmese", nativelabel: "မြန်မာ" },
  { value: "ms", name: "Malay", nativelabel: "Bahasa Melayu" },
  { value: "fil", name: "Filipino(Tagalog)", nativelabel: "Filipino" },
  { value: "jv", name: "Javanese", nativelabel: "Basa Jawa" },
  { value: "sw", name: "Swahili", nativelabel: "Kiswahili" },
  { value: "ha", name: "Hausa", nativelabel: "هَرْشٜىٰن هَوْسَا" },
  { value: "am", name: "Amharic", nativelabel: "አማርኛ" },
  { value: "ug", name: "Uyghur", nativelabel: "ئۇيغۇرچە" },
];

// DeepL/DeepLX 不支持的语言
const DEEPL_UNSUPPORTED_LANGS = new Set(["kn", "am", "ug", "lo"]);

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
