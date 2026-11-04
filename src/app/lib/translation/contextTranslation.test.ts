import { test, expect } from "vitest";
import { extractTranslatedLinesWithNumbers, extractTaggedSingleLine, wrapTranslateTaggedLine } from "./contextTranslation";

// #68:单行重试改走标记格式后,模型以对话体闲聊回复(短祈使句在它眼里像一句
// 聊天)必须被判为提取失败(空串),交回既有的缺口/软填/重试机制兜住 ——
// 而不是整段被当作译文写进字幕。
const CHAT_PROSE = "I'm sorry, but I don't see any SRT file content in your message. Could you please share the subtitles you'd like translated?";

test("untagged chat-style prose extracts as empty for a single-line retry", () => {
  expect(extractTranslatedLinesWithNumbers(CHAT_PROSE, 1, ["Don't mess around"])).toEqual([""]);
});

test("properly tagged single-line response extracts the translation", () => {
  expect(extractTranslatedLinesWithNumbers("[TRANSLATE_0]别乱来[/TRANSLATE_0]", 1, ["Don't mess around"])).toEqual(["别乱来"]);
});

test("wrapTranslateTaggedLine wraps with index 0 by default", () => {
  expect(wrapTranslateTaggedLine("Don't mess around")).toBe("[TRANSLATE_0]Don't mess around[/TRANSLATE_0]");
  expect(wrapTranslateTaggedLine("Hello", 3)).toBe("[TRANSLATE_3]Hello[/TRANSLATE_3]");
});

test("extractTaggedSingleLine keeps the tagged translation and flattens newlines", () => {
  expect(extractTaggedSingleLine("[TRANSLATE_0]别乱来[/TRANSLATE_0]", "Don't mess around")).toBe("别乱来");
  // 换行拍平成空格,同 chunk 营救:单行译文里混进换行会破坏逐行装配。
  expect(extractTaggedSingleLine("[TRANSLATE_0]好的\n行[/TRANSLATE_0]", "OK")).toBe("好的 行");
});

test("extractTaggedSingleLine discards tagless prose and whitespace-only tags", () => {
  expect(extractTaggedSingleLine(CHAT_PROSE, "Don't mess around")).toBe("");
  expect(extractTaggedSingleLine("[TRANSLATE_0]   [/TRANSLATE_0]", "Don't mess around")).toBe("");
});
