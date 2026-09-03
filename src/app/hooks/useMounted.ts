"use client";

import { useSyncExternalStore } from "react";

/**
 * SSR 安全的「已挂载」判据。静态导出的 HTML 在 Node 里预渲染,首屏必须与它一致;
 * useSyncExternalStore 而非 useState+useEffect:后者会被 react-hooks/set-state-in-effect 拦下。
 */
export const useMounted = (): boolean =>
  useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
