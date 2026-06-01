"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Modal, List, Space, App, Tag, theme } from "antd";
import { ReloadOutlined, UnorderedListOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";

/**
 * Surfaces partial-failure state from useTranslationState: after the main
 * pass + 10s auto-retry, any lines still failing are reported here.
 *
 * - `count` / `lines`: line-level failures within a single translation run
 *    (one lang × N lines that didn't translate). `lines` lets the user copy
 *    the originals and handle manually.
 * - `failedLangs`: lang-level failures in multi-language batch mode
 *    (entire target lang errored out across all batches — auth bounce, model
 *    refusal). Codes like "ga fo pa" — user copies and re-runs targeting only
 *    those. Independent from line failures; both can be present simultaneously.
 * - `onRetry`: re-runs the translation; cache covers successful lines/langs,
 *   only failed ones actually re-request the API.
 */
export default function TranslateFailurePanel({
  count,
  lines,
  failedLangs = [],
  reason,
  onRetry,
  onClose,
  disabled = false,
}: {
  count: number;
  lines: string[];
  failedLangs?: string[];
  /** Representative raw API error (e.g. "[422] reasoning_effort is not supported
   *  with this model"). Shown verbatim under the partial-failure notice so the user
   *  sees WHY — e.g. opting into thinking on a custom model the provider rejects. */
  reason?: string;
  onRetry: () => void;
  /** Dismiss the whole failure state (clears line + lang failures). Wired to each
   *  Alert's close button so a handled failure can be put away without retrying. */
  onClose?: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const { copyToClipboard } = useCopyToClipboard();
  const [modalOpen, setModalOpen] = useState(false);
  const { token } = theme.useToken();

  const hasLineFailures = count > 0;
  const hasLangFailures = failedLangs.length > 0;
  const hasFailures = hasLineFailures || hasLangFailures;

  // Visibility: the inline Alert below can sit under a long result, off-screen. Fire a
  // one-shot toast the moment failures appear so it's noticed regardless of scroll —
  // antd auto-dismisses it, no lifecycle bookkeeping. The inline Alert (closable) stays
  // as the place to read the API reason and retry / copy the failed lines.
  useEffect(() => {
    if (hasFailures) message.warning(hasLineFailures ? t("partialFailureTitle", { count }) : t("failedLanguagesTitle", { count: failedLangs.length }));
    // Fire only on the transition INTO a failed state, not on later count tweaks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFailures]);

  if (!hasFailures) return null;

  const copyAll = () => {
    copyToClipboard(lines.join("\n"));
    message.success(t("copyAllFailed"));
  };

  const copyAllLangs = () => {
    // Space-separated matches what users will paste back into the
    // Quick Entry via Language Codes field (which accepts comma OR space).
    copyToClipboard(failedLangs.join(" "));
    message.success(t("copyAllFailedLanguages"));
  };

  return (
    <>
      {hasLineFailures && (
        <Alert
          type="warning"
          showIcon
          closable={onClose ? { onClose } : false}
          className="!mt-4"
          title={t("partialFailureTitle", { count })}
          description={
            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              <span>{t("partialFailureDesc")}</span>
              {reason && (
                <div
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: token.colorTextSecondary,
                    background: token.colorFillTertiary,
                    borderRadius: token.borderRadiusSM,
                    padding: "6px 10px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                  }}>
                  {reason}
                </div>
              )}
            </Space>
          }
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
      )}

      {hasLangFailures && (
        <Alert
          type="warning"
          showIcon
          closable={onClose ? { onClose } : false}
          className="!mt-4"
          title={t("failedLanguagesTitle", { count: failedLangs.length })}
          description={
            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              <span>{t("failedLanguagesDesc")}</span>
              <div>
                {failedLangs.map((code) => (
                  <Tag key={code} style={{ marginBottom: 4 }}>
                    {code}
                  </Tag>
                ))}
              </div>
            </Space>
          }
          action={
            <Space orientation="vertical" size="small">
              {/* hasLineFailures already rendered a retry button — avoid duplicating */}
              {!hasLineFailures && (
                <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={onRetry} disabled={disabled}>
                  {t("retryFailedLines")}
                </Button>
              )}
              <Button size="small" icon={<CopyOutlined />} onClick={copyAllLangs}>
                {t("copyAllFailedLanguages")}
              </Button>
            </Space>
          }
        />
      )}

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
