"use client";

import React from "react";
import { Card, theme } from "antd";
import type { CardProps } from "antd";

/**
 * PageCard — project Card wrapper that applies token.boxShadowTertiary.
 *
 * Axiom A3 (token-only): Cards use AntD elevation tokens, not Tailwind
 * shadow utilities. This wrapper enforces consistent elevation across
 * Upload / Settings / Result cards without the `shadow-md border-transparent
 * hover:shadow-lg transition-shadow duration-300` Tailwind cocktail that
 * mixed design systems.
 *
 * Caller styles are merged last (can override). Leave `style` unset to use
 * the default token elevation.
 */
export const PageCard = ({ style, ...rest }: CardProps) => {
  const { token } = theme.useToken();
  return <Card style={{ boxShadow: token.boxShadowTertiary, ...style }} {...rest} />;
};

export default PageCard;
