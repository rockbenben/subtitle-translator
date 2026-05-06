"use client";

import { Collapse } from "antd";

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
  return (
    <section id="faq" style={{ marginTop: 40, fontSize: 13, opacity: 0.75 }} aria-label="FAQ">
      <Collapse
        ghost
        size="small"
        items={items.map((item, i) => ({
          key: toAnchorId(item.q) || String(i),
          label: item.q,
          children: <p style={{ margin: 0 }}>{item.a}</p>,
        }))}
      />
    </section>
  );
}
