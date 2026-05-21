import React from "react";
import { routing } from "@/i18n/routing";
import { getMessages } from "next-intl/server";
import type { Metadata } from "next";
import {
  SITE_URL,
  SITE_NAME,
  SITE_LOGO,
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
  const fullTitle = `${title} - ${SITE_NAME}`;
  const fullUrl = `${SITE_URL}/${locale}/${path}`;
  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: fullUrl,
      languages: {
        "x-default": `${SITE_URL}/${routing.defaultLocale}/${path}`,
        ...Object.fromEntries(routing.locales.map((lang) => [lang, `${SITE_URL}/${lang}/${path}`])),
      },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: fullUrl,
      siteName: SITE_NAME,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: fullTitle }],
      locale: getOGLocale(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(getOGLocale),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: [OG_IMAGE],
    },
  };
}

/** Render FAQPage JSON-LD structured data */
export function FaqSchema({ faq, locale }: { faq: { q: string; a: string }[]; locale: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    inLanguage: getBcp47Locale(locale),
    mainEntity: faq.map(({ q, a }) => ({
      "@type": "Question",
      name: q,
      acceptedAnswer: { "@type": "Answer", text: a },
    })),
  };
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

/** Render WebApplication JSON-LD for tool pages (GEO-optimized) */
export function WebAppSchema({
  name,
  description,
  url,
  locale,
  featureList,
  applicationCategory = "DeveloperApplication",
}: {
  name: string;
  description: string;
  url: string;
  locale: string;
  featureList?: string[];
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
    inLanguage: getBcp47Locale(locale),
    isAccessibleForFree: true,
    dateModified: BUILD_DATE,
    isPartOf: { "@id": `${SITE_URL}/#website` },
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    author: { "@type": "Person", name: AUTHOR.name, url: AUTHOR.url },
    publisher: { "@id": `${SITE_URL}/#organization` },
  };
  if (featureList && featureList.length > 0) {
    jsonLd.featureList = featureList;
  }
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/** Render HowTo JSON-LD — high-value signal for AI "how to" queries */
export function HowToSchema({ name, description, steps, locale }: { name: string; description: string; steps: { name: string; text: string }[]; locale: string }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    inLanguage: getBcp47Locale(locale),
    name,
    description,
    step: steps.map((s, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      name: s.name,
      text: s.text,
    })),
  };
  return React.createElement("script", {
    type: "application/ld+json",
    dangerouslySetInnerHTML: { __html: JSON.stringify(jsonLd) },
  });
}

/** Render BreadcrumbList JSON-LD for site navigation signal */
export function BreadcrumbSchema({ items }: { items: { name: string; url: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${SITE_URL}${item.url}`,
    })),
  };
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
    sameAs: [AUTHOR.url, "https://github.com/rockbenben/web-tools-by-ai"],
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
