"use client";
import React, { memo, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Layout, Menu, Space, Button, Dropdown, Flex } from "antd";
import { GithubOutlined, QqOutlined, DiscordOutlined, SunOutlined, MoonOutlined, TeamOutlined, SendOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { useAppMenu } from "@/app/components/projects";
import { isChineseLocale } from "@/app/utils";
import { SOCIAL_LINKS } from "./config";
import { LanguageSelector } from "./LanguageSelector";
// 仅桌面版渲染，web 构建里返回 null。放在 Navigation.tsx 而不是 LanguageSelector
// 等文件里：本文件被上游 sync_config.yaml 显式排除（每个子项目自维护），改它
// 不会在下次同步时被还原。
import ExportFolderButton from "@/app/desktop/ExportFolderButton";

const { Header } = Layout;

// 图标样式
const iconStyle = { fontSize: 18 };

// ============ 项目特定配置 ============
const DEFAULT_GITHUB = "https://github.com/rockbenben/subtitle-translator";

// ============ 动态组件 ============

/**
 * 从路径中提取当前菜单项的 key
 * 路径格式: /locale/tool-name 或 /locale (首页)
 */
const getCurrentMenuKey = (pathname: string): string => {
  const segments = pathname.split("/").filter(Boolean);
  return segments.length > 1 ? segments.slice(1).join("/") : "home";
};

export function Navigation() {
  const menuItems = useAppMenu();
  const pathname = usePathname();
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();

  // useSyncExternalStore for hydration-safe client detection
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isChinese = isChineseLocale(locale);
  const currentMenuKey = getCurrentMenuKey(pathname);

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  // 主题切换图标：SSR 和 hydration 前显示 MoonOutlined，挂载后显示正确图标
  const themeIcon = mounted && resolvedTheme === "light" ? <SunOutlined style={iconStyle} /> : <MoonOutlined style={iconStyle} />;

  return (
    <Header style={{ padding: 0, background: "transparent", height: 48, lineHeight: "48px" }}>
      <Flex justify="space-between" align="center" style={{ padding: "0 16px", borderBottom: "1px solid rgba(128, 128, 128, 0.25)" }}>
        <Menu selectedKeys={[currentMenuKey]} mode="horizontal" items={menuItems} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent" }} />
        <Space size="middle">
          <LanguageSelector />
          <ExportFolderButton iconStyle={iconStyle} />

          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                ...(isChinese
                  ? [
                      {
                        key: "qq",
                        icon: <QqOutlined />,
                        label: (
                          <a href={SOCIAL_LINKS.qq} target="_blank" rel="noopener noreferrer nofollow">
                            QQ 群
                          </a>
                        ),
                      },
                    ]
                  : []),
                {
                  key: "discord",
                  icon: <DiscordOutlined />,
                  label: (
                    <a href={SOCIAL_LINKS.discord} target="_blank" rel="noopener noreferrer nofollow">
                      Discord
                    </a>
                  ),
                },
                {
                  key: "telegram",
                  icon: <SendOutlined />,
                  label: (
                    <a href={SOCIAL_LINKS.telegram} target="_blank" rel="noopener noreferrer nofollow">
                      Telegram
                    </a>
                  ),
                },
              ],
            }}>
            <Button type="text" icon={<TeamOutlined style={iconStyle} />} aria-label="Community links" />
          </Dropdown>

          <a href={DEFAULT_GITHUB} target="_blank" rel="noopener noreferrer">
            <Button type="text" icon={<GithubOutlined style={iconStyle} />} aria-label="View on GitHub" />
          </a>

          <Button type="text" icon={themeIcon} onClick={handleThemeToggle} aria-label="Toggle theme" />
        </Space>
      </Flex>
    </Header>
  );
}

export default memo(Navigation);
