"use client";

import React from "react";
import { theme } from "antd";

interface SectionProps {
  /** Inline override (last write wins). */
  style?: React.CSSProperties;
  /** Drops the default marginBottom. Useful when nesting inside Flex gap. */
  noGap?: boolean;
  className?: string;
  children: React.ReactNode;
}

/**
 * Block Section — the project's universal "grouped fields" container (design-system A1):
 * transparent bg + colorBorderSecondary border + paddingSM + borderRadiusLG. No nested Cards,
 * no extra shadows. 带状态色的块(已连接 / 警告 / 已启用)是状态反馈,各自就地画:
 * ApiStatusBlock / ContextTranslationBlock / TranslationProgressStrip。
 */
export const Section = ({ style, noGap, className, children }: SectionProps) => {
  const { token } = theme.useToken();
  return (
    <section
      className={className}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
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
