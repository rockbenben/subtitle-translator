// 软填(保留原文)槽位的译后加工规则 —— 网页组件与 CLI handler 共用同一份。
//
// 背景:一行翻译失败时,pipeline 会把【未翻译的原文】填进那个槽位,并在
// FailedLine.index 里记下它的下标。界面与 CLI 都会当场承诺「失败的行已保留
// 原文」。所以任何译后加工(removeChars 是目前唯一的一种)都必须跳过这些槽位
// —— 加工它们会产出既非原文也非译文的东西,把刚做出的承诺当场推翻。
//
// 为什么要抽出来:这个「跳过」惯用法曾在五处逐字复制(字幕 handler / JSON
// handler / md-raw handler / SubtitleTranslator / MDTranslator)。CLAUDE.md 的
// CLI 一节明写 handler「只做参数搬运,不要复制装配逻辑,两边行为漂移是这套设计
// 首要避免的问题」。规则一旦要改(比如改成逐片段而非逐行),五处漏一处,网页端
// 与 CLI 就对「哪些行被清理」产生分歧,而这种分歧只会在用户的产物里显形。

/** FailedLine[] → 软填槽位下标集合。`index` 缺失的记录(无位置信息)自然被忽略。 */
export const softFilledIndices = (outcome: { failures: Array<{ index?: number }> }): Set<number> =>
  new Set(outcome.failures.map((f) => f.index).filter((i): i is number => i !== undefined));

/**
 * 整批变换(applyRemoveCharsToLines 这类接收/返回数组的),软填槽位原样保留。
 * 变换仍作用于【整个数组】再逐位挑选 —— 有些实现依赖上下文,不能只喂子集。
 */
export const transformSkippingSoftFilled = (lines: string[], softFilled: Set<number>, transform: (all: string[]) => string[]): string[] => {
  if (softFilled.size === 0) return transform(lines);
  const all = transform(lines);
  return lines.map((raw, i) => (softFilled.has(i) ? raw : all[i]));
};

/** 逐行变换(applyRemoveCharsToMarkdown 这类接收/返回单行的),软填槽位原样保留。 */
export const mapSkippingSoftFilled = (lines: string[], softFilled: Set<number>, transform: (line: string) => string): string[] =>
  lines.map((line, i) => (softFilled.has(i) ? line : transform(line)));
