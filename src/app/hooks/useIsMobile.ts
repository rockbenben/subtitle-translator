"use client";

import { Grid } from "antd";

/**
 * Returns true on screens narrower than antd's `md` breakpoint (<768px).
 * Used to switch components between desktop and mobile-friendly layouts.
 *
 * SSR: antd Grid.useBreakpoint() returns `{}` during SSR, so `screens.md` is
 * undefined and we treat it as desktop (the more common case). On mount the
 * value updates to a real boolean; mobile users may briefly see a desktop
 * layout before re-render — acceptable for layout-only switches.
 */
export const useIsMobile = (): boolean => {
  const screens = Grid.useBreakpoint();
  return screens.md === false;
};
