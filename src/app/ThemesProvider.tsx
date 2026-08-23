"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ConfigProvider, App, theme, Layout } from "antd";
import { ReactNode, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { getLangDir } from "rtl-detect";

export default function ThemesProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AntdConfigProvider>{children}</AntdConfigProvider>
    </NextThemesProvider>
  );
}

/* ─────────────────────────────────────────────────────────────
   Interlingua — Swiss-international design system.
   Paper / ink / one Klein-blue accent. Square corners, hairline
   rules, mono meta. Light is the canonical "paper" face; dark is
   the inverted "ink plate" with a periwinkle-shifted accent
   (pure Klein blue is illegible on near-black).
   Single source of truth here, mirrored as CSS vars in globals.css.
   ───────────────────────────────────────────────────────────── */
const BLUE_LIGHT = "#1D35F5"; // Klein blue — light-mode accent
const BLUE_DARK = "#7A8CFF"; // periwinkle — dark-mode accent (AA on ink)
const INK = "#141310";
const PAPER = "#F4F2EC";

// Rational state palette — kept slightly desaturated so the single blue
// accent stays the loudest voice. Error is warm red, clearly apart from blue.
const stateLight = { colorSuccess: "#1E8A5A", colorWarning: "#B07D10", colorError: "#D02B1F" };
const stateDark = { colorSuccess: "#4CC38A", colorWarning: "#D9A514", colorError: "#F2604F" };

const sharedTokens = {
  fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  fontFamilyCode: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  // Square corners everywhere — the Swiss signature. Hairlines do the
  // separating, not rounded boxes.
  borderRadius: 0,
  borderRadiusLG: 0,
  borderRadiusSM: 0,
  borderRadiusXS: 0,

  motionDurationMid: "0.2s",
  motionEaseInOut: "cubic-bezier(0.65, 0, 0.35, 1)",

  fontSize: 14,
  controlHeight: 36,
  // Flat system: kill antd's default elevation language.
  boxShadow: "none" as const,
  boxShadowSecondary: "0 6px 24px rgba(20, 19, 16, 0.10)",
  boxShadowTertiary: "none" as const,
  wireframe: false,
};

const lightTokens = {
  ...sharedTokens,
  ...stateLight,
  colorPrimary: BLUE_LIGHT,
  colorInfo: BLUE_LIGHT,
  colorBgBase: PAPER,
  colorBgContainer: "#FCFBF7",
  colorBgElevated: "#FFFFFF",
  colorBgLayout: "transparent",
  colorTextBase: INK,
  colorBorder: "rgba(20, 19, 16, 0.30)",
  colorBorderSecondary: "rgba(20, 19, 16, 0.12)",
  colorSplit: "rgba(20, 19, 16, 0.12)",
  colorPrimaryBg: "rgba(29, 53, 245, 0.06)",
  colorPrimaryBgHover: "rgba(29, 53, 245, 0.12)",
};

const darkTokens = {
  ...sharedTokens,
  ...stateDark,
  colorPrimary: BLUE_DARK,
  colorInfo: BLUE_DARK,
  colorBgBase: "#121110",
  colorBgContainer: "#191815",
  colorBgElevated: "#201F1B",
  colorBgLayout: "transparent",
  colorTextBase: "#F0EDE4",
  colorBorder: "rgba(240, 237, 228, 0.28)",
  colorBorderSecondary: "rgba(240, 237, 228, 0.10)",
  colorSplit: "rgba(240, 237, 228, 0.10)",
  colorPrimaryBg: "rgba(122, 140, 255, 0.10)",
  colorPrimaryBgHover: "rgba(122, 140, 255, 0.18)",
  boxShadowSecondary: "0 6px 24px rgba(0, 0, 0, 0.45)",
};

function AntdConfigProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const locale = useLocale();
  const direction = getLangDir(locale);

  // SSR 直接 isDark=true 跟 defaultTheme="dark" 对齐,mount 后才相信 resolvedTheme。
  // ⚠ 注释曾写「resolvedTheme 在 SSR + 首次 client render 都是 undefined」——
  // 那个前提在 next-themes 0.4.6 上【已不成立】(库源码是
  // `useState(() => getTheme(storageKey, defaultTheme))`,初始化函数在首次客户端
  // 渲染就跑,那时它已经是 "light" 了;探针实测确认)。真正兜住 SSR 一致性的是下面
  // 这个 mounted 闸,不是 resolvedTheme 恰好为空。
  // useSyncExternalStore 而非 useState+useEffect: 后者会被 react-hooks 规则
  // (set-state-in-effect) 报错, 且 Navigation.tsx 已用同样写法做 SSR-safe
  // mounted 检测。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isDark = mounted ? resolvedTheme !== "light" : true;

  // ⚠ 已知且【有意接受】的 hydration 警告，别再重查一遍(2026-08 已完整定位):
  //   现象:偶发 "A tree hydrated but some attributes... didn't match",diff 里
  //   一侧是暗色值、另一侧是亮色值,出现在各组件 inline style 的 antd token 颜色上。
  //   成因:上面这道 mounted 闸【本身是好的】—— 探针实测 hydration 那一拍确实是
  //   暗色。失配来自「翻转」与「深层子树 hydration」之间的【竞态】:mount 后翻成
  //   亮色的那次渲染,可能插进子树尚未 hydrate 完的中间。所以它只在较慢的加载路径
  //   (dev 的 HMR 重连)上偶发,普通加载复现不出。
  //   影响:dev 控制台噪音 + 生产上极短的一次闪色(翻转后立即被正常 re-render 修正,
  //   不会长期停在错色)。
  //
  // 两条【已试过并否决】的修法:
  //   1. antd `cssVar` 模式 —— 无效。`useToken().token` 按设计永远返回字面色值
  //      (公开 API 与内部返回值是错位解构的,var 版在 `.cssVar` 字段上);而那套
  //      var 定义在 antd 自己组件带的作用域 class 上,普通 div/span 解析不到,
  //      实测会【静默】变透明(强调条直接消失),比原问题更危险。
  //      另注:antd 6 的 cssVar 不再接受 `true`,只收对象。
  //   2. 全面改用 globals.css 的 CSS 变量 —— 机制成立(ToolPage 上验证过:失配
  //      结构上消失、明暗两色正确、连闪色一并没了),但要覆盖全部首屏组件就得把
  //      antd 的 success/warning/error 整套语义色板在 CSS 里再抄一份明暗两版,
  //      等于给颜色开出第二个真相源 —— 与本文件「single source of truth」的定位
  //      冲突,维护成本大于收益,已撤销。
  //
  // 真正的结构性解法是让服务端就知道主题(cookie),但生产是 `output: "export"`
  // 静态导出(next.config.ts),构建期定死 HTML,没有服务器可读 cookie —— 这条路
  // 对本项目关闭。要重新评估的时机:改成 standalone/SSR 部署时。
  const algorithms = isDark ? [theme.darkAlgorithm] : [theme.defaultAlgorithm];
  const tokens = isDark ? darkTokens : lightTokens;

  return (
    <ConfigProvider
      direction={direction}
      theme={{
        hashed: false,
        algorithm: algorithms,
        token: tokens,
        components: {
          Layout: {
            headerBg: "transparent",
            bodyBg: "transparent",
          },
          Menu: {
            itemBg: "transparent",
            horizontalItemHoverColor: tokens.colorPrimary,
            horizontalItemSelectedColor: tokens.colorPrimary,
            horizontalItemBorderRadius: 0,
            itemSelectedColor: tokens.colorPrimary,
          },
          Segmented: {
            itemSelectedBg: tokens.colorPrimaryBg,
            itemSelectedColor: tokens.colorPrimary,
            trackBg: "transparent",
            itemHoverBg: "transparent",
          },
          // Swiss primary button: solid ink slab on paper, inverted paper slab
          // on ink. Hover snaps to the accent — color IS the hover state, no
          // shadow, no lift.
          Button: {
            primaryShadow: "none",
            defaultShadow: "none",
            colorPrimary: isDark ? "#F0EDE4" : INK,
            colorPrimaryHover: tokens.colorPrimary,
            colorPrimaryActive: isDark ? "#5F73F2" : "#1626B8",
            primaryColor: isDark ? "#141310" : "#F4F2EC",
            fontWeight: 600,
          },
          Card: {
            colorBorderSecondary: tokens.colorBorderSecondary,
            headerFontSize: 15,
          },
          Input: {
            // Hairline focus: accent border + soft halo, no hard 2px ring.
            activeShadow: `0 0 0 3px ${tokens.colorPrimaryBg}`,
            activeBorderColor: tokens.colorPrimary,
            hoverBorderColor: tokens.colorBorder,
          },
          Tag: {
            borderRadiusSM: 0,
          },
          Modal: {
            borderRadiusLG: 0,
          },
        },
      }}>
      <App>
        <Layout style={{ minHeight: "100vh", background: "transparent" }}>{children}</Layout>
      </App>
    </ConfigProvider>
  );
}
