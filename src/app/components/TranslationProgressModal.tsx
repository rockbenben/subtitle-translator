"use client";

import type { CSSProperties } from "react";
import { Modal, Typography, theme } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

// Projection-screen palette — intentionally theme-independent: a cinema
// screen is dark in a lit room too. The subtitle yellow is the one deliberate
// departure from the Interlingua blue, scoped to inside the screen.
const SCREEN_BG = "#0C0C0A";
const SCREEN_EDGE = "rgba(245, 241, 230, 0.12)";
const SUB_YELLOW = "#FFD935";
const SCREEN_TEXT_FAINT = "rgba(245, 241, 230, 0.4)";

const TICK_COUNT = 24;

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
  /** Cinema variant: letterboxed screen with the latest translated line as a
   *  live subtitle. Used by SubtitleTranslator; other tools keep the default. */
  projection?: boolean;
  /** Most recently translated line (subtitle preview). Only read when projection. */
  latestLine?: string;
}

/**
 * Interlingua progress modal — mono-caps status, heavy grotesk percent,
 * hairline tick bar. The `projection` variant swaps the percent display for
 * a 21:9 cinema screen that plays the latest translated line as a subtitle —
 * the signature element of the subtitle-translator page.
 */
const TranslationProgressModal = ({
  open,
  percent,
  multiLanguageMode = false,
  targetLanguageCount = 0,
  currentCount,
  totalCount,
  projection = false,
  latestLine,
}: TranslationProgressModalProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  if (!open) return null;

  // Show at least 1% once translation has kicked off, so users see the bar move
  // even when a single LLM batch is still in-flight and no lines have returned yet.
  const displayPercent = percent >= 100 ? 100 : percent > 0 ? Math.min(Math.max(1, Math.floor(percent)), 99) : 0;
  const isDone = displayPercent >= 100;
  const hasCountInfo = typeof currentCount === "number" && typeof totalCount === "number" && totalCount > 0;

  const doneTicks = Math.floor((displayPercent / 100) * TICK_COUNT);

  const monoCaps: CSSProperties = {
    fontSize: 11,
    letterSpacing: "0.18em",
    textTransform: "uppercase",
  };

  return (
    <Modal open={open} footer={null} closable={false} centered width={projection ? 520 : 360} styles={{ body: { padding: "28px 28px 24px" } }}>
      <div className="flex flex-col">
        {/* Mono-caps status marker */}
        <div className="font-mono flex items-center justify-between" style={{ ...monoCaps, color: token.colorTextTertiary, marginBottom: 20 }}>
          <span>
            <span style={{ color: isDone ? token.colorSuccess : token.colorPrimary }}>{isDone ? "" : "● "}</span>
            {isDone ? "DONE" : "IN PROGRESS"}
          </span>
          {hasCountInfo && (
            <span>
              <span style={{ color: token.colorText }}>{currentCount}</span>
              <span style={{ opacity: 0.5 }}> / {totalCount}</span>
            </span>
          )}
        </div>

        {projection ? (
          /* ── Projection screen — live subtitle preview ── */
          <div
            aria-hidden
            style={{
              position: "relative",
              aspectRatio: "21 / 9",
              background: `radial-gradient(ellipse 80% 90% at 50% 30%, #191A16, ${SCREEN_BG} 78%)`,
              border: `1px solid ${SCREEN_EDGE}`,
              display: "flex",
              flexDirection: "column",
              justifyContent: "flex-end",
              alignItems: "center",
              padding: "12px 16px 9%",
              overflow: "hidden",
            }}>
            <span
              className="font-mono"
              style={{
                position: "absolute",
                top: 10,
                insetInlineStart: 12,
                fontSize: 9.5,
                letterSpacing: "0.2em",
                color: SCREEN_TEXT_FAINT,
              }}>
              {hasCountInfo ? `CUE ${String(currentCount).padStart(3, "0")} / ${totalCount}` : `${displayPercent}%`}
            </span>
            {!isDone && (
              <span
                className="font-mono"
                style={{
                  position: "absolute",
                  top: 10,
                  insetInlineEnd: 12,
                  fontSize: 9.5,
                  letterSpacing: "0.2em",
                  color: SUB_YELLOW,
                }}>
                <span style={{ animation: "caret-blink 1.2s steps(2) infinite", display: "inline-block" }}>●</span> REC
              </span>
            )}
            <div
              style={{
                fontSize: "clamp(14px, 2.6vw, 19px)",
                fontWeight: 500,
                textAlign: "center",
                color: latestLine ? SUB_YELLOW : SCREEN_TEXT_FAINT,
                textShadow: latestLine ? "0 2px 4px rgba(0,0,0,.9), 0 0 22px rgba(255,217,53,.22)" : "none",
                letterSpacing: "0.03em",
                lineHeight: 1.45,
                display: "-webkit-box",
                WebkitLineClamp: 2,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
                maxWidth: "92%",
              }}>
              {latestLine || t("pleaseWait")}
              {latestLine && !isDone && (
                <span
                  style={{
                    display: "inline-block",
                    width: 3,
                    height: "0.9em",
                    background: SUB_YELLOW,
                    verticalAlign: -2,
                    marginInlineStart: 6,
                    animation: "caret-blink 1s steps(2) infinite",
                  }}
                />
              )}
            </div>
          </div>
        ) : (
          /* ── Default: heavy grotesk percent ── */
          <div className="flex items-baseline" style={{ marginBottom: 4 }}>
            <span
              className="font-display"
              style={{
                fontSize: 64,
                fontWeight: 800,
                lineHeight: 1,
                letterSpacing: "-0.04em",
                color: isDone ? token.colorSuccess : token.colorText,
                transition: "color 0.3s ease",
                fontVariantNumeric: "tabular-nums",
              }}>
              {displayPercent}
            </span>
            <span className="font-display" style={{ fontSize: 24, fontWeight: 400, marginInlineStart: 4, opacity: 0.45 }}>
              %
            </span>
          </div>
        )}

        {/* Tick bar — the translation as a reel of segments. Done ticks take
            the accent; the head tick is taller (projection nods yellow). */}
        <div aria-hidden style={{ display: "flex", gap: 3, alignItems: "flex-end", height: 16, marginTop: projection ? 14 : 12 }}>
          {Array.from({ length: TICK_COUNT }, (_, i) => {
            const isHead = !isDone && i === doneTicks;
            const filled = i < doneTicks || isDone;
            return (
              <span
                key={i}
                style={{
                  flex: 1,
                  height: isHead ? 16 : 9,
                  background: filled ? token.colorPrimary : isHead ? (projection ? SUB_YELLOW : token.colorPrimary) : token.colorFillSecondary,
                  opacity: filled || isHead ? 1 : undefined,
                  transition: "background 0.25s ease, height 0.25s ease",
                }}
              />
            );
          })}
        </div>

        {/* Status line */}
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

        <Text type="secondary" style={{ fontSize: 12, marginTop: 4 }}>
          {t("pleaseWait")}
        </Text>
      </div>
    </Modal>
  );
};

export default TranslationProgressModal;
