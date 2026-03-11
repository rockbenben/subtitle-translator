import { routing } from "@/i18n/routing";
import type { Metadata } from "next";

export const SITE_URL = "https://tools.newzone.top";
export const SITE_NAME = "Tools By AI";
export const SITE_LOGO = `${SITE_URL}/logo.png`;
export const AUTHOR = { name: "rockbenben", url: "https://github.com/rockbenben" };

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
      languages: Object.fromEntries(routing.locales.map((lang) => [lang, `/${lang}/${path}`])),
    },
    openGraph: {
      title: fullTitle,
      description,
      url: `/${locale}/${path}`,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  };
}

/**
 * Generate metadata for zh-only tool pages (static metadata).
 * Includes canonical and OG tags, but no hreflang (single locale).
 */
export function generateZhOnlyToolMetadata({ title, description, keywords, path }: { title: string; description: string; keywords: string; path: string }): Metadata {
  return {
    title,
    description,
    keywords,
    alternates: {
      canonical: `/zh/${path}`,
    },
    openGraph: {
      title,
      description,
      url: `/zh/${path}`,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}
