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
  /** When true (default), appends the shared privacy notice to the
   *  description paragraph. Set false for tools that don't need it. */
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
  const descriptionText =
    typeof description === "string" ? [description, withPrivacyNotice ? t("privacyNotice") : ""].filter(Boolean).join(" ") : null;

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
              <Link href={guideUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, whiteSpace: "nowrap" }}>
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
            混入 ReactNode 就退化成 CSS 截断 —— 3 行以外的内容直接消失且无从展开
            (窄屏上几乎每个工具的描述都会被截掉)。所以这里拼成一个字符串,
            显式空格避免空格分词语种渲染成 "…timelines.Your API key…"。 */}
        {descriptionText && (
          <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: t("expand") }} style={{ marginBottom: 0 }}>
            {descriptionText}
          </Paragraph>
        )}
        {!descriptionText && description && (
          <Paragraph type="secondary" ellipsis={{ rows: 3 }} style={{ marginBottom: 0 }}>
            {description}
            {withPrivacyNotice && <> {t("privacyNotice")}</>}
          </Paragraph>
        )}
      </header>
      {children}
    </>
  );
};

export default ToolPage;
