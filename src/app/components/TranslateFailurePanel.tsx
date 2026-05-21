"use client";

import { useState } from "react";
import { Alert, Button, Modal, List, Space, App, theme } from "antd";
import { ReloadOutlined, UnorderedListOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";

/**
 * Surfaces partial-failure state from useTranslationState: after the main
 * pass + 10s auto-retry, any lines still failing are reported here.
 *
 * - `count`: total failed-line count across this translation run
 * - `lines`: the original text of each failed line (user can copy + handle manually)
 * - `onRetry`: re-runs the same handleTranslate; cache covers successful lines,
 *   only failed lines actually re-request the API
 */
export default function TranslateFailurePanel({ count, lines, onRetry, disabled = false }: { count: number; lines: string[]; onRetry: () => void; disabled?: boolean }) {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const { copyToClipboard } = useCopyToClipboard();
  const [modalOpen, setModalOpen] = useState(false);
  const { token } = theme.useToken();

  if (count <= 0) return null;

  const copyAll = () => {
    copyToClipboard(lines.join("\n"));
    message.success(t("copyAllFailed"));
  };

  return (
    <>
      <Alert
        type="warning"
        showIcon
        className="!mt-4"
        message={t("partialFailureTitle", { count })}
        description={t("partialFailureDesc")}
        action={
          <Space orientation="vertical" size="small">
            <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={onRetry} disabled={disabled}>
              {t("retryFailedLines")}
            </Button>
            {lines.length > 0 && (
              <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setModalOpen(true)}>
                {t("viewFailedLines")}
              </Button>
            )}
          </Space>
        }
      />

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={t("failedLinesModalTitle", { count: lines.length })}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={copyAll}>
            {t("copyAllFailed")}
          </Button>,
          <Button key="close" type="primary" onClick={() => setModalOpen(false)}>
            {t("closeFailedLinesModal")}
          </Button>,
        ]}
        width={720}>
        <List
          size="small"
          bordered
          dataSource={lines}
          style={{ maxHeight: "60vh", overflowY: "auto" }}
          renderItem={(item, idx) => (
            <List.Item>
              <span
                className="font-mono"
                style={{
                  color: token.colorTextTertiary,
                  marginRight: 12,
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  display: "inline-block",
                  minWidth: `${String(lines.length).length + 1}ch`,
                  textAlign: "right",
                }}>
                {String(idx + 1).padStart(String(lines.length).length, "0")}
              </span>
              {item}
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
