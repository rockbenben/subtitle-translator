import React from "react";
import { routing } from "@/i18n/routing";
import type { Metadata } from "next";

export const SITE_URL = "https://tools.newzone.top";
export const SITE_NAME = "Tools By AI";
export const SITE_LOGO = `${SITE_URL}/logo.png`;
export const AUTHOR = { name: "rockbenben", url: "https://github.com/rockbenben" };

/** Map internal locale codes to OpenGraph locale format (language_TERRITORY) */
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

/** Convert internal locale to OpenGraph locale format */
export function getOGLocale(locale: string): string {
  return OG_LOCALE_MAP[locale] ?? locale;
}

/**
 * Generate complete metadata for an i18n tool page.
 * Includes OG, Twitter cards, canonical, and hreflang alternates.
 */
export function generateToolMetadata({ locale, title, description, path }: { locale: string; title: string; description: string; path: string }): Metadata {
  const fullTitle = `${title} - ${SITE_NAME}`;
  return {
    title: fullTitle,
    description,
    alternates: {
      canonical: `/${locale}/${path}`,
      languages: { "x-default": `/${routing.defaultLocale}/${path}`, ...Object.fromEntries(routing.locales.map((lang) => [lang, `/${lang}/${path}`])) },
    },
    openGraph: {
      title: fullTitle,
      description,
      url: `/${locale}/${path}`,
      siteName: SITE_NAME,
      images: [{ url: "/og-image.png", width: 1200, height: 630, alt: fullTitle }],
      locale: getOGLocale(locale),
      alternateLocale: routing.locales.filter((l) => l !== locale).map(getOGLocale),
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      images: ["/og-image.png"],
    },
  };
}

/** Render FAQPage JSON-LD structured data + visible FAQ section */
export function FaqSchema({ faq }: { faq: { q: string; a: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
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

/** Build-time date for dateModified — baked into static HTML */
const BUILD_DATE = new Date().toISOString();

/** Render enhanced WebApplication JSON-LD for tool pages (GEO-optimized) */
export function ToolSchema({ name, description, url, locale, featureList }: { name: string; description: string; url: string; locale: string; featureList?: string[] }) {
  const fullUrl = `${SITE_URL}${url}`;
  const jsonLd: Record<string, unknown> = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "@id": `${fullUrl}#webapp`,
    name,
    description,
    url: fullUrl,
    applicationCategory: "DeveloperApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript. Requires HTML5.",
    inLanguage: locale,
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
export function HowToSchema({ name, description, steps }: { name: string; description: string; steps: { name: string; text: string }[] }) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "HowTo",
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

