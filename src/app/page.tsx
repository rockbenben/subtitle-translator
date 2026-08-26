import type { Metadata } from "next";
import { routing } from "@/i18n/routing";
import { localeRedirectScript } from "@/app/localeRedirect";

// 裸域名根页：兜底跳到默认 locale。noindex 防止爬虫索引这个无内容的中转页。
//
// ⚠ 这里曾用 next/navigation 的 redirect()，但【静态导出下它不产出任何构建期跳转
//   手段】—— 实测 out/index.html 是一份 3.4KB 的壳：既无 meta refresh、也无
//   <noscript>，去掉标签后可见正文为空。跳转要等整个 bundle 下载并 hydrate 之后
//   才发生：慢网白屏数秒、禁 JS 永久白屏，而这是全站访问量最大的那个 URL。
// ⚠ 旧注释写着「production edgeone.json 301-redirects "/" → "/{defaultLocale}"」，
//   那句话【两边都不成立】(本文件由 project_sync 铺给全部子项目，注释必须处处为真)：
//   · 主仓 tools.newzone.top 确有 public/edgeone.json，但那 18 条 301 全是裸工具
//     slug（/subtitle-translator* 之类），【没有 "/" 这一条】；
//   · 8 个子项目连 edgeone.json 都没有。
//   也就是说根页此前既没有 CDN 兜底、也没有构建期跳转。
// 用构建期就生效的 meta refresh + 兜底链接代替（同 img-prompt 的做法）。
//
// ⚠ 桌面分支（本仓 feat/electron-desktop、子项目 feat/tauri-desktop）【不要】把本文件
//   的这个取向合并过去：桌面端本地加载没有慢网问题，meta refresh 反而带来一次整页
//   白闪，那边应当保持 redirect()。同一分歧 img-prompt 已经踩过并在它 tauri 分支的
//   page.tsx 顶部写了对称的警告（commit a993dcc5「双方都正确但结论相反」），这里是
//   另一半 —— 两边都写上，才不至于靠 merge 时临场判断。
export const metadata: Metadata = {
  robots: { index: false, follow: true },
};

export default function RootPage() {
  const home = `/${routing.defaultLocale}`;
  return (
    <>
      {/* 语言落点：已选语言 > 浏览器偏好 > defaultLocale。解析不出或就是默认值时
          什么都不做，由下面那条 meta refresh 兜底（也是禁用 JS 时的唯一出路）。 */}
      <script dangerouslySetInnerHTML={{ __html: localeRedirectScript }} />
      <meta httpEquiv="refresh" content={`0;url=${home}`} />
      <p style={{ fontFamily: "sans-serif", padding: 24 }}>
        <a href={home}>Redirecting…</a>
      </p>
    </>
  );
}
