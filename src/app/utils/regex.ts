// 标点符号结尾的正则表达式
export const punctuationEndRegex = /(?:[。？！…”"」\]】)）※]|\.{3,}|-{3,}|—{3,}|={3,}|＝{3,})$/;
// 以特殊字符开头的任意行，未包含括号 （(
export const specialLineStartRegex = /^(?:[【「\[“"◆※].*|-{3,}|—{3,}|={3,}|＝{3,}|第.*[章节卷])$/;

// 纯数字行的正则表达式
export const pureNumberRegex = /^\d+$/;
// 数字开头
export const numberStartRegex = /^\d+/;
// 数字结尾
export const numberEndRegex = /\d$/;

// 中文小说常用正则
// 章节标题正则
export const chapterTitleRegex =
  // 回 的否定预查扩充:回到/回头/回来/回去/回了/回过 等常见句首动词短语在
  // 「数字+回」结构下曾被误判为章节标题(如「三回头看」),导致 reorder 把正文
  // 行当章节移位。
  // 裸标记词(序章/前言/正文/番外…)必须带边界预查:不锚定时任何以这些词
  // 开头的正文句("前言不搭后语"、"正文开始了")都被当标题,reorder 把该句
  // 及其后内容整段搬到文末。允许紧跟:行尾/空白/标点/括号/编号。
  // [上中下][部册]册 → [上中下][部册]:旧写法要求字面 "上部册",真实的
  // 上册/下部 反而永不匹配。
  // 复合形态显式收编:番外篇/正文卷 是起点式 TXT 导出的标准标题前缀
  // ("正文卷 第一章 …"),裸词加边界预查时漏掉它们会让这些标题失识别;
  // 预查类含「第」,容纳 "番外第三章" 直接相连的写法。
  // 「番外之」单列(不走边界预查):番外之一/番外之婚后生活 是晋江/起点的
  // 高频番外标题形态 —— 之 不能进共享预查类(否则 "序章之后，…" 这类散文
  // 也会命中),只对 番外 开例外。
  // [上中下][部册] 的预查窄到 行尾/空白/冒号:真实卷头是 "上册"/"下册 xxx",
  // 共享宽预查会把硬折行首的 "中部，丘陵…"/"上册第3页写道" 误判成标题,
  // reorder 会把其后整块正文搬到文末。
  /^(?:(?:序章|序言|引子|前言|卷首语|扉页|楔子|正文卷?|终章|后记|附录|尾声|番外篇?)(?=$|[\s：:，,、．.·\-—（(【\[「《0-9零一二三四五六七八九十第])|番外之|[上中下][部册](?=$|[\s：:])|第?\s{0,4}[\d〇零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+?\s{0,4}(?:章|节(?!课)|卷|集(?![合和])|幕(?![前后布])|回(?![合访忆顾应答音到头来去了过])|部(?![分赛游])|篇(?!张))).*/;

// 章节单位标记（与 chapterTitleRegex 覆盖的 8 种一致）——供 extractChapterOrder / 排版规则共用，避免标记集漂移
export const CHAPTER_MARKERS = "章节卷集幕回部篇";

// 数字标题正则
export const numberTitleRegex = /^[ 　\t]{0,4}\d{1,5}([：:,.， 、_—\-]|【.{1,30}】).{0,30}$/;

// 标题严格正则：第 X 章
export const chapterPattern = /^(第?\s{0,4}[\d〇零一二两三四五六七八九十百千万壹贰叁肆伍陆柒捌玖拾佰仟]+?\s{0,4}章)(.*)$/;

export const novelSectionHeaderRegex = /^(?:作者|(?:内容|作品)?简介|创作|标签)[:：]?/u;

// ── 章节标题判定（chapterTitleRegex/numberTitleRegex 命中 + 下面三条约束）──
// 两个正则都只锚定"行首像不像标题"，chapterTitleRegex 的「第」还是可选的，
// 于是 "一部正在上映的电影，票价三十起步。" 这类正文句会被当成章节标题：
// 合并同章标题会把它和另一处同号行之间的整段正文静默删掉，章节重排会把全书
// 从这句话处切开搬走。三条约束（行长上限、句末句号、非「第X章」标题的句中逗号）
// 划在"真标题簇"与"正文句簇"之间的空档上：真标题最长 35 字，>40 字的命中行全是
// 正文句。判错的代价是这一行不再当章节边界（正文并入上一章），不会删内容。
export const CHAPTER_TITLE_MAX_LEN = 40;

// 显式「第X标记」前缀，捕获标记用于区分「章」与其他（部/节/集/卷/回…）
const chapterHeadRegex = /^第\s*[〇零一二三四五六七八九十百千万两壹贰叁肆伍陆柒捌玖拾佰仟萬\d]{1,10}\s*([章节卷集幕回部篇])/;
const sentenceEndRegex = /[。.]$/;
// 「句中有逗号」= 除末字符外出现过逗号：真标题里的逗号是并列短语
// （"混江湖，就是要叫人忌惮！"），正文句的逗号是分句分隔。
const innerCommaRegex = /[，,]/;

// 裸栏目名：不带「第X」前缀、本身就是章名的那些词。
// ⚠ 没有「第X章」前缀 + 句号收尾 = 正文句 这条判据会把它们整族误判成正文：
// 在一份 8000+ 本的真实书库上量过，这一类命中 1224 条，以这些词开头的 77 条
// **逐条看全部是真标题**——"尾声。" "正文。" "后记·逮捕。" "序章，神秘的女婴。"
// "终章，《matrix》即《黑客帝国》。"。所以这一族先过目再判，其余（"一部正在上映的
// 电影，票价三十起步。"、编号清单体）照旧按正文句处理。
const sectionLabelRegex = /^(?:序章|楔子|正文|终章|末章|后记|後记|尾声|番外|引子|[序前]言|卷首语|扉页|跋)/u;

/**
 * 这本书的章节单位用的是哪个标记（章/节/卷/集/幕/回/部/篇）。
 *
 * 判法：只看那些**不像正文句**的命中，数它们行首的标记，最多的那个就是单位。
 * 用来裁「有显式前缀但标记不是『章』+ 句号 + 逗号」那一支——同一支判据在两本书上
 * 要得相反的结果：
 *   - 竞技文以「章」为单位，正文里「第一节打完，两队打成28平。」独立成行、还带递增
 *     序号 → 标记是外人，判正文句（书库里这一类 8500 余条）；
 *   - 有的书章节单位**就是**「节」，1198 章叫"第N节 …"，其中 6 条自带逗号句号
 *     （"第226节 来吧，我们捕猎。"）→ 单位就是节，一条都不能判掉。
 *
 * ⚠ 数单位时必须把句子样命中排除在外：一本 12 章的竞技文里 22 行比赛进程，
 * 一起数的话「节」以 22 > 12 把自己投成单位，一条都判不掉——正文比目录多正是这类书的样子。
 */
export const detectChapterUnit = (lines: string[]): string | null => {
  const tally = new Map<string, number>();
  for (const raw of lines) {
    const t = raw.trim();
    if (!t || [...t].length > CHAPTER_TITLE_MAX_LEN) continue;
    const head = t.match(chapterHeadRegex);
    if (!head) continue;
    // 句子样的不参与投票（它可能是正文，不是单位）。「章」要参与投票：
    // 竞技文里干净的「第N章」961 条、正文句的「第N节」里不带句号的也有 70 余条，
    // 不把章算进去就会被那 70 条把单位投成「节」，一条正文都判不掉了。
    if (sentenceEndRegex.test(t) && innerCommaRegex.test(t.slice(0, -1))) continue;
    tally.set(head[1], (tally.get(head[1]) ?? 0) + 1);
  }
  let unit: string | null = null;
  let max = 0;
  for (const [m, n] of tally) {
    if (n > max) {
      unit = m;
      max = n;
    }
  }
  return unit;
};

/**
 * `unit` 传 `detectChapterUnit` 得到的这本书的章节单位时，标记与它相同的句子样行
 * 不再判成正文句（那是这本书自己的标题形状）；不传保持原来的严格判法。
 */
export const isChapterTitleLine = (line: string, unit?: string | null): boolean => {
  const t = line.trim();
  if (!t) return false;
  if ([...t].length > CHAPTER_TITLE_MAX_LEN) return false;
  if (!chapterTitleRegex.test(t) && !numberTitleRegex.test(t)) return false;
  const head = t.match(chapterHeadRegex);
  // 没有「第X章」这类显式前缀、又以句号收尾 —— 是正文句，不是标题（裸栏目名除外）
  if (!head && sentenceEndRegex.test(t) && !sectionLabelRegex.test(t)) return false;
  // 有显式前缀但标记不是「章」(部/节/集/卷/回…) 且 句号收尾 + 内含逗号 ——
  // 「第二部《办公室风情》的票房表现，…更好。」「第1节比赛接近尾声，…」这类
  // 正文句。「第61章 方圆有事想求。」这类章标记的标题不受影响。
  if (head && head[1] !== "章" && sentenceEndRegex.test(t) && innerCommaRegex.test(t.slice(0, -1)) && head[1] !== unit) return false;
  return true;
};
