"use client";

import { useCallback } from "react";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";

const STORAGE_KEY = "translation-recentLanguages";
const MAX_RECENT = 5;

/**
 * Tracks the last 5 distinct language codes the user picked as source/target.
 * Surfaces them at the top of the LanguageSelector dropdowns so frequent
 * combinations don't require typing or scrolling through 122 entries.
 *
 * `auto` is intentionally excluded — it's not a "language" the user picks for
 * actual translation, just a source-detection mode that's already at the top
 * of the list by virtue of being entry #0.
 *
 * Push semantics: latest pick goes to position 0, duplicates dedupe (a re-pick
 * is treated as "most recent", not "skip"), list caps at 5.
 */
export const useRecentLanguages = (): {
  recentLanguages: string[];
  pushRecentLanguage: (code: string) => void;
} => {
  const [recentLanguages, setRecentLanguages] = useLocalStorage<string[]>(STORAGE_KEY, []);

  const pushRecentLanguage = useCallback(
    (code: string) => {
      if (!code || code === "auto") return;
      setRecentLanguages((prev) => {
        const deduped = prev.filter((c) => c !== code);
        return [code, ...deduped].slice(0, MAX_RECENT);
      });
    },
    [setRecentLanguages],
  );

  return { recentLanguages, pushRecentLanguage };
};
