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
// maxLen：长度阈值。0、undefined、负数 均视作"未启用"（不保留超长行的豁免规则）
export const filterLines = (text: string, filters: string | string[], maxLen?: number): string => {
  const list = Array.isArray(filters)
    ? filters
    : filters
        .split(",")
        .map((w) => w.trim())
        .filter(Boolean);
  const hasMaxLen = typeof maxLen === "number" && maxLen > 0;
  return splitTextIntoLines(text)
    .filter((line) => {
      if (hasMaxLen && line.trim().length > maxLen) return true;
      return !list.some((f) => f && line.includes(f));
    })
    .join("\n");
};

// 移除相邻重复行（比较时会 trim）
export const dedupeAdjacentLines = (lines: string[]): string[] => {
  if (lines.length === 0) return lines;
  const out: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const cur = lines[i].trim();
    const prev = i > 0 ? lines[i - 1].trim() : "";
    if (i === 0 || cur !== prev) out.push(lines[i]);
  }
  return out;
};

// 整行只由句子标点（？！。…，、；：等）组成时不算分隔符——可能是正文里的反应/停顿行（？？？、……？、。。。）
const SENTENCE_PUNCT_ONLY = /^[？！。…，、；：?!.,;:]+$/u;
// 分隔行：整行仅由符号组成（≥3 个非字母/数字/空白字符，如 =====、---、***、~~~、→→→），但排除纯句子标点行 = 段落分隔，由排版步骤删掉并转成断点
export const isSeparatorBar = (s: string): boolean => {
  const t = s.trim();
  return t.length >= 3 && /^[^\p{L}\p{N}\s]+$/u.test(t) && !SENTENCE_PUNCT_ONLY.test(t);
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

// 整理从命令行 / 终端（如 Claude Code）复制出来的文本：
// 1) 去掉行首的引用竖线装饰（markdown `>`、终端块/框线竖条 ▎▌│ 等），保留竖线前的缩进；
// 2) dedent：削掉所有非空行的公共行首缩进——覆盖「无竖线、纯缩进」的 CLI 文本，同时保留代码块/嵌套列表的相对缩进；
// 3) 按段落重排：空行＝段落分隔；列表项与 ``` 围栏代码块逐行保留、不参与合并；其余连续行拼回整段；
// 4) 折行拼接：两侧都是中日韩字符时不补空格（避免「中 文」），否则补一个空格（拼回英文折行）。
const CLI_GUTTER_RE = /^([ \t]*)(?:[>▏▎▍▌▐█│┃┆┊║]\s?)+/;
// 范围含平假名/片假名(U+3040–U+30FF):漏掉它们会让日文折行在拼接点插多余空格。
const CJK_CHAR_RE = /[　-ヿ㐀-鿿豈-﫿＀-￯]/;
const LIST_ITEM_RE = /^\s*(?:[-*+]|\d+[.)])\s+/;
// markdown 表格行（以 | 开头）：与列表项同等保留整行、不并入段落。
// | 已从 CLI_GUTTER_RE 移除——否则会吃掉表格行首竖线，整张表还会被并成一段。
const TABLE_ROW_RE = /^\s*\|/;
const CODE_FENCE_RE = /^\s*```/;
// markdown 标记行：整行保留、不并入段落（否则 "## 标题" 会粘进正文，CJK 无空格粘连后不可恢复）。
// 标题：# 后必须有空格 + 实际内容（CommonMark ATX 规则；裸 "#####" 横幅不算标题，落到 BANNER）。
const HEADING_RE = /^\s*#{1,6}\s+\S/;
// 分割线/横幅：整行仅由 -*_= 与空白组成（≥3 个符号）。覆盖 markdown HR（---、***、_ _ _、- - -）
// 与 CLI 横幅（====）。必须在 LIST_ITEM 之前判断——"- - -" 否则会被 "- " 吃成列表项。
const HR_BANNER_RE = /^\s*(?:[-*_=][ \t]*){3,}$/;
// 整行粗体标签（**步骤:** 之类的 LLM 伪小标题）：行内除首尾 ** 外无其它星号，允许尾随冒号。
// 句中粗体（"the **bold** continues"）整行不匹配，仍正常参与折行合并。
const BOLD_LABEL_RE = /^\s*\*\*[^*]+\*\*[:：]?\s*$/;

const isCJKChar = (ch: string): boolean => !!ch && CJK_CHAR_RE.test(ch);

// 将同一段落的折行片段拼成一行：中日韩↔中日韩边界不补空格，其余补一个空格
const joinParagraphFragments = (fragments: string[]): string => {
  let acc = "";
  for (const fragment of fragments) {
    if (!acc) {
      acc = fragment;
      continue;
    }
    const noSpace = isCJKChar(acc[acc.length - 1]) && isCJKChar(fragment[0]);
    acc += (noSpace ? "" : " ") + fragment;
  }
  return acc;
};

export const cleanCliText = (raw: string): string => {
  // 1) 去竖线（保留竖线前的缩进，交给 dedent 统一处理）
  const deGuttered = splitTextIntoLines(raw).map((line) => line.replace(CLI_GUTTER_RE, "$1")); // splitTextIntoLines 内部已规范化换行符
  // 2) dedent：按所有非空行的最小行首缩进统一削去
  const indents = deGuttered.filter((line) => line.trim()).map((line) => line.match(/^[ \t]*/)?.[0].length ?? 0);
  const minIndent = indents.length ? indents.reduce((min, n) => Math.min(min, n), Infinity) : 0; // reduce 而非 Math.min(...arr)，避免几万行输入展开实参时爆栈
  const dedented = minIndent ? deGuttered.map((line) => line.slice(minIndent)) : deGuttered;

  // 3) 按段落重排
  const out: string[] = [];
  let buffer: string[] = [];
  let inCodeBlock = false;
  const flush = () => {
    if (buffer.length) {
      out.push(joinParagraphFragments(buffer));
      buffer = [];
    }
  };

  for (const line of dedented) {
    if (CODE_FENCE_RE.test(line)) {
      flush();
      out.push(line.trimEnd());
      inCodeBlock = !inCodeBlock;
    } else if (inCodeBlock) {
      out.push(line.trimEnd()); // 代码块内逐行原样保留（含相对缩进）
    } else if (!line.trim()) {
      flush(); // 空行＝段落分隔
      out.push("");
    } else if (HEADING_RE.test(line) || HR_BANNER_RE.test(line) || BOLD_LABEL_RE.test(line)) {
      // markdown 标记行整行保留（标题/分割线/粗体标签）。HR_BANNER 须先于
      // LIST_ITEM——"- - -" 是 HR 不是列表项。这些行自身是完整结构，后续
      // 折行不应并入，所以直接 out.push 而非进 buffer（与表格行同款处理）。
      flush();
      out.push(line.trimEnd());
    } else if (LIST_ITEM_RE.test(line)) {
      // 列表项＝新逻辑行起点：先 flush 上一块，再把本项压入 buffer，
      // 其后被硬折的续行会经下面的 else 分支并入本项（修复多行列表项被拆成游离段落）。
      flush();
      buffer.push(line.trimEnd());
    } else if (TABLE_ROW_RE.test(line)) {
      flush();
      out.push(line.trimEnd()); // 表格行整行原样保留，不参与合并
    } else {
      buffer.push(line.trim());
    }
  }
  flush();

  // 4) 段间空行折叠为单个，去掉首尾空行
  return compressNewlines(out.join("\n"), 2).trim();
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

// 转义正则表达式中的特殊字符，防止正则注入
export const escapeRegExp = (str: string): string => str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
