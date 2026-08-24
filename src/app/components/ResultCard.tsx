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
  /**
   * TextArea 的书写方向,默认 `"ltr"`。判据只有一条:**这框里装的是自由文本还是结构化文本**。
   *
   * - 装自由文本的传 `"auto"`(字幕、Markdown、小说、简繁、提取出的值、批处理产物)。
   *   HTML 对 textarea 的 dir=auto 用的是 `unicode-bidi: plaintext`,**逐行**按首个强
   *   方向字符判定:字幕的时间码/序号行仍是 LTR,希伯来语/阿拉伯语正文行整行转 RTL,
   *   句尾的 ?!()「」这些中性字符才会落在句子真正的末尾 —— 默认的 "ltr" 会让它们按
   *   LTR 段落方向解析,跑到句子另一端(subtitle-translator#62)。
   * - 装结构化文本的**什么都不传**(JSON / 书签 / IMGPrompt / CSV):缩进与列对齐本身
   *   是信息,逐行 auto 会把「首个强方向字符是 RTL」的那种行整行甩到右边、缩进消失 ——
   *   实测触发点是**裸数组元素**(`"בית",` 自成一行,i18n 里很常见)与 RTL 键;
   *   `"key": "RTL 值"` 由键锚成 LTR,不受影响。
   * - `"rtl"`:整篇定向,只有 Markdown 正文用(逐行 auto 会让以拉丁链接开头的行判成
   *   LTR,而整篇本该是 RTL)。
   *
   * 默认取 "ltr" 而不是 "auto":32 个调用点里结构化的是多数,且漏传时的表现是「跟改动
   * 前一样」,而不是静默换一种排版。
   */
  textDirection?: "ltr" | "rtl" | "auto";
  rows?: number;
  className?: string;
}

/**
 * Output-side surface. Distinguished from the input side by a 2px accent
 * (`token.colorPrimary`) top strip — continuation of the ToolPage brand mark;
 * signals "this is the output region" at a glance.
 *
 * Callers always guard with `{result && (<ResultCard ...>)}`, so this component
 * assumes non-empty content. The translation progress / loading affordance is
 * handled by the surrounding TranslationProgressStrip.
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
