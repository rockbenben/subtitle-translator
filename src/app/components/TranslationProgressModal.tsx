"use client";

import type { CSSProperties } from "react";
import { Modal, Progress, Typography, theme } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface TranslationProgressModalProps {
  /** Whether the modal is open */
  open: boolean;
  /** Progress percentage (0-100) */
  percent: number;
  /** Whether multi-language mode is enabled */
  multiLanguageMode?: boolean;
  /** Number of target languages */
  targetLanguageCount?: number;
  /** Lines / items completed so far — rendered as a "current / total" hint */
  currentCount?: number;
  /** Total lines / items — omit (or 0) to hide the hint */
  totalCount?: number;
}

/**
 * Interlingua progress modal — one shared design for every translator (subtitle,
 * JSON, Markdown). Mono-caps status with a live accent dot, a tabular percent,
 * and a single hairline determinate bar. No live-text preview: translation is
 * fast, so the readout stays calm and consistent everywhere.
 */
const TranslationProgressModal = ({ open, percent, multiLanguageMode = false, targetLanguageCount = 0, currentCount, totalCount }: TranslationProgressModalProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  if (!open) return null;

  // Show at least 1% once translation has kicked off, so the bar moves even
  // while the first batch is still in-flight and no lines have returned yet.
  const displayPercent = percent >= 100 ? 100 : percent > 0 ? Math.min(Math.max(1, Math.floor(percent)), 99) : 0;
  const isDone = displayPercent >= 100;
  const hasCountInfo = typeof currentCount === "number" && typeof totalCount === "number" && totalCount > 0;
  const accent = isDone ? token.colorSuccess : token.colorPrimary;

  const monoCaps: CSSProperties = { fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" };

  return (
    <Modal open={open} footer={null} closable={false} centered width={360} styles={{ body: { padding: "26px 28px 22px" } }}>
      <div className="flex flex-col">
        {/* Status marker + count */}
        <div className="font-mono flex items-center justify-between" style={{ ...monoCaps, color: token.colorTextTertiary, marginBottom: 18 }}>
          <span className="flex items-center" style={{ gap: 7 }}>
            {/* Static status marker — the bar's `active` shimmer carries the motion. */}
            <span aria-hidden style={{ width: 7, height: 7, background: accent, display: "inline-block" }} />
            {isDone ? "DONE" : "IN PROGRESS"}
          </span>
          {hasCountInfo && (
            <span>
              <span style={{ color: token.colorText }}>{currentCount}</span>
              <span style={{ opacity: 0.5 }}> / {totalCount}</span>
            </span>
          )}
        </div>

        {/* Percent */}
        <div className="flex items-baseline" style={{ marginBottom: 12 }}>
          <span
            className="font-display"
            style={{
              fontSize: 44,
              fontWeight: 800,
              lineHeight: 1,
              letterSpacing: "-0.035em",
              color: isDone ? token.colorSuccess : token.colorText,
              transition: "color 0.3s ease",
              fontVariantNumeric: "tabular-nums",
            }}>
            {displayPercent}
          </span>
          <span className="font-display" style={{ fontSize: 20, fontWeight: 400, marginInlineStart: 3, opacity: 0.4 }}>
            %
          </span>
        </div>

        {/* antd Progress line — square caps (Swiss), `active` shimmer shows life
            while an LLM batch is in-flight and the percent sits, `success` greens
            it on done. Our own percent above is the focal readout, so showInfo off. */}
        <Progress percent={displayPercent} status={isDone ? "success" : "active"} showInfo={false} strokeLinecap="butt" size={{ height: 6 }} style={{ marginBottom: 0, lineHeight: 1 }} />

        {/* Localized status line + multi-language hint */}
        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 14 }}>
            {t("translating")}
          </Text>
          {multiLanguageMode && targetLanguageCount > 0 && (
            <Text type="secondary" style={{ fontSize: 13 }}>
              {t("multiTranslating")} <Text strong>{targetLanguageCount}</Text>
            </Text>
          )}
        </div>
      </div>
    </Modal>
  );
};

export default TranslationProgressModal;
