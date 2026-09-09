"use client";

// 桌面自维护文件(sync 的 [locale] 规则只含 /error.tsx,本文件不同步)——
// 与上游 web-tools-by-ai 的 [locale]/not-found.tsx 手工对齐:上游升级了本地化 +
// 5s 倒计时 + 首页按钮时这边跟一遍。NotFound 命名空间由 SHARED_NAMESPACES 随同步带入。

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Result, Button } from "antd";
import Link from "next/link";

/**
 * Per-locale not-found page. Reads `useLocale()` to localize the redirect
 * + copy. Auto-redirects to the locale homepage after 5s for stranded
 * users; exposes a manual Link so AI crawlers see a discoverable URL.
 */
export default function NotFound() {
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations("NotFound");
  const homePath = `/${locale}`;
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const tick = setInterval(() => setCountdown((c) => Math.max(c - 1, 0)), 1000);
    const redirect = setTimeout(() => router.push(homePath), 5000);
    return () => {
      clearInterval(tick);
      clearTimeout(redirect);
    };
  }, [router, homePath]);

  return (
    // min-h-[60vh] 与 error.tsx 一致：min-h-screen 会在 100vh 的 Layout 里再要
    // 一屏高度，一个 404 页反而带出竖向滚动条。
    <div className="flex justify-center items-center min-h-[60vh]">
      <Result
        status="404"
        title={t("title")}
        subTitle={`${t("description")} (${countdown}s)`}
        extra={
          <Link href={homePath}>
            <Button type="primary">{t("goHome")}</Button>
          </Link>
        }
      />
    </div>
  );
}
