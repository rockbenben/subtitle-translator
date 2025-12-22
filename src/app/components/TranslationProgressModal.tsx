"use client";

import { Modal, Progress, Typography } from "antd";
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
}

/**
 * Shared progress modal component for translation operations.
 * Shows a circular progress indicator with optional multi-language info.
 */
const TranslationProgressModal = ({ open, percent, multiLanguageMode = false, targetLanguageCount = 0 }: TranslationProgressModalProps) => {
  const t = useTranslations("common");

  if (!open) return null;

  const displayPercent = Math.round(percent * 100) / 100;

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
            "0%": "#1677ff",
            "100%": "#52c41a",
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

        {/* Status text */}
        <Text type="secondary" className="mt-3 text-sm">
          {t("pleaseWait")}
        </Text>
      </div>
    </Modal>
  );
};

export default TranslationProgressModal;
