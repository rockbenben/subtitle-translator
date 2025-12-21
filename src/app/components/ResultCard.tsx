"use client";

import { Card, Button, Space, Input, Typography } from "antd";
import { CopyOutlined, DownloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { TextArea } = Input;
const { Paragraph } = Typography;

interface ResultCardProps {
  /** Card title - defaults to "translationResult" translation key */
  title?: string;
  /** Result content to display */
  content: string;
  /** Formatted character count string */
  charCount?: string;
  /** Formatted line count string */
  lineCount?: string;
  /** Whether to show stats footer - defaults to true */
  showStats?: boolean;
  /** Copy button callback */
  onCopy: () => void;
  /** Optional copy node callback - when provided, shows "Copy Node" button (for JSON tools) */
  onCopyNode?: () => void;
  /** Optional export callback - when provided, shows "Export" button */
  onExport?: () => void;
  /** Text direction for RTL language support - defaults to "ltr" */
  textDirection?: "ltr" | "rtl";
  /** Number of rows for TextArea - defaults to 10 */
  rows?: number;
  /** Additional class name */
  className?: string;
}

/**
 * Shared result card component for displaying processed/translated text.
 * Supports both translation tools and JSON processing tools.
 */
const ResultCard = ({ title, content, charCount, lineCount, showStats = true, onCopy, onCopyNode, onExport, textDirection = "ltr", rows = 10, className = "" }: ResultCardProps) => {
  const t = useTranslations("common");
  const tJson = useTranslations("json");

  const displayTitle = title || t("translationResult");

  return (
    <Card
      title={displayTitle}
      className={`shadow-sm h-full ${className}`}
      extra={
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
      }>
      <TextArea value={content} dir={textDirection} rows={rows} readOnly aria-label={displayTitle} />
      {showStats && charCount && lineCount && (
        <Paragraph type="secondary" className="text-right">
          {t("outputStatsTitle")}: {charCount} {t("charLabel")}, {lineCount} {t("lineLabel")}
        </Paragraph>
      )}
    </Card>
  );
};

export default ResultCard;
