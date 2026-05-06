"use client";

import React, { useEffect, useState } from "react";
import { Splitter } from "antd";

interface ToolSplitLayoutProps {
  /** Stable key used to persist the split position in localStorage. */
  storageKey: string;
  /** Split direction — "horizontal" puts input on the left, "vertical" on top. */
  direction?: "horizontal" | "vertical";
  /** Percentage (0–100) of the first pane's initial size before any user resize. */
  initialPercent?: number;
  /** Minimum size (in px) for each pane to prevent collapse. */
  minSize?: number;
  /** Left / top pane content (typically input / source area). */
  first: React.ReactNode;
  /** Right / bottom pane content (typically config / result area). */
  second: React.ReactNode;
  /** Total layout height. Defaults to `60vh` which feels right for
   *  full-viewport tools; caller can override when embedded. */
  height?: string | number;
}

/**
 * Resizable two-pane layout for tools with distinct input and output / config
 * areas. Uses AntD 6's <Splitter> so users can drag the divider. The split
 * percentage persists per `storageKey` in localStorage so refreshing or
 * re-visiting the tool preserves the user's preferred split.
 *
 * Theme 1 of the full-site redesign: unifies the fixed `<Row gutter><Col
 * lg={12}>` pattern used across 10+ tools into one shared primitive.
 */
const ToolSplitLayout = ({ storageKey, direction = "horizontal", initialPercent = 50, minSize = 240, first, second, height = "60vh" }: ToolSplitLayoutProps) => {
  const key = `toolSplit:${storageKey}`;
  const [sizes, setSizes] = useState<(number | string)[]>([`${initialPercent}%`, `${100 - initialPercent}%`]);

  // Read persisted split on mount. Stored as a comma-separated pair of
  // CSS-length values, e.g. "48%,52%" — trivially parseable and human-
  // readable in devtools.
  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parts = raw.split(",").map((s) => s.trim());
      if (parts.length === 2) setSizes(parts);
    }
  }, [key]);

  const handleResize = (values: number[]) => {
    const total = values.reduce((a, b) => a + b, 0) || 1;
    const pct = values.map((v) => `${Math.round((v / total) * 10000) / 100}%`);
    setSizes(pct);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(key, pct.join(","));
      } catch {
        // quota exceeded — silently ignore, split just won't persist
      }
    }
  };

  return (
    <Splitter layout={direction} onResize={handleResize} style={{ height }}>
      <Splitter.Panel size={sizes[0]} min={minSize}>
        {first}
      </Splitter.Panel>
      <Splitter.Panel size={sizes[1]} min={minSize}>
        {second}
      </Splitter.Panel>
    </Splitter>
  );
};

export default ToolSplitLayout;
