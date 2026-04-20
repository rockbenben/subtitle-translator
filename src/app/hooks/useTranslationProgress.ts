"use client";

import { useRef, useState } from "react";

/**
 * Progress + abort state for a single translation run.
 *
 * `abortControllerRef` is shared across all concurrent translate calls in a
 * run so one auth failure (or user cancel) can tear them all down at once.
 * `makeUpdateProgress` builds a progress callback scoped to a specific file
 * slice within a multi-file translation, normalizing fractional/overflowing
 * progress into a clean {percent, current, total} pair.
 */
export const useTranslationProgress = () => {
  const [translateInProgress, setTranslateInProgress] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressInfo, setProgressInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  /**
   * Build a progress-updater for one file within a multi-file batch.
   * `fileIndex` / `totalFiles` map per-file [0..1] into the global progress bar.
   */
  const makeUpdateProgress =
    (fileIndex: number = 0, totalFiles: number = 1) =>
    (current: number, total: number) => {
      const progress = ((fileIndex + current / total) / totalFiles) * 100;
      setProgressPercent(progress);
      // `current` can be fractional (e.g. 0.5 kick value to avoid a 0% stall) — floor it for display.
      setProgressInfo({ current: Math.min(Math.floor(current), total), total });
    };

  const resetProgress = () => {
    setProgressPercent(0);
    setProgressInfo({ current: 0, total: 0 });
  };

  return {
    translateInProgress,
    setTranslateInProgress,
    progressPercent,
    setProgressPercent,
    progressInfo,
    setProgressInfo,
    abortControllerRef,
    makeUpdateProgress,
    resetProgress,
  };
};
