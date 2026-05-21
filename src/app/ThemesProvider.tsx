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

const VERMILION = "#E54D2E";

// Editorial-tuned state colors — desaturated, warm-shifted to sit alongside
// vermilion without screaming. colorError is a cooler red so users can
// distinguish "danger" from the warm primary brand accent.
const MOSS = "#6B8E5A"; // success
const GOLD = "#C9A961"; // warning
const BRICK = "#C12B2B"; // error (cooler than vermilion to stay readable as "danger")

const sharedTokens = {
  colorPrimary: VERMILION,
  colorInfo: VERMILION,
  colorSuccess: MOSS,
  colorWarning: GOLD,
  colorError: BRICK,

  fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  fontFamilyCode: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  borderRadius: 4,
  borderRadiusLG: 6,
  borderRadiusSM: 3,
  borderRadiusXS: 2,

  motionDurationMid: "0.25s",
  motionEaseInOut: "cubic-bezier(0.65, 0, 0.35, 1)",

  fontSize: 14,
  controlHeight: 36,
};

const darkTokens = {
  ...sharedTokens,
  colorBgBase: "#0E0F12",
  colorBgContainer: "#16181D",
  colorBgElevated: "#1B1E24",
  colorBgLayout: "transparent",
  colorTextBase: "#F2EEE6",
  colorBorder: "rgba(245, 240, 230, 0.10)",
  colorBorderSecondary: "rgba(245, 240, 230, 0.06)",
  colorSplit: "rgba(245, 240, 230, 0.08)",
  colorPrimaryBg: "rgba(229, 77, 46, 0.10)",
  colorPrimaryBgHover: "rgba(229, 77, 46, 0.16)",
};

const lightTokens = {
  ...sharedTokens,
  colorBgBase: "#FBF8F2",
  colorBgContainer: "#FFFFFF",
  colorBgElevated: "#FFFFFF",
  colorBgLayout: "transparent",
  colorTextBase: "#1A1814",
  colorBorder: "rgba(26, 24, 20, 0.10)",
  colorBorderSecondary: "rgba(26, 24, 20, 0.06)",
  colorSplit: "rgba(26, 24, 20, 0.08)",
  colorPrimaryBg: "rgba(229, 77, 46, 0.08)",
  colorPrimaryBgHover: "rgba(229, 77, 46, 0.14)",
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
          Button: {
            primaryShadow: "none",
            defaultShadow: "none",
          },
          Card: {
            colorBorderSecondary: tokens.colorBorder,
          },
          Input: {
            // Refined focus: soft vermilion halo + accent border, replacing
            // antd's default hard 2px outline ring. Matches the editorial
            // tone of the rest of the site (subtle, warm, intentional).
            activeShadow: `0 0 0 3px ${tokens.colorPrimaryBg}`,
            activeBorderColor: tokens.colorPrimary,
            hoverBorderColor: tokens.colorBorder,
          },
        },
      }}>
      <App>
        <Layout style={{ minHeight: "100vh", background: "transparent" }}>{children}</Layout>
      </App>
    </ConfigProvider>
  );
}
