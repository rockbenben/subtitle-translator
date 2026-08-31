import { routing } from "@/i18n/routing";

/**
 * 裸域名根页的语言落点脚本（内联、零依赖、在解析期同步执行）。
 *
 * 为什么必须是内联脚本：生产是 `output: "export"`，部署产物是纯静态的 out/，
 * **没有运行时** —— next-intl 的 Accept-Language 协商（src/proxy.ts 那个
 * middleware）在生产根本不执行，它只在 `yarn dev` 里有效。所以语言协商只能
 * 放到客户端做。
 *
 * 优先级：用户显式选过的语言 > 浏览器偏好 > defaultLocale。
 *  · 显式选择存在 localStorage（LanguageSelector 写入）。【没有这一层就别做
 *    这个功能】：用户手动切到英文、下次打开裸域名又被甩回中文，站点等于在跟
 *    用户对着干。
 *  · 解析不出结果、或结果就是 defaultLocale 时【什么都不做】，交给同页那条
 *    <meta http-equiv="refresh"> 兜底（它也是禁用 JS 时的唯一出路）。
 *
 * ⚠ 只用在 `/` 上。显式的 /en、/zh 是用户给出的最强信号，永远不要改写；404 也
 *   【刻意不挂】—— not-found.tsx 是全站的 not-found 边界，Next 会把它序列化进
 *   【每一个页面】的 RSC payload（实测 out/en.html 里就出现过脚本文本），让会改写
 *   location 的脚本搭车进所有语言页太冒险；语义上也不对（在 /en 下踩 404 应留在英文）。
 *   原因同样写在 not-found.tsx 顶部。
 * ⚠ L 用的是 `routing.locales`（本次构建【实际产出】的那些），【不是】ALL_LOCALES
 *   全集。单语言构建下这两者不同：拿全集去匹配，会把偏好德语的用户 replace 到
 *   `/de` —— 而那条路由根本没被构建出来，直接 404。曾经写错过一次，实测发现
 *   （build:lang zh 的产物里 L 仍是 18 个）。
 * ⚠ 中文按地区分简繁：zh-TW / zh-HK / zh-MO / *-Hant → zh-hant，其余 zh-* → zh。
 *   弄反了比不做更糟（台湾用户落到简体）。
 * ⚠ location.replace 而非 href：不留历史记录，否则用户按返回会被反复弹回来。
 * ⚠ 带上 search 与 hash：`?huginn` 这类功能门控参数丢了是有代价的 —— 仓库里已经
 *   为此修过一次（见 ui/navigation/LanguageSelector 的注释：data-batch 会因参数
 *   消失把已选工具回写成 excel，localStorage 永久丢失）。同页那条 meta refresh 是
 *   静态的、保不住它们，所以这条 JS 路径是唯一能保住的地方。
 * ⚠ 整体 try/catch：无痕模式 / 禁用站点数据时读 localStorage 会直接抛。
 * ⚠ dev 与生产【会有一处差异，是预期的】：`yarn dev` 下 middleware 是活的，
 *   next-intl 自己按 Accept-Language 把 `/` 307 走了（实测 zh-CN→/zh、de-DE→/de、
 *   不发头→/en），本页与本脚本根本轮不到执行。方向一致，但 dev 读不到 localStorage，
 *   所以【dev 不尊重用户选过的语言】。改不了：生产是静态导出、压根没有 middleware，
 *   为它改用 cookie 只服务 dev，不划算。
 */

/** 用户显式选择的界面语言。LanguageSelector 写、这段脚本读。 */
export const LOCALE_STORAGE_KEY = "ui-locale";

export const localeRedirectScript = `(function(){try{
var L=${JSON.stringify(routing.locales)},D=${JSON.stringify(routing.defaultLocale)},p=null;
try{var s=localStorage.getItem(${JSON.stringify(LOCALE_STORAGE_KEY)});if(s&&L.indexOf(s)>=0)p=s;}catch(e){}
if(!p){var n=navigator.languages||[navigator.language||""];
for(var i=0;i<n.length&&!p;i++){var t=String(n[i]||"").toLowerCase();
if(t.indexOf("zh")===0){var h=/(^|-)(tw|hk|mo|hant)(-|$)/.test(t)?"zh-hant":"zh";if(L.indexOf(h)>=0)p=h;}
else{var b=t.split("-")[0];if(L.indexOf(b)>=0)p=b;}}}
if(p&&p!==D)location.replace("/"+p+location.search+location.hash);
}catch(e){}})();`;
