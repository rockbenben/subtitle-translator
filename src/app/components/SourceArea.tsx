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
}

/**
 * Input-side mirror of ResultCard's TextArea + stats footer. When stats.isTooLong
 * triggers, the TextArea switches to displayText + readOnly; StatsFooter shows
 * 只读模式 hint alongside the char/line counters — same affordance the user
 * already sees on the result side.
 */
const SourceArea = ({ sourceText, setSourceText, stats, placeholder, ariaLabel, rows = 8, className }: SourceAreaProps) => {
  return (
    <>
      <TextArea
        placeholder={placeholder}
        value={stats.isEditable ? sourceText : stats.displayText}
        onChange={stats.isEditable ? (e) => setSourceText(e.target.value) : undefined}
        rows={rows}
        allowClear
        readOnly={!stats.isEditable}
        aria-label={ariaLabel}
        className={className}
      />
      {sourceText && <StatsFooter charCount={stats.charCount} lineCount={stats.lineCount} isReadOnly={!stats.isEditable} />}
    </>
  );
};

export default SourceArea;
