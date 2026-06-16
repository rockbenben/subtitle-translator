"use client";
import { useEffect } from "react";
import { useAutoUpdate } from "@/app/hooks/useAutoUpdate";
import { useLanguagePreference } from "@/app/hooks/useLanguagePreference";
import { isTauriRuntime, openExternalLink } from "@/app/utils/externalLink";
import { routing } from "@/i18n/routing";

/**
 * Tauri-only side effects, mounted once inside the providers (NextIntlClientProvider
 * for routing + antd <App> for modal). No-ops entirely in the web build.
 *  - auto-update check (startup + interval, confirm-to-install)
 *  - remember UI language across launches (soft redirect, once per session)
 *  - global external-link interceptor (gotcha #10): route external links to the
 *    system browser via plugin-opener instead of hijacking the app webview.
 */
export default function TauriIntegration() {
  useAutoUpdate();
  useLanguagePreference([...routing.locales]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = (e.target as Element | null)?.closest?.("a")?.getAttribute("href");
      if (!href) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      const external = (url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin;
      if (!external && url.protocol !== "mailto:" && url.protocol !== "tel:") return; // internal → let the router handle it
      e.preventDefault();
      e.stopPropagation();
      openExternalLink(url.href);
    };
    document.addEventListener("click", onClick, true); // capture phase
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
