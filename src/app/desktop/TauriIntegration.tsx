"use client";
import { useEffect } from "react";
import { useAutoUpdate } from "./useAutoUpdate";
import { useLanguagePreference } from "./useLanguagePreference";
import { isTauriRuntime, openExternalLink } from "./externalLink";
import { routing } from "@/i18n/routing";

/**
 * 【桌面版把 Web 那套「导出目录」整条关掉】上游 utils/exportDir.ts 的唯一判据是
 * `typeof window.showDirectoryPicker === "function"`：它既决定 ToolPage 里那个
 * 按工具的导出目录按钮显不显示，也决定 downloadFile 是用 File System Access
 * 直接写盘、还是退回 saveAs()。
 *
 * 桌面版必须让它退回 saveAs：真正改写落盘路径的是 Rust 侧的 on_download 钩子
 * （见 src-tauri/src/lib.rs），而它挂的正是 saveAs() 触发的那次真实下载。两套
 * 并存时，Chromium 内核的 WebView2（Windows）上会出现【两个导出目录入口、两份
 * 互不相干的设置】，且 File System Access 那条直接绕过 on_download —— 用户在
 * 导航栏/托盘里选的目录会被无声忽略，文件落在另一个地方。
 *
 * 抹掉这个全局，上游那条判据自己就得出 false，不必碰任何镜像文件（exportDir.ts
 * 与 components/styled/ToolPage.tsx 都在 sync_config.yaml 的同步范围内，后者还是
 * overwrite 模式）。【必须在模块作用域】：supportsExportDir() 在渲染期就被读，
 * effect 晚于渲染。SSR（静态导出预渲染）里没有 window，所以要判空。
 */
if (typeof window !== "undefined" && isTauriRuntime()) delete window.showDirectoryPicker;

/**
 * 【src/app/desktop/ 这个目录为什么存在】上游 web-tools-by-ai 的
 * scripts/project_sync.py 会把 src/app/{hooks,utils,components,lib,ui/navigation}
 * 等目录同步下来，其中 hooks 与 lib/translation 是 mode: overwrite —— 该模式会
 * 删除「目标目录里存在、源目录里没有」的孤儿文件。桌面端专属文件放在那些目录
 * 里会被静默删掉（useAutoUpdate.ts / useLanguagePreference.ts 就中过这一条）。
 * sync_config.yaml 里没有任何规则指向 src/app/desktop，所以这里是安全区。
 *
 * 唯一留在共享地界的是 [locale]/layout.tsx 里挂载本组件的那一行 —— 该文件不在
 * 任何同步规则的范围内（[locale] 规则的 include 只有 /error.tsx）。
 *
 * Tauri-only side effects, mounted once inside the providers (NextIntlClientProvider
 * for routing + antd <App> for modal). No-ops entirely in the web build.
 *  - auto-update check (startup + interval, confirm-to-install)
 *  - remember UI language across launches (soft redirect, once per session)
 *  - global external-link interceptor (gotcha #10): route external links to the
 *    system browser via plugin-opener instead of hijacking the app webview.
 */
export default function TauriIntegration() {
  useAutoUpdate();
  useLanguagePreference([...routing.locales]);

  useEffect(() => {
    if (!isTauriRuntime()) return;
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const href = (e.target as Element | null)?.closest?.("a")?.getAttribute("href");
      if (!href) return;
      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      const external = (url.protocol === "http:" || url.protocol === "https:") && url.origin !== window.location.origin;
      if (!external && url.protocol !== "mailto:" && url.protocol !== "tel:") return; // internal → let the router handle it
      e.preventDefault();
      e.stopPropagation();
      openExternalLink(url.href);
    };
    document.addEventListener("click", onClick, true); // capture phase
    return () => document.removeEventListener("click", onClick, true);
  }, []);

  return null;
}
