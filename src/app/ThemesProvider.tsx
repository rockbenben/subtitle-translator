"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ConfigProvider, App, theme, Layout } from "antd";
import { ReactNode } from "react";

export default function ThemesProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark">
      <AntdConfigProvider>{children}</AntdConfigProvider>
    </NextThemesProvider>
  );
}

function AntdConfigProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();

  // 使用 resolvedTheme，SSR 时为 undefined，默认使用 dark（与 CSS 变量默认值一致）
  const algorithms = resolvedTheme === "light" ? [theme.defaultAlgorithm] : [theme.darkAlgorithm];

  return (
    <ConfigProvider
      theme={{
        hashed: false,
        algorithm: algorithms,
      }}>
      <App>
        <Layout style={{ minHeight: "100vh" }}>{children}</Layout>
      </App>
    </ConfigProvider>
  );
}
