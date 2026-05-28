import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Defensive noindex on the bare-root fallback. In production edgeone.json
// 301-redirects "/" → "/{defaultLocale}" at CDN so crawlers never reach this.
// If any host doesn't honor edgeone.json, the static fallback would otherwise
// be a content-less 200 page Google could index. Belt-and-suspenders.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

// Redirect the user to the default locale when `/` is requested
export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
