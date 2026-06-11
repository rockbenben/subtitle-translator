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

  // next-themes 的 resolvedTheme 在 SSR + 首次 client render 都是 undefined,
  // 等 mount 后才确定。SSR 直接 isDark=true 跟 defaultTheme="dark" 对齐 (避
  // 免 hydration mismatch),mount 后才相信 resolvedTheme。
  // useSyncExternalStore 而非 useState+useEffect: 后者会被 react-hooks 规则
  // (set-state-in-effect) 报错, 且 Navigation.tsx 已用同样写法做 SSR-safe
  // mounted 检测。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isDark = mounted ? resolvedTheme !== "light" : true;
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
