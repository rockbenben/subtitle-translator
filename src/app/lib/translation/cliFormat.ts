// CLI 格式层:契约 + 三个格式 handler,全部集中在这一个文件。
//
// 为什么住在 lib/translation:这是主仓与翻译子项目里【路径唯一相同】的地方
// (子项目同步会把工具目录 `(translate)/<tool>/` 拍平成 `[locale]/`,而 lib
// 整目录原样同步)。格式的解析/装配本体在 ./formats/*(网页组件与 CLI 共用
// 同一份实现),handler 只做参数搬运 —— 不要在这里复制任何装配逻辑,两边
// 行为漂移是这套设计首要避免的问题。
//
// 集中的直接后果:每个翻译子项目的 CLI 都带全三种格式(字幕/Markdown/JSON),
// scripts/cli.ts 静态 import 本文件,不再有运行时发现。

import type { TranslateBatchMeta, PipelineOutcome } from "./pipeline";
import { splitTextIntoLines, hasPrecisionLossRisk } from "@/app/utils/textUtils";
import {
  detectSubtitleFormat,
  filterSubLines,
  prepareAssForTranslation,
  restoreAssAfterTranslation,
  applyRemoveCharsToAssLines,
  assembleSubtitleOutput,
  getOutputFileExtension,
  ASS_STYLE_PRESETS,
  SUBTITLE_DEFAULTS,
  type BilingualFormat,
} from "./formats/subtitle";
import { MARKDOWN_DEFAULTS, filterMarkdownLines, restorePlaceholders, splitMarkdownSegments, mergeMarkdownSegments, applyRemoveCharsToMarkdown, applyRemoveCharsToSegments } from "./formats/markdown";
import { softFilledIndices, transformSkippingSoftFilled, mapSkippingSoftFilled } from "./softFill";

/** CLI 驱动提供给 handler 的能力(翻译、清理、命令行开关)。 */
export interface CliFormatContext {
  /**
   * 把一组文本送进翻译流水线。documentType 传 "subtitle"/"markdown" 走上下文
   * 批处理;传 undefined 走非上下文路径。opts.independent 标记这组文本是
   * 互相独立的单元(JSON 值)而非连续文档 —— 组装线据此剥掉 chunkSize、引擎
   * 据此否决 LLM 上下文 marker 批(【两条】批处理路径都要压住,详见
   * PipelineRuntimeConfig.independent),强制逐条往返:chunk 路径的「内嵌换行
   * 扁平化 + join/split 对齐」对连续文档是可接受降级,对 JSON 是静默数据损坏。
   */
  translate: (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean }) => Promise<PipelineOutcome>;
  /** 通用逐行字符清理(字幕/JSON)。Markdown 用 applyRemoveCharsToMarkdown(占位符感知)。 */
  applyRemoveChars: (lines: string[]) => string[];
  /** 用户设置的 removeChars 原始串 —— markdown handler 要用占位符感知版。 */
  removeChars: string;
  /** 原始命令行开关,handler 按需自取(如 --bilingual / --md-raw)。 */
  flags: Record<string, string | boolean | undefined>;
  /** 所选服务是否 LLM(LLM_MODELS)——上下文批处理只对 LLM 生效,MT 无上下文路径。 */
  isLlmMethod: boolean;
  sourceLanguage: string;
  targetLanguage: string;
  fileName: string;
  /**
   * 本文件的第一个目标语言 —— 【文件级】提示只在它为 true 时打。
   *
   * run() 是按 file×lang 调的,而"这份 JSON 有精度损失风险"这类判断测的是文件
   * 属性,与目标语言无关:`-t ja -t ko -t zh` 会把同一条 ⚠ 刷三遍,200 文件的
   * 批次就是 1200 行重复警告淹掉真正的 ✖。
   * 由驱动给出而不是 handler 自己记忆:handler 只拿得到 basename,而
   * `en/messages.json` 与 `fr/messages.json` 同名;按内容记则会把两份内容恰好
   * 相同的文件(locale 刚 fork 时很常见)误判成同一个,第二份静默丢掉警告。
   * 文件边界只有驱动知道。
   */
  firstLangForFile: boolean;
  /** 源文件扩展名(小写,不含点)——SSA 之类需要按源回写的格式要用。 */
  sourceExt?: string;
}

/** handler 产出:文件内容 + 输出扩展名。返回 null = 该文件没有可翻译内容。 */
export type CliFormatResult = {
  content: string;
  ext: string;
  /** true 时输出文件名插入 _bilingual 后缀(双语字幕与仅译文同扩展名时防覆盖)。 */
  bilingualSuffix?: boolean;
} | null;

export interface CliFormatHandler {
  /** --format 的取值,同时是日志里的格式名。 */
  id: string;
  /** 归属此 handler 的扩展名(小写,含点)。 */
  extensions: string[];
  run: (text: string, ctx: CliFormatContext) => Promise<CliFormatResult>;
}

// ─── subtitle ────────────────────────────────────────────────────────────────

/**
 * 文件【本身】就不可用(解析不了),与目标语言无关。驱动据此报一次就跳到下一个
 * 文件:普通 Error 会在语言循环里被逐轮 catch,一个坏 .srt 配 `-t ja -t ko -t zh`
 * 就报三次 ✖、hardFailures 记成 3 —— 读 ✖ 数量的人(或 CI)会以为挂了三个文件。
 * 与 handler 返回 null(「没有可译内容」)那条已经用 break 处理的分支同一道理。
 */
export class CliFileFormatError extends Error {}

/**
 * 命令行开关的三态语义:显式关 > 显式开 > 共享默认。
 *
 * ⚠ 关【优先于】开,不是笔误:这是既有契约(`--no-context` 压 `--context`,
 * 有回归测试钉着),两侧同时给出时保守的那一侧赢 —— 拿不准时宁可【不翻】
 * 代码块/frontmatter/LaTeX,也不要把结构翻烂。
 *
 * 只注册非默认那一侧的 flag 时,另一侧传 undefined —— 反向 flag 在当前默认下
 * 只能重申现状,是个按了没反应的选项。真要翻转某个默认时,在翻转它的那个
 * commit 里补上对应的反向 flag。
 */
export const triState = (on: unknown, off: unknown, dflt: boolean): boolean => (off === true ? false : on === true ? true : dflt);

const subtitleHandler: CliFormatHandler = {
  id: "subtitle",
  extensions: [".srt", ".vtt", ".ass", ".ssa", ".lrc", ".sbv"],

  async run(text, ctx) {
    const lines = splitTextIntoLines(text);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") throw new CliFileFormatError("unsupported subtitle format");

    const { contentLines, contentIndices, assContentStartIndex } = filterSubLines(lines, fileType);
    if (contentLines.length === 0) return null;

    // ASS 覆盖标签在翻译前剥离、翻译后还原 —— 模型看不到 {\an8} 之类。
    const isAss = fileType === "ass";
    const { cleanLines, tagMaps } = isAss ? prepareAssForTranslation(contentLines) : { cleanLines: contentLines, tagMaps: [] };

    const bilingual = ctx.flags.bilingual === true;
    // 值域由驱动在参数校验阶段保证(非 ass/srt 直接 exit 2)。
    const bilingualFormat = ((ctx.flags["bilingual-format"] as string | undefined) ?? "ass") as BilingualFormat;

    // 上下文批处理默认值来自 SUBTITLE_DEFAULTS(与网页端同一常量,不再手抄),
    // --no-context 显式关闭。contentIndices 把 cue 文本映射回物理行 ——
    // 失败报告指向用户在文件里能找到的行号,而不是「第 N 条可译行」。
    const useContext = triState(ctx.flags.context, ctx.flags["no-context"], SUBTITLE_DEFAULTS.contextAware);
    const outcome = await ctx.translate(cleanLines, useContext ? "subtitle" : undefined, { lineNumbers: contentIndices.map((i) => i + 1), fileName: ctx.fileName });

    // removeChars 只作用于【原始译文】,且必须在 ASS 标签还原【之前】——
    // 还原之后再清理会损坏 \N 硬换行、{\anX} 标签与绘图坐标行。
    // ASS 用 token 感知版(跳过 ###n### 保护槽,与网页端同一份实现)。
    // 软填槽位跳过 —— 规则与网页端共用同一份(lib/translation/softFill)。
    const softFilled = softFilledIndices(outcome);
    const cleaned = transformSkippingSoftFilled(outcome.lines, softFilled, isAss ? (ls) => applyRemoveCharsToAssLines(ls, ctx.removeChars) : ctx.applyRemoveChars);
    const translatedLines = isAss ? restoreAssAfterTranslation(cleaned, tagMaps) : cleaned;

    const content = assembleSubtitleOutput({
      lines,
      contentIndices,
      contentLines,
      translatedLines,
      fileType,
      assContentStartIndex,
      tagMaps,
      isBilingual: bilingual,
      isOriginalFirst: ctx.flags["original-first"] === true,
      bilingualFormat,
      // 原生 ASS「重新排版」是网页端的样式化选项(需要整套 assStyle UI),
      // CLI 保持源样式:in-place 替换永远不会改坏用户既有的 Style 定义。
      assNativeRebuild: false,
      assStyle: ASS_STYLE_PRESETS.default,
      sourceLanguage: ctx.sourceLanguage,
      exportLang: ctx.targetLanguage,
      // 与网页端同一份规则:只有引擎标记为软填的槽位才只出一半。按"译文==原文"
      // 判会把专有名词/数字/♪ 这类合法译成自身的行吃掉一半(见 isSoftFilledHalf)。
      softFilledIndices: softFilled,
    });

    return { content, ext: getOutputFileExtension(fileType, bilingual, bilingualFormat, ctx.sourceExt), bilingualSuffix: bilingual };
  },
};

// ─── markdown ────────────────────────────────────────────────────────────────

const markdownHandler: CliFormatHandler = {
  id: "markdown",
  extensions: [".md", ".markdown", ".mdx"],

  async run(text, ctx) {
    const lines = splitTextIntoLines(text);
    // 空/纯空白文件是失败信号(✖ no translatable content,exit 1),不是
    // 「原样输出」:静默写出 0 字节的 .zh.md 会让按退出码把关的流水线把
    // 截断的生成物当成译好的文档。区别于下面「全保护文档」——那种有内容,
    // 只是全部不可译,原样输出才是对的(与网页端一致)。
    if (lines.length === 0 || text.trim() === "") return null;

    // 默认值来自 MARKDOWN_DEFAULTS(与网页端同一常量),flag 只做显式覆盖。
    const d = MARKDOWN_DEFAULTS.options;
    const mdOptions = {
      // 只有非默认那一侧有 flag;另一侧传 undefined。反向 flag 等到真要翻转
      // 对应默认值时再加(那时它才不是空操作)。
      translateFrontmatter: triState(ctx.flags["md-translate-frontmatter"], undefined, d.translateFrontmatter),
      translateMultilineCode: triState(ctx.flags["md-translate-code"], undefined, d.translateMultilineCode),
      translateLatex: triState(ctx.flags["md-translate-latex"], undefined, d.translateLatex),
      translateLinkText: triState(undefined, ctx.flags["md-no-link-text"], d.translateLinkText),
    };

    // Raw 模式:整篇按行翻译。上下文批处理默认值来自 MARKDOWN_DEFAULTS,
    // --context 开启、--no-context 显式禁用永远赢。
    // 与网页端 contextAwareActive 同语义的关键门:【仅 LLM】
    // 生效并隐含 raw(MDTranslator.tsx: contextAware && LLM_MODELS.includes)
    // —— MT 方法没有上下文路径,若不加这道门,--context + gtxFreeAPI 会把
    // 占位符保护整个丢掉、逐行机翻代码块/frontmatter,还静默 exit 0。
    const useContext = triState(ctx.flags.context, ctx.flags["no-context"], MARKDOWN_DEFAULTS.contextAware) && ctx.isLlmMethod;
    // 输出沿用源扩展名:.mdx / .markdown 硬写成 .md 会让 Next/Docusaurus 不再
    // 按 MDX 处理(JSX 组件被当纯文本,或整份文件被跳过)。
    const ext = ctx.sourceExt && ["md", "markdown", "mdx"].includes(ctx.sourceExt) ? ctx.sourceExt : "md";
    if (ctx.flags["md-raw"] === true || useContext) {
      const outcome = await ctx.translate(lines, useContext ? "markdown" : undefined, { fileName: ctx.fileName });
      // raw 模式下 outcome.lines 与源行 1:1,软填槽位可以精确跳过(理由见
      // softFilledIndices)。逐行清理与整段清理等价 —— 占位符 token 不跨行。
      const cleanedLines = mapSkippingSoftFilled(outcome.lines, softFilledIndices(outcome), (l) => applyRemoveCharsToMarkdown(l, ctx.removeChars));
      return { content: cleanedLines.join("\n"), ext };
    }

    const parsed = filterMarkdownLines(lines, mdOptions);
    const { contentLines, sourceLineNumbers } = parsed;

    // 结构化模式:每个内容行按占位符切开,只有散文片段进 wire。片段之间互相
    // 独立(不是连续文档),不走上下文批处理 —— 与网页端 translateBatch(...,
    // undefined) 同路径(chunk/逐行由方法的 chunkSize 决定,两边一致)。
    const { textsToTranslate, textLineNumbers, lineSegments } = splitMarkdownSegments(contentLines, sourceLineNumbers);

    // 没有可译片段(整篇都是代码块 / frontmatter)不是失败:网页端照样输出一份
    // 原样文档。返回 null 会让驱动记硬失败、整批 exit 1、这份文件不落盘 ——
    // `-i docs/*.md -o out/` 会静默少一个文件,且与真失败无法区分。
    const outcome =
      textsToTranslate.length > 0
        ? await ctx.translate(textsToTranslate, undefined, { lineNumbers: textLineNumbers, fileName: ctx.fileName })
        : { lines: [] as string[], failures: [], lastError: undefined, rateLimited: false };

    // removeChars 在【合并之前】逐片段做,软填片段原样保留(applyRemoveCharsToSegments
    // 与网页端 MDTranslator 共用同一份)。用占位符感知版,且必须在占位符还原
    // 【之前】:还原后再清理会损坏受保护的代码/链接/LaTeX 正文,而通用逐行
    // 清理命中 <<<…>>> 会毁掉 token 导致受保护块整块丢失 + 字面 token 泄漏。
    const cleaned = applyRemoveCharsToSegments(outcome.lines, softFilledIndices(outcome), ctx.removeChars);
    const merged = mergeMarkdownSegments(lineSegments, cleaned);

    // ⚠ 输出【只 join contentLines】,不要像字幕那样把译文塞回原始 lines 数组:
    // filterMarkdownLines 返回的 contentLines 已经是全文的降维表示(围栏代码、
    // frontmatter、LaTeX 块等被折叠成【一行】占位符)。往原始 lines 里回填会
    // 让被折叠的块出现两次 —— 原始围栏还在,占位符还原后又插一份。
    return { content: restorePlaceholders(merged.join("\n"), parsed), ext };
  },
};

// ─── json ────────────────────────────────────────────────────────────────────

// 遍历所有字符串叶子,原地回填,结构/键名/非字符串值全部不动。
// 刻意不复刻网页版 JSONTranslator 的 JSONPath 选择器与 i18n 键配对:那是交互
// 式功能(用户挑要翻哪些路径)。CLI 的默认语义是「整份文件的文案都翻」——
// locale 文件的批处理场景,这就是想要的行为。需要按路径挑选时用网页端。

/**
 * 收集所有字符串叶子,并为每个叶子留一个原地写回的 setter。
 * 用 setter 而不是路径字符串:键名里可能含点/方括号,拼路径再解析会在这类键上
 * 悄悄写错位置。
 */
const collectStrings = (node: unknown, out: string[], setters: Array<(v: string) => void>): void => {
  if (Array.isArray(node)) {
    node.forEach((v, i) => {
      if (typeof v === "string") {
        out.push(v);
        setters.push((nv) => {
          node[i] = nv;
        });
      } else collectStrings(v, out, setters);
    });
    return;
  }
  if (node && typeof node === "object") {
    const obj = node as Record<string, unknown>;
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (typeof v === "string") {
        out.push(v);
        setters.push((nv) => {
          obj[k] = nv;
        });
      } else collectStrings(v, out, setters);
    }
  }
};

/**
 * JSON.parse/stringify 往返时,【整数样式的键】会被 V8 按数值升序排到所有字符串
 * 键之前(ECMA-262 的 OrdinaryOwnPropertyKeys 规定,不是实现细节,躲不掉)。
 * 于是 `{"10":…,"2":…,"other":…}` 出来变成 `{"2":…,"10":…,"other":…}` ——
 * 只有字符串叶子该变,结果 diff 里却多出一堆本轮根本没打算碰的行,评审或
 * 卡 `git diff` 的流水线会被这些噪声挡住。ICU 复数表、以 ID 作键的文案表都是
 * 这个形状。
 *
 * 与超长数字的精度警告同一处置:提醒,不拒绝(网页端也是同样往返)。
 * 保序需要换掉整条 parse/stringify 管线,代价远大于它挡住的问题。
 */
const hasIntegerLikeKeys = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(hasIntegerLikeKeys);
  if (typeof value !== "object" || value === null) return false;
  const keys = Object.keys(value as Record<string, unknown>);
  // 仅当整数键与其它键混在一起、或整数键本身不是升序时才会看出重排。
  // 判据放宽成「存在整数样式键且不止一个键」—— 宁可多提醒一次。
  if (keys.length > 1 && keys.some((k) => /^(?:0|[1-9]\d*)$/.test(k))) return true;
  return Object.values(value as Record<string, unknown>).some(hasIntegerLikeKeys);
};

const jsonHandler: CliFormatHandler = {
  id: "json",
  extensions: [".json"],

  async run(text, ctx) {
    let parsed: unknown;
    try {
      // ⚠ 【严格 JSON.parse,不是网页端的 preprocessJson】—— 这是一处【有意保留】
      // 的网页/CLI 分歧,别再"顺手统一"(已经统一过一次又退回来了):
      //
      // 1) 依赖边界:preprocessJson 住在 utils/jsonUtils.ts,而 sync_config.yaml
      //    把该文件从共享 utils 规则里【显式 exclude】,只同步给 json-translate
      //    子项目;本文件(lib/translation)却同步给【每个】翻译子项目。从这里
      //    import 它 → project_sync.py 一跑,subtitle-translator 与 md-translator
      //    的 cliFormat.ts 就引用一个不存在的模块,yarn build/typecheck/cli 全炸。
      //    同一个陷阱在 hasPrecisionLossRisk 上踩过并留了解法(那个函数被专门
      //    移进 textUtils),而 json5 是主仓依赖、子仓 package.json 不在同步范围,
      //    所以"把 jsonUtils 也同步过去"需要跨三个仓手工装依赖。
      //
      // 2) 语义边界:preprocessJson 拿 null 当解析失败哨兵(`if (parsed !== null)
      //    return parsed`),所以它【无法表示一个成功解析出的顶层 null】——
      //    内容为 `null` 的文件会被改写成 `[null]` 并 exit 0;它还会给无外层
      //    括号的片段自动补 {}/[]。对 CLI 这种产物直接进流水线的场景,静默改写
      //    文档结构比"报错要求修文件"坏得多。
      //
      // 代价(已知并接受):带尾逗号/注释的手改 locale 文件在浏览器里能翻、在
      // CLI 上报 ✖ invalid JSON + exit 1。--help 里明写了这条。
      parsed = JSON.parse(text);
    } catch (e) {
      throw new CliFileFormatError(`invalid JSON (${(e as Error).message}) — the CLI requires strict JSON; the web tool additionally accepts JSON5 (trailing commas, comments)`);
    }
    // JSON.parse/stringify 往返会改写超出 IEEE-754 双精度的数字(雪花 ID、
    // 订单号),1.0 也会塌成 1。网页端同样往返、同样只【警告】不拒绝,对齐它。
    // 文件级提示,只在本文件的第一个目标语言打(见 CliFormatContext.firstLangForFile)。
    if (ctx.firstLangForFile) {
      if (hasPrecisionLossRisk(text)) {
        console.error(`⚠ ${ctx.fileName}: large or high-precision numbers may lose precision through the JSON round-trip.`);
      }
      if (hasIntegerLikeKeys(parsed)) {
        console.error(`⚠ ${ctx.fileName}: integer-like keys are re-sorted ahead of string keys by the JSON round-trip, so key order in the output may differ from the input.`);
      }
    }

    const values: string[] = [];
    const setters: Array<(v: string) => void> = [];
    // 根节点本身就是字符串叶子(`"Hello world"` 是合法 JSON)时 collectStrings
    // 一个值都收不到 —— 会掉进下面「没有可译内容 → 原样往返」那条分支,把文件
    // 原封不动写出来并打 ✔ exit 0,与真正的成功【无法区分】(CI 里
    // `yarn cli … && upload` 会照发)。单独收一下。
    if (typeof parsed === "string") {
      values.push(parsed);
      setters.push((nv) => {
        parsed = nv;
      });
    } else collectStrings(parsed, values, setters);
    // 没有字符串叶子(全是数字/布尔/空对象)不是失败 —— 与 markdown handler
    // 的「整篇都是代码块」同一判据(见上面那段注释)。返回 null 会让驱动记
    // 硬失败、整批 exit 1、这份文件不落盘:翻译 locale 树
    // `-i locales/*/messages.json -o out/` 时会静默少一个文件,还与真失败
    // 无法区分,盯 exit code 的 CI 直接卡住发布。原样往返写出。
    // (真正的空文件走不到这里:JSON.parse("") 已在上面抛 invalid JSON。)
    if (values.length === 0) return { content: JSON.stringify(parsed, null, 2) + "\n", ext: "json" };

    // independent:各值互相独立且必须逐值往返(内嵌换行是值的一部分,错位
    // 即数据损坏)—— 驱动剥 chunkSize 走逐条路径,与网页版逐值调用同语义。
    const outcome = await ctx.translate(values, undefined, { fileName: ctx.fileName }, { independent: true });
    // removeChars 只打【真译出来的】值:软失败槽位回填的是原文,再删字符会写出
    // 既非原文也非译文的东西(网页端把 removeChars 放在成功分支内)。
    // 用引擎给的 index,不再从 line 反推(independent 路径下二者恰好相等,
    // 但那是巧合 —— 这条路径一旦开始传 lineNumbers 就会静默错位)。
    // 走共享 helper 而不是内联同一段逻辑 —— softFill.ts 的头注释说这个惯用法
    // 曾在四处复制、而分歧「只会在用户的产物里显形」;JSON 路径不该是第五份。
    const cleaned = transformSkippingSoftFilled(outcome.lines, softFilledIndices(outcome), ctx.applyRemoveChars);
    cleaned.forEach((v, i) => setters[i](v));

    return { content: JSON.stringify(parsed, null, 2) + "\n", ext: "json" };
  },
};

/** 全部格式 handler —— scripts/cli.ts 静态 import,顺序即 --list-formats 顺序。 */
export const CLI_FORMAT_HANDLERS: CliFormatHandler[] = [subtitleHandler, markdownHandler, jsonHandler];
