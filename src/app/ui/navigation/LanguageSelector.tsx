"use client";
import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Dropdown, Input, Drawer, Row, Col, theme, Grid } from "antd";
import { TranslationOutlined, CheckOutlined } from "@ant-design/icons";
import { useLocale } from "next-intl";

// ============ 语言配置 ============

interface Language {
  key: string;
  label: string;
}

/**
 * 支持的语言列表
 * Supported languages list
 */
const LANGUAGES: readonly Language[] = [
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
  { key: "th", label: "ไทย" },
  { key: "tr", label: "Türkçe" },
  { key: "zh-hant", label: "繁体中文" },
  { key: "bn", label: "বাংলা" },
  { key: "id", label: "Indonesia" },
  { key: "it", label: "Italiano" },
] as const;

// ============ 组件 ============

export function LanguageSelector() {
  const router = useRouter();
  const pathname = usePathname();
  const locale = useLocale();
  const { token } = theme.useToken();
  const screens = Grid.useBreakpoint();
  const isMobile = !screens.md;

  const [langOpen, setLangOpen] = useState(false);
  const [langQuery, setLangQuery] = useState("");

  const currentLanguage = LANGUAGES.find((l) => l.key === locale)?.label || "English";

  const filteredLanguages = (() => {
    const q = langQuery.trim().toLowerCase();
    if (!q) return LANGUAGES;
    return LANGUAGES.filter((l) => l.label.toLowerCase().includes(q) || l.key.toLowerCase().includes(q));
  })();

  const handleLanguageChange = (key: string) => {
    const newPath = pathname.replace(/^\/[a-z]{2}(-[a-z]+)?/, `/${key}`);
    router.push(newPath);
  };

  const renderLanguageList = () => (
    <>
      <Input
        allowClear
        aria-label="Search language"
        placeholder="Search language / 语言 / Idioma..."
        prefix={<TranslationOutlined />}
        value={langQuery}
        autoFocus={isMobile ? false : langOpen}
        onChange={(e) => setLangQuery(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      <div style={{ maxHeight: isMobile ? "60vh" : 360, overflowY: "auto", overflowX: "hidden", paddingBottom: 4 }}>
        <Row gutter={[8, 8]}>
          {filteredLanguages.map((lang) => {
            const selected = lang.key === locale;
            return (
              <Col xs={24} sm={12} md={8} key={lang.key}>
                <Button
                  block
                  size={isMobile ? "middle" : "small"}
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
              </Col>
            );
          })}
        </Row>
        {filteredLanguages.length === 0 && <div style={{ padding: 8, opacity: 0.45 }}>No match</div>}
      </div>
    </>
  );

  const desktopPanel = (
    <div
      style={{
        width: 600,
        maxWidth: "90vw",
        padding: 16,
        backgroundColor: token.colorBgElevated,
        borderRadius: token.borderRadiusLG,
        boxShadow: token.boxShadowSecondary,
      }}>
      {renderLanguageList()}
    </div>
  );

  return (
    <>
      {isMobile ? (
        <>
          <Button type="text" icon={<TranslationOutlined />} aria-label="Select language" onClick={() => setLangOpen(true)} />
          <Drawer title="Select Language / 选择语言" placement="bottom" onClose={() => setLangOpen(false)} open={langOpen} height="auto" styles={{ body: { padding: 16 } }}>
            {renderLanguageList()}
          </Drawer>
        </>
      ) : (
        <Dropdown
          open={langOpen}
          onOpenChange={setLangOpen}
          trigger={["click"]}
          destroyOnHidden
          arrow={{ pointAtCenter: true }}
          menu={{ items: [] }}
          popupRender={() => desktopPanel}
          placement="bottomRight">
          <Button type="text" icon={<TranslationOutlined />} aria-label="Select language">
            {currentLanguage}
          </Button>
        </Dropdown>
      )}
    </>
  );
}
