"use client";

import React from "react";
import { Typography } from "antd";
import { QuestionCircleOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Title, Paragraph, Link } = Typography;

interface ToolPageProps {
  /** Icon rendered before the title. */
  icon?: React.ReactNode;
  /** Already-localized page title. */
  title: React.ReactNode;
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
 * Consistent tool-page shell: icon + title + optional guide link +
 * description + privacy notice. Replaces the copy-pasted Title/Paragraph
 * pattern that every tool's client.tsx was duplicating.
 *
 * Description / title / guide URL are caller-resolved (already localized)
 * so this primitive doesn't need to know a tool's i18n namespace.
 */
const ToolPage = ({ icon, title, description, guideUrl, withPrivacyNotice = true, children }: ToolPageProps) => {
  const t = useTranslations("common");

  return (
    <>
      <Title level={1} style={{ fontSize: "1.6em", fontWeight: 600, marginTop: 0 }}>
        {icon} {title}
      </Title>
      {(description || guideUrl || withPrivacyNotice) && (
        <Paragraph type="secondary" ellipsis={{ rows: 3, expandable: true, symbol: "more" }}>
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
      {children}
    </>
  );
};

export default ToolPage;
