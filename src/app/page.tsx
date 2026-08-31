import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { routing } from "@/i18n/routing";

// 裸根路径的兜底：跳到默认 locale。noindex 防止这个无内容的中转页被索引
//（桌面端用不上，但本文件由 project_sync 铺给全部子项目，保持一致）。
//
// ⚠【本文件在桌面分支上刻意与 main 分歧 —— 合并 main 时不要取它那一侧】
//   main 把 redirect() 换成了「meta refresh + localeRedirect 脚本」，理由是静态
//   导出下 redirect() 不产出任何构建期跳转：out/index.html 是个空壳，要等整个
//   bundle 下载并 hydrate 之后才跳，慢网白屏数秒、禁 JS 永久白屏。那对 Web 成立。
//   桌面端反过来：页面是本地资源，没有慢网也没有禁 JS，meta refresh 换来的只是
//   一次整页白闪；语言落点也另有其人（desktop/useLanguagePreference.ts 记住上次
//   选择，而不是读浏览器语言）。
//   main 那两个文件（page.tsx / not-found.tsx）顶部写着对称的警告，这里是另一半 ——
//   两边都写上，才不至于靠 merge 时临场判断。同一分歧 img-prompt 的 tauri 分支
//   已经踩过（commit a993dcc5「双方都正确但结论相反」）。
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function RootPage() {
  redirect(`/${routing.defaultLocale}`);
}
