import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// 未匹配路由的兜底（静态导出产出 out/404.html）：回默认 locale。
//
// ⚠【同 page.tsx：本文件在桌面分支上刻意与 main 分歧，合并时不要取 main 那一侧】
//   main 改用 meta refresh，是为了让跳转在构建期就成立（Web 上慢网 / 禁 JS 会白屏）；
//   桌面端本地加载没有这两个问题，meta refresh 反而多一次整页白闪，所以这里保持
//   redirect()。理由与对称的警告写在 main 的同名文件顶部。
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function RootNotFound() {
  redirect(`/${routing.defaultLocale}`);
}
