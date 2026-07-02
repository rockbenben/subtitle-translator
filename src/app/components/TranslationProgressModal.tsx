"use client";

import type { CSSProperties } from "react";
import { Modal, Progress, Typography, theme } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface TranslationProgressModalProps {
  /** Whether a translation run is currently in flight */
  isTranslating: boolean;
  /** Progress percentage (0-100) */
  percent: number;
  /** Dismiss the held DONE state (typically resets progress so the modal closes) */
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
 * Interlingua progress modal — one shared design for every translator (subtitle,
 * JSON, Markdown). Mono-caps status with a live accent dot, a tabular percent,
 * and a single hairline determinate bar.
 *
 * Visibility/state are PURELY DERIVED from (isTranslating, percent) — no internal
 * state, effects or timers — so completion can't be missed and the modal can't
 * race itself closed:
 *   showing = isTranslating || percent >= 100   (in flight, or a finished run)
 *   done    = percent >= 100 && !isTranslating  (reached 100% and stopped)
 * On done the modal holds the green "DONE" readout until the user dismisses it
 * (✕ / mask → onDismiss, which resets progress and closes it). An aborted/failed
 * run closes below 100%, so showing flips false the instant isTranslating does —
 * no false "DONE".
 */
const TranslationProgressModal = ({ isTranslating, percent, onDismiss, multiLanguageMode = false, targetLanguageCount = 0, currentCount, totalCount }: TranslationProgressModalProps) => {
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
    <Modal open={showing} footer={null} closable={done} mask={{ closable: done }} onCancel={done ? onDismiss : undefined} centered width={360} styles={{ body: { padding: "26px 28px 22px" } }}>
      <div className="flex flex-col">
        {/* Status marker + count */}
        <div className="font-mono flex items-center justify-between" style={{ ...monoCaps, color: token.colorTextTertiary, marginBottom: 18 }}>
          <span className="flex items-center" style={{ gap: 7 }}>
            {/* Static status marker — the bar's `active` shimmer carries the motion. */}
            <span aria-hidden style={{ width: 7, height: 7, background: accent, display: "inline-block" }} />
            {done ? "DONE" : "IN PROGRESS"}
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
              color: done ? token.colorSuccess : token.colorText,
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
        <Progress percent={displayPercent} status={done ? "success" : "active"} showInfo={false} strokeLinecap="butt" size={{ height: 6 }} style={{ marginBottom: 0, lineHeight: 1 }} />

        {/* Localized status line + multi-language hint */}
        <div className="flex items-center justify-between" style={{ marginTop: 16 }}>
          <Text strong style={{ fontSize: 14 }}>
            {done ? t("translateDone") : t("translating")}
          </Text>
          {!done && multiLanguageMode && targetLanguageCount > 0 && (
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
