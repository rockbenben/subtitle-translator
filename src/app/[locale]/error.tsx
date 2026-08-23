"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Result, Button } from "antd";
import { shouldAutoReload, RELOAD_STAMP_KEY } from "@/app/lib/autoReload";

/**
 * Locale-level error boundary. Primary job is deploy-skew recovery: a session
 * opened before a deploy lazy-loads tool chunks that the new deploy deleted
 * from gh-pages, so the first navigation after a release crashes. A hard
 * reload fetches the new self-consistent build, so we do it automatically
 * (once per cooldown — see autoReload.ts) instead of showing Next's default
 * "This page couldn't load" screen. Repeat errors inside the cooldown fall
 * through to the visible fallback below.
 */
export default function LocaleError() {
  const t = useTranslations("AppError");
  const [willReload] = useState(() => {
    if (typeof window === "undefined") return false;
    try {
      const last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY)) || null;
      return shouldAutoReload(last, Date.now());
    } catch {
      // sessionStorage unavailable → still reload; the cooldown guard is lost
      // but a reload loop needs the error to also persist across full loads,
      // which only happens for genuine bugs on storage-less browsers.
      return true;
    }
  });

  useEffect(() => {
    if (!willReload) return;
    try {
      sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
    } catch {}
    window.location.reload();
  }, [willReload]);

  // About to hard-reload — render nothing rather than flashing the error UI.
  if (willReload) return null;

  return (
    <div className="flex justify-center items-center min-h-[60vh]">
      <Result
        status="error"
        title={t("title")}
        subTitle={t("description")}
        extra={
          <Button type="primary" onClick={() => window.location.reload()}>
            {t("reload")}
          </Button>
        }
      />
    </div>
  );
}
