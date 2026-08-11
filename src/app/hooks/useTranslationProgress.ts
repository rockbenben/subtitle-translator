"use client";

import { useEffect, useRef, useState } from "react";
import type { LineTranslatedEvent } from "@/app/lib/translation/pipeline";

/** A single live line in the streaming results list. */
export interface LiveLine {
  index: number;
  original: string;
  translation: string;
  failed: boolean;
}

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

  // ─── 实时逐行结果(与进度条并行的第二通道)──────────────────────────────
  // 每一行译完立即上屏,不等整批结束(LLM 上下文批一条 20-60s,逐行批一条
  // ~200ms)。只记录【本批】的 event 流;失败的线不在这里呈现 —— 失败面板
  // 是它们的统一出口,这里混入"原文副本"只会让用户以为译出了。
  // 有序追加(Set + 数组而非 Map):run 以行序发射(线路径下标严格递增;上下文
  // 批在批次内自增),Set 天然去重跨通道重复(替换重试同槽)。文档变化/重跑
  // 由调用方 clearLiveLines 复位。
  const [liveLines, setLiveLines] = useState<LiveLine[]>([]);
  const liveLinesRef = useRef<LiveLine[]>([]);
  const livePosRef = useRef(0);
  const clearLiveLines = () => {
    liveLinesRef.current = [];
    livePosRef.current = 0;
    setLiveLines([]);
  };
  // 新行入流。同一 index 再发(替换重试 / 重复发射)时覆盖原位,其余追加。
  // ⚠ 只处理【内容】;「这一行最终没译出」的标记走 markLiveLinesFailed。
  const recordLiveLine = (result: LineTranslatedEvent) => {
    const line: LiveLine = { index: result.index, original: result.original, translation: result.translation, failed: false };
    const list = liveLinesRef.current;
    const pos = livePosRef.current;
    if (pos < list.length && list[pos].index === line.index) {
      list[pos] = line; // 替换重试同一槽 —— 覆盖而非追加
    } else {
      livePosRef.current = list.length; // 乱序(替换没有命中队尾)时收缩到队尾续写
      list.push(line);
    }
    setLiveLines([...list]);
  };
  // 把已发射的行标记为最终失败(失败面板确认这些槽位保留原文后调用)。
  // 只翻 failed 位,不动 original/translation —— 用户已经看到的内容不抹掉。
  const markLiveLinesFailed = (indices: Iterable<number>) => {
    const idx = new Set(indices);
    if (idx.size === 0) return;
    liveLinesRef.current = liveLinesRef.current.map((l) => (idx.has(l.index) ? { ...l, failed: true } : l));
    setLiveLines([...liveLinesRef.current]);
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
    liveLines,
    clearLiveLines,
    recordLiveLine,
    markLiveLinesFailed,
  };
};
