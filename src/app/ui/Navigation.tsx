"use client";
import React, { useState, useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Space, ConfigProvider, theme as antTheme, Button, Dropdown, Input } from "antd";
import type { MenuProps } from "antd";
import { GithubOutlined, QqOutlined, DiscordOutlined, TranslationOutlined, SunOutlined, MoonOutlined, CheckOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { AppMenu } from "@/app/components/projects";
import { useAuth } from "@/app/components/AuthContext";
import LoginModal from "@/app/components/LoginModal";

const { Header } = Layout;

const LANGUAGES = [
  { key: "zh", label: "中文" },
  { key: "en", label: "English" },
  { key: "es", label: "Español" },
  { key: "hi", label: "हिन्दी" },
  { key: "ar", label: "العربية" },
  { key: "pt", label: "Português" },
  { key: "fr", label: "Français" },
  { key: "de", label: "Deutsch" },
  { key: "ja", label: "日本語" },
  { key: "ko", label: "한국어" },
  { key: "ru", label: "Русский" },
  { key: "vi", label: "Tiếng Việt" },
  { key: "tr", label: "Türkçe" },
  { key: "zh-hant", label: "繁体中文" },
  { key: "bn", label: "বাংলা" },
  { key: "id", label: "Indonesia" },
  { key: "it", label: "Italiano" },
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
  const { user, logout } = useAuth();
  const [loginOpen, setLoginOpen] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");

  const [current, setCurrent] = useState(pathname);
  const isChineseLocale = locale === "zh" || locale === "zh-hant";
  const currentLanguage = LANGUAGES.find((l) => l.key === locale)?.label || "English";

  // 语言筛选与布局计算（需放在 early return 之前，避免违反 Hooks 规则）
  const filteredLanguages = useMemo(() => {
    const q = langQuery.trim().toLowerCase();
    if (!q) return LANGUAGES as readonly { key: string; label: string }[];
    return LANGUAGES.filter((l) => l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q));
  }, [langQuery]);
  const langGridCols = LANGUAGES.length > 16 ? 3 : 2;
  // 三列时适当加宽：按列数与单列最小宽度动态计算弹层宽度
  const perColMin = 140; // 每列最小宽度（px），避免标签被过度挤压
  const panelGap = 6; // 与 grid gap 保持一致
  const panelPadding = 16; // 外层 padding: 8 上下合计
  const langPanelWidth = Math.min(
    680, // 上限，防止过宽
    Math.max(420, langGridCols * perColMin + (langGridCols - 1) * panelGap + panelPadding)
  );

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
              open={langOpen}
              onOpenChange={setLangOpen}
              trigger={["click"]}
              destroyOnHidden
              arrow={{ pointAtCenter: true }}
              menu={{ items: [] }}
              popupRender={() => (
                <div
                  style={{
                    width: langPanelWidth,
                    maxWidth: "90vw",
                    padding: 8,
                    background: bgColor,
                    borderRadius: 8,
                    boxShadow: theme === "light" ? token.boxShadowSecondary : token.boxShadow,
                    border: `1px solid ${theme === "light" ? token.colorBorderSecondary : token.colorBorder}`,
                  }}>
                  <Input
                    allowClear
                    size="small"
                    aria-label="Search language"
                    placeholder="Search language / 语言 / Idioma..."
                    prefix={<TranslationOutlined />}
                    value={langQuery}
                    autoFocus={langOpen}
                    onChange={(e) => setLangQuery(e.target.value)}
                  />
                  <div
                    style={{
                      marginTop: 8,
                      maxHeight: 360,
                      overflowY: "auto",
                      display: "grid",
                      gridTemplateColumns: `repeat(${langGridCols}, minmax(${perColMin}px, 1fr))`,
                      gap: 6,
                      paddingBottom: 4,
                    }}>
                    {filteredLanguages.map((lang) => {
                      const selected = lang.key === locale;
                      return (
                        <Button
                          key={lang.key}
                          size="small"
                          type={selected ? "primary" : "text"}
                          style={{
                            justifyContent: "space-between",
                            display: "flex",
                            width: "100%",
                            textAlign: "left",
                          }}
                          onClick={() => {
                            handleLanguageChange(lang.key);
                            setLangOpen(false);
                          }}>
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {lang.label}
                            <span style={{ opacity: 0.7, marginLeft: 6 }}>({lang.key})</span>
                          </span>
                          {selected && <CheckOutlined />}
                        </Button>
                      );
                    })}
                    {filteredLanguages.length === 0 && <div style={{ padding: 8, color: token.colorTextSecondary }}>No match</div>}
                  </div>
                </div>
              )}
              placement="bottomRight">
              <Button type="text" icon={<TranslationOutlined />}>
                {currentLanguage}
              </Button>
            </Dropdown>

          <Space size={token.marginXS}>
            {!user ? (
              <Button type="text" onClick={() => setLoginOpen(true)}>Sign In</Button>
            ) : (
              <Space>
                <span style={{ color: token.colorTextSecondary }}>{user.email}</span>
                <Button type="text" onClick={logout}>Sign Out</Button>
              </Space>
            )}
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
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} />
    </ConfigProvider>
  );
}

export default Navigation;
