"use client";

import { useState } from "react";
import { Alert, Button, Modal, List, Space, App } from "antd";
import { ReloadOutlined, UnorderedListOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";

/**
 * Surfaces partial-failure state from useTranslateData: after the main
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
          <Space direction="vertical" size="small">
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
              <span style={{ color: "rgba(255,255,255,0.45)", marginRight: 8 }}>{idx + 1}.</span>
              {item}
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
