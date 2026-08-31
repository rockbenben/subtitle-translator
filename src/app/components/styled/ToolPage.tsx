"use client";

import React, { useEffect } from "react";
import { Typography, theme } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { TOOL_KEYS, groupOf, type ToolKey } from "@/app/lib/toolRegistry";
import ExportFolderButton from "@/app/components/ExportFolder";
import { setExportDirTool } from "@/app/utils";

const { Title, Paragraph, Text, Link } = Typography;

interface ToolPageProps {
  /** Icon rendered before the title. */
  icon?: React.ReactNode;
  /** Tool key (camelCase in TOOL_REGISTRY). The H1 is read from
   *  `tools.<toolKey>.title` — single source of truth, shared with nav menu
   *  and Schema.org WebApplication.name. */
  toolKey: string;
  /** Already-localized description body. Falls back to nothing when unset. */
  description?: React.ReactNode;
  /** External user-guide URL. When provided, renders a "User Guide" link
   *  before the description text. */
  guideUrl?: string;
   /**
   * 是否提供「导出目录」入口。判据只有一条：这个工具**一次点击会不会落多个文件**
   * （批量 / 多语言 / 分割）—— 单文件导出用浏览器下载目录就够。目录按 toolKey 分开存，
   * 所以不提供入口的工具也就没有自己的目录，导出照常走浏览器下载。
   */
  showExportFolder?: boolean;
  /** Body — the actual tool surface. */
  children: React.ReactNode;
}

/**
 * Interlingua tool-page shell — mono index crumb ("02 / 17 — 文本翻译"),
 * heavy grotesk title, Klein-blue accent rule, narrow description column.
 * Smaller scale than the home hero so it doesn't compete with the tool
 * surface below.
 *
 * Reads the H1 from `tools.<toolKey>.title` so the nav short name, the
 * Schema.org `name`, and the in-tool H1 stay in lock-step.
 */
const ToolPage = ({ icon, toolKey, description, guideUrl, showExportFolder, children }: ToolPageProps) => {
  const t = useTranslations("common");
  const tTools = useTranslations("tools");
  const tNav = useTranslations("navigation");
  const { token } = theme.useToken();

  // Registry index → "02 / 17" chapter marker. Tools not in the registry
  // (shouldn't happen — invariant-tested) just skip the crumb.
  // 描述能拼成纯字符串时才有「展开」；调用方目前传的都是 t(...) 字符串，
  // ReactNode 描述走下面的降级分支（只截断、无展开）。
  const descriptionText = typeof description === "string" ? description : null;

  // ⚠ 页头【不放隐私说明】。它曾经在这里,19 个工具页一字不差,而其中 12 个
  // (文本分割 / 文本对照 / 全部 JSON 工具)根本不收 API key —— 对它们那句
  // "您的 API 密钥…" 是句空话。它现在只有一份,挂在 TranslationSettings 里
  // apiKey 输入框的 Form.Item extra 上。别再往页头加回来。
  //
  // ⚠ 描述用 0.65 那档,但【不能写 type="secondary"】—— antd 6 把它映射到
  // --ant-color-text-description,实测那是 0.45(暗色下 rgba(240,237,228,.45),
  // 对 #121110 只有 4.04:1,不到 WCAG AA 的 4.5)。真正的 0.65 是
  // --ant-color-text-secondary(7.21:1)。直接引用【CSS 变量】而不是
  // token.colorTextSecondary:Paragraph 自带 antd 的 css-var 作用域类,变量在
  // 它自己身上有定义,所以解析得到,而且明暗两套都对。
  //
  // ⚠ 本文件的颜色【一律不写 style={{ color: token.xxx }}】。useToken() 返回
  // 字面色值,而这个 header 在【亮色主题下拿到的是暗色那套】(成因见
  // ThemesProvider 里那段说明):实测亮色下描述仍是 rgba(240,237,228,.65)、
  // 强调条仍是暗色的 periwinkle —— 浅纸上的浅字,章节序号整行看不见。
  // 替代:文本走 antd Typography(自带 css-var 作用域类),强调色走 globals.css
  // 的 --accent(:root / html.dark 两套,与 ThemesProvider 同源镜像)。

  // 描述【铺满正文栏,不设 max-width】。
  //
  // 这是一次有代价的取舍,别当成疏漏改回去:1232px @ 14px ≈ 169 个拉丁字符 /
  // 88 个汉字每行,远超排版上常说的 45–90 舒适区。长行真正的毛病是【回扫丢行】
  // ——读完一行往回找下一行时容易串行——那主要发生在【多行连读的段落】里。
  // 这里的描述只有 1–3 行,而且是一次性扫读,不是连读,所以代价可控。
  // 换来的是页头不再有一块解释不清的右侧空白(试过封顶 640 / 680 / 双栏,
  // 都被指出别扭),而且行数少一行、页头更矮。
  //
  // 想收窄的话只动这一处:给下面两个 Paragraph 加回 maxWidth 即可。

  // 告诉写入路径「当前是哪个工具」—— downloadFile 在 37 个调用点深处，逐个传
  // toolKey 不现实，而这里本来就拿着它。见 utils/exportDir.ts 的 setExportDirTool。
  useEffect(() => {
    setExportDirTool(toolKey);
    return () => setExportDirTool(null);
  }, [toolKey]);

  const registryIndex = TOOL_KEYS.indexOf(toolKey as ToolKey);
  const crumb =
    registryIndex >= 0
      ? `${String(registryIndex + 1).padStart(2, "0")} / ${TOOL_KEYS.length} — ${tNav(groupOf(toolKey as ToolKey))}`
      : null;

  return (
    <>
      <header style={{ marginBottom: token.marginLG }}>
        {/* 刊头序号。 */}
        {crumb && (
          <Text
            type="secondary"
            className="font-mono"
            aria-hidden
            style={{
              display: "block",
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              marginBottom: 6,
            }}>
            <span style={{ color: "var(--accent)" }}>{crumb.slice(0, 2)}</span>
            {crumb.slice(2)}
          </Text>
        )}
        {/* 标题行：标题左、页面操作右 —— 工具页的通行形状(GitHub / Linear /
            Stripe / Vercel 都是这个)。「使用说明」是这一页唯一的页面级操作,
            放在【和 H1 同一行】的右端;它此前挂在上面那条装饰性序号行上,
            比 H1 还高 32px,那才是它显得没着落的原因。 */}
        <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", columnGap: 24, rowGap: 4 }}>
          <Title
            level={1}
            className="font-display"
            style={{
              fontSize: "clamp(26px, 3.4vw, 38px)",
              fontWeight: 700,
              lineHeight: 1.15,
              letterSpacing: "-0.025em",
              marginTop: 0,
              marginBottom: 0,
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}>
            {icon && (
              <span style={{ color: "var(--accent)", fontSize: "0.85em", display: "inline-flex" }} aria-hidden>
                {icon}
              </span>
            )}
            <span>{tTools(`${toolKey}.title`)}</span>
          </Title>
          {/* 页面级操作区：导出目录（按工具各存一个）＋ 使用说明。ToolPage 每页只
              渲染一次（toolPageConvention 不变量测试钉着），所以这里天然「一页一个」
              —— 这正是它从 ResultCard 搬过来的原因。 */}
          <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
            {showExportFolder && <ExportFolderButton toolKey={toolKey} />}
            {guideUrl && (
              // 12px 的链接文字本身只有 19px 高。加纵向内边距把可点区域撑到
              // ≥24px(WCAG 2.2 SC 2.5.8 的下限),负外边距抵消掉,视觉位置不变。
              <Link
                href={guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: token.fontSizeSM, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 6px", margin: "-5px -6px" }}>
                <QuestionCircleOutlined aria-hidden /> {t("userGuide")}
              </Link>
            )}
          </div>
        </div>
        <div aria-hidden style={{ height: 2, width: 40, background: "var(--accent)", marginTop: token.marginXS, marginBottom: token.marginSM }} />
        {/* antd 只有在 children 是纯字符串时才会走 JS 量测、渲染「展开」链接;
            混入 ReactNode 就退化成 CSS 截断 —— 3 行以外的内容直接消失且无从展开。
            所以调用方传字符串描述时走上面那支,ReactNode 描述走下面的降级支。 */}
        {descriptionText && (
          <Paragraph ellipsis={{ rows: 3, expandable: true, symbol: t("expand") }} style={{ marginBottom: 0, color: "var(--ant-color-text-secondary)" }}>
            {descriptionText}
          </Paragraph>
        )}
        {!descriptionText && description && (
          <Paragraph ellipsis={{ rows: 3 }} style={{ marginBottom: 0, color: "var(--ant-color-text-secondary)" }}>
            {description}
          </Paragraph>
        )}
      </header>
      {children}
    </>
  );
};

export default ToolPage;
