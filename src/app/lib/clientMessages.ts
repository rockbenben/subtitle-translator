/**
 * Pure helpers for shaping the messages payload that's shipped to the
 * NextIntlClientProvider. No next-intl imports → safe for unit tests and
 * pure consumers.
 */

/**
 * Namespaces always available client-side on every page.
 * - site chrome: Metadata, navigation, tools, feedback
 * - cross-cutting: common, CopyToClipboard, languages
 *
 * Per-tool namespaces (SubtitleTranslator, MDTranslator, TextSplitter, JSON*, …)
 * and shared widget namespaces used by a subset of tools (e.g. ProtectedRuleManager,
 * used by chinese-conversion + novel-processor) stay out of here. Tool pages
 * declare them via TOOL_REGISTRY[<tool>].namespaces — automated tests verify
 * the declaration matches actual widget usage (see widget-namespace-parity
 * test).
 */
export const SHARED_NAMESPACES = ["Metadata", "navigation", "tools", "feedback", "common", "languages", "CopyToClipboard", "NotFound"] as const;

/**
 * Build the client-bundled messages object: pick SHARED_NAMESPACES from the
 * full messages, slimming `tools.*` to just { title, description } per tool.
 *
 * The long-form metaTitle/metaDescription/faq/features are server-only
 * (consumed by ToolPageShell + generateMetadata via loadToolContent), so
 * omitting them from the client payload saves ~14 KB per provider, ~30 KB
 * per page (layout + ToolPageShell double-ship would otherwise duplicate).
 */
export function pickSharedMessages(all: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const ns of SHARED_NAMESPACES) {
    const value = all[ns];
    if (value === undefined) continue;
    if (ns === "tools" && value && typeof value === "object") {
      const slim: Record<string, { title?: string; description?: string }> = {};
      for (const [k, v] of Object.entries(value as Record<string, Record<string, unknown>>)) {
        slim[k] = {};
        if (typeof v?.title === "string") slim[k].title = v.title;
        if (typeof v?.description === "string") slim[k].description = v.description;
      }
      out.tools = slim;
    } else {
      out[ns] = value;
    }
  }
  return out;
}
