import { test, expect } from "vitest";
import { parseCues, replaceCueText } from "./subtitleCues";

// 裸秒 SRT 变体(0.00 --> 29.98):对照面板源侧直接吃原始 sourceText,
// parseCues 入口必须自己归一化,否则源 cue 全部丢失、源/译面板错位。
const BARE_SECONDS_SRT = `1
0.00 --> 29.98
ミク

2
30.00 --> 59.98
ミク

3
60.00 --> 89.98
ミク
`;

test("parseCues reads bare-seconds SRT with normalized ms timings", () => {
  const cues = parseCues(BARE_SECONDS_SRT, "srt");
  expect(cues).toHaveLength(3);
  expect(cues[0]).toMatchObject({ index: 1, startMs: 0, endMs: 29_980, text: "ミク" });
  expect(cues[1]).toMatchObject({ index: 2, startMs: 30_000, endMs: 59_980 });
  // 分钟进位:60s → 00:01:00,000
  expect(cues[2]).toMatchObject({ index: 3, startMs: 60_000, endMs: 89_980 });
});

test("replaceCueText round-trips bare-seconds SRT on normalized timecodes", () => {
  const edits = new Map([[2, "未来"]]);
  const out = replaceCueText(BARE_SECONDS_SRT, "srt", edits);
  expect(out).toContain("00:00:30,000 --> 00:00:59,980\n未来");
  // 未编辑的 cue 原文保留,时间码全部标准化
  expect((out.match(/ミク/g) ?? []).length >= 2).toBe(true);
  expect(out).not.toContain("0.00 -->");
});

test("parseCues reads MM:SS (no milliseconds) SRT and fills .000", () => {
  const text = `1
00:30 --> 01:00
ミク

2
1:01:00 --> 1:01:02
未来
`;
  const cues = parseCues(text, "srt");
  expect(cues).toHaveLength(2);
  expect(cues[0]).toMatchObject({ startMs: 30_000, endMs: 60_000, text: "ミク" });
  expect(cues[1]).toMatchObject({ startMs: 3_660_000, endMs: 3_662_000, text: "未来" });
});

test("standard SRT still parses (reverse direction)", () => {
  const standard = `1
00:00:01,000 --> 00:00:03,000
Hello

2
00:00:04,000 --> 00:00:06,000
World
`;
  const cues = parseCues(standard, "srt");
  expect(cues).toHaveLength(2);
  expect(cues[0]).toMatchObject({ startMs: 1000, endMs: 3000, text: "Hello" });
});
