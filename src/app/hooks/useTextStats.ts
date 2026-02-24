"use client";

import { useMemo, useDeferredValue } from "react";
import { truncate } from "@/app/utils/textUtils";

const MAX_CHAR_LENGTH = 1000000;

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
});

/**
 * Custom hook for deferred text statistics with editing state.
 * Uses useDeferredValue for non-blocking updates instead of manual debounce.
 *
 * @param text - The source text to analyze
 * @param maxChars - Optional max character limit before becoming read-only (default: 1,000,000)
 * @returns Object containing stats, deferred text, displayText, and isEditable flag
 */
export const useTextStats = (text: string, maxChars: number = MAX_CHAR_LENGTH) => {
  const deferredText = useDeferredValue(text);

  // Critical: Calculate layout-related flags from ACTUAL text immediately, not deferred text
  // This prevents rendering 25MB text into the DOM while waiting for the deferred update
  const isTooLong = text.length > maxChars;

  // If text is too long, strictly force truncated display regardless of deferred state
  // truncate() is cheap (slice), so it's safe to run on every render
  const displayText = isTooLong ? truncate(text) : text;

  const stats = useMemo(() => {
    // Use the deferred text for heavy line counting calculations
    const targetText = deferredText;
    const totalChars = targetText.length;
    let totalLines = 0;

    if (totalChars > 0) {
      // Optimized line counting using indexOf (significantly faster than char-by-char iteration)
      let index = -1;
      while ((index = targetText.indexOf("\n", index + 1)) !== -1) {
        totalLines++;
      }

      // Fallback for old Mac line endings (\r) if no \n exists
      // If the text contains \n, we assume it uses standard or windows endings and ignore standalone \r to avoid double counting \r\n
      if (totalLines === 0 && targetText.includes("\r")) {
        let rIndex = -1;
        while ((rIndex = targetText.indexOf("\r", rIndex + 1)) !== -1) {
          totalLines++;
        }
      }

      totalLines++; // Add the last line
    }

    return {
      charCount: compactFormatter.format(totalChars),
      lineCount: compactFormatter.format(totalLines),
    };
  }, [deferredText]);

  return {
    ...stats,
    isTooLong,
    displayText,
    // Return deferred text as 'deferredText' for consumers who want the stabilized value
    deferredText,
    isEditable: !isTooLong,
  };
};
