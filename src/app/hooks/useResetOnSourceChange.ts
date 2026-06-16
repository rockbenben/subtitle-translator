"use client";

import { useState } from "react";

/**
 * 源文本变化时即时复位"源派生产物"——替代各工具各自手写的 prevSourceText 渲染期块。
 *
 * 在组件里、产物 setter 定义之后调用:
 *   useResetOnSourceChange(sourceText, () => setResult(""));
 *
 * 语义与原手写块一致:在 render 阶段比较上一次 sourceText,变化时立即调用 reset
 * （无 useEffect 延迟、无闪烁）。reset 只应复位本地 useState 产物;不要在其中 set
 * 共享 context（如 TranslationProvider 的 translatedText），那会触发 setState-in-render
 * 警告——译文这类"重结果"按既定约定改源后保留,直到重新翻译。
 */
export function useResetOnSourceChange(sourceText: string, reset: () => void) {
  const [prevSourceText, setPrevSourceText] = useState(sourceText);
  if (prevSourceText !== sourceText) {
    setPrevSourceText(sourceText);
    reset();
  }
}
