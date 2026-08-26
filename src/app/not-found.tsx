import type { Metadata } from "next";
import { routing } from "@/i18n/routing";

// 未匹配路由的兜底（静态导出产出 out/404.html）：跳到默认 locale。
//
// ⚠ 同 page.tsx：静态导出下 redirect() 不产出构建期跳转，404.html 会是一份没有
//   meta refresh、没有 <noscript>、可见正文为空的壳 —— 跳转要等全部 JS 加载并
//   hydrate 后才发生（慢网白屏数秒、禁 JS 永久白屏）。
//   而且 404 比根页更暴露：主仓 public/edgeone.json 的 18 条 301 全是裸工具 slug，
//   没有任何一条兜 404；子项目连 edgeone.json 都没有。CDN 层面从来就没人接过这一页。
// 用构建期就生效的 meta refresh + 兜底链接代替（同 img-prompt 的做法）。
//
// ⚠ 这里【刻意不做】按浏览器语言的自动落点（根页 page.tsx 做了）。两个原因：
//   ① 本组件是全站的 not-found 边界，Next 会把它序列化进【每一个页面】的 RSC
//      payload —— 实测 out/en.html 里就有那段脚本的文本。让一段会改写 location
//      的脚本搭车进所有语言页，是在拿「显式 locale 永不被改写」这条底线冒险。
//   ② 语义上也不对：用户在 /en/... 下踩到 404，应当留在英文，而不是被送去浏览器
//      语言。404 保持确定性地回默认语言。
//
// ⚠ 桌面分支（本仓 feat/electron-desktop、子项目 feat/tauri-desktop）【不要】把本文件
//   的这个取向合并过去：桌面端本地加载没有慢网问题，meta refresh 反而带来一次整页
//   白闪，那边应当保持 redirect()。同一分歧 img-prompt 已经踩过并在它 tauri 分支的
//   page.tsx 顶部写了对称的警告（commit a993dcc5「双方都正确但结论相反」），这里是
//   另一半 —— 两边都写上，才不至于靠 merge 时临场判断。
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function RootNotFound() {
  const home = `/${routing.defaultLocale}`;
  return (
    <>
      <meta httpEquiv="refresh" content={`0;url=${home}`} />
      <p style={{ fontFamily: "sans-serif", padding: 24 }}>
        <a href={home}>Redirecting…</a>
      </p>
    </>
  );
}
