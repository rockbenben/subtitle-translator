"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Modal, List, Space, App, Tag, theme } from "antd";
import { ReloadOutlined, UnorderedListOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import type { FailedLine } from "@/app/hooks/useTranslationState";

/**
 * Surfaces partial-failure state from useTranslationState: after the main
 * pass + 10s auto-retry, any lines still failing are reported here.
 *
 * - `count` / `lines`: line-level failures within a single translation run. A
 *    run can span several target langs (multi-language mode) and several files
 *    (batch mode) — failures accumulate across all of them until the next
 *    run/clear. Each `FailedLine` carries the original text plus, when the
 *    source path can supply them, the real 1-based line position, target lang
 *    and source file — so the modal points at the actual location instead of a
 *    meaningless 1..N re-numbering. `lines` lets the user copy the originals
 *    and handle manually.
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
  lines: FailedLine[];
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

  // 两类失败面板各自独立关闭:onClose(=clearFailures)是全清,直接接到
  // 单个 Alert 的关闭按钮会让"关掉行级提示"连带清空语言级失败码(用户还
  // 没抄走)。本地 dismissed 状态先各自隐藏,两者都关掉才真正全清。
  const [lineDismissed, setLineDismissed] = useState(false);
  const [langDismissed, setLangDismissed] = useState(false);
  const failureKey = `${count}|${failedLangs.join(",")}`;
  const [prevFailureKey, setPrevFailureKey] = useState(failureKey);
  if (failureKey !== prevFailureKey) {
    // 新一轮失败 → 复位本地关闭状态
    setPrevFailureKey(failureKey);
    setLineDismissed(false);
    setLangDismissed(false);
  }

  const hasLineFailures = count > 0 && !lineDismissed;
  const hasLangFailures = failedLangs.length > 0 && !langDismissed;
  const hasFailures = hasLineFailures || hasLangFailures;

  const dismissLine = () => {
    setLineDismissed(true);
    if (failedLangs.length === 0 || langDismissed) onClose?.();
  };
  const dismissLang = () => {
    setLangDismissed(true);
    if (count === 0 || lineDismissed) onClose?.();
  };

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

  // Concurrent soft-fail collection pushes lines out of order, and multi-file
  // batches accumulate several files' failures under one clearFailures — sort by
  // (file, lang, line) so rows group per file and each group reads top-to-bottom
  // like its source (line numbers are only unique within one file). Records
  // without a line number (JSONTranslator's key nodes) sort to the front and
  // fall back to sequential.
  const sortedLines = [...lines].sort((a, b) => {
    const fileCmp = (a.file ?? "").localeCompare(b.file ?? "");
    if (fileCmp !== 0) return fileCmp;
    const langCmp = (a.lang ?? "").localeCompare(b.lang ?? "");
    if (langCmp !== 0) return langCmp;
    return (a.line ?? 0) - (b.line ?? 0);
  });
  // Tag each row with its source file / target lang only when the failures span
  // more than one — a single-file or single-language run needs no per-row noise.
  const distinctLangs = new Set(sortedLines.map((l) => l.lang).filter(Boolean));
  const showLang = distinctLangs.size > 1;
  const distinctFiles = new Set(sortedLines.map((l) => l.file).filter(Boolean));
  const showFile = distinctFiles.size > 1;
  // Pad the index column to the widest number shown (real line no. or sequential).
  // reduce, not Math.max(...spread): a fully-failed large file (huge JSON) could
  // spread tens of thousands of args and hit RangeError("too many arguments").
  const maxNum = sortedLines.reduce((m, l) => Math.max(m, l.line ?? 0), sortedLines.length);
  const numWidth = String(maxNum).length;

  // copyToClipboard 自带「已复制」提示，不再叠加 message.success（原来会把按钮文案
  // 当成功提示再弹一次，一次点击出现两个 toast）。
  // 内嵌换行压平成空格:ASS 多行 cue 的 \N 已被转成真实 \n,原样复制会让剪贴板
  // 物理行数 > 失败条数 —— 拿去外部翻译后逐行贴回(复制按钮存在的工作流)必错位。
  const copyAll = () => {
    copyToClipboard(sortedLines.map((l) => l.text.replace(/\r?\n/g, " ")).join("\n"));
  };

  const copyAllLangs = () => {
    // Space-separated matches what users will paste back into the
    // Quick Entry via Language Codes field (which accepts comma OR space).
    copyToClipboard(failedLangs.join(" "));
  };

  return (
    <>
      {hasLineFailures && (
        <Alert
          type="warning"
          showIcon
          closable={onClose ? { onClose: dismissLine } : false}
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
          closable={onClose ? { onClose: dismissLang } : false}
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
          dataSource={sortedLines}
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
                  minWidth: `${numWidth + 1}ch`,
                  textAlign: "right",
                }}>
                {/* Real source line number when the path supplied one; otherwise
                    sequential (JSONTranslator's key nodes have no line position). */}
                {String(item.line ?? idx + 1).padStart(numWidth, "0")}
              </span>
              {showFile && item.file && (
                <Tag style={{ marginRight: 8 }} color="default">
                  {item.file}
                </Tag>
              )}
              {showLang && item.lang && (
                <Tag style={{ marginRight: 8 }} color="default">
                  {item.lang}
                </Tag>
              )}
              {item.text}
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
