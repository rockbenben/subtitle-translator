// 统一换行符为 \n（将 Windows 的 \r\n 和旧 Mac 的 \r 规范为 \n），对已为 \n 的内容不做多余替换
export const normalizeNewlines = (text: string): string => (text.includes("\r") ? text.replace(/\r\n?/g, "\n") : text);

interface SplitOptions {
  removeEmptyLines?: boolean; // 如果为 true, 将移除结果数组中的所有严格空字符串行 ("")
}
export const splitTextIntoLines = (text: string, options: SplitOptions = {}): string[] => {
  if (!text) {
    return [];
  }
  // 先统一换行符，避免在此处重复书写换行正则
  const normalized = normalizeNewlines(text);
  let lines = normalized.split("\n");
  // 现在这里的 options 永远不会是 undefined，代码是安全的
  if (options.removeEmptyLines) {
    lines = lines.filter(Boolean);
  }
  return lines;
};

// 过滤掉只包含空白的行，并根据 shouldTrim 参数决定是否去掉每行的首尾空白
export const cleanLines = (text: string, shouldTrim: boolean = false): string[] =>
  splitTextIntoLines(text)
    .filter((line) => line.trim())
    .map((line) => (shouldTrim ? line.trim() : line));

// 截断字符串到指定长度，默认长度为 100K
const MAX_DISPLAY_LENGTH = 100000;
export const truncate = (str: string, num: number = MAX_DISPLAY_LENGTH): string => (str.length <= num ? str : `${str.slice(0, num)}...`);

// 中文段落分割处理
const splitCNParagraph = (text: string) => {
  const paragraphCNSplitRegex =
    /(如下：(?!\\n)|[^\\n“”][。；！？]”?\\b(?=[\\w･&&[^\\d]]{2,11}：[^\\n“])|(?:\\w」?；)(?=[^\\n“”：；]{14})|(?<=\\w：“[^\\n“”]{1,39}[。！？—…]”)(?=[^\\n“”：；]{1,39}：“)|(?:[^\\n【】]】)(?=【\\w{1,7}：)|(?:\\w[：；。！？]{1,2}[”]?)(?=[第其][一二三四五六七八九][，、]|[一二三四五六七八九][则来是者]?[，、]|[①-⓿][^\\n]|（[^\\n（）]{17,29}[。！？…]）\\n)|(?:[^\\n“”][。！？—…]”)(?:[\\u4e00-\\u9fa5]{1,14}[说道]。)?(?=“[^\\n“”])|(?<=[^\\n]{4})(?:[^\\n]{24}[。！？—…][』”’】］）]?)(?=[^\\n]{29})(?<![。！？—…]\\w{1,4}[！？…]{1,2})(?![、，。：；！？—…]|(?<=(\\w{1,3})……)\\2|(?<=[—…”])[^“”。：；！？—…]{1,14}[。：；！？—…]|(?<=……)(?:[等略]|以?及|的[^的确士])|(?<=[』”’】］）])[的地]))(?<!“[^\\n”]{1,34}|‘[^\\n’]{1,34}|「[^\\n」]{1,34}|『[^\\n』]{1,34}|（[^\\n）]{1,34}|【[^\\n】]{1,34}|［[^\\n］]{1,34})(?![^\\n“]{0,34}”|[^\\n‘]{0,34}’|[^\\n「]{0,34}」|[^\\n『]{0,34}』|[^\\n（]{0,34}）|[^\\n【]{0,34}】|[^\\n［]{0,34}］)/g;
  return text.replace(paragraphCNSplitRegex, "$1\n");
};

// 智能英文段落分割
const splitEnglishParagraph = async (text: string): Promise<string> => {
  const nlp = (await import("compromise")).default;
  return nlp(text).sentences().out("array").join("\n");
};

type ParagraphSplitMethod = "cn" | "en";
export const splitParagraph = async (text: string, method: ParagraphSplitMethod = "cn"): Promise<string> => {
  switch (method) {
    case "cn":
      return splitCNParagraph(text);
    case "en":
      return await splitEnglishParagraph(text);
  }
};

// 将字符串中的全角数字和字母转为半角
export const toHalfWidth = (text: string): string => text.replace(/[０-９Ａ-Ｚａ-ｚ]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 65248));

// 过滤文本中的行；filters 可为逗号分隔字符串或字符串数组
export const filterLines = (text: string, filters: string | string[], maxLen?: number): string => {
  const list = Array.isArray(filters)
    ? filters
    : filters
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
  return splitTextIntoLines(text)
    .filter((line) => {
      if (maxLen !== undefined && line.trim().length > maxLen) return true;
      return !list.some((f) => f && line.includes(f));
    })
    .join("\n");
};

// 移除相邻重复行（比较时会 trim）
export const removeAdjacentDuplicateLines = (lines: string[]): string[] => {
  if (lines.length === 0) return lines;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i].trim();
    const prev = i > 0 ? lines[i - 1].trim() : "";
    if (i === 0 || cur !== prev) out.push(lines[i]);
  }
  return out;
};

// 通用：移除所有重复行（非相邻去重），支持 trim 比较与排除集合
export interface DedupeOptions {
  trim?: boolean;
  exclude?: Iterable<string>;
}
export const dedupeLines = (lines: string[], options: DedupeOptions = {}): string[] => {
  const { trim = true, exclude } = options;
  const excludeSet = exclude ? new Set(exclude) : undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const line of lines) {
    const key = trim ? line.trim() : line;
    if (excludeSet && excludeSet.has(key)) continue;
    if (!seen.has(key)) {
      seen.add(key);
      out.push(line);
    }
  }
  return out;
};

// Cache for compressNewlines regexes to avoid recompilation
const compressNewlinesRegexCache = new Map<number, RegExp>();

// 压缩连续换行符，默认将 3 个及以上换行压缩为 2 个
export const compressNewlines = (text: string, maxConsecutive: number = 2): string => {
  if (maxConsecutive < 1) return text.replace(/\n+/g, "\n");

  let re = compressNewlinesRegexCache.get(maxConsecutive);
  if (!re) {
    re = new RegExp(`\\n{${maxConsecutive + 1},}`, "g");
    compressNewlinesRegexCache.set(maxConsecutive, re);
  }

  return text.replace(re, "\n".repeat(maxConsecutive));
};

//将空格分隔的字符串解析为数组（不处理转义字符）
export const splitBySpaces = (input: string): string[] => {
  if (!input || !input.trim()) return [];
  return input
    .trim()
    .split(/\s+/)
    .filter((item) => item.length > 0);
};

/**
 * 解析用户输入的转义字符，将字符串中的转义序列转换为实际字符
 * 支持的转义字符: \n(换行), \r(回车), \t(制表符), \s(空格), \\(反斜杠)
 */
const parseEscapeChars = (str: string): string => {
  return str
    .replace(/\\n/g, "\n") // 换行
    .replace(/\\r/g, "\r") // 回车
    .replace(/\\t/g, "\t") // 制表符
    .replace(/\\s/g, " ") // 空格
    .replace(/\\\\/g, "\\"); // 反斜杠（必须放在最后）
};

// 将空格分隔的字符串解析为数组，并处理转义字符
export const parseSpaceSeparatedItems = (input: string): string[] => {
  const items = splitBySpaces(input);
  // 处理每个项的转义字符
  return items.map((item) => parseEscapeChars(item));
};
