import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";

export const routing = defineRouting({
  // A list of all locales that are supported
  locales: ["en", "zh", "zh-hant", "pt", "es", "hi", "ar", "fr", "de", "ja", "ko", "ru", "vi", "tr", "bn", "id", "it"],
  defaultLocale: "en",
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
