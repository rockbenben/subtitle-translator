"use client";

import { Collapse, theme } from "antd";

/** Slugify a question into a URL-safe anchor id — supports CJK via keeping
 *  non-ASCII alphanumerics and replacing whitespace / punctuation with `-`. */
const toAnchorId = (q: string) =>
  q
    .toLowerCase()
    .trim()
    .replace(/[\s/]+/g, "-")
    .replace(/[^\p{L}\p{N}-]/gu, "")
    .slice(0, 80);

export function FaqSection({ items }: { items: { q: string; a: string }[] }) {
  const { token } = theme.useToken();
  return (
    <section id="faq" style={{ marginTop: 56 }} aria-label="FAQ">
      {/* Editorial chapter divider — mono caps label + extending hairline */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: token.marginMD }}>
        <span
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: token.colorText,
            opacity: 0.7,
            whiteSpace: "nowrap",
          }}>
          FAQ — {String(items.length).padStart(2, "0")}
        </span>
        <div aria-hidden style={{ flex: 1, height: 1, background: token.colorBorderSecondary }} />
      </div>
      <Collapse
        ghost
        size="small"
        items={items.map((item, i) => ({
          key: toAnchorId(item.q) || String(i),
          label: (
            <span style={{ display: "inline-flex", alignItems: "baseline", gap: 12 }}>
              <span
                className="font-mono"
                style={{
                  fontSize: 12,
                  color: token.colorText,
                  opacity: 0.7,
                  letterSpacing: "0.05em",
                  flexShrink: 0,
                }}>
                Q{String(i + 1).padStart(2, "0")}
              </span>
              <span>{item.q}</span>
            </span>
          ),
          children: <p style={{ margin: 0, paddingLeft: 40, opacity: 0.85, fontSize: 13 }}>{item.a}</p>,
        }))}
      />
    </section>
  );
}
