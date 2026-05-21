"use client";

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
 * Editorial progress modal — Fraunces display percentage, mono counter,
 * mono-caps chapter label. The Progress ring already animates via its stroke
 * gradient, so no separate spinner icon is needed.
 */
const TranslationProgressModal = ({ open, percent, multiLanguageMode = false, targetLanguageCount = 0, currentCount, totalCount }: TranslationProgressModalProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  if (!open) return null;

  // Show at least 1% once translation has kicked off, so users see the bar move
  // even when a single LLM batch is still in-flight and no lines have returned yet.
  const displayPercent = percent >= 100 ? 100 : percent > 0 ? Math.min(Math.max(1, Math.floor(percent)), 99) : 0;
  const isDone = displayPercent >= 100;
  const hasCountInfo = typeof currentCount === "number" && typeof totalCount === "number" && totalCount > 0;

  return (
    <Modal open={open} footer={null} closable={false} centered width={340} styles={{ body: { padding: "32px 28px" } }}>
      <div className="flex flex-col items-center">
        {/* Editorial chapter label — mono caps top marker */}
        <div
          className="font-mono"
          style={{
            fontSize: 11,
            letterSpacing: "0.16em",
            textTransform: "uppercase",
            color: token.colorText,
            opacity: 0.55,
            marginBottom: 24,
          }}>
          {isDone ? "Done" : "In Progress"}
        </div>

        {/* Progress Circle — vermilion → moss gradient */}
        <Progress
          type="circle"
          percent={displayPercent}
          size={140}
          strokeWidth={6}
          strokeColor={{
            "0%": token.colorPrimary,
            "100%": token.colorSuccess,
          }}
          format={(p) => (
            <div className="flex items-baseline justify-center">
              <span
                className="font-display"
                style={{
                  fontSize: 44,
                  fontWeight: 500,
                  lineHeight: 1,
                  letterSpacing: "-0.03em",
                  color: isDone ? token.colorSuccess : token.colorText,
                  transition: "color 0.3s ease",
                }}>
                {Math.round(p || 0)}
              </span>
              <span
                className="font-display"
                style={{
                  fontSize: 18,
                  fontWeight: 400,
                  marginLeft: 2,
                  opacity: 0.5,
                }}>
                %
              </span>
            </div>
          )}
        />

        {/* Status — vermilion pulse dot (replaces redundant spinner) */}
        <div className="mt-6 flex items-center gap-2">
          {!isDone && (
            <span
              aria-hidden
              style={{
                display: "inline-block",
                width: 6,
                height: 6,
                borderRadius: "50%",
                background: token.colorPrimary,
                animation: "loading-pulse 1.4s ease-in-out infinite",
              }}
            />
          )}
          <Text strong>{t("translating")}</Text>
        </div>

        {/* Multi-language info */}
        {multiLanguageMode && targetLanguageCount > 0 && (
          <Text type="secondary" className="mt-2">
            {t("multiTranslating")} <Text strong>{targetLanguageCount}</Text>
          </Text>
        )}

        {/* Count info — mono "32 / 150" */}
        {hasCountInfo && (
          <div
            className="font-mono mt-3"
            style={{
              fontSize: 13,
              color: token.colorTextSecondary,
              letterSpacing: "0.04em",
            }}>
            <span style={{ color: token.colorText, fontWeight: 600 }}>{currentCount}</span>
            <span style={{ opacity: 0.4, padding: "0 6px" }}>/</span>
            <span>{totalCount}</span>
          </div>
        )}

        {/* Status text */}
        <Text type="secondary" className="mt-3 text-sm">
          {t("pleaseWait")}
        </Text>
      </div>
    </Modal>
  );
};

export default TranslationProgressModal;
