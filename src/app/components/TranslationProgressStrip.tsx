"use client";

import type { CSSProperties } from "react";
import { Button, Progress, Typography, theme } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface TranslationProgressStripProps {
  /** Whether a translation run is currently in flight */
  isTranslating: boolean;
  /** Progress percentage (0-100) */
  percent: number;
  /** Cancel the in-flight run (requestCancel from the hook) */
  onCancel?: () => void;
  /** Dismiss the held DONE state (typically resets progress so the strip closes) */
  onDismiss?: () => void;
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
 * 内联翻译进度条 —— 前身是全屏的 TranslationProgressModal,砍掉遮罩改为内联,
 * 是「翻译中界面不再锁死 + 可取消」反馈的落点:进度就长在翻译按钮下方,旁边是
 * 取消按钮,页面其余部分保持可交互。
 *
 * 可见性/状态沿用弹窗的合同,【纯派生】自 (isTranslating, percent) —— 没有内部
 * state / effect / timer,完成不会被错过,也不会跟自己竞态:
 *   showing = isTranslating || percent >= 100   (在飞,或一轮已完成)
 *   done    = percent >= 100 && !isTranslating  (到 100% 且已停)
 * done 时保持绿色 DONE 直到用户点 ✕(onDismiss 复位进度即关闭)。中止/失败的
 * run 在 100% 以下收尾,isTranslating 一落 showing 立刻为 false —— 不会有假 DONE。
 * 取消同理:引擎保证被取消的 run 不钉 100%(取消路径全部经由抛出提前退出)。
 */
const TranslationProgressStrip = ({ isTranslating, percent, onCancel, onDismiss, multiLanguageMode = false, targetLanguageCount = 0, currentCount, totalCount }: TranslationProgressStripProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  const done = percent >= 100 && !isTranslating;
  const showing = isTranslating || percent >= 100;
  if (!showing) return null;

  // Show at least 1% once translation has kicked off, so the bar moves even
  // while the first batch is still in-flight and no lines have returned yet.
  const displayPercent = percent >= 100 ? 100 : percent > 0 ? Math.min(Math.max(1, Math.floor(percent)), 99) : 0;
  const hasCountInfo = typeof currentCount === "number" && typeof totalCount === "number" && totalCount > 0;
  const accent = done ? token.colorSuccess : token.colorPrimary;

  const monoCaps: CSSProperties = { fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        padding: "12px 14px",
        marginTop: 12,
      }}>
      {/* Status marker + count */}
      <div className="font-mono flex items-center justify-between" style={{ ...monoCaps, color: token.colorTextTertiary, marginBottom: 10 }} aria-live="off">
        <span className="flex items-center" style={{ gap: 7 }}>
          {/* Static status marker — the bar's `active` shimmer carries the motion. */}
          <span aria-hidden style={{ width: 7, height: 7, background: accent, display: "inline-block" }} />
          {done ? "DONE" : "IN PROGRESS"}
          <span className="font-display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, textTransform: "none", color: done ? token.colorSuccess : token.colorText, fontVariantNumeric: "tabular-nums" }}>
            {displayPercent}%
          </span>
        </span>
        {hasCountInfo && (
          <span>
            <span style={{ color: token.colorText }}>{currentCount}</span>
            <span style={{ opacity: 0.5 }}> / {totalCount}</span>
          </span>
        )}
      </div>

      <Progress percent={displayPercent} status={done ? "success" : "active"} showInfo={false} strokeLinecap="butt" size={{ height: 6 }} style={{ marginBottom: 0, lineHeight: 1 }} />

      {/* Localized status line + cancel / dismiss */}
      <div className="flex items-center justify-between" style={{ marginTop: 10 }}>
        <span className="flex items-baseline" style={{ gap: 8 }}>
          <Text strong style={{ fontSize: 13 }}>
            {done ? t("translateDone") : t("translating")}
          </Text>
          {!done && multiLanguageMode && targetLanguageCount > 0 && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {t("multiTranslating")} <Text strong>{targetLanguageCount}</Text>
            </Text>
          )}
        </span>
        {done
          ? onDismiss && <Button size="small" type="text" icon={<CloseOutlined />} onClick={onDismiss} aria-label={t("translateDone")} />
          : onCancel && (
              <Button size="small" danger onClick={onCancel}>
                {t("cancel")}
              </Button>
            )}
      </div>
    </div>
  );
};

export default TranslationProgressStrip;
