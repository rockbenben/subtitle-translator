import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";

// Namespaces loaded on every page via the layout-level provider.
// - site chrome: Metadata, navigation, tools, feedback
// - cross-cutting: common, CopyToClipboard, languages
// Per-tool namespaces (subtitle, json, markdown, text-splitter, ...) stay
// out of here and are added by each tool page's own <ScopedMessages>.
export const SHARED_NAMESPACES = ["Metadata", "navigation", "tools", "feedback", "common", "languages", "CopyToClipboard"] as const;

// Server component that ships shared + the named tool namespaces to the
// client. NextIntlClientProvider does not deep-merge with ancestor providers,
// so the inner provider must re-include every namespace its subtree reads.
//
// The explicit `locale` prop is required for static export: getMessages()
// without an argument falls back to headers(), which forces dynamic rendering
// and breaks `output: "export"`.
export async function ScopedMessages({ locale, namespaces, children }: { locale: string; namespaces: readonly string[]; children: React.ReactNode }) {
  setRequestLocale(locale);
  const all = (await getMessages({ locale })) as Record<string, unknown>;
  const messages: Record<string, unknown> = {};
  for (const ns of SHARED_NAMESPACES) {
    if (all[ns] !== undefined) messages[ns] = all[ns];
  }
  for (const ns of namespaces) {
    if (all[ns] !== undefined) messages[ns] = all[ns];
  }
  return <NextIntlClientProvider messages={messages}>{children}</NextIntlClientProvider>;
}
