"use client";
import { useEffect } from "react";
import { useAutoUpdate } from "./useAutoUpdate";
import { useLanguagePreference } from "./useLanguagePreference";
import { isTauriRuntime, openExternalLink } from "./externalLink";
import { installNativeExportDir } from "./exportDirNative";
import { routing } from "@/i18n/routing";

/**
 * 【桌面版的「导出目录」在这里接上】上游 utils/exportDir.ts 留了一个原生实现注入口，
 * 注入之后 ToolPage 标题行那个按工具的按钮在桌面上照常工作，底下换成原生对话框 +
 * Rust 的 on_download（见 desktop/exportDirNative.ts）。
 *
 * 【必须在模块作用域】supportsExportDir() 在渲染期就被读，放进 effect 就晚了。
 * 本文件由 [locale]/layout.tsx 静态 import，模块求值早于任何一次渲染。
 */
installNativeExportDir();

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
