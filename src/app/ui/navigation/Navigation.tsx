"use client";
import React, { memo, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { Layout, Menu, Space, Button, Dropdown, Drawer, Flex, theme } from "antd";
import { GithubOutlined, QqOutlined, DiscordOutlined, MenuOutlined, SunOutlined, MoonOutlined, TeamOutlined, SendOutlined } from "@ant-design/icons";
import { useTheme } from "next-themes";
import { useLocale } from "next-intl";
import { getLangDir } from "rtl-detect";
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
  const { token } = theme.useToken();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // useSyncExternalStore for hydration-safe client detection
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isChinese = isChineseLocale(locale);
  const currentMenuKey = getCurrentMenuKey(pathname);

  // 路由变化时关掉抽屉。放在渲染期（React 官方的 "Adjusting state when a prop
  // changes"）而不是 Menu.onClick：后者在 Link 导航之后才触发，抽屉会在新页面
  // 上多留一帧。
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (prevPathname !== pathname) {
    setPrevPathname(pathname);
    setDrawerOpen(false);
  }

  // 抽屉从【触发它的那一侧】滑出。RTL 下汉堡会跟着 flex 翻到右边（实测 /ar 上
  // x=330/视口 380），而 antd 的 placement 是【物理方向】—— 它的 `-rtl` 类只设
  // direction: rtl，rc-drawer 也纯按 placement 定位，都不会替你翻面。写死 "left"
  // 的话，阿拉伯语用户点右上角的汉堡，菜单从左边滑出来。
  const drawerSide = getLangDir(locale) === "rtl" ? "right" : "left";

  const handleThemeToggle = () => {
    setTheme(resolvedTheme === "light" ? "dark" : "light");
  };

  // 主题切换图标：SSR 和 hydration 前显示 MoonOutlined，挂载后显示正确图标
  const themeIcon = mounted && resolvedTheme === "light" ? <SunOutlined style={iconStyle} /> : <MoonOutlined style={iconStyle} />;

  return (
    // ⚠ 本文件【不在 project_sync 范围内】（sync_config.yaml 的 UI 规则明写
    //   `exclude: Navigation.tsx`），是各子项目自维护的一份 —— 主仓
    //   web-tools-by-ai 的同名文件改了，这里要手动对齐，否则会静默漂移。
    //
    // 刊头【通栏】—— 曾把内容收进 <main> 那根 1280 栏以求对齐，实测代价太大：
    // 宽屏下菜单被挤到装不下、把项目折进「⋯」，而屏幕右边空着一大片。导航的职责
    // 是把去处显示出来，这一条排在观感对齐前面（与主仓同步的判断）。
    // 边框走 token.colorSplit，不再手写 rgba 灰（Axiom A3：颜色只走 token）。
    <Header style={{ padding: 0, background: "transparent", height: 48, lineHeight: "48px", borderBottom: `1px solid ${token.colorSplit}` }}>
      <Flex justify="space-between" align="center" style={{ paddingInline: "clamp(16px, 4vw, 24px)" }}>
        {/* 汉堡 / 横排菜单的取舍交给【CSS 媒体查询】，不用 JS 断点 —— 理由写在
            globals.css 的 `.nav-primary` 一节：静态导出只有一份 HTML，任何 JS
            判据都必然有一侧的首屏是错的（两侧代价都实测过，写在那条注释里）。 */}
        <Flex align="center" className="nav-left" style={{ flex: 1, minWidth: 0 }}>
          <Button className="nav-burger" type="text" icon={<MenuOutlined style={iconStyle} />} onClick={() => setDrawerOpen(true)} aria-label="Open navigation" />
          <nav aria-label="Primary" className="nav-primary">
            <Menu selectedKeys={[currentMenuKey]} mode="horizontal" items={menuItems} style={{ flex: 1, minWidth: 0, border: "none", background: "transparent" }} />
          </nav>
        </Flex>
        {/* 抽屉常驻（内容懒渲染）。两处 nav 同名不冲突：任一时刻只有一处未被
            display:none 隐藏，被隐藏的那个不会暴露给辅助技术。 */}
        <Drawer placement={drawerSide} open={drawerOpen} onClose={() => setDrawerOpen(false)} size="default" styles={{ body: { padding: 0 } }}>
          <nav aria-label="Primary">
            <Menu selectedKeys={[currentMenuKey]} mode="inline" items={menuItems} style={{ border: "none" }} />
          </nav>
        </Drawer>
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

          {/* antd Button with href renders a single <a class="ant-btn"> — avoids
              the invalid <a><button></a> nesting + unnamed outer anchor. */}
          <Button type="text" href={DEFAULT_GITHUB} target="_blank" rel="noopener noreferrer" icon={<GithubOutlined style={iconStyle} />} aria-label="View on GitHub" />

          <Button type="text" icon={themeIcon} onClick={handleThemeToggle} aria-label="Toggle theme" />
        </Space>
      </Flex>
    </Header>
  );
}

export default memo(Navigation);
