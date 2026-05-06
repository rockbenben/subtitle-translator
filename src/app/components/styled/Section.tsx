"use client";

import React from "react";
import { theme } from "antd";

type Variant = "neutral" | "success" | "warning" | "error" | "primary";

interface SectionProps {
  /**
   * Color semantic. Only use colored variants for **state feedback** (API
   * connected / warning / error / feature enabled). Default "neutral" is
   * transparent bg + subtle border — used for any grouped-fields container.
   *
   * Never pick "success" for "user hasn't tested yet" — that would promise
   * something that might not hold. See ApiStatusBlock for the correct model.
   */
  variant?: Variant;
  /** Inline override (last write wins — prefer `variant` when possible). */
  style?: React.CSSProperties;
  /** Drops the default marginBottom. Useful when nesting inside Flex gap. */
  noGap?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Block Section — the project's universal "grouped fields" container.
 *
 * Axiom A1 (block pattern): every grouped field set uses this — transparent
 * bg + colorBorderSecondary border + paddingSM + borderRadiusLG. No nested
 * Cards, no extra shadows.
 *
 * Axiom A2 (stateful bg): colored backgrounds only for actual state signals.
 * Default to `variant="neutral"`; only pick colored variants when the block
 * conveys a live state the user can verify (tested = success, needs input =
 * warning, failed = error, enabled LLM feature = primary).
 */
export const Section = ({ variant = "neutral", style, noGap, className, children }: SectionProps) => {
  const { token } = theme.useToken();

  const palette: Record<Variant, { bg: string; border: string }> = {
    neutral: { bg: "transparent", border: token.colorBorderSecondary },
    success: { bg: token.colorSuccessBg, border: token.colorSuccessBorder },
    warning: { bg: token.colorWarningBg, border: token.colorWarningBorder },
    error: { bg: token.colorErrorBg, border: token.colorErrorBorder },
    primary: { bg: token.colorPrimaryBg, border: token.colorPrimaryBorder },
  };

  const { bg, border } = palette[variant];

  return (
    <section
      className={className}
      style={{
        background: bg,
        border: `1px solid ${border}`,
        borderRadius: token.borderRadiusLG,
        padding: token.paddingSM,
        marginBottom: noGap ? 0 : token.marginSM,
        ...style,
      }}>
      {children}
    </section>
  );
};

export default Section;
