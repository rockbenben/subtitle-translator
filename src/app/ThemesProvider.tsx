"use client";

import { ThemeProvider as NextThemesProvider, useTheme } from "next-themes";
import { ConfigProvider, App, theme, Layout } from "antd";
import { ReactNode, useEffect, useSyncExternalStore } from "react";
import { useLocale } from "next-intl";
import { getLangDir } from "rtl-detect";

export default function ThemesProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemesProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AntdConfigProvider>{children}</AntdConfigProvider>
    </NextThemesProvider>
  );
}

/* ─────────────────────────────────────────────────────────────
   Interlingua — Swiss-international design system.
   Paper / ink / one Klein-blue accent. Square corners, hairline
   rules, mono meta. Light is the canonical "paper" face; dark is
   the inverted "ink plate" with a periwinkle-shifted accent
   (pure Klein blue is illegible on near-black).
   本文件是色板的单一来源。globals.css 的 --accent 只是 hydration 前的兜底，
   真值由文件末尾的 AccentSync 在运行时从 antd 渲染出的 colorPrimary 写回
   （seed 会被暗色算法压暗，两边手写必然分叉——理由写在那个组件上）。
   ───────────────────────────────────────────────────────────── */
const BLUE_LIGHT = "#1D35F5"; // Klein blue — light-mode accent
const BLUE_DARK = "#7A8CFF"; // periwinkle — dark-mode accent (AA on ink)
const INK = "#141310";
const PAPER = "#F4F2EC";

// Rational state palette — kept slightly desaturated so the single blue
// accent stays the loudest voice. Error is warm red, clearly apart from blue.
//
// ⚠ 这五个(以及 colorPrimary / colorLink / colorTextBase / colorBgBase)是
// antd 的【seed token】,不是最终值:`theme/util/alias.js` 里有一句
// `Object.keys(seedToken).forEach(t => delete overrideTokens[t])` —— 你写进
// `theme.token` 的 seed 只喂给算法,算法派生出的那个才是界面上真正渲染的颜色。
// 暗色下派生会【压暗】:#F2604F → 实测渲染 #d15546。所以要动这几个颜色的对比度,
// 得挪 seed 再实测,不能"再声明一遍"。非 seed 的 map/alias token(下面那组文字
// 分级)则是覆盖生效的。
// 亮色的 success/warning 从 #1E8A5A / #B07D10 压深:那两个值在纸面上只有
// 3.88:1 与 3.24:1,而它们渲染的是「已连接」「需配置」这类【状态文字】,
// 12–14px,4.5 的门槛适用。error #D02B1F 本来就够(4.63)。
const stateLight = { colorSuccess: "#197A4F", colorWarning: "#8C6209", colorError: "#D02B1F" };
// colorError 从 #F2604F 上调:那个 seed 在暗色下派生成 #d15546,对 #191815 只有
// 4.31:1 —— 而它渲染的是「清空」这类【可点的破坏性动作】文字,不是禁用态,
// 4.5 的门槛适用。
const stateDark = { colorSuccess: "#4CC38A", colorWarning: "#D9A514", colorError: "#FF7A69" };

/* ─────────────────────────────────────────────────────────────
   文字分级 —— 从 antd 默认值上调,为的是 WCAG AA。
   antd 出厂的 tertiary/description 是 0.45 alpha、placeholder 是 0.25。
   在本色板上实测:0.45 → 暗色 4.01:1、亮色 2.94:1;placeholder 0.25 → 2.11:1。
   三个都低于 AA 的 4.5,而这一级承载的是【真内容】:首页卡片描述、表单标签、
   上传格式提示、开关说明、空态引导。
   「更暗 = 更次要」这条路在这套纸/墨色板上走不通(亮色下 0.45 只有 2.94),
   所以次要层的区分交给【字体处理】—— 11px mono、字距、全大写 —— 而不是靠淡。
   这本来也是这套 Swiss 系统该用的手法。
   ⚠ 这些是 map/alias token,覆盖会生效(与上面的 seed 相反)。
   ───────────────────────────────────────────────────────────── */
const textTiersLight = {
  colorTextTertiary: "rgba(20, 19, 16, 0.62)", // 4.99:1 on paper
  colorTextDescription: "rgba(20, 19, 16, 0.62)", // Typography type="secondary" 走这个
  colorTextPlaceholder: "rgba(20, 19, 16, 0.60)", // 4.68:1 on paper
};
const textTiersDark = {
  colorTextTertiary: "rgba(240, 237, 228, 0.60)", // 6.14:1 on container
  colorTextDescription: "rgba(240, 237, 228, 0.60)",
  colorTextPlaceholder: "rgba(240, 237, 228, 0.55)", // 5.36:1 on container
};

const sharedTokens = {
  fontFamily: 'var(--font-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", sans-serif',
  fontFamilyCode: 'var(--font-mono), ui-monospace, "SF Mono", Menlo, Consolas, monospace',

  // Square corners everywhere — the Swiss signature. Hairlines do the
  // separating, not rounded boxes.
  borderRadius: 0,
  borderRadiusLG: 0,
  borderRadiusSM: 0,
  borderRadiusXS: 0,

  motionDurationMid: "0.2s",
  motionEaseInOut: "cubic-bezier(0.65, 0, 0.35, 1)",

  fontSize: 14,
  controlHeight: 36,
  // Flat system: kill antd's default elevation language.
  boxShadow: "none" as const,
  boxShadowSecondary: "0 6px 24px rgba(20, 19, 16, 0.10)",
  boxShadowTertiary: "none" as const,
  wireframe: false,
};

const lightTokens = {
  ...sharedTokens,
  ...stateLight,
  ...textTiersLight,
  colorPrimary: BLUE_LIGHT,
  colorInfo: BLUE_LIGHT,
  colorBgBase: PAPER,
  colorBgContainer: "#FCFBF7",
  colorBgElevated: "#FFFFFF",
  colorBgLayout: "transparent",
  colorTextBase: INK,
  colorBorder: "rgba(20, 19, 16, 0.30)",
  colorBorderSecondary: "rgba(20, 19, 16, 0.12)",
  colorSplit: "rgba(20, 19, 16, 0.12)",
  colorPrimaryBg: "rgba(29, 53, 245, 0.06)",
  colorPrimaryBgHover: "rgba(29, 53, 245, 0.12)",
};

const darkTokens = {
  ...sharedTokens,
  ...stateDark,
  ...textTiersDark,
  colorPrimary: BLUE_DARK,
  colorInfo: BLUE_DARK,
  colorBgBase: "#121110",
  colorBgContainer: "#191815",
  colorBgElevated: "#201F1B",
  colorBgLayout: "transparent",
  colorTextBase: "#F0EDE4",
  colorBorder: "rgba(240, 237, 228, 0.28)",
  colorBorderSecondary: "rgba(240, 237, 228, 0.10)",
  colorSplit: "rgba(240, 237, 228, 0.10)",
  colorPrimaryBg: "rgba(122, 140, 255, 0.10)",
  colorPrimaryBgHover: "rgba(122, 140, 255, 0.18)",
  boxShadowSecondary: "0 6px 24px rgba(0, 0, 0, 0.45)",
  // 实心强调块上的字色。antd 默认是白,而暗色下这四个状态色本身就亮:
  // 白字压在 accent #6b7adc 上只有 3.86:1(error 3.33 / success 2.92 / warning 2.98),
  // 换成墨色全部 4.89–6.46。影响的是选中的 CheckableTag、Switch 的
  // checkedChildren、Badge 这类实心块。亮色那边相反(白字 5.19–7.29),保持默认。
  colorTextLightSolid: "#121110",
};

function AntdConfigProvider({ children }: { children: ReactNode }) {
  const { resolvedTheme } = useTheme();
  const locale = useLocale();
  const direction = getLangDir(locale);

  // SSR 直接 isDark=true 跟 defaultTheme="dark" 对齐,mount 后才相信 resolvedTheme。
  // ⚠ 注释曾写「resolvedTheme 在 SSR + 首次 client render 都是 undefined」——
  // 那个前提在 next-themes 0.4.6 上【已不成立】(库源码是
  // `useState(() => getTheme(storageKey, defaultTheme))`,初始化函数在首次客户端
  // 渲染就跑,那时它已经是 "light" 了;探针实测确认)。真正兜住 SSR 一致性的是下面
  // 这个 mounted 闸,不是 resolvedTheme 恰好为空。
  // useSyncExternalStore 而非 useState+useEffect: 后者会被 react-hooks 规则
  // (set-state-in-effect) 报错, 且 Navigation.tsx 已用同样写法做 SSR-safe
  // mounted 检测。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isDark = mounted ? resolvedTheme !== "light" : true;

  // ⚠ 已知且【有意接受】的 hydration 警告，别再重查一遍(2026-08 已完整定位):
  //   现象:偶发 "A tree hydrated but some attributes... didn't match",diff 里
  //   一侧是暗色值、另一侧是亮色值,出现在各组件 inline style 的 antd token 颜色上。
  //   成因:上面这道 mounted 闸【本身是好的】—— 探针实测 hydration 那一拍确实是
  //   暗色。失配来自「翻转」与「深层子树 hydration」之间的【竞态】:mount 后翻成
  //   亮色的那次渲染,可能插进子树尚未 hydrate 完的中间。所以它只在较慢的加载路径
  //   (dev 的 HMR 重连)上偶发,普通加载复现不出。
  //   影响:dev 控制台噪音 + 生产上极短的一次闪色(翻转后立即被正常 re-render 修正,
  //   不会长期停在错色)。
  //
  // 两条【已试过并否决】的修法:
  //   1. antd `cssVar` 模式 —— 无效。`useToken().token` 按设计永远返回字面色值
  //      (公开 API 与内部返回值是错位解构的,var 版在 `.cssVar` 字段上);而那套
  //      var 定义在 antd 自己组件带的作用域 class 上,普通 div/span 解析不到,
  //      实测会【静默】变透明(强调条直接消失),比原问题更危险。
  //      另注:antd 6 的 cssVar 不再接受 `true`,只收对象。
  //   2. 全面改用 globals.css 的 CSS 变量 —— 机制成立(ToolPage 上验证过:失配
  //      结构上消失、明暗两色正确、连闪色一并没了),但要覆盖全部首屏组件就得把
  //      antd 的 success/warning/error 整套语义色板在 CSS 里再抄一份明暗两版,
  //      等于给颜色开出第二个真相源 —— 与本文件「single source of truth」的定位
  //      冲突,维护成本大于收益,已撤销。
  //
  // 真正的结构性解法是让服务端就知道主题(cookie),但生产是 `output: "export"`
  // 静态导出(next.config.ts),构建期定死 HTML,没有服务器可读 cookie —— 这条路
  // 对本项目关闭。要重新评估的时机:改成 standalone/SSR 部署时。
  const algorithms = isDark ? [theme.darkAlgorithm] : [theme.defaultAlgorithm];
  const tokens = isDark ? darkTokens : lightTokens;

  return (
    <ConfigProvider
      direction={direction}
      // antd 默认给「恰好两个汉字、且无图标」的按钮加 0.34em 字距（Popconfirm 的
      // 取消 / 删除 / 清空 正是这个形态），旁边带图标的按钮不加，同一排两种字距。
      // 全局关掉；TranslationProgressStrip 里那层局部 ConfigProvider 保留 —— 它的
      // 单元测试脱离本 Provider 单独渲染。
      button={{ autoInsertSpace: false }}
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
          // Swiss primary button: solid ink slab on paper, inverted paper slab
          // on ink. Hover snaps to the accent — color IS the hover state, no
          // shadow, no lift.
          Button: {
            primaryShadow: "none",
            defaultShadow: "none",
            colorPrimary: isDark ? "#F0EDE4" : INK,
            colorPrimaryHover: tokens.colorPrimary,
            colorPrimaryActive: isDark ? "#5F73F2" : "#1626B8",
            primaryColor: isDark ? "#141310" : "#F4F2EC",
            fontWeight: 600,
          },
          Card: {
            colorBorderSecondary: tokens.colorBorderSecondary,
            headerFontSize: 15,
          },
          Input: {
            // Hairline focus: accent border + soft halo, no hard 2px ring.
            activeShadow: `0 0 0 3px ${tokens.colorPrimaryBg}`,
            activeBorderColor: tokens.colorPrimary,
            hoverBorderColor: tokens.colorBorder,
          },
          Tag: {
            borderRadiusSM: 0,
          },
          Modal: {
            borderRadiusLG: 0,
          },
        },
      }}>
      {/* message 默认 top=8，正好压在 48px 高的表头上 —— 一条「分割完成」把
          导航里的两三项遮掉三秒。下移到表头之下；页面滚动后表头是 static 的，
          不会再有遮挡问题。 */}
      <App message={{ top: 56 }}>
        <AccentSync />
        <Layout style={{ minHeight: "100vh", background: "transparent" }}>{children}</Layout>
      </App>
    </ConfigProvider>
  );
}

/* ─────────────────────────────────────────────────────────────
   把 antd 真正渲染出来的 colorPrimary 写回 globals.css 的 --accent。

   为什么需要:`colorPrimary` 是 antd 的 seed token,喂给算法后【派生值才是
   界面上的颜色】。暗色算法会压暗 —— 实测 seed #7A8CFF 渲染成 #6b7adc。
   于是同一个「唯一强调色」有了两副面孔:antd 那侧(链接/按钮/Segmented/Tag)
   是 #6b7adc,CSS 那侧(focus ring、卡片 hover 的边与强调条、skip-link 底色)
   是 #7a8cff。差得不多,但这套系统的立身之本就是「只有一个蓝」。

   两个都试过的替代方案都不成立:在 `theme.token` 里再声明一遍 colorPrimary
   无效(seed 会被 alias.js 从 override 集合里删掉);反过来把 --accent 手写成
   #6b7adc 又等于把派生结果硬编码进另一个文件,antd 一升级就再次分叉。
   在运行时同步是唯一「不可能再漂」的写法:CSS 里那个值退化成 hydration 前的
   兜底,hydration 之后由 antd 说了算。
   ───────────────────────────────────────────────────────────── */
function AccentSync() {
  const { token } = theme.useToken();
  useEffect(() => {
    document.documentElement.style.setProperty("--accent", token.colorPrimary);
  }, [token.colorPrimary]);
  return null;
}
