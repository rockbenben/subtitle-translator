import React from "react";
import { routing } from "@/i18n/routing";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import {
  SITE_URL,
  SITE_NAME,
  SITE_LOGO,
  SITE_VERSION,
  OG_IMAGE,
  AUTHOR,
  getOGLocale,
  getBcp47Locale,
  extractToolContent,
  type ApplicationCategory,
  type ToolKey,
  type ToolContent,
} from "./toolRegistry";

// Re-export everything from toolRegistry for backward compatibility — consumers
// can import from "@/app/lib/seo" without caring about the split.
export * from "./toolRegistry";

/**
 * Build a Next.js Metadata object for a tool page.
 * Includes OG, Twitter cards, absolute canonical, and hreflang alternates.
 */
export function buildToolPageMetadata({ locale, title, description, path }: { locale: string; title: string; description: string; path: string }): Metadata {
  // No site-name suffix — metaTitle is already SEO-optimized in messages/*.json,
  // appending " - Tools By AI" used to push some titles past Google's ~60-char
  // SERP cutoff (e.g. mdTranslator). siteName still goes into Open Graph,
  // which is the right surface for brand context.
  const fullUrl = `${SITE_URL}/${locale}/${path}`;
  return {
    title,
    description,
    alternates: {
      canonical: fullUrl,
      languages: {
        "x-default": `${SITE_URL}/${routing.defaultLocale}/${path}`,
        ...Object.fromEntries(routing.locales.map((lang) => [lang, `${SITE_URL}/${lang}/${path}`])),
      },
    },
    openGraph: {
      title,
      description,
      url: fullUrl,
      siteName: SITE_NAME,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: title }],
      locale: getOGLocale(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(getOGLocale),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

// FAQ/HowTo 文案用 [label](url) + `code` 的 markdown 子集 —— JSON-LD 是给
// 搜索引擎/AI 的纯文本结构数据,不能塞原始 markdown 语法(链接渲染成字面
// "[字幕翻译](../subtitle-translator)",代码标记渲染成反引号)。剥成纯文本。
const stripInlineMarkdown = (text: string): string =>
  text
    .replace(/\[([^\]]+)\]\([^)\s]+\)/g, "$1") // [label](url) → label
    .replace(/(`+)([^`]+?)\1/g, "$2"); // `code` → code

/** Render FAQPage JSON-LD structured data.
 *  Pass `pageUrl` (the same `url` given to WebAppSchema) so the FAQ can `about`-link
 *  to the WebApplication's @id — helps AI engines parse "this FAQ is about that
 *  app" instead of treating it as orphan content. */
export function FaqSchema({ faq, locale, pageUrl }: { faq: { q: string; a: string }[]; locale: string; pageUrl?: string }) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: getBcp47Locale(locale),
    dateModified: BUILD_DATE,
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: stripInlineMarkdown(q),
      acceptedAnswer: { "@type": "Answer", text: stripInlineMarkdown(a) },
    })),
  };
  if (pageUrl) {
    jsonLd.about = { "@id": `${SITE_URL}${pageUrl}#webapp` };
  }
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/**
 * Captured at module-load time. In `next build` (SSG) this resolves to the
 * build's worker-process start time — stable across the generated HTML.
 * In `next dev` it's the dev-server start time, which is fine because
 * `dateModified` isn't load-bearing during development.
 */
const BUILD_DATE = new Date().toISOString();

/** Render WebApplication JSON-LD for tool pages (GEO-optimized).
 *  `alternateName`: 1-3 真实别名（不要 keyword stuffing），帮 AI 引擎在不同
 *  语言/检索意图下识别这个工具。如英文 query 搜 "subtitle translator" 时让 AI
 *  能关联到 zh 页的"字幕翻译器"。空数组/undefined 不会输出该字段。 */
export function WebAppSchema({
  name,
  description,
  url,
  locale,
  featureList,
  alternateName,
  applicationCategory = "DeveloperApplication",
}: {
  name: string;
  description: string;
  url: string;
  locale: string;
  featureList?: string[];
  alternateName?: string[];
  applicationCategory?: ApplicationCategory;
}) {
  const fullUrl = `${SITE_URL}${url}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${fullUrl}#webapp`,
    name,
    description,
    url: fullUrl,
    applicationCategory,
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    softwareVersion: SITE_VERSION,
    inLanguage: getBcp47Locale(locale),
    isAccessibleForFree: true,
    dateModified: BUILD_DATE,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  if (alternateName && alternateName.length > 0) {
    // De-dup + filter empties + drop entries equal to primary `name`
    const cleaned = Array.from(new Set(alternateName.filter((n) => n && n !== name)));
    if (cleaned.length > 0) jsonLd.alternateName = cleaned;
  }
  if (featureList && featureList.length > 0) {
    jsonLd.featureList = featureList;
  }
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/**
 * Render ItemList JSON-LD for the homepage — lets AI engines understand
 * "what's in this site" as a structured collection rather than scraping
 * cards from HTML. One row per tool, in declaration order.
 *
 * Pass `items` from the home page's `useTranslations` resolved titles +
 * registered paths. `description` per item is optional but recommended for
 * richer entity context.
 */
export function ItemListSchema({ items, locale }: { items: { name: string; description?: string; url: string }[]; locale: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    inLanguage: getBcp47Locale(locale),
    numberOfItems: items.length,
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      url: `${SITE_URL}${item.url}`,
      name: item.name,
      ...(item.description ? { description: item.description } : {}),
    })),
  };
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/** Render BreadcrumbList JSON-LD for site navigation signal */
export function BreadcrumbSchema({ items, locale }: { items: { name: string; url: string }[]; locale?: string }) {
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
  if (locale) {
    jsonLd.inLanguage = getBcp47Locale(locale);
  }
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/**
 * Render sitewide Organization + WebSite JSON-LD as a connected @graph.
 * Mount this at the locale layout level — each locale page emits its own
 * copy with the appropriate inLanguage tag.
 */
export function GlobalSchemas({ locale }: { locale: string }) {
  const org = {
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    url: SITE_URL,
    logo: { "@type": "ImageObject", url: SITE_LOGO },
    sameAs: [AUTHOR.url],
    founder: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
  };
  const website = {
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    url: SITE_URL,
    name: SITE_NAME,
    inLanguage: getBcp47Locale(locale),
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [org, website],
  };
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/**
 * Load a tool's localized content from messages/{locale}.json under
 * tools.<toolKey>. Thin async wrapper around the pure `extractToolContent`
 * helper — use this when you don't already have the messages object loaded
 * (e.g. inside `generatePageMetadata`). ToolPageShell prefers calling
 * `extractToolContent` directly on the messages it already holds.
 */
export async function loadToolContent(toolKey: ToolKey, locale: string): Promise<ToolContent> {
  const messages = (await getMessages({ locale })) as { tools?: Record<string, unknown> };
  return extractToolContent(messages, toolKey);
}
