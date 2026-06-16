"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTauriRuntime } from "@/app/utils/externalLink";

const KEY = "subtitle_translator_preferred_language";
export const setPreferredLanguage = (l: string) => {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
};
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const localeOf = (p: string) => p.match(/^\/([a-z]{2}(-[a-z]+)?)/i)?.[1] ?? null;
const systemLocale = () => {
  const s = (typeof navigator !== "undefined" && navigator.language) || "en";
  if (s.startsWith("zh")) return /TW|HK|Hant/i.test(s) ? "zh-hant" : "zh";
  return s.split("-")[0];
};

// MODULE-level, not a ref: survives the [locale] layout remount a switch triggers, so
// the redirect runs exactly once per app launch and never bounces a switch (gotcha #11).
let sessionRedirectDone = false;

export function useLanguagePreference(valid: string[]) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (sessionRedirectDone || !isTauriRuntime()) return;
    const cur = localeOf(pathname);
    if (!cur) return;
    sessionRedirectDone = true;
    let pref = read();
    if (!pref) {
      const s = systemLocale();
      if (valid.includes(s)) {
        pref = s;
        setPreferredLanguage(s);
      }
    } // first run → system
    if (pref && valid.includes(pref) && pref !== cur) {
      router.replace(pathname.replace(/^\/[a-z]{2}(-[a-z]+)?/i, `/${pref}`)); // SOFT redirect, once
    }
  }, [pathname, router, valid]);
}
