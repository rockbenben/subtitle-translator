export interface LanguageOption {
  value: string;
  labelkey: string;
  nativelabel: string;
  name: string;
  unsupportedmethods?: string[];
}

// 部分语言不支持的翻译方法
const DEEPL_METHODS = ["deepl", "deeplx"];
const Azure_DEEPL_METHODS = ["deepl", "deeplx", "azure"];

//autocorrect:false
export const languages: LanguageOption[] = [
  { value: "auto", labelkey: "languages.auto", nativelabel: "Auto", name: "Auto" },
  { value: "en", labelkey: "languages.english", nativelabel: "English", name: "English" },
  { value: "zh", labelkey: "languages.chinese", nativelabel: "简体", name: "Simplified Chinese" },
  { value: "zh-hant", labelkey: "languages.traditionalChinese", nativelabel: "繁體", name: "Traditional Chinese" },
  { value: "es", labelkey: "languages.spanish", nativelabel: "Español", name: "Spanish" },
  { value: "de", labelkey: "languages.german", nativelabel: "Deutsch", name: "German" },
  { value: "pt-br", labelkey: "languages.portugueseBrazil", nativelabel: "Português (Brasil)", name: "Portuguese (Brazil)" },
  { value: "pt-pt", labelkey: "languages.portuguesePortugal", nativelabel: "Português (Portugal)", name: "Portuguese (Portugal)" },
  { value: "ar", labelkey: "languages.arabic", nativelabel: "العربية", name: "Arabic" },
  { value: "ja", labelkey: "languages.japanese", nativelabel: "日本語", name: "Japanese" },
  { value: "ko", labelkey: "languages.korean", nativelabel: "한국어", name: "Korean" },
  { value: "ru", labelkey: "languages.russian", nativelabel: "Русский", name: "Russian" },
  { value: "fr", labelkey: "languages.french", nativelabel: "Français", name: "French" },
  { value: "it", labelkey: "languages.italian", nativelabel: "Italiano", name: "Italian" },
  { value: "tr", labelkey: "languages.turkish", nativelabel: "Türkçe", name: "Turkish" },
  { value: "pl", labelkey: "languages.polish", nativelabel: "Polski", name: "Polish" },
  { value: "uk", labelkey: "languages.ukrainian", nativelabel: "Українська", name: "Ukrainian" },
  { value: "ro", labelkey: "languages.romanian", nativelabel: "Română", name: "Romanian" },
  { value: "hu", labelkey: "languages.hungarian", nativelabel: "Magyar", name: "Hungarian" },
  { value: "cs", labelkey: "languages.czech", nativelabel: "Čeština", name: "Czech" },
  { value: "sk", labelkey: "languages.slovak", nativelabel: "Slovenčina", name: "Slovak" },
  { value: "bg", labelkey: "languages.bulgarian", nativelabel: "Български", name: "Bulgarian" },
  { value: "sv", labelkey: "languages.swedish", nativelabel: "Svenska", name: "Swedish" },
  { value: "da", labelkey: "languages.danish", nativelabel: "Dansk", name: "Danish" },
  { value: "fi", labelkey: "languages.finnish", nativelabel: "Suomi", name: "Finnish" },
  { value: "nb", labelkey: "languages.norwegian", nativelabel: "Norsk bokmål", name: "Norwegian" },
  { value: "lt", labelkey: "languages.lithuanian", nativelabel: "Lietuvių", name: "Lithuanian" },
  { value: "lv", labelkey: "languages.latvian", nativelabel: "Latviešu", name: "Latvian" },
  { value: "et", labelkey: "languages.estonian", nativelabel: "Eesti", name: "Estonian" },
  { value: "el", labelkey: "languages.greek", nativelabel: "Ελληνικά", name: "Greek" },
  { value: "sl", labelkey: "languages.slovenian", nativelabel: "Slovenščina", name: "Slovenian" },
  { value: "nl", labelkey: "languages.dutch", nativelabel: "Nederlands", name: "Dutch" },
  { value: "id", labelkey: "languages.indonesian", nativelabel: "Bahasa Indonesia", name: "Indonesian" },
  { value: "ms", labelkey: "languages.malay", nativelabel: "Bahasa Melayu", name: "Malay", unsupportedmethods: DEEPL_METHODS },
  { value: "vi", labelkey: "languages.vietnamese", nativelabel: "Tiếng Việt", name: "Vietnamese", unsupportedmethods: DEEPL_METHODS },
  { value: "hi", labelkey: "languages.hindi", nativelabel: "हिन्दी", name: "Hindi", unsupportedmethods: DEEPL_METHODS },
  { value: "bn", labelkey: "languages.bengali", nativelabel: "বাংলা", name: "Bengali", unsupportedmethods: DEEPL_METHODS },
  { value: "bho", labelkey: "languages.bhojpuri", nativelabel: "भोजपुरी", name: "Bhojpuri", unsupportedmethods: DEEPL_METHODS },
  { value: "mr", labelkey: "languages.marathi", nativelabel: "मराठी", name: "Marathi", unsupportedmethods: DEEPL_METHODS },
  { value: "gu", labelkey: "languages.gujarati", nativelabel: "ગુજરાતી", name: "Gujarati", unsupportedmethods: DEEPL_METHODS },
  { value: "ta", labelkey: "languages.tamil", nativelabel: "தமிழ்", name: "Tamil", unsupportedmethods: DEEPL_METHODS },
  { value: "te", labelkey: "languages.telugu", nativelabel: "తెలుగు", name: "Telugu", unsupportedmethods: DEEPL_METHODS },
  { value: "kn", labelkey: "languages.kannada", nativelabel: "ಕನ್ನಡ", name: "Kannada", unsupportedmethods: DEEPL_METHODS },
  { value: "th", labelkey: "languages.thai", nativelabel: "ไทย", name: "Thai", unsupportedmethods: DEEPL_METHODS },
  { value: "fil", labelkey: "languages.filipino", nativelabel: "Filipino", name: "Filipino(Tagalog)", unsupportedmethods: DEEPL_METHODS },
  { value: "jv", labelkey: "languages.javanese", nativelabel: "Basa Jawa", name: "Javanese", unsupportedmethods: Azure_DEEPL_METHODS },
  { value: "he", labelkey: "languages.hebrew", nativelabel: "עברית", name: "Hebrew", unsupportedmethods: DEEPL_METHODS },
  { value: "am", labelkey: "languages.amharic", nativelabel: "አማርኛ", name: "Amharic", unsupportedmethods: DEEPL_METHODS },
  { value: "fa", labelkey: "languages.persian", nativelabel: "فارسی", name: "Persian", unsupportedmethods: DEEPL_METHODS },
  { value: "ug", labelkey: "languages.uyghur", nativelabel: "ئۇيغۇرچە", name: "Uyghur", unsupportedmethods: DEEPL_METHODS },
  { value: "ha", labelkey: "languages.hausa", nativelabel: "هَرْشٜىٰن هَوْسَا", name: "Hausa", unsupportedmethods: DEEPL_METHODS },
  { value: "sw", labelkey: "languages.swahili", nativelabel: "Kiswahili", name: "Swahili", unsupportedmethods: DEEPL_METHODS },
  { value: "uz", labelkey: "languages.uzbek", nativelabel: "Oʻzbekcha", name: "Uzbek", unsupportedmethods: DEEPL_METHODS },
  { value: "kk", labelkey: "languages.kazakh", nativelabel: "Қазақ тілі", name: "Kazakh", unsupportedmethods: DEEPL_METHODS },
  { value: "ky", labelkey: "languages.kyrgyz", nativelabel: "Кыргызча", name: "Kyrgyz", unsupportedmethods: DEEPL_METHODS },
  { value: "tk", labelkey: "languages.turkmen", nativelabel: "Türkmençe", name: "Turkmen", unsupportedmethods: DEEPL_METHODS },
  { value: "ur", labelkey: "languages.urdu", nativelabel: "اردو", name: "Urdu", unsupportedmethods: DEEPL_METHODS },
  { value: "hr", labelkey: "languages.croatian", nativelabel: "Hrvatski", name: "Croatian", unsupportedmethods: DEEPL_METHODS },
];
