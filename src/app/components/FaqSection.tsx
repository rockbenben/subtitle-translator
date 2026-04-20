"use client";

import { Collapse } from "antd";

export function FaqSection({ items }: { items: { q: string; a: string }[] }) {
  return (
    <section style={{ marginTop: 40, fontSize: 13, opacity: 0.75 }}>
      <Collapse
        ghost
        size="small"
        items={items.map((item, i) => ({
          key: String(i),
          label: item.q,
          children: <p style={{ margin: 0 }}>{item.a}</p>,
        }))}
      />
    </section>
  );
}
