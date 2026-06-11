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
  const registryIndex = TOOL_KEYS.indexOf(toolKey as ToolKey);
  const crumb =
    registryIndex >= 0
      ? `${String(registryIndex + 1).padStart(2, "0")} / ${TOOL_KEYS.length} — ${tNav(groupOf(toolKey as ToolKey))}`
      : null;

  return (
    <>
      <header style={{ marginBottom: token.marginLG }}>
        {crumb && (
          <div
            className="font-mono"
            aria-hidden
            style={{
              fontSize: 11,
              letterSpacing: "0.18em",
              textTransform: "uppercase",
              color: token.colorTextTertiary,
              marginBottom: 6,
            }}>
            <span style={{ color: token.colorPrimary }}>{crumb.slice(0, 2)}</span>
            {crumb.slice(2)}
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
        {(description || guideUrl || withPrivacyNotice) && (
          <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: "more" }} style={{ marginBottom: 0 }}>
            {guideUrl && (
              <>
                <Link href={guideUrl} target="_blank" rel="noopener noreferrer">
                  <QuestionCircleOutlined /> {t("userGuide")}
                </Link>{" "}
              </>
            )}
            {description}
            {withPrivacyNotice && t("privacyNotice")}
          </Paragraph>
        )}
      </header>
      {children}
    </>
  );
};

export default ToolPage;
