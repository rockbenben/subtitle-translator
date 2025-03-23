"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ConfigProvider, theme } from "antd";
import { ReactNode } from "react";
import { AntdRegistry } from "@ant-design/nextjs-registry";

export default function ThemesProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark">
      <AntdConfigProvider>{children}</AntdConfigProvider>
    </NextThemesProvider>
  );
}

function AntdConfigProvider({ children }: { children: ReactNode }) {
  const { theme: currentTheme } = useTheme();

  const algorithms = currentTheme === "dark" ? [theme.darkAlgorithm] : [theme.defaultAlgorithm];

  return (
    <ConfigProvider theme={{ cssVar: true, hashed: false, algorithm: algorithms }}>
      <AntdRegistry>{children}</AntdRegistry>
    </ConfigProvider>
  );
}
