"use client";

import { Modal, Progress, Typography, theme } from "antd";
import { LoadingOutlined } from "@ant-design/icons";
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
 * Shared progress modal component for translation operations.
 * Shows a circular progress indicator with optional multi-language info.
 */
const TranslationProgressModal = ({ open, percent, multiLanguageMode = false, targetLanguageCount = 0, currentCount, totalCount }: TranslationProgressModalProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  if (!open) return null;

  // Show at least 1% once translation has kicked off, so users see the bar move
  // even when a single LLM batch is still in-flight and no lines have returned yet.
  const displayPercent = percent >= 100 ? 100 : percent > 0 ? Math.min(Math.max(1, Math.floor(percent)), 99) : 0;
  const hasCountInfo = typeof currentCount === "number" && typeof totalCount === "number" && totalCount > 0;

  return (
    <Modal open={open} footer={null} closable={false} centered width={320} styles={{ body: { padding: "32px 24px" } }}>
      <div className="flex flex-col items-center">
        {/* Progress Circle with gradient */}
        <Progress
          type="circle"
          percent={displayPercent}
          size={120}
          strokeWidth={8}
          strokeColor={{
            "0%": token.colorPrimary,
            "100%": token.colorSuccess,
          }}
          format={(p) => (
            <div className="flex flex-col items-center">
              <span className="text-2xl font-semibold">{Math.round(p || 0)}%</span>
            </div>
          )}
        />

        {/* Title with spinning icon */}
        <div className="mt-6 flex items-center gap-2">
          <LoadingOutlined spin className="text-blue-500" />
          <Text strong className="text-base">
            {t("translating")}
          </Text>
        </div>

        {/* Multi-language info */}
        {multiLanguageMode && targetLanguageCount > 0 && (
          <Text type="secondary" className="mt-2">
            {t("multiTranslating")} <Text strong>{targetLanguageCount}</Text>
          </Text>
        )}

        {/* Count info: "32 / 150" */}
        {hasCountInfo && (
          <Text type="secondary" className="mt-2 text-sm">
            <Text strong>{currentCount}</Text> / {totalCount}
          </Text>
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
