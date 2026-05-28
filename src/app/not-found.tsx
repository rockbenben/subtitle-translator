import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// Defensive noindex for the bare-root fallback HTML. In production
// edgeone.json 301-redirects "/" → "/{defaultLocale}" at CDN level so this
// page is never reached by crawlers. But if any host/CDN doesn't honor
// edgeone.json, the static fallback emitted here would otherwise be a
// content-less 200 page Google could index. Belt-and-suspenders.
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

// Redirect the user to the default locale when `/` is requested
export default function RootNotFound() {
  redirect(`/${routing.defaultLocale}`);
}
