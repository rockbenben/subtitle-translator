import React, { Suspense } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations, setRequestLocale } from "next-intl/server";
import { FaqSection } from "@/app/components/FaqSection";
import { pickSharedMessages } from "@/app/lib/clientMessages";
import { routing } from "@/i18n/routing";
import {
  WebAppSchema,
  FaqSchema,
  HowToSchema,
  BreadcrumbSchema,
  buildToolPageMetadata,
  loadToolContent,
  extractToolContent,
  pathOf,
  appCategoryOf,
  namespacesOf,
  type ToolKey,
} from "./seo";

/**
 * Factory that produces a Next.js `generateMetadata` function for a tool page.
 *
 * Usage in page.tsx:
 *   export const generateMetadata = generatePageMetadata("subtitleTranslator");
 */
export function generatePageMetadata(toolKey: ToolKey) {
  return async function generateMetadata({ params }: { params: Promise<{ locale?: string }> }): Promise<Metadata> {
    const { locale = routing.defaultLocale } = await params;
    const content = await loadToolContent(toolKey, locale);
    return buildToolPageMetadata({
      locale,
      title: content.metaTitle,
      description: content.metaDescription,
      path: pathOf(toolKey),
    });
  };
}

/**
 * Unified server component for tool pages. Emits the full SEO/GEO schema
 * suite (WebApplication, FAQPage, HowTo, BreadcrumbList) and wraps the
 * given client `children` in a NextIntlClientProvider with shared + per-tool
 * namespaces plus a Suspense boundary.
 *
 * Per-tool config (URL path, applicationCategory, client namespaces) comes
 * from TOOL_REGISTRY in toolRegistry.ts — pages just pass toolKey.
 *
 *   <ToolPageShell toolKey="subtitleTranslator" locale={locale}>
 *     <ClientPage />
 *   </ToolPageShell>
 *
 * NextIntlClientProvider does not deep-merge with ancestor providers, so this
 * inner provider must re-include every namespace its subtree reads. We do that
 * by feeding it `pickSharedMessages(all) + per-tool namespaces`.
 */
export async function ToolPageShell({
  toolKey,
  locale,
  children,
}: {
  toolKey: ToolKey;
  locale: string;
  children: React.ReactNode;
}) {
  setRequestLocale(locale);
  const all = (await getMessages({ locale })) as Record<string, unknown> & { tools?: Record<string, unknown> };
  const content = extractToolContent(all, toolKey);
  const tNav = await getTranslations({ locale, namespace: "navigation" });
  const url = `/${locale}/${pathOf(toolKey)}`;

  const clientMessages = pickSharedMessages(all);
  for (const ns of namespacesOf(toolKey)) {
    if (all[ns] !== undefined) clientMessages[ns] = all[ns];
  }

  return (
    <>
      <WebAppSchema
        name={content.title}
        description={content.description}
        url={url}
        locale={locale}
        featureList={content.features}
        applicationCategory={appCategoryOf(toolKey)}
      />
      {content.faq.length > 0 && <FaqSchema faq={content.faq} locale={locale} />}
      {content.howto && <HowToSchema name={content.title} description={content.description} steps={content.howto} locale={locale} />}
      <BreadcrumbSchema
        items={[
          { name: tNav("home"), url: `/${locale}` },
          { name: content.title, url },
        ]}
      />
      <NextIntlClientProvider messages={clientMessages}>
        <article>
          <Suspense>{children}</Suspense>
          {content.faq.length > 0 && <FaqSection items={content.faq} />}
        </article>
      </NextIntlClientProvider>
    </>
  );
}
