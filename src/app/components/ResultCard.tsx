"use client";

import { Button, Space, Input, Tooltip, theme } from "antd";
import { CopyOutlined, DownloadOutlined, SwapOutlined, ClearOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import PageCard from "@/app/components/styled/PageCard";
import StatsFooter from "@/app/components/StatsFooter";

const { TextArea } = Input;

/** Subset of useTextStats return value that ResultCard consumes. */
interface TextStats {
  charCount: string;
  lineCount: string;
  isTooLong: boolean;
  displayText: string;
  isEditable: boolean;
}

interface ResultCardProps {
  title?: React.ReactNode;
  /** Result content to display. If onChange is provided, this should be the state value. */
  content: string;
  /** Callback for content changes. If provided, the TextArea becomes editable. */
  onChange?: (value: string) => void;
  /**
   * Optional useTextStats result. When supplied, ResultCard auto-handles isTooLong
   * (switches to displayText + read-only + shows "只读模式" hint) and pulls
   * charCount/lineCount from it. charCount/lineCount props are ignored if stats is set.
   */
  stats?: TextStats;
  charCount?: string;
  lineCount?: string;
  /** Whether to show stats footer - defaults to true */
  showStats?: boolean;
  /** Copy button callback */
  onCopy: () => void;
  /** Optional copy node callback - when provided with `copyNodeLabel`, shows the button (used by JSON tools) */
  onCopyNode?: () => void;
  /** Label for the copy-node button. Caller-supplied so ResultCard stays namespace-agnostic. */
  copyNodeLabel?: string;
  /** Optional export callback - when provided, shows "Export" button */
  onExport?: () => void;
  /** Optional format callback - when provided, shows "Format" button (strips blank lines / trims). */
  onFormat?: () => void;
  /** Optional move-result-to-source callback - when provided, shows "Result ➔ Source" button. */
  onMoveToSource?: () => void;
  /** Text direction for RTL language support - defaults to "ltr" */
  textDirection?: "ltr" | "rtl";
  rows?: number;
  className?: string;
}

/**
 * Output-side surface. Distinguished from the input side by a 2px vermilion
 * (`token.colorPrimary`) top strip — continuation of the ToolPage brand mark;
 * signals "this is the output region" at a glance.
 *
 * Callers always guard with `{result && (<ResultCard ...>)}`, so this component
 * assumes non-empty content. The translation progress / loading affordance is
 * handled by the surrounding TranslationProgressModal.
 *
 * Action buttons are ordered left-to-right by intent: transforms (Format,
 * MoveToSource) first, then takes (Copy, CopyNode, Export). Export is the
 * visual anchor as primary-ghost on the right.
 */
const ResultCard = ({
  title,
  content,
  onChange,
  stats,
  charCount,
  lineCount,
  showStats = true,
  onCopy,
  onCopyNode,
  copyNodeLabel,
  onExport,
  onFormat,
  onMoveToSource,
  textDirection = "ltr",
  rows = 10,
  className = "",
}: ResultCardProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  const displayTitle = title || t("result");

  const displayContent = stats?.isTooLong ? stats.displayText : content;
  const effectiveOnChange = stats && !stats.isEditable ? undefined : onChange;
  const forcedReadOnly = Boolean(onChange && stats?.isTooLong);
  const effectiveCharCount = stats?.charCount ?? charCount;
  const effectiveLineCount = stats?.lineCount ?? lineCount;

  return (
    <PageCard
      title={displayTitle}
      className={`h-full ${className}`}
      style={{ borderTop: `2px solid ${token.colorPrimary}` }}
      extra={
        <Space>
          {onFormat && (
            <Tooltip title={t("formatTooltip")}>
              <Button type="text" icon={<ClearOutlined />} onClick={onFormat}>
                {t("format")}
              </Button>
            </Tooltip>
          )}
          {onMoveToSource && (
            <Tooltip title={t("resultToSourceTooltip")}>
              <Button type="text" icon={<SwapOutlined />} onClick={onMoveToSource}>
                {t("resultToSource")}
              </Button>
            </Tooltip>
          )}
          <Button type="text" icon={<CopyOutlined />} onClick={onCopy}>
            {t("copy")}
          </Button>
          {onCopyNode && copyNodeLabel && (
            <Button type="text" icon={<CopyOutlined />} onClick={onCopyNode}>
              {copyNodeLabel}
            </Button>
          )}
          {onExport && (
            <Button type="primary" ghost icon={<DownloadOutlined />} onClick={onExport}>
              {t("exportFile")}
            </Button>
          )}
        </Space>
      }>
      <TextArea
        value={displayContent}
        onChange={effectiveOnChange ? (e) => effectiveOnChange(e.target.value) : undefined}
        dir={textDirection}
        rows={rows}
        readOnly={!effectiveOnChange}
        aria-label={typeof title === "string" ? title : t("translationResult")}
      />
      {showStats && (forcedReadOnly || (effectiveCharCount && effectiveLineCount)) && effectiveCharCount && effectiveLineCount && (
        <StatsFooter charCount={effectiveCharCount} lineCount={effectiveLineCount} isReadOnly={forcedReadOnly} />
      )}
    </PageCard>
  );
};

export default ResultCard;
