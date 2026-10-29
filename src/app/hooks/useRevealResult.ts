"use client";

import { useEffect, useRef } from "react";

/**
 * 翻译跑完后把结果区带进视野。
 *
 * 翻译工具的结果区在进度条/失败面板之后,完成后通常落在首屏下方 —— 用户只看到
 * 「翻译完成」却看不到结果,得自己往下找。只在「刚跑完 + 有结果 + 结果不在视野内」
 * 时滚动,已经在看结果或还没出结果时不动。
 */
export const useRevealResult = (isTranslating: boolean, hasResult: boolean) => {
  const ref = useRef<HTMLDivElement>(null);
  const wasTranslating = useRef(isTranslating);

  useEffect(() => {
    const justFinished = wasTranslating.current && !isTranslating;
    wasTranslating.current = isTranslating;
    if (!justFinished || !hasResult) return;

    const frame = requestAnimationFrame(() => {
      const el = ref.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      if (rect.bottom <= 0 || rect.top >= window.innerHeight) {
        // 尊重系统「减少动态效果」：平滑滚动本身是一次大幅动画。
        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        el.scrollIntoView?.({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [isTranslating, hasResult]);

  return ref;
};
