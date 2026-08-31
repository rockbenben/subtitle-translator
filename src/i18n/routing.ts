import { defineRouting } from "next-intl/routing";
import { createNavigation } from "next-intl/navigation";
import { locales, buildLocale } from "./locales";

// 语言全集与单语言构建开关在 ./locales（由 project_sync 从主仓同步，别在这里改）。
// 本文件只保留【逐仓库真正不同】的那一项：defaultLocale。
export const routing = defineRouting({
  locales,
  defaultLocale: buildLocale ?? "en",
});

// Lightweight wrappers around Next.js' navigation APIs
// that will consider the routing configuration
export const { Link, redirect, usePathname, useRouter, getPathname } = createNavigation(routing);
