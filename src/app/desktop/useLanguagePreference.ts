"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { isTauriRuntime } from "./externalLink";

const KEY = "subtitle_translator_preferred_language";
export const setPreferredLanguage = (l: string) => {
  try {
    localStorage.setItem(KEY, l);
  } catch {}
};
const read = () => {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
};
const localeOf = (p: string) => p.match(/^\/([a-z]{2}(-[a-z]+)?)/i)?.[1] ?? null;
const systemLocale = () => {
  const s = (typeof navigator !== "undefined" && navigator.language) || "en";
  if (s.startsWith("zh")) return /TW|HK|Hant/i.test(s) ? "zh-hant" : "zh";
  return s.split("-")[0];
};

// MODULE-level, not a ref: survives the [locale] layout remount a switch triggers, so
// the redirect runs exactly once per app launch and never bounces a switch (gotcha #11).
let sessionRedirectDone = false;

export interface LanguageDecision {
  /** locale to soft-redirect to, or undefined to stay put */
  redirectTo?: string;
  /** locale to write to localStorage, or undefined to leave it alone */
  persist?: string;
}

/**
 * 启动/导航时「跳哪个 locale、把哪个 locale 记成偏好」的唯一判定。抽成纯函数是
 * 为了能被 scripts/languagePreference.check.ts 直接跑 —— 这段分支出过一次真实
 * 事故（gotcha #11），而本仓库没有测试框架，不值得为它引一个。
 *
 * 【核心不变量】首次跳转那一轮【绝不写盘】：current 是窗口配置的启动入口
 * locale（/en/），不是用户偏好。写了就把偏好覆盖成 en，用户下次启动再也跳不
 * 回去。重定向后 effect 会带着新 pathname 再跑一次，那一轮才落盘。
 */
export const decideLanguage = ({
  current,
  stored,
  system,
  valid,
  redirectDone,
}: {
  current: string;
  stored: string | null;
  system: string;
  valid: string[];
  redirectDone: boolean;
}): LanguageDecision => {
  // 跳转已经发生过（或用户刚在切换器里选了语言）：当前 locale 就是偏好。
  if (redirectDone) return { persist: current };

  let pref = stored;
  let persist: string | undefined;
  if (!pref && valid.includes(system)) {
    pref = system; // 首次启动 → 跟随系统语言
    persist = system;
  }
  // stored 不在 valid 里（版本间删过语言、被手改过）时一并落到这里修复成 current。
  if (pref && valid.includes(pref) && pref !== current) return { redirectTo: pref, persist };
  return { persist: current };
};

export function useLanguagePreference(valid: string[]) {
  const pathname = usePathname();
  const router = useRouter();
  useEffect(() => {
    if (!isTauriRuntime()) return;
    const current = localeOf(pathname);
    if (!current) return;

    const { redirectTo, persist } = decideLanguage({
      current,
      stored: read(),
      system: systemLocale(),
      valid,
      redirectDone: sessionRedirectDone,
    });
    sessionRedirectDone = true;

    // 偏好写在 LanguageSelector 之外：那个文件与上游仓库 web-tools-by-ai 逐字节
    // 一致，改它等于给每次上游同步埋一个永久冲突点。导航一律经过这里，用户在
    // 切换器里的手动选择同样会被这条路径记下来。
    if (persist) setPreferredLanguage(persist);
    if (redirectTo) router.replace(pathname.replace(/^\/[a-z]{2}(-[a-z]+)?/i, `/${redirectTo}`)); // SOFT redirect
  }, [pathname, router, valid]);
}
