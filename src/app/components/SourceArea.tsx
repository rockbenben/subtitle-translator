"use client";

import { Input } from "antd";
import StatsFooter from "@/app/components/StatsFooter";

const { TextArea } = Input;

/** Subset of useTextStats return value that SourceArea consumes. */
interface TextStats {
  charCount: string;
  lineCount: string;
  isTooLong: boolean;
  displayText: string;
  isEditable: boolean;
}

interface SourceAreaProps {
  /** Source text state value. */
  sourceText: string;
  /** Callback that receives the new text on edit. */
  setSourceText: (value: string) => void;
  /** useTextStats result for the same sourceText. SourceArea auto-handles isTooLong (read-only + truncated displayText + 只读模式 hint). */
  stats: TextStats;
  placeholder?: string;
  ariaLabel?: string;
  rows?: number;
  className?: string;
  /**
   * 翻译进行中锁住编辑。用 readOnly 而非 disabled:当前轮跑在点击那一刻的源文
   * 快照上,运行中改源会让「新源文 + 旧译文」错配着落进结果区和导出文件 ——
   * 但用户此时正需要照着源文看进度,所以留下可读可选可滚,只关掉写入。
   */
  locked?: boolean;
}

/**
 * Input-side mirror of ResultCard's TextArea + stats footer. When stats.isTooLong
 * triggers, the TextArea switches to displayText + readOnly; StatsFooter shows
 * 只读模式 hint alongside the char/line counters — same affordance the user
 * already sees on the result side.
 */
const SourceArea = ({ sourceText, setSourceText, stats, placeholder, ariaLabel, rows = 8, className, locked = false }: SourceAreaProps) => {
  const editable = stats.isEditable && !locked;
  return (
    <>
      <TextArea
        placeholder={placeholder}
        value={stats.isEditable ? sourceText : stats.displayText}
        onChange={editable ? (e) => setSourceText(e.target.value) : undefined}
        rows={rows}
        // allowClear 的 ✕ 走的也是 onChange —— 锁上时一并撤掉,免得留一个看着能点的清空入口
        allowClear={editable}
        readOnly={!editable}
        aria-label={ariaLabel}
        className={className}
      />
      {sourceText && <StatsFooter charCount={stats.charCount} lineCount={stats.lineCount} isReadOnly={!stats.isEditable} />}
    </>
  );
};

export default SourceArea;
