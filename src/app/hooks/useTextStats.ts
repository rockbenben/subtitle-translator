"use client";

import { useDeferredValue, useMemo } from "react";
import { truncate } from "@/app/utils/textUtils";

const MAX_CHAR_LENGTH = 1000000;

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
});

/**
 * Custom hook for deferred text statistics with editing state.
 * Combines useDeferredValue + text stats calculation + isEditable check.
 *
 * @param text - The source text to analyze
 * @param maxChars - Optional max character limit before becoming read-only (default: 1,000,000)
 * @returns Object containing stats, deferred text, displayText, and isEditable flag
 */
export const useTextStats = (text: string, maxChars: number = MAX_CHAR_LENGTH) => {
  const deferredText = useDeferredValue(text);

  const stats = useMemo(() => {
    const totalChars = deferredText.length;
    let totalLines = 0;

    if (totalChars > 0) {
      for (let i = 0; i < totalChars; i++) {
        const c = deferredText.charCodeAt(i);

        if (c === 10) {
          // \n
          totalLines++;
        } else if (c === 13) {
          // \r or \r\n
          totalLines++;
          if (i + 1 < totalChars && deferredText.charCodeAt(i + 1) === 10) {
            i++; // skip \n in \r\n
          }
        }
      }
      totalLines++; // last line
    }

    const isTooLong = totalChars > maxChars;
    const displayText = isTooLong ? truncate(deferredText) : deferredText;

    return {
      charCount: compactFormatter.format(totalChars),
      lineCount: compactFormatter.format(totalLines),
      isTooLong,
      displayText,
      isEditable: !isTooLong,
    };
  }, [deferredText, maxChars]);

  return {
    ...stats,
    deferredText,
  };
};
