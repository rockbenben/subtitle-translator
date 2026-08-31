"use client";
import React, { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Button, Dropdown, Input, Drawer, Row, Col, theme, Grid } from "antd";
import { TranslationOutlined, CheckOutlined } from "@ant-design/icons";
import { useLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { LOCALE_STORAGE_KEY } from "@/app/localeRedirect";

// ============ 语言配置 ============

interface Language {
  key: string;
  label: string;
}

/**
 * 语言名称表。【键序 = 选择器里的展示顺序】，但「展示哪些」由 routing.locales 决定
 * —— 见下面的 LANGUAGES。新增语言只改 routing.ts + 这里的名称。
 */
const LABELS: Record<string, string> = {
  zh: "中文",
  en: "English",
  es: "Español",
  hi: "हिन्दी",
  ar: "العربية",
  pt: "Português",
  fr: "Français",
  de: "Deutsch",
  ja: "日本語",
  ko: "한국어",
  ru: "Русский",
  vi: "Tiếng Việt",
  th: "ไทย",
  tr: "Türkçe",
  "zh-hant": "繁体中文",
  bn: "বাংলা",
  id: "Indonesia",
  it: "Italiano",
};

/**
 * 实际展示的语言 = LABELS 里【且】routing.locales 里有的。
 *
 * ⚠ 这份列表【必须】跟着 routing.locales 走，不能自己写死一份：单语言/语种子集
 *   构建（scripts/buildWithLang.js）只产出其中一个 locale 的路由，而写死的列表照样
 *   把 18 个语种都列出来 —— 点任何一个都落到没构建出来的路由上。
 *   同一份派生写法 img-prompt 的 ui/navigation/config.ts 已经在用。
 */
const LANGUAGES: readonly Language[] = Object.keys(LABELS)
  .filter((key) => (routing.locales as readonly string[]).includes(key))
  .map((key) => ({ key, label: LABELS[key] }));

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
    // 记住显式选择：裸域名根页/404 的落点脚本优先读它，不再按浏览器偏好猜。
    // 没有这一层的话，用户切到英文、下次打开裸域名又被甩回浏览器语言 —— 站点
    // 会跟用户对着干。无痕模式下 setItem 会抛，吞掉即可（退化成按浏览器偏好）。
    try {
      localStorage.setItem(LOCALE_STORAGE_KEY, key);
    } catch {}
    const newPath = pathname.replace(/^\/[a-z]{2}(-[a-z]+)?/, `/${key}`);
    // usePathname 不含 query/hash —— 不补会在切语言时丢掉 ?huginn 这类
    // 功能门控参数(data-batch 的效应还会因参数消失把已选工具回写成
    // excel,localStorage 永久丢失)。点击事件里读 window.location 安全。
    router.push(`${newPath}${window.location.search}${window.location.hash}`);
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
        className="mb-2"
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
                  aria-current={selected ? "true" : undefined}
                  style={{ justifyContent: "space-between", display: "flex", width: "100%", textAlign: "left" }}
                  onClick={() => {
                    handleLanguageChange(lang.key);
                    setLangOpen(false);
                  }}>
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {lang.label}
                    <span style={{ opacity: 0.7, marginLeft: 6 }}>({lang.key})</span>
                  </span>
                  {selected && <CheckOutlined aria-hidden />}
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

  // 触发按钮两个分支共用同一份，语言名显隐交给 CSS（globals.css 的 `.lang-btn`）——
  // 交给 isMobile 的话静态 HTML 永远出移动分支，hydrate 后桌面才补上语言名，头部会抖。
  // isMobile 只留面板形态（Drawer / Dropdown）的选择，那要点开才可见。
  const trigger = (
    <Button className="lang-btn" type="text" icon={<TranslationOutlined />} aria-label="Select language" onClick={isMobile ? () => setLangOpen(true) : undefined}>
      {currentLanguage}
    </Button>
  );

  return (
    <>
      {isMobile ? (
        <>
          {trigger}
          <Drawer title="Select Language / 选择语言" placement="bottom" onClose={() => setLangOpen(false)} open={langOpen} size="default" styles={{ body: { padding: 16 } }}>
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
          {trigger}
        </Dropdown>
      )}
    </>
  );
}
