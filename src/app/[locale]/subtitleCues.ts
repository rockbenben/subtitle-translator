// 带时间轴的 cue 模型 + 译文回写纯函数层(对照校对面板的底层)。
//
// 设计:cue 解析【复用】filterSubLines 的全部边界处理(cue id、NOTE/STYLE
// 块、紧凑 SRT 序号递增、HLS 头、VTT 内联标签剥离),再按【时间码行号】分组
// (findTimeLineIndexBefore,同 buildAssBilingualBody —— 行号唯一,避免逐字节
// 相同的时间码把两个独立 cue 错误合并)。不重写一套字幕解析。
//
// 与翻译流程解耦:输入是【已生成的字幕文本 + 格式】。parseCues 只读分析,
// replaceCueText 把编辑后的译文按 cue index 写回(保留时间码/序号/结构)。
// 两者共用 groupTimedCues / 同一 Dialogue 顺序,index 严格对齐。
// LRC(歌词,无可靠 end 时间)走行级的 parseReviewTexts / replaceReviewText。

import { splitTextIntoLines } from "@/app/utils";
import { filterSubLines, findTimeLineIndexBefore, VTT_SRT_TIME, SBV_TIME_REGEX, TIME_ARROW_SPLIT } from "./subtitleUtils";

export interface SubtitleCue {
  /** 1-based 展示序号(按出现顺序重排,与源文件 cue 序号无关) */
  index: number;
  startMs: number;
  endMs: number;
  /** 去格式标签后的 cue 文本,多行用 \n 连接 */
  text: string;
}

// SRT/VTT/SBV 时间码 → ms。小数部分是【毫秒】(右补零到 3 位):
// ".5" = 500ms,".78" = 780ms,".783" = 783ms。小时可省(VTT)或两位(SRT)。
const SRT_VTT_TIME = /^(?:(\d+):)?(\d{1,2}):(\d{2})[,.](\d{1,3})$/;
export const parseSrtVttTimeToMs = (tc: string): number | null => {
  const m = tc.trim().match(SRT_VTT_TIME);
  if (!m) return null;
  const [, h, mm, ss, frac] = m;
  const ms = Number(frac.padEnd(3, "0").slice(0, 3));
  return ((Number(h || "0") * 60 + Number(mm)) * 60 + Number(ss)) * 1000 + ms;
};

// ASS 时间码 H:MM:SS.cc → ms。小数部分是【厘秒】(右补零到 2 位再 ×10):
// ".5" = 500ms,".78" = 780ms —— 与 SRT/VTT 的毫秒语义不同,不能共用。
const ASS_TIME = /^(\d+):(\d{2}):(\d{2})[.,](\d{1,2})$/;
export const parseAssTimeToMs = (tc: string): number | null => {
  const m = tc.trim().match(ASS_TIME);
  if (!m) return null;
  const [, h, mm, ss, cs] = m;
  const ms = Number(cs.padEnd(2, "0").slice(0, 2)) * 10;
  return ((Number(h) * 60 + Number(mm)) * 60 + Number(ss)) * 1000 + ms;
};

const ASS_ALL_TAGS = /\{[^}]*\}/g;
const ASS_NEWLINE = /\\[Nn]/g;

/** 时间行 → [start, end] 原始时间码字符串(剥离 VTT cue settings) */
const splitTimeLine = (timeLine: string, format: string): [string, string] => {
  if (format === "sbv") {
    const [s, e] = timeLine.split(",");
    return [(s ?? "").trim(), (e ?? "").trim()];
  }
  const parts = timeLine.split(TIME_ARROW_SPLIT);
  // VTT end 可带 settings(align:start position:0%)—— 取箭头两侧第一个 token
  const start = (parts[0] ?? "").trim().split(/\s/)[0];
  const end = (parts[1] ?? "").trim().split(/\s/)[0];
  return [start, end];
};

/**
 * srt / vtt / sbv:filterSubLines 提内容行 + 按时间码行号分组。
 * 返回每个 cue 的时间行、内容行【在 lines 里的行号】、内容文本(按插入顺序)。
 * parseTimedCues(解析)与 replaceCueText(回写)共用,保证 cue 顺序/index 一致。
 */
interface TimedGroup {
  timeLine: string;
  /** 该 cue 的内容行在 lines 数组里的行号 */
  lineIdxs: number[];
  texts: string[];
}
const groupTimedCues = (lines: string[], format: string): TimedGroup[] => {
  const { contentLines, contentIndices } = filterSubLines(lines, format);
  const timeRegex = format === "sbv" ? SBV_TIME_REGEX : VTT_SRT_TIME;

  // 行号唯一(同 buildAssBilingualBody):同一物理 cue 的多行内容聚合,
  // 时间码逐字节相同的两个独立 cue 不会被错误合并。Map 保留插入顺序。
  const groups = new Map<number, TimedGroup>();
  contentIndices.forEach((idx, i) => {
    const tIdx = findTimeLineIndexBefore(lines, idx, timeRegex);
    if (tIdx === -1) return;
    const existing = groups.get(tIdx);
    if (existing) {
      existing.lineIdxs.push(idx);
      existing.texts.push(contentLines[i]);
    } else {
      groups.set(tIdx, { timeLine: lines[tIdx].trim(), lineIdxs: [idx], texts: [contentLines[i]] });
    }
  });
  return [...groups.values()];
};

const parseTimedCues = (lines: string[], format: string): SubtitleCue[] => {
  const cues: SubtitleCue[] = [];
  let n = 0;
  for (const { timeLine, texts } of groupTimedCues(lines, format)) {
    const [startRaw, endRaw] = splitTimeLine(timeLine, format);
    const startMs = parseSrtVttTimeToMs(startRaw);
    const endMs = parseSrtVttTimeToMs(endRaw);
    if (startMs === null || endMs === null) continue;
    cues.push({ index: ++n, startMs, endMs, text: texts.join("\n") });
  }
  return cues;
};

/** ass:Dialogue 行直接 split(时间在行内,非独立时间行) */
const parseAssCues = (lines: string[]): SubtitleCue[] => {
  // assContentStartIndex = Text 字段起始列(format 行逗号数;默认 9)
  const { assContentStartIndex } = filterSubLines(lines, "ass");
  const cues: SubtitleCue[] = [];
  let n = 0;
  for (const line of lines) {
    if (!/^dialogue:/i.test(line.trim())) continue;
    const parts = line.split(",");
    if (parts.length <= assContentStartIndex) continue;
    // ASS Dialogue: Layer(0),Start(1),End(2),Style(3),...,Text(assContentStartIndex+)
    const startMs = parseAssTimeToMs(parts[1] ?? "");
    const endMs = parseAssTimeToMs(parts[2] ?? "");
    if (startMs === null || endMs === null) continue;
    const text = parts.slice(assContentStartIndex).join(",").trim().replace(ASS_ALL_TAGS, "").replace(ASS_NEWLINE, "\n").trim();
    if (text === "") continue;
    cues.push({ index: ++n, startMs, endMs, text });
  }
  return cues;
};

/**
 * 解析字幕文本为带时间轴的 cue 数组。支持 srt / vtt / sbv / ass。
 * lrc 及未知格式返回 [](歌词无可靠 end 时间,字幕规范不适用)。
 */
export const parseCues = (text: string, format: string): SubtitleCue[] => {
  if (!text.trim()) return [];
  const lines = splitTextIntoLines(text);
  // SSA(v4.00)与 ASS 共用管线;调用方传的 format 可能是【物理扩展名】
  // (translatedTextExt,.ssa 源回写 .ssa)—— 不归一的话 .ssa 文件的对照
  // 校对面板永不渲染,而同内容粘贴(无扩展名,检测为 ass)又正常,行为自相矛盾。
  if (format === "ass" || format === "ssa") return parseAssCues(lines);
  if (format === "srt" || format === "vtt" || format === "sbv") return parseTimedCues(lines, format);
  return [];
};

// ─── 译文回写(对照校对编辑后导出)────────────────────────────────────────

/** srt / vtt / sbv:把第 n 个 cue 的内容行替换为新文本(首行位置放全部新行,
 *  其余原内容行删除);时间码/序号/空行保留。index 与 parseCues 严格对齐。 */
const replaceTimedCueText = (lines: string[], format: string, newTextByIndex: Map<number, string>): string => {
  const replaceByFirst = new Map<number, string[]>();
  const removeLines = new Set<number>();
  let n = 0;
  for (const { timeLine, lineIdxs } of groupTimedCues(lines, format)) {
    const [s, e] = splitTimeLine(timeLine, format);
    if (parseSrtVttTimeToMs(s) === null || parseSrtVttTimeToMs(e) === null) continue; // 同 parseTimedCues 跳过
    n++;
    const nt = newTextByIndex.get(n);
    if (nt === undefined) continue;
    replaceByFirst.set(lineIdxs[0], nt.split("\n"));
    for (const li of lineIdxs.slice(1)) removeLines.add(li);
  }
  const out: string[] = [];
  lines.forEach((line, idx) => {
    const rep = replaceByFirst.get(idx);
    if (rep) out.push(...rep);
    else if (!removeLines.has(idx)) out.push(line);
  });
  return out.join("\n");
};

/** ass:替换 Dialogue 的 Text 字段(真实换行转回 \N,保留前缀字段)。 */
const replaceAssCueText = (lines: string[], newTextByIndex: Map<number, string>): string => {
  const { assContentStartIndex } = filterSubLines(lines, "ass");
  let n = 0;
  return lines
    .map((line) => {
      if (!/^dialogue:/i.test(line.trim())) return line;
      const parts = line.split(",");
      if (parts.length <= assContentStartIndex) return line;
      if (parseAssTimeToMs(parts[1] ?? "") === null || parseAssTimeToMs(parts[2] ?? "") === null) return line;
      const text = parts.slice(assContentStartIndex).join(",").trim().replace(ASS_ALL_TAGS, "").replace(ASS_NEWLINE, "\n").trim();
      if (text === "") return line; // 同 parseAssCues 跳过,保持 index 对齐
      n++;
      const nt = newTextByIndex.get(n);
      if (nt === undefined) return line;
      return [...parts.slice(0, assContentStartIndex), nt.replace(/\n/g, "\\N")].join(",");
    })
    .join("\n");
};

/**
 * 把编辑后的译文按 cue index(parseCues 的 1-based index)写回字幕,保留时间码/
 * 序号/空行/结构。newTextByIndex 里没有的 index 保持原文。lrc/未知格式原样返回。
 */
export const replaceCueText = (text: string, format: string, newTextByIndex: Map<number, string>): string => {
  if (!text.trim()) return text;
  const lines = splitTextIntoLines(text);
  // ssa 归一同 parseCues —— 只归一 parse 不归一写回的话,.ssa 面板能渲染但
  // 「应用并下载」原样返回未编辑的译文。
  if (format === "ass" || format === "ssa") return replaceAssCueText(lines, newTextByIndex);
  if (format === "srt" || format === "vtt" || format === "sbv") return replaceTimedCueText(lines, format, newTextByIndex);
  return text;
};

// ─── 对照校对行(行级视图,含 lrc)──────────────────────────────────────────

// LRC 行首时间标签串(可多个,卡拉 OK 行):写回时保留为前缀
const LRC_LEADING_TAGS = /^\s*(?:\[\d{2}:\d{2}(?:\.\d{2,3})?\])*/;

/**
 * 对照校对的行单位。lrc 无可靠 end 时间(不入质检/时间轴),但「行序 ↔ 文本」
 * 对照照样成立 —— 用 filterSubLines 的内容行(已剥时间标签)做行级视图;
 * timed 格式(srt/vtt/sbv/ass)复用 parseCues,index 语义一致(1-based 顺序)。
 */
export const parseReviewTexts = (text: string, format: string): string[] => {
  if (format !== "lrc") return parseCues(text, format).map((c) => c.text);
  if (!text.trim()) return [];
  return filterSubLines(splitTextIntoLines(text), "lrc").contentLines;
};

/**
 * 对照校对写回。timed 格式走 replaceCueText;lrc 保留行首时间标签前缀、
 * 替换其后内容(真实换行压成空格 —— LRC 无多行 cue)。index 与
 * parseReviewTexts 严格对齐。
 */
export const replaceReviewText = (text: string, format: string, newTextByIndex: Map<number, string>): string => {
  if (format !== "lrc") return replaceCueText(text, format, newTextByIndex);
  if (!text.trim()) return text;
  const lines = splitTextIntoLines(text);
  const { contentIndices } = filterSubLines(lines, "lrc");
  contentIndices.forEach((lineIdx, i) => {
    const nt = newTextByIndex.get(i + 1);
    if (nt === undefined) return;
    const prefix = (lines[lineIdx].match(LRC_LEADING_TAGS)?.[0] ?? "").trimStart();
    const body = nt.replace(/\n/g, " ").trim();
    lines[lineIdx] = prefix ? `${prefix} ${body}` : body;
  });
  return lines.join("\n");
};

