"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Progress + abort state for a single translation run.
 *
 * `abortControllerRef` is shared across all concurrent translate calls in a
 * run so one auth failure (or user cancel) can tear them all down at once.
 * `makeUpdateProgress` builds a progress callback scoped to a specific file
 * slice within a multi-file translation, normalizing fractional/overflowing
 * progress into a clean {percent, current, total} pair.
 */
export const useTranslationProgress = () => {
  const [isTranslating, setIsTranslating] = useState(false);
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressInfo, setProgressInfo] = useState<{ current: number; total: number }>({ current: 0, total: 0 });
  const abortControllerRef = useRef<AbortController | null>(null);

  // Provider 卸载(进行中浏览器后退/换页)后,运行结果再也无处投递,但翻译
  // 循环全靠闭包自持,会headless 跑完剩余批次/语言/文件 —— 真实 API 配额
  // 持续燃烧,且 message toast 还会弹在用户切去的页面上。卸载时:中止当前
  // run 的 controller(杀掉在飞请求 + 让批任务的 signal 检查短路),并立
  // disposed 旗标(让 translateSingle / translateBatch 拒绝开启后续语言/
  // 文件的新 run —— 它们各自新建 controller,单靠 abort 拦不住)。
  // effect 体里复位 false:StrictMode 开发态的 mount→cleanup→mount 周期
  // 保留同一 ref,不复位会把重挂载后的所有翻译永久拒之门外。
  const disposedRef = useRef(false);
  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      // 此处必须读【卸载时刻】的最新 controller(每次 translateBatch 都换新);
      // 按 lint 建议在 effect 体内拷贝只会拿到 mount 时的 null。
      // eslint-disable-next-line react-hooks/exhaustive-deps
      abortControllerRef.current?.abort();
    };
  }, []);

  /**
   * Build a progress-updater for one file within a multi-file batch.
   * `fileIndex` / `totalFiles` map per-file [0..1] into the global progress bar.
   */
  const makeUpdateProgress =
    (fileIndex: number = 0, totalFiles: number = 1) =>
    (current: number, total: number) => {
      const progress = ((fileIndex + current / total) / totalFiles) * 100;
      setProgressPercent(progress);
      // `current` can be fractional (e.g. 0.5 kick value to avoid a 0% stall) — floor it for display.
      setProgressInfo({ current: Math.min(Math.floor(current), total), total });
    };

  const resetProgress = () => {
    setProgressPercent(0);
    setProgressInfo({ current: 0, total: 0 });
  };

  return {
    isTranslating,
    setIsTranslating,
    progressPercent,
    setProgressPercent,
    progressInfo,
    setProgressInfo,
    abortControllerRef,
    disposedRef,
    makeUpdateProgress,
    resetProgress,
  };
};
