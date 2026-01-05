"use client";
import React, { useState, useEffect, memo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Layout, Menu, Space, Button, Dropdown, Input, Flex } from "antd";
import type { MenuProps } from "antd";
import { GithubOutlined, QqOutlined, DiscordOutlined, TranslationOutlined, SunOutlined, MoonOutlined, CheckOutlined, TeamOutlined, SendOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { useAppMenu } from "@/app/components/projects";
import { LANGUAGES, SOCIAL_LINKS } from "./config";

const { Header } = Layout;

export function Navigation() {
  const menuItems = useAppMenu();
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const locale = useLocale();

  // mounted 状态用于主题图标的 hydration 安全渲染
  const [mounted, setMounted] = useState(false);
  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");
  const [current, setCurrent] = useState(pathname);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isChineseLocale = locale === "zh" || locale === "zh-hant";
  const currentLanguage = LANGUAGES.find((l) => l.key === locale)?.label || "English";

  const filteredLanguages = (() => {
    const q = langQuery.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q));
  })();

  const langGridCols = LANGUAGES.length > 16 ? 3 : 2;
  const perColMin = 140;
  const panelGap = 6;
  const panelPadding = 16;
  const langPanelWidth = Math.min(680, Math.max(420, langGridCols * perColMin + (langGridCols - 1) * panelGap + panelPadding));

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  const handleMenuClick: MenuProps["onClick"] = (e) => setCurrent(e.key);

  const handleLanguageChange = (key: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}(-[a-z]+)?/, `/${key}`);
    router.push(newPath);
  };

  // 语言选择面板
  const languagePanel = (
    <div style={{ width: langPanelWidth, maxWidth: "90vw", padding: 8 }}>
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
              style={{ justifyContent: "space-between", display: "flex", width: "100%", textAlign: "left" }}
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
        {filteredLanguages.length === 0 && <div style={{ padding: 8, opacity: 0.45 }}>No match</div>}
      </div>
    </div>
  );

  // 图标样式
  const iconStyle = { fontSize: 18 };

  // 主题切换图标：SSR 和 hydration 前显示 MoonOutlined，挂载后显示正确图标
  const themeIcon = mounted && resolvedTheme === "light" ? <SunOutlined style={iconStyle} /> : <MoonOutlined style={iconStyle} />;

  return (
    <Header style={{ padding: 0, background: "transparent", height: 48, lineHeight: "48px" }}>
      <Flex justify="space-between" align="center" style={{ padding: "0 16px", borderBottom: "1px solid rgba(128, 128, 128, 0.25)" }}>
        <Menu onClick={handleMenuClick} selectedKeys={[current]} mode="horizontal" items={menuItems} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent" }} />

        <Space size="middle">
          <Dropdown
            open={langOpen}
            onOpenChange={setLangOpen}
            trigger={["click"]}
            destroyOnHidden
            arrow={{ pointAtCenter: true }}
            menu={{ items: [] }}
            popupRender={() => languagePanel}
            placement="bottomRight">
            <Button type="text" icon={<TranslationOutlined />} aria-label="Select language">
              {currentLanguage}
            </Button>
          </Dropdown>

          <Dropdown
            trigger={["click"]}
            placement="bottomRight"
            menu={{
              items: [
                ...(isChineseLocale
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

          <a href={SOCIAL_LINKS.github} target="_blank" rel="noopener noreferrer">
            <Button type="text" icon={<GithubOutlined style={iconStyle} />} aria-label="View on GitHub" />
          </a>

          <Button type="text" icon={themeIcon} onClick={handleThemeToggle} aria-label="Toggle theme" />
        </Space>
      </Flex>
    </Header>
  );
}

export default memo(Navigation);
