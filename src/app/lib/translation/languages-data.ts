export interface LanguageOption {
  value: string;
  name: string;
  nativelabel: string;
}

//autocorrect:false
// Order mirrors LANGUAGE_GROUPS (below) — single-select dropdown reads master
// order; multi-select popup reads LANGUAGE_GROUPS. Keeping them aligned means
// users see the same regional flow whether they pick one target or many.
// `auto` is the source-detect mode, kept at top (only shown in source select).
export const languages: LanguageOption[] = [
  { value: "auto", name: "Auto", nativelabel: "Auto" },

  // ── Common (16) ──
  { value: "en", name: "English", nativelabel: "English" },
  { value: "zh", name: "Simplified Chinese", nativelabel: "简体" },
  { value: "zh-hant", name: "Traditional Chinese", nativelabel: "繁體" },
  { value: "es", name: "Spanish", nativelabel: "Español" },
  { value: "fr", name: "French", nativelabel: "Français" },
  { value: "de", name: "German", nativelabel: "Deutsch" },
  { value: "ja", name: "Japanese", nativelabel: "日本語" },
  { value: "ko", name: "Korean", nativelabel: "한국어" },
  { value: "hi", name: "Hindi", nativelabel: "हिन्दी" },
  { value: "ar", name: "Arabic", nativelabel: "العربية" },
  { value: "ru", name: "Russian", nativelabel: "Русский" },
  { value: "pt-br", name: "Portuguese (Brazil)", nativelabel: "Português (Brasil)" },
  { value: "id", name: "Indonesian", nativelabel: "Bahasa Indonesia" },
  { value: "vi", name: "Vietnamese", nativelabel: "Tiếng Việt" },
  { value: "it", name: "Italian", nativelabel: "Italiano" },
  { value: "yue", name: "Cantonese", nativelabel: "粵語" },

  // ── Europe (42) ──
  { value: "pl", name: "Polish", nativelabel: "Polski" },
  { value: "uk", name: "Ukrainian", nativelabel: "Українська" },
  { value: "nl", name: "Dutch", nativelabel: "Nederlands" },
  { value: "ro", name: "Romanian", nativelabel: "Română" },
  { value: "el", name: "Greek", nativelabel: "Ελληνικά" },
  { value: "hu", name: "Hungarian", nativelabel: "Magyar" },
  { value: "sv", name: "Swedish", nativelabel: "Svenska" },
  { value: "cs", name: "Czech", nativelabel: "Čeština" },
  { value: "pt-pt", name: "Portuguese (Portugal)", nativelabel: "Português (Portugal)" },
  { value: "ca", name: "Catalan", nativelabel: "Català" },
  { value: "sr", name: "Serbian", nativelabel: "Српски" },
  { value: "bg", name: "Bulgarian", nativelabel: "Български" },
  { value: "hy", name: "Armenian", nativelabel: "Հայերեն" },
  { value: "da", name: "Danish", nativelabel: "Dansk" },
  { value: "sq", name: "Albanian", nativelabel: "Shqip" },
  { value: "fi", name: "Finnish", nativelabel: "Suomi" },
  { value: "nb", name: "Norwegian Bokmål", nativelabel: "Norsk bokmål" },
  { value: "sk", name: "Slovak", nativelabel: "Slovenčina" },
  { value: "hr", name: "Croatian", nativelabel: "Hrvatski" },
  { value: "be", name: "Belarusian", nativelabel: "Беларуская" },
  { value: "scn", name: "Sicilian", nativelabel: "Sicilianu" },
  { value: "ka", name: "Georgian", nativelabel: "ქართული" },
  { value: "lmo", name: "Lombard", nativelabel: "Lombard" },
  { value: "lt", name: "Lithuanian", nativelabel: "Lietuvių" },
  { value: "gl", name: "Galician", nativelabel: "Galego" },
  { value: "bs", name: "Bosnian", nativelabel: "Bosanski" },
  { value: "sl", name: "Slovenian", nativelabel: "Slovenščina" },
  { value: "mk", name: "Macedonian", nativelabel: "Македонски" },
  { value: "lv", name: "Latvian", nativelabel: "Latviešu" },
  { value: "et", name: "Estonian", nativelabel: "Eesti" },
  { value: "is", name: "Icelandic", nativelabel: "Íslenska" },
  { value: "mt", name: "Maltese", nativelabel: "Malti" },
  { value: "cy", name: "Welsh", nativelabel: "Cymraeg" },
  { value: "ga", name: "Irish", nativelabel: "Gaeilge" },
  { value: "br", name: "Breton", nativelabel: "Brezhoneg" },
  { value: "eu", name: "Basque", nativelabel: "Euskara" },
  { value: "yi", name: "Yiddish", nativelabel: "ייִדיש" },
  { value: "lb", name: "Luxembourgish", nativelabel: "Lëtzebuergesch" },
  { value: "oc", name: "Occitan", nativelabel: "Occitan" },
  { value: "an", name: "Aragonese", nativelabel: "Aragonés" },
  { value: "la", name: "Latin", nativelabel: "Latina" },
  { value: "eo", name: "Esperanto", nativelabel: "Esperanto" },

  // ── MiddleEast (8) ──
  { value: "tr", name: "Turkish", nativelabel: "Türkçe" },
  { value: "he", name: "Hebrew", nativelabel: "עברית" },
  { value: "fa", name: "Persian", nativelabel: "فارسی" },
  { value: "ur", name: "Urdu", nativelabel: "اردو" },
  { value: "ps", name: "Pashto", nativelabel: "پښتو" },
  { value: "prs", name: "Dari", nativelabel: "دری" },
  { value: "ckb", name: "Central Kurdish", nativelabel: "کوردی" },
  { value: "kmr", name: "Northern Kurdish", nativelabel: "Kurdî" },

  // ── CentralAsia (10) ──
  { value: "uz", name: "Uzbek", nativelabel: "Oʻzbekcha" },
  { value: "kk", name: "Kazakh", nativelabel: "Қазақ тілі" },
  { value: "ky", name: "Kyrgyz", nativelabel: "Кыргызча" },
  { value: "tk", name: "Turkmen", nativelabel: "Türkmençe" },
  { value: "az", name: "Azerbaijani", nativelabel: "Azərbaycan" },
  { value: "tg", name: "Tajik", nativelabel: "Тоҷикӣ" },
  { value: "mn", name: "Mongolian", nativelabel: "Монгол" },
  { value: "ba", name: "Bashkir", nativelabel: "Башҡортса" },
  { value: "tt", name: "Tatar", nativelabel: "Татар теле" },
  { value: "ug", name: "Uyghur", nativelabel: "ئۇيغۇرچە" },

  // ── SouthAsia (15) ──
  { value: "bn", name: "Bengali", nativelabel: "বাংলা" },
  { value: "mr", name: "Marathi", nativelabel: "मराठी" },
  { value: "te", name: "Telugu", nativelabel: "తెలుగు" },
  { value: "ta", name: "Tamil", nativelabel: "தமிழ்" },
  { value: "gu", name: "Gujarati", nativelabel: "ગુજરાતી" },
  { value: "kn", name: "Kannada", nativelabel: "ಕನ್ನಡ" },
  { value: "pa", name: "Punjabi", nativelabel: "ਪੰਜਾਬੀ" },
  { value: "ml", name: "Malayalam", nativelabel: "മലയാളം" },
  { value: "bho", name: "Bhojpuri", nativelabel: "भोजपुरी" },
  { value: "mai", name: "Maithili", nativelabel: "मैथिली" },
  { value: "ne", name: "Nepali", nativelabel: "नेपाली" },
  { value: "si", name: "Sinhala", nativelabel: "සිංහල" },
  { value: "as", name: "Assamese", nativelabel: "অসমীয়া" },
  { value: "gom", name: "Konkani", nativelabel: "कोंकणी" },
  { value: "sa", name: "Sanskrit", nativelabel: "संस्कृतम्" },

  // ── SeAsia (11) ──
  { value: "th", name: "Thai", nativelabel: "ไทย" },
  { value: "lo", name: "Lao", nativelabel: "ລາວ" },
  { value: "my", name: "Burmese", nativelabel: "မြန်မာ" },
  { value: "ms", name: "Malay", nativelabel: "Bahasa Melayu" },
  { value: "fil", name: "Filipino(Tagalog)", nativelabel: "Tagalog" },
  { value: "jv", name: "Javanese", nativelabel: "Basa Jawa" },
  { value: "su", name: "Sundanese", nativelabel: "Basa Sunda" },
  { value: "ace", name: "Acehnese", nativelabel: "Acèh" },
  { value: "pag", name: "Pangasinan", nativelabel: "Salitan Pangasinan" },
  { value: "pam", name: "Pampangan", nativelabel: "Kapampangan" },
  { value: "ceb", name: "Cebuano", nativelabel: "Cebuano" },

  // ── Africa (14) ──
  { value: "sw", name: "Swahili", nativelabel: "Kiswahili" },
  { value: "ha", name: "Hausa", nativelabel: "هَرْشٜىٰن هَوْسَا" },
  { value: "am", name: "Amharic", nativelabel: "አማርኛ" },
  { value: "ig", name: "Igbo", nativelabel: "Igbo" },
  { value: "wo", name: "Wolof", nativelabel: "Wolof" },
  { value: "xh", name: "Xhosa", nativelabel: "isiXhosa" },
  { value: "zu", name: "Zulu", nativelabel: "isiZulu" },
  { value: "af", name: "Afrikaans", nativelabel: "Afrikaans" },
  { value: "om", name: "Oromo", nativelabel: "Afaan Oromoo" },
  { value: "st", name: "Southern Sotho", nativelabel: "Sesotho" },
  { value: "tn", name: "Tswana", nativelabel: "Setswana" },
  { value: "ts", name: "Tsonga", nativelabel: "Xitsonga" },
  { value: "mg", name: "Malagasy", nativelabel: "Malagasy" },
  { value: "ln", name: "Lingala", nativelabel: "Lingála" },

  // ── AmericasOceania (5) ──
  { value: "ht", name: "Haitian Creole", nativelabel: "Kreyòl ayisyen" },
  { value: "qu", name: "Quechua", nativelabel: "Runa Simi" },
  { value: "ay", name: "Aymara", nativelabel: "Aymar aru" },
  { value: "gn", name: "Guarani", nativelabel: "Avañe'ẽ" },
  { value: "mi", name: "Maori", nativelabel: "Māori" },
];

// ════════════════════════════════════════════════════════════════════════════
// Per-service language support — last verified 2026-05-22.
//
// Each translation service supports a different subset of our master `languages`
// list above. UNSUPPORTED_LANGS is a per-service denylist: when a user picks
// (sourceLanguage, targetLanguage), `checkLanguageSupport` (see utils.ts)
// blocks the request *before* dispatch and surfaces a clear error rather than
// letting the user wait through retries and a confusing service-level rejection.
//
// ── Verification sources (re-check ~yearly) ──
//   DeepL:           https://developers.deepl.com/docs/getting-started/supported-languages
//                    Now 110+ languages — only kn/am/ug/si/lo from our master
//                    list remain unsupported.
//   Google Cloud:    https://docs.cloud.google.com/translate/docs/languages
//                    NMT model ~250 codes, LLM model ~100 codes. Same denylist
//                    used for gtxFreeAPI (free public endpoint) since both route
//                    through Google's translation backend. Only an/wo from our
//                    master are missing. NOTE: Wolof is supported by Meta NLLB,
//                    NOT Google — easy to confuse.
//   Qwen-MT:         https://help.aliyun.com/zh/model-studio/machine-translation
//                    Plus/flash/turbo tiers cover 92 languages; lite is smaller
//                    and not separately tracked here.
//   Azure Translator https://learn.microsoft.com/zh-cn/azure/ai-services/translator/language-support
//                    Comprehensive — see denylist for the few gaps.
//                    NOTE: Azure uses `ku` for Central Kurdish; our master code
//                    is `ckb` (BCP-47). Mapping lives in services/traditional.ts
//                    as AZURE_LANG_MAP. Beware of the Transliterate-only entries
//                    (be / tg) — they look supported in the docs but the Text
//                    Translation API rejects them.
//   TranslateGemma   https://huggingface.co/collections/google/translategemma
//                    Three variants: 4b / 12b / 27b. ALL THREE share the same
//                    55-language coverage (verified 2026-05-22 by reading each
//                    model card — "designed to handle translation tasks across
//                    55 languages" is a family-wide statement, not 4b-specific).
//                    Larger variants don't expand language support, only model
//                    quality. So a single denylist works across all variants;
//                    switching models won't unblock new languages.
//                    Official list not published; we use WMT24++ benchmark
//                    (55 pairs / 50 unique langs) as proxy:
//                    https://huggingface.co/datasets/google/wmt24pp
//                    Anything not in WMT24++ is denied (conservative —
//                    the model may support more, but blocking is safer than
//                    surfacing low-quality output).
//
// ── How to re-verify ──
// 1. Open each source URL, scrape current supported-language list.
// 2. Diff against our `languages` master array above (lowercase ISO codes).
// 3. Update the appropriate Set below and the verification date.
// 4. Run `yarn test` — registry.test.ts will catch any obvious mismatch.
// ════════════════════════════════════════════════════════════════════════════
const UNSUPPORTED_LANGS: Record<string, Set<string>> = {
  // DeepL & DeepLX — same coverage (DeepLX is a community proxy in front of DeepL).
  // Verified 2026-05-26 — denylist is complete, no other master codes missing.
  deepl: new Set(["kn", "am", "ug", "si", "lo"]),
  deeplx: new Set(["kn", "am", "ug", "si", "lo"]),

  // Google Cloud Translation / GTX (Free). Both go through Google's NMT backend.
  // Only 2 codes from our master aren't on Google's official supported list:
  // `an` (Aragonese) and `wo` (Wolof). Most other niche codes (ace/scn/lmo/etc)
  // are supported. Verified 2026-05-26.
  gtxFreeAPI: new Set(["an", "wo"]),
  google: new Set(["an", "wo"]),

  // Azure Translator. Pre-existing `jv` (Javanese) plus 21 from the 2026-05
  // expansion, plus `be` and `tg` (added 2026-05-26 — both languages appear
  // only in Azure's Transliterate API table, NOT in Text Translation, which
  // is the API we hit).
  azure: new Set([
    "jv",
    // 2026-05 additions:
    "ace", "an", "ay", "br", "ceb", "eo", "gn", "la", "lb", "lmo",
    "oc", "om", "pag", "pam", "qu", "sa", "scn", "su", "ts", "wo", "yi",
    // 2026-05-26 additions (Transliterate-only, no Text Translation):
    "be", "tg",
  ]),

  // Qwen-MT plus/flash/turbo. 41 codes denied; 80 of our master supported
  // (Qwen-MT claims 92 in total — the gap is Arabic dialects + a few codes
  // like ast/nn/sd/tl/vec/war that aren't in our master at all).
  // Official list: https://help.aliyun.com/zh/model-studio/machine-translation
  qwenMt: new Set([
    "ky", "tk", "tg", "mn", "ml", "pa", "bho", "ha", "am", "ug",
    // 2026-05 additions (ga/gn removed 2026-05-26 — both are in Qwen-MT's
    // official 92-language list, were wrongly denied):
    "ace", "an", "ay", "ba", "br", "ckb", "eo", "gom",
    "ht", "ig", "kmr", "la", "lmo", "ln", "mg", "mi", "om", "pam",
    "prs", "ps", "qu", "sa", "st", "su", "tn", "ts", "tt", "wo",
    "xh", "yi", "zu",
  ]),

  // TranslateGemma 4b-it. Conservative: deny everything not in WMT24++.
  // `auto` is handled separately via REQUIRES_EXPLICIT_SOURCE.
  // Code/name overrides for region-script variants (zh-Hans, pt-BR, etc.)
  // live in services/traditional.ts as TRANSLATEGEMMA_OVERRIDES — most
  // codes pass through unchanged using languages[].name.
  translategemma: new Set([
    "yue", "bho",
    // 2026-05 backfill — our existing master list entries not in WMT24++:
    "af", "bs", "mk", "be", "sq", "mt", "hy", "ka", "uz", "kk", "ky", "tk",
    "az", "tg", "mn", "si", "ne", "lo", "my", "ms", "jv", "ha", "am", "ug",
    // 2026-05 additions (43 - 1 since zu IS in WMT24++):
    "ace", "an", "as", "ay", "ba", "br", "ceb", "ckb", "cy", "eo", "eu",
    "ga", "gl", "gn", "gom", "ht", "ig", "kmr", "la", "lb", "lmo", "ln",
    "mai", "mg", "mi", "oc", "om", "pag", "pam", "prs", "ps", "qu", "sa",
    "scn", "st", "su", "tn", "ts", "tt", "wo", "xh", "yi",
  ]),
};

/**
 * Methods that require an explicit source language because the underlying model has
 * no language-detection mode. Triggers a different error message than UNSUPPORTED_LANGS
 * — "pick a real source" rather than "language not supported".
 */
export const REQUIRES_EXPLICIT_SOURCE: ReadonlySet<string> = new Set(["translategemma"]);

// ════════════════════════════════════════════════════════════════════════════
// Regional grouping for the multi-language picker UI.
//
// Drives the collapsible sections in LanguageSelector's multi-select popup,
// so 122 languages become scannable instead of an undifferentiated wall.
// Every non-"auto" code from `languages` above must appear in exactly one
// group — enforced by the registry test.
//
// `labelKey` is the i18n key (under `common` namespace) for the section title.
// ════════════════════════════════════════════════════════════════════════════
export const LANGUAGE_GROUPS: ReadonlyArray<{ key: string; labelKey: string; codes: readonly string[] }> = [
  {
    key: "common",
    labelKey: "langGroupCommon",
    // Order: en + Chinese family first (universal + our zh-heavy user base),
    // then Western European business top 3 (es/fr/de — most common targets for
    // Chinese users), East Asian neighbors (ja/ko), then world-scale languages
    // by speaker count (hi/ar/ru/pt-br/id), secondary regional (vi/it), then
    // variant (yue) at tail.
    codes: ["en", "zh", "zh-hant", "es", "fr", "de", "ja", "ko", "hi", "ar", "ru", "pt-br", "id", "vi", "it", "yue"],
  },
  {
    key: "europe",
    labelKey: "langGroupEurope",
    // Tiered by speaker count + EU/translation demand. af (Afrikaans) lives in
    // africa group despite being Germanic by family — group is geographic,
    // and South African Afrikaans isn't European by geography.
    codes: [
      // Tier 1: Major markets, 10M+ native
      "pl", "uk", "nl", "ro", "el", "hu", "sv", "cs", "pt-pt",
      // Tier 2: Medium markets, 5-9M
      "ca", "sr", "bg", "hy", "da", "sq", "fi", "nb", "sk", "hr", "be", "scn",
      // Tier 3: Smaller national, 1-4M
      "ka", "lmo", "lt", "gl", "bs", "sl", "mk", "lv", "et",
      // Tier 4: Tiny but official
      "is", "mt",
      // Tier 5: Celtic minorities
      "cy", "ga", "br",
      // Tier 6: Other regional minorities (Basque / Germanic / Romance)
      "eu", "yi", "lb", "oc", "an",
      // Tier 7: Classical / constructed
      "la", "eo",
    ],
  },
  {
    key: "middleEast",
    labelKey: "langGroupMiddleEast",
    codes: ["tr", "he", "fa", "ur", "ps", "prs", "ckb", "kmr"],
  },
  {
    key: "centralAsia",
    labelKey: "langGroupCentralAsia",
    codes: ["uz", "kk", "ky", "tk", "az", "tg", "mn", "ba", "tt", "ug"],
  },
  {
    key: "southAsia",
    labelKey: "langGroupSouthAsia",
    // By speakers + translation demand: bn/mr top, te before ta (te has more
    // speakers), pa elevated for diaspora demand, classical sa at tail.
    codes: ["bn", "mr", "te", "ta", "gu", "kn", "pa", "ml", "bho", "mai", "ne", "si", "as", "gom", "sa"],
  },
  {
    key: "seAsia",
    labelKey: "langGroupSeAsia",
    codes: ["th", "lo", "my", "ms", "fil", "jv", "su", "ace", "pag", "pam", "ceb"],
  },
  {
    key: "africa",
    labelKey: "langGroupAfrica",
    // af (Afrikaans) clusters with Southern African Bantu (xh/zu/st/tn/ts) —
    // moved here from europe because group is geographic, not linguistic.
    codes: ["sw", "ha", "am", "ig", "wo", "xh", "zu", "af", "om", "st", "tn", "ts", "mg", "ln"],
  },
  {
    key: "americasOceania",
    labelKey: "langGroupAmericasOceania",
    // ht (Haitian Creole, Caribbean), qu/ay/gn (South American indigenous),
    // mi (Maori, Polynesian). Combined because Oceania alone is just 1 lang.
    codes: ["ht", "qu", "ay", "gn", "mi"],
  },
] as const;

/**
 * Reverse lookup: language code → group key. Built once at module load.
 * Used by `<LanguageSelector>` to render group headers in correct order.
 */
export const LANGUAGE_GROUP_BY_CODE: Record<string, string> = Object.fromEntries(LANGUAGE_GROUPS.flatMap(({ key, codes }) => codes.map((c) => [c, key])));

// ════════════════════════════════════════════════════════════════════════════
// Quick-pick presets for the multi-language popup.
//
// Replace the previous "Select all 121 languages" trap (almost certainly not
// what the user wants — burns API quota) with curated common combinations.
// Clicking a preset MERGES into the current selection (not replaces) so users
// can stack "Top World" + "European Mainstream".
//
// Code order within each preset MUST match the master `languages` array order
// (enforced by test). So adding a code is a single insertion at its master
// position, not a re-sort across 4 presets + 18 locale files.
// ════════════════════════════════════════════════════════════════════════════
export const LANGUAGE_PRESETS: ReadonlyArray<{ key: string; labelKey: string; codes: readonly string[] }> = [
  {
    key: "topWorld",
    labelKey: "langPresetTopWorld",
    // Top 10 from common (excluding variants + secondary regional). Order
    // matches common's order — they're the same set, same priorities.
    codes: ["en", "zh", "es", "fr", "de", "ja", "hi", "ar", "ru", "pt-br"],
  },
  {
    key: "europe",
    labelKey: "langPresetEurope",
    // ru included — largest European native-speaker base; without it "European
    // Mainstream" reads as Western-EU-only.
    codes: ["en", "es", "fr", "de", "ru", "it", "pl", "nl", "pt-pt"],
  },
  {
    key: "eastAsian",
    labelKey: "langPresetEastAsian",
    codes: ["zh", "zh-hant", "ja", "ko", "yue"],
  },
  {
    key: "indianSubcontinent",
    labelKey: "langPresetIndian",
    // ur (Urdu) is in middleEast group, but Pakistan is part of the Indian
    // subcontinent geographically, so it lands at the tail of this preset.
    codes: ["hi", "bn", "mr", "te", "ta", "gu", "pa", "ml", "ur"],
  },
] as const;

/**
 * 检查翻译方法是否支持指定语言
 */
export function isMethodSupportedForLanguage(method: string, lang: string): boolean {
  return !UNSUPPORTED_LANGS[method]?.has(lang);
}
