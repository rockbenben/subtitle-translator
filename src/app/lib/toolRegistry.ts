/**
 * Pure tool + site config: constants, OG locale map, TOOL_REGISTRY, types,
 * and the derived helpers. No React, no next-intl — safe to import from
 * tests or build scripts without pulling the Next.js runtime.
 *
 * Side-effecting helpers (loadToolContent, schemas, buildToolPageMetadata,
 * GlobalSchemas, ToolPageShell) live in seo.ts / toolPageShell.tsx and
 * re-import from here.
 */
import pkg from "../../../package.json";

export const SITE_URL = "https://tools.newzone.top";
export const SITE_NAME = "Tools By AI";
export const SITE_LOGO = `${SITE_URL}/logo.png`;
export const OG_IMAGE = "/og-image.png";
export const AUTHOR = { name: "rockbenben", url: "https://github.com/rockbenben" };
// Bumped via package.json `version` field. Surfaced as Schema.org
// SoftwareApplication.softwareVersion on every tool page — freshness signal
// for AI engines that cite "latest version of X tool".
export const SITE_VERSION: string = pkg.version;

/**
 * Map internal locale codes to OpenGraph locale format (language_TERRITORY).
 * For BCP-47 (Schema.org `inLanguage`) we transform underscore → hyphen.
 */
const OG_LOCALE_MAP: Record<string, string> = {
  zh: "zh_CN",
  "zh-hant": "zh_TW",
  en: "en_US",
  pt: "pt_BR",
  es: "es_ES",
  hi: "hi_IN",
  ar: "ar_SA",
  fr: "fr_FR",
  de: "de_DE",
  ja: "ja_JP",
  ko: "ko_KR",
  ru: "ru_RU",
  vi: "vi_VN",
  th: "th_TH",
  tr: "tr_TR",
  bn: "bn_BD",
  id: "id_ID",
  it: "it_IT",
};

/** Convert internal locale to OpenGraph locale format (e.g. "zh" → "zh_CN") */
export function getOGLocale(locale: string): string {
  return OG_LOCALE_MAP[locale] ?? locale;
}

/** Convert internal locale to BCP-47 tag for Schema.org inLanguage (e.g. "zh" → "zh-CN") */
export function getBcp47Locale(locale: string): string {
  return getOGLocale(locale).replace("_", "-");
}

/**
 * Schema.org applicationCategory values used in this project.
 * Subset of the schema.org enum: https://schema.org/applicationCategory
 */
export type ApplicationCategory =
  | "DeveloperApplication"
  | "UtilitiesApplication"
  | "MultimediaApplication"
  | "DesignApplication"
  | "BusinessApplication";

/**
 * UI grouping used by homepage filters and nav menu. Tools listed under the
 * same group share a category tab. Order of values defines the default tab
 * order in the UI.
 */
export type ToolGroup = "translate" | "textParser" | "jsonParser" | "dataParser";
export const TOOL_GROUPS = ["translate", "textParser", "jsonParser", "dataParser"] as const satisfies readonly ToolGroup[];

type ToolEntry = {
  /** URL slug under /{locale}/ */
  path: string;
  /** Schema.org WebApplication.applicationCategory */
  category: ApplicationCategory;
  /** UI grouping for homepage filters and nav menu */
  group: ToolGroup;
  /** Client-side i18n namespaces shipped via ToolPageShell's NextIntlClientProvider */
  namespaces: string[];
};

/**
 * Single source of truth for per-tool configuration. New tools add one entry
 * here; page.tsx (via ToolPageShell + generatePageMetadata), projects.tsx, and
 * home.tsx all derive from this.
 *
 * Declaration order = homepage display order.
 */
export const TOOL_REGISTRY = {
  subtitleTranslator:   { path: "subtitle-translator",    category: "MultimediaApplication", group: "translate",  namespaces: ["SubtitleTranslator", "TranslationSettings", "TranslationGlossary"] },
  mdTranslator:         { path: "md-translator",          category: "BusinessApplication",   group: "translate",  namespaces: ["MDTranslator", "TranslationSettings", "TranslationGlossary"] },
  jsonTranslate:        { path: "json-translate",         category: "DeveloperApplication",  group: "translate",  namespaces: ["JSON", "TranslationSettings", "TranslationGlossary"] },
  textSplitter:         { path: "text-splitter",          category: "UtilitiesApplication",  group: "textParser", namespaces: ["TextSplitter"] },
  chineseConversion:    { path: "chinese-conversion",     category: "UtilitiesApplication",  group: "textParser", namespaces: ["ChineseConversion", "ProtectedRuleManager"] },
  novelProcessor:       { path: "novel-processor",        category: "UtilitiesApplication",  group: "textParser", namespaces: ["NovelProcessor", "ProtectedRuleManager"] },
  textToolbox:          { path: "text-toolbox",           category: "DeveloperApplication",  group: "textParser", namespaces: ["TextToolbox"] },
  dataBatch:            { path: "data-batch",             category: "UtilitiesApplication",  group: "textParser", namespaces: ["DataBatch"] },
  jsonValueExtractor:   { path: "json-value-extractor",   category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONValueExtractor"] },
  jsonNodeEdit:         { path: "json-node-edit",         category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONNodeEdit"] },
  jsonValueTransformer: { path: "json-value-transformer", category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONValueTransformer"] },
  jsonValueSwapper:     { path: "json-value-swapper",     category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONValueSwapper"] },
  jsonNodeInserter:     { path: "json-node-inserter",     category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONNodeInserter"] },
  jsonSortClassify:     { path: "json-sort-classify",     category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONSortClassify"] },
  jsonMatchUpdate:      { path: "json-match-update",      category: "DeveloperApplication",  group: "jsonParser", namespaces: ["JSON", "JSONMatchUpdate"] },
  dataParserFlare:      { path: "data-parser/flare",      category: "DeveloperApplication",  group: "dataParser", namespaces: ["JSON", "Flare"] },
  dataParserImgPrompt:  { path: "data-parser/img-prompt", category: "DesignApplication",     group: "dataParser", namespaces: ["JSON", "ImgPrompt"] },
} as const satisfies Record<string, ToolEntry>;

export type ToolKey = keyof typeof TOOL_REGISTRY;

/** Convenient ordered list of all tool keys (declaration order = display order). */
export const TOOL_KEYS = Object.keys(TOOL_REGISTRY) as ToolKey[];

/**
 * Curated 2-3 related tools per tool, surfaced under each tool page as
 * cross-links. Pure toolKey references — no i18n needed; the rendering
 * component reads the localized title from messages.tools[key].title.
 *
 * Semantic clusters used:
 *   • Translation trio (subtitle / md / json-translate) cross-link each other
 *   • Text-family tools (splitter / toolbox / novel / chinese-conversion) form a square
 *   • JSON tools route to nearest-utility siblings + the JSON i18n translator
 *   • Data-parser tools cluster with each other + jsonValueExtractor / dataBatch
 *
 * Goal: 2-3 outbound links per page so AI engines see an entity graph and
 * users discover adjacent tools.
 */
export const RELATED_TOOLS: Record<ToolKey, ToolKey[]> = {
  subtitleTranslator:   ["mdTranslator", "jsonTranslate", "textSplitter"],
  mdTranslator:         ["subtitleTranslator", "jsonTranslate", "textSplitter"],
  jsonTranslate:        ["mdTranslator", "subtitleTranslator", "jsonValueExtractor"],
  textSplitter:         ["textToolbox", "novelProcessor", "mdTranslator"],
  chineseConversion:    ["novelProcessor", "textToolbox", "textSplitter"],
  novelProcessor:       ["textSplitter", "textToolbox", "chineseConversion"],
  textToolbox:          ["textSplitter", "novelProcessor", "chineseConversion"],
  dataBatch:            ["textToolbox", "jsonValueExtractor", "jsonTranslate"],
  jsonValueExtractor:   ["jsonValueTransformer", "jsonNodeEdit", "jsonSortClassify"],
  jsonNodeEdit:         ["jsonNodeInserter", "jsonValueTransformer", "jsonValueSwapper"],
  jsonValueTransformer: ["jsonValueExtractor", "jsonValueSwapper", "jsonMatchUpdate"],
  jsonValueSwapper:     ["jsonValueTransformer", "jsonNodeEdit", "jsonMatchUpdate"],
  jsonNodeInserter:     ["jsonNodeEdit", "jsonValueSwapper", "jsonSortClassify"],
  jsonSortClassify:     ["jsonValueExtractor", "jsonMatchUpdate", "jsonNodeEdit"],
  jsonMatchUpdate:      ["jsonValueTransformer", "jsonValueSwapper", "jsonValueExtractor"],
  dataParserFlare:      ["dataParserImgPrompt", "jsonValueExtractor", "dataBatch"],
  dataParserImgPrompt:  ["dataParserFlare", "jsonTranslate", "dataBatch"],
};

/** Return the curated related-tool keys for a tool. Order is meaningful (declaration order = display order). */
export function relatedToolsOf(toolKey: ToolKey): ToolKey[] {
  return RELATED_TOOLS[toolKey] ?? [];
}

export function pathOf(toolKey: ToolKey): string {
  return TOOL_REGISTRY[toolKey].path;
}
/** Schema.org applicationCategory for the tool. Named with `app*` prefix to
 *  avoid collision with the UI-category helper in src/app/[locale]/home.tsx. */
export function appCategoryOf(toolKey: ToolKey): ApplicationCategory {
  return TOOL_REGISTRY[toolKey].category;
}
export function groupOf(toolKey: ToolKey): ToolGroup {
  return TOOL_REGISTRY[toolKey].group;
}
/** Fresh mutable copy so callers can pass to props typed as string[] */
export function namespacesOf(toolKey: ToolKey): string[] {
  return [...TOOL_REGISTRY[toolKey].namespaces];
}
/** Tool keys belonging to a UI group, in registry order. */
export function toolKeysByGroup(group: ToolGroup): ToolKey[] {
  return TOOL_KEYS.filter((k) => TOOL_REGISTRY[k].group === group);
}
/** URL paths belonging to a UI group, in registry order. */
export function toolPathsByGroup(group: ToolGroup): string[] {
  return toolKeysByGroup(group).map(pathOf);
}

export type HowToStep = { name: string; text: string };
export type FaqEntry = { q: string; a: string };

/**
 * Localized content for a tool page, loaded from messages/{locale}.json.
 * Distinct from Next.js `Metadata` (which is the HTML <title>/OG/canonical
 * shape); this is the raw text content used to *build* that Metadata and the
 * Schema.org JSON-LD payloads.
 */
export type ToolContent = {
  /** Short display name — used as Schema name and breadcrumb label */
  title: string;
  /** Short description — used as Schema description */
  description: string;
  /** Long SEO title — used in HTML <title> via buildToolPageMetadata */
  metaTitle: string;
  /** Long SEO meta description */
  metaDescription: string;
  faq: FaqEntry[];
  /** null when the locale has no howto data — schema is then omitted */
  howto: HowToStep[] | null;
  features: string[];
};

/**
 * Extract a tool's localized content from an already-loaded messages object.
 * Pure — exported so callers that already have `messages` in hand (e.g.
 * ToolPageShell, which also needs them for the client provider) can skip the
 * second next-intl call. Also enables direct unit testing without mocking
 * next-intl/server.
 *
 * Returns empty/null fields for missing keys — no fallback chain.
 */
export function extractToolContent(
  messages: { tools?: Record<string, unknown> } | undefined | null,
  toolKey: ToolKey,
): ToolContent {
  const entry = (messages?.tools?.[toolKey] ?? {}) as Record<string, unknown>;
  const str = (k: string) => (typeof entry[k] === "string" ? (entry[k] as string) : "");
  return {
    title: str("title"),
    description: str("description"),
    metaTitle: str("metaTitle"),
    metaDescription: str("metaDescription"),
    faq: Array.isArray(entry.faq) ? (entry.faq as FaqEntry[]) : [],
    howto: Array.isArray(entry.howto) ? (entry.howto as HowToStep[]) : null,
    features: Array.isArray(entry.features) ? (entry.features as string[]) : [],
  };
}
