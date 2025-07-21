"use client";
import React, { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Space, ConfigProvider, theme as antTheme, Button, Dropdown } from "antd";
import type { MenuProps } from "antd";
import { GithubOutlined, QqOutlined, DiscordOutlined, GlobalOutlined, SunOutlined, MoonOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { AppMenu } from "@/app/components/projects";

const { Header } = Layout;

const LANGUAGES = [
  { key: "en", label: "English" },
  { key: "zh", label: "中文" },
  { key: "zh-hant", label: "繁体中文" },
  { key: "pt", label: "Português" },
  { key: "it", label: "Italiano" },
  { key: "de", label: "Deutsch" },
  { key: "ru", label: "Русский" },
  { key: "es", label: "Español" },
  { key: "fr", label: "Français" },
  { key: "ja", label: "日本語" },
  { key: "ko", label: "한국어" },
  { key: "hi", label: "हिन्दी" },
  { key: "ar", label: "العربية" },
  { key: "bn", label: "বাংলা" },
] as const;
const SOCIAL_LINKS = {
  github: "https://github.com/rockbenben/subtitle-translator",
  discord: "https://discord.gg/PZTQfJ4GjX",
  qq: "https://qm.qq.com/q/qvephMO8q4",
} as const;

export function Navigation() {
  const menuItems = AppMenu();
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const { token } = antTheme.useToken();
  const locale = useLocale();

  const [current, setCurrent] = useState(pathname);
  const isChineseLocale = locale === "zh" || locale === "zh-hant";

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleThemeToggle = () => setTheme(theme === "light" ? "dark" : "light");
  const handleMenuClick: MenuProps["onClick"] = (e) => setCurrent(e.key);

  const handleLanguageChange = (key: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}(-[a-z]+)?/, `/${key}`);
    router.push(newPath);
  };

  const handleLanguageMenuClick: MenuProps["onClick"] = (e) => {
    handleLanguageChange(e.key);
  };

  const getSocialIconStyle = () => ({
    fontSize: token.fontSizeXL,
    padding: token.paddingXS,
    color: theme === "light" ? token.colorText : token.colorTextLightSolid,
  });

  const languageItems: MenuProps["items"] = LANGUAGES.map((lang) => ({
    key: lang.key,
    label: lang.label,
  }));

  const bgColor = theme === "light" ? token.colorBgContainer : token.colorBgLayout;

  return (
    <ConfigProvider
      theme={{
        components: {
          Menu: {
            itemHoverColor: token.colorPrimary,
            horizontalItemSelectedColor: token.colorPrimary,
            itemSelectedBg: "transparent",
          },
        },
      }}>
      <Header
        style={{
          padding: 4,
          borderBottom: `1px solid ${theme === "light" ? token.colorBorderSecondary : token.colorBorder}`,
          backgroundColor: bgColor,
        }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: `0 ${token.paddingLG}px`,
          }}>
          <Menu
            onClick={handleMenuClick}
            selectedKeys={[current]}
            mode="horizontal"
            items={menuItems}
            style={{
              flex: 1,
              minWidth: 0,
              backgroundColor: bgColor,
              borderBottom: "none",
            }}
          />

          <Space size={token.marginSM}>
            <Dropdown
              menu={{
                items: languageItems,
                onClick: handleLanguageMenuClick,
              }}
              placement="bottomRight">
              <Button type="text" icon={<GlobalOutlined />}>
                {LANGUAGES.find((l) => l.key === locale)?.label || "English"}
              </Button>
            </Dropdown>

            <Space size={token.marginXS}>
              {isChineseLocale && (
                <a href={SOCIAL_LINKS.qq} target="_blank" rel="noopener noreferrer">
                  <QqOutlined style={getSocialIconStyle()} />
                </a>
              )}
              <a href={SOCIAL_LINKS.discord} target="_blank" rel="noopener noreferrer">
                <DiscordOutlined style={getSocialIconStyle()} />
              </a>
              <a href={SOCIAL_LINKS.github} target="_blank" rel="noopener noreferrer">
                <GithubOutlined style={getSocialIconStyle()} />
              </a>
            </Space>

            <Button
              type="text"
              icon={theme === "dark" ? <MoonOutlined /> : <SunOutlined />}
              onClick={handleThemeToggle}
              style={{
                display: "flex",
                alignItems: "center",
              }}
            />
          </Space>
        </div>
      </Header>
    </ConfigProvider>
  );
}

export default Navigation;
