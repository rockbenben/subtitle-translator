import React, { Suspense } from "react";
import type { Metadata } from "next";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, setRequestLocale } from "next-intl/server";
import { pickSharedMessages } from "@/app/lib/clientMessages";
import { routing } from "@/i18n/routing";
import { buildToolPageMetadata, loadToolContent, pathOf, namespacesOf, type ToolKey } from "./seo";

// 子项目专用简化版：不渲染 schemas / FAQ / 相关工具卡片。
// 主仓 toolPageShell.tsx 已从 sync 排除，本文件由子项目独立维护。
export function generatePageMetadata(toolKey: ToolKey) {
  return async function generateMetadata({ params }: { params: Promise<{ locale?: string }> }): Promise<Metadata> {
    const { locale = routing.defaultLocale } = await params;
    const content = await loadToolContent(toolKey, locale);
    return buildToolPageMetadata({
      locale,
      title: content.metaTitle,
      description: content.metaDescription,
      path: pathOf(toolKey),
    });
  };
}

export async function ToolPageShell({ toolKey, locale, children }: { toolKey: ToolKey; locale: string; children: React.ReactNode }) {
  setRequestLocale(locale);
  const all = (await getMessages({ locale })) as Record<string, unknown>;
  const clientMessages = pickSharedMessages(all);
  for (const ns of namespacesOf(toolKey)) {
    if (all[ns] !== undefined) clientMessages[ns] = all[ns];
  }
  return (
    <NextIntlClientProvider messages={clientMessages}>
      <article>
        <Suspense>{children}</Suspense>
      </article>
    </NextIntlClientProvider>
  );
}
