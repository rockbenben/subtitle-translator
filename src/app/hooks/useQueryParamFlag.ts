"use client";

import { useSyncExternalStore } from "react";

/**
 * 读 URL 查询串里的一个「功能门控」开关（如 `?huginn`），**不触发 CSR bailout**。
 *
 * ⚠ 不要改用 `useSearchParams()`。生产是 `output: "export"`，而 `useSearchParams`
 * 在静态生成时必须由 <Suspense> 兜住，否则整个页面的客户端子树被替换成
 * `BAILOUT_TO_CLIENT_SIDE_RENDERING` 模板 —— 实测 `/en/data-batch` 的静态 HTML 里
 * `<article>` 只剩那个 template，**工具页头（H1）与整个工具界面都不在 HTML 里**。
 * 对一个靠 SEO 与「首屏即可用」吃饭的工具站，这是把一个页面的内容全丢了：
 * 爬虫与禁 JS 的用户都只看到 FAQ。19 个语种各中一次。
 *
 * 替代方案是给消费组件套 <Suspense>，但那样静态 HTML 里只剩 fallback，同样是
 * 首屏缺内容；本 hook 让静态 HTML 渲染**默认档**（无参数那一侧），hydrate 后再
 * 按真实查询串切换 —— 与 `useMounted` / `useLocalStorage` 同一套
 * `useSyncExternalStore` 写法，服务端快照恒定，因此不存在 hydration 失配。
 *
 * ⚠ 只在**挂载与跨文档导航**时读：站内没有指向 `?huginn` 的链接（那是手输 / 外链
 * 入口），而 `LanguageSelector` 切语言时是整页 `router.push`，会重新挂载。
 * 若将来出现站内客户端跳转加参数，这里需要补一个订阅（history + popstate）。
 */
export const useQueryParamFlag = (name: string): boolean =>
  useSyncExternalStore(
    // 无订阅：查询串不会在不重新挂载的情况下变化（见上）。
    () => () => {},
    () => new URLSearchParams(window.location.search).has(name),
    () => false,
  );
