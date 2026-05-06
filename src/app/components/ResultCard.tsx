"use client";

import { Button, Space, Input, Typography, Flex, Empty, Skeleton, theme } from "antd";
import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import PageCard from "@/app/components/styled/PageCard";

const { TextArea } = Input;

interface ResultCardProps {
  title?: React.ReactNode;
  /** Result content to display. If onChange is provided, this should be the state value. */
  content: string;
  /** Callback for content changes. If provided, the TextArea becomes editable. */
  onChange?: (value: string) => void;
  charCount?: string;
  lineCount?: string;
  /** Whether to show stats footer - defaults to true */
  showStats?: boolean;
  /** Copy button callback */
  onCopy: () => void;
  /** Optional copy node callback - when provided, shows "Copy Node" button (for JSON tools) */
  onCopyNode?: () => void;
  /** Optional export callback - when provided, shows "Export" button */
  onExport?: () => void;
  /** When true, overrides content display with a <Skeleton /> (e.g. first render while awaiting first chunk). */
  loading?: boolean;
  /** Text direction for RTL language support - defaults to "ltr" */
  textDirection?: "ltr" | "rtl";
  rows?: number;
  className?: string;
}

/**
 * Shared result card. Supports translation / JSON tools uniformly:
 * - loading → Skeleton paragraph (8 rows by default)
 * - empty content (not loading) → <Empty /> hint
 * - populated → <TextArea> (read-only unless onChange provided)
 */
const ResultCard = ({
  title,
  content,
  onChange,
  charCount,
  lineCount,
  showStats = true,
  onCopy,
  onCopyNode,
  onExport,
  loading = false,
  textDirection = "ltr",
  rows = 10,
  className = "",
}: ResultCardProps) => {
  const t = useTranslations("common");
  const tJson = useTranslations("json");
  const { token } = theme.useToken();

  const displayTitle = title || t("translationResult");
  const hasContent = !!content;

  let body: React.ReactNode;
  if (loading) {
    body = <Skeleton active paragraph={{ rows: 8 }} title={false} />;
  } else if (!hasContent) {
    body = (
      <Flex justify="center" align="center" style={{ minHeight: 200 }}>
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("noMatches")} />
      </Flex>
    );
  } else {
    body = (
      <>
        <TextArea
          value={content}
          onChange={onChange ? (e) => onChange(e.target.value) : undefined}
          dir={textDirection}
          rows={rows}
          readOnly={!onChange}
          aria-label={typeof title === "string" ? title : t("translationResult")}
        />
        {showStats && charCount && lineCount && (
          <Flex justify="end" style={{ marginTop: token.marginXS }}>
            <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM }}>
              {charCount} {t("charLabel")} / {lineCount} {t("lineLabel")}
            </Typography.Text>
          </Flex>
        )}
      </>
    );
  }

  return (
    <PageCard
      title={displayTitle}
      className={`h-full ${className}`}
      extra={
        hasContent && !loading ? (
          <Space wrap>
            <Button type="text" icon={<CopyOutlined />} onClick={onCopy}>
              {t("copy")}
            </Button>
            {onCopyNode && <Button onClick={onCopyNode}>{tJson("copyNode")}</Button>}
            {onExport && (
              <Button type="primary" ghost icon={<DownloadOutlined />} onClick={onExport}>
                {t("exportFile")}
              </Button>
            )}
          </Space>
        ) : null
      }>
      {body}
    </PageCard>
  );
};

export default ResultCard;
