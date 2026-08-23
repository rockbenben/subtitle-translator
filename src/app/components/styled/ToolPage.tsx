"use client";

import React from "react";
import { Typography, theme } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { TOOL_KEYS, groupOf, type ToolKey } from "@/app/lib/toolRegistry";

const { Title, Paragraph, Link } = Typography;

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
  /** When true (default), renders the shared privacy notice as its own
   *  quiet line under the description. Set false for tools that don't need it. */
  withPrivacyNotice?: boolean;
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
const ToolPage = ({ icon, toolKey, description, guideUrl, withPrivacyNotice = true, children }: ToolPageProps) => {
  const t = useTranslations("common");
  const tTools = useTranslations("tools");
  const tNav = useTranslations("navigation");
  const { token } = theme.useToken();

  // Registry index → "02 / 17" chapter marker. Tools not in the registry
  // (shouldn't happen — invariant-tested) just skip the crumb.
  // 描述能拼成纯字符串时才有「展开」；调用方目前传的都是 t(...) 字符串，
  // ReactNode 描述走下面的降级分支（只截断、无展开）。
  const descriptionText = typeof description === "string" ? description : null;

  // 一段文字一件事。隐私说明【不再拼进描述】—— 它和「这个工具是干什么的」
  // 是两件事,揉成一段的代价在窄屏上是实打实的:3 行截断按拼接后的长度算,
  // 而隐私那句占了近六成,于是被截掉的恰恰是用户此刻唯一想读的描述
  // (实测 390px:"…如有问题或建… 展开",描述后半段和整句隐私都进了折叠)。
  // 拆开后截断只作用于描述,隐私那行短、恒定可见 —— 对一个要用户填 API key
  // 的工具来说,那句话恒定可见本来就比藏进「展开」更有用。
  const privacyNotice = withPrivacyNotice ? t("privacyNotice") : null;

  // 正文栏宽上限。这个文件的文档注释一直写着 "narrow description column",
  // 但此前【没有任何 max-width】—— 1920 下描述横跨 1232px,实测约 169 字符/行
  // (舒适区 45–90),一段小字灰文拉满整屏,读起来是一堵墙而不是一句话。
  // 640px @ 14px ≈ 45 个汉字 / 88 个拉丁字符每行,中西文都落在舒适区内。
  const MEASURE = 640;

  const registryIndex = TOOL_KEYS.indexOf(toolKey as ToolKey);
  const crumb =
    registryIndex >= 0
      ? `${String(registryIndex + 1).padStart(2, "0")} / ${TOOL_KEYS.length} — ${tNav(groupOf(toolKey as ToolKey))}`
      : null;

  return (
    <>
      <header style={{ marginBottom: token.marginLG }}>
        {/* 章节序号行同时安置「使用说明」链接：这一行本来右侧全空，链接放这里
            不占额外高度，也把描述段落让给纯文本（见下方 ellipsis 的说明）。 */}
        {(crumb || guideUrl) && (
          <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: 12, marginBottom: 6 }}>
            {crumb ? (
              <span
                className="font-mono"
                aria-hidden
                style={{
                  fontSize: 11,
                  letterSpacing: "0.18em",
                  textTransform: "uppercase",
                  color: token.colorTextTertiary,
                }}>
                <span style={{ color: token.colorPrimary }}>{crumb.slice(0, 2)}</span>
                {crumb.slice(2)}
              </span>
            ) : (
              <span />
            )}
            {guideUrl && (
              // 12px 的链接文字本身只有 19px 高。加纵向内边距把可点区域撑到
              // ≥24px(WCAG 2.2 SC 2.5.8 的下限),负外边距抵消掉,视觉位置不变 ——
              // 触控区变大而排版一寸没动。这一行右侧本来全空,不会挤到别的东西。
              <Link
                href={guideUrl}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: 12, whiteSpace: "nowrap", display: "inline-flex", alignItems: "center", gap: 4, padding: "5px 6px", margin: "-5px -6px" }}>
                <QuestionCircleOutlined /> {t("userGuide")}
              </Link>
            )}
          </div>
        )}
        <Title
          level={1}
          className="font-display"
          style={{
            fontSize: "clamp(26px, 3.4vw, 38px)",
            fontWeight: 700,
            lineHeight: 1.15,
            letterSpacing: "-0.025em",
            marginTop: 0,
            marginBottom: token.marginXS,
            display: "flex",
            alignItems: "center",
            gap: 12,
          }}>
          {icon && (
            <span style={{ color: token.colorPrimary, fontSize: "0.85em", display: "inline-flex" }} aria-hidden>
              {icon}
            </span>
          )}
          <span>{tTools(`${toolKey}.title`)}</span>
        </Title>
        <div
          aria-hidden
          style={{
            height: 2,
            width: 40,
            background: token.colorPrimary,
            marginBottom: token.marginSM,
          }}
        />
        {/* antd 只有在 children 是纯字符串时才会走 JS 量测、渲染「展开」链接;
            混入 ReactNode 就退化成 CSS 截断 —— 3 行以外的内容直接消失且无从展开。
            所以调用方传字符串描述时走上面那支,ReactNode 描述走下面的降级支。 */}
        {descriptionText && (
          <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: t("expand") }} style={{ marginBottom: 0, maxWidth: MEASURE }}>
            {descriptionText}
          </Paragraph>
        )}
        {!descriptionText && description && (
          <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ marginBottom: 0, maxWidth: MEASURE }}>
            {description}
          </Paragraph>
        )}
        {privacyNotice && (
          <p
            style={{
              margin: `${token.marginXS}px 0 0`,
              // 字号小一号，行宽就要等比收窄 —— 否则同样 640px 下它每行的
              // 字数反而比上面的描述多。两段的“每行几个字”对齐，读起来才是同一个节奏。
              maxWidth: Math.round((MEASURE * token.fontSizeSM) / token.fontSize),
              fontSize: token.fontSizeSM,
              lineHeight: 1.6,
              color: token.colorTextTertiary,
            }}>
            {privacyNotice}
          </p>
        )}
      </header>
      {children}
    </>
  );
};

export default ToolPage;
