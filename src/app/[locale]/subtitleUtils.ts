// 用于匹配 VTT/SRT 时间行（支持默认小时省略、多位数小时以及 1 到 3 位毫秒值）。
// 分隔符两侧按 WebVTT 规范允许「一个或多个空格/Tab」—— 单空格硬编码曾把
// Tab/双空格分隔的合法 VTT 整文件判为"无内容"。
export const VTT_SRT_TIME = /^(?:\d+:)?\d{2}:\d{2}[,.]\d{1,3}[ \t]+-->[ \t]+(?:\d+:)?\d{2}:\d{2}[,.]\d{1,3}/;
// 时间行的 start/end 拆分(与上面同样的分隔符容忍度)
export const TIME_ARROW_SPLIT = /[ \t]+-->[ \t]+/;
// LRC 格式的时间标记正则表达式
export const LRC_TIME_REGEX = /^\[\d{2}:\d{2}(\.\d{2,3})?\]/;
// Same pattern with global flag — for `.match` / `.replace` across a line that
// may have multiple time tags (e.g. karaoke lines). Pre-compiled at module
// scope so the bilingual-output loop in SubtitleTranslator doesn't `new
// RegExp()` per line × per call (was 2× per LRC line on every export).
export const LRC_TIME_REGEX_GLOBAL = /\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g;
const LRC_METADATA_REGEX = /^\[(ar|ti|al|by|offset|re|ve):/i;
// YouTube SBV 时间行:`0:00:01.000,0:00:03.500`(逗号分隔 start,end,无 --> 箭头)。
// 整行锚定 —— cue 文本里出现类似片段不会误判;ms 容忍 1-3 位(YouTube 固定输出 3 位)。
export const SBV_TIME_REGEX = /^\d+:\d{2}:\d{2}\.\d{1,3},\d+:\d{2}:\d{2}\.\d{1,3}$/;

// 识别字幕文件的类型
export const detectSubtitleFormat = (lines: string[]): "ass" | "vtt" | "srt" | "lrc" | "sbv" | "error" => {
  // 获取前 50 行，并去除其中的空行
  const nonEmptyLines = lines.slice(0, 50).filter((line) => line.trim().length > 0);
  let assCount = 0,
    vttCount = 0,
    srtCount = 0,
    lrcCount = 0,
    sbvCount = 0;

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const trimmed = nonEmptyLines[i].trim();

    // ASS 格式判断:[script info] 行计入投票,不再无条件早退 —— cue 文本里
    // 以 "[Script Info]" 开头的合法 SRT/SBV(讲字幕格式的视频字幕)曾被整文件
    // 劫持成 ass,filterSubLines 提不出任何 Dialogue 行,文件完全不可翻译。
    // 真 ASS 靠 [script info] + Dialogue 行的票数照样胜出(纯头部粘贴时其余
    // 计数均为 0,1 票也够)。
    if (/^\[script info\]/i.test(trimmed)) assCount++;

    // 如果第一行是 WEBVTT 标识，则为 VTT 格式
    if (i === 0 && /^WEBVTT($|\s)/i.test(trimmed)) return "vtt";

    if (/^dialogue:\s*\d+,[^,]*,[^,]*,/i.test(trimmed)) {
      assCount++;
    }
    // 匹配时间行
    if (VTT_SRT_TIME.test(trimmed)) {
      if (trimmed.includes(",")) {
        srtCount++;
      } else if (trimmed.includes(".")) {
        vttCount++;
      }
    }
    // 检测LRC格式的时间标记
    if (LRC_TIME_REGEX.test(trimmed)) {
      lrcCount++;
    }
    if (LRC_METADATA_REGEX.test(trimmed)) {
      lrcCount++;
    }
    if (SBV_TIME_REGEX.test(trimmed)) {
      sbvCount++;
    }
  }

  // 根据时间行分隔符数量判断。严格多数(>)而非 >=:真 ASS 不含箭头/LRC/SBV
  // 时间行(其余计数恒为 0,1 票照样胜出);平局意味着每个 cue 文本里都有一条
  // Dialogue 行 —— 讲 ASS 语法的 SRT/SBV 教学字幕,>= 会把整文件劫持成 ass,
  // 序号/箭头时间码被原样保留、cue 文本被当 Dialogue 改写,导出 .ass 两头不合法
  // ([Script Info] 投票同病已修,这里是 Dialogue 计票的平局分支)。
  if (assCount > 0 && assCount > Math.max(vttCount, srtCount, lrcCount, sbvCount)) {
    return "ass";
  }
  // LRC 判定要求文件【完全没有】--> 箭头:真 LRC 不含箭头时间行;cue 文本
  // 里内嵌 [mm:ss] 标注的 SRT/VTT(歌词字幕、转录稿)曾被票数压过误判成
  // LRC。用宽松的 includes("-->") 而非带空格要求的时间码正则 —— 无空格箭头
  // 的 SRT(00:00:01,000-->00:00:02,000)两个计数都是 0,照样会误判。
  // sbvCount === 0 同理:真 LRC 不含 SBV 时间行,带 [mm:ss] 标注的 SBV 转录稿
  // 不能被 LRC 票数压过。
  if (lrcCount > 0 && vttCount === 0 && srtCount === 0 && sbvCount === 0 && !nonEmptyLines.some((l) => l.includes("-->"))) {
    return "lrc";
  }
  // 无 WEBVTT 头(头部在上面 i===0 已提前返回)的点分隔毫秒文件按 SRT 处理:
  // 规范要求 VTT 必须有头,而"点分隔的 SRT"是真实存在的社区变体 —— 此前按
  // VTT 处理会让 translated-only 导出生成无 WEBVTT 头的 .vtt(两种格式下都
  // 不合法);按 SRT 导出保持与源文件相同的保真度。
  if (srtCount > 0 || vttCount > 0) return "srt";
  // 箭头时间码是更强信号,SBV 排在 srt/vtt 之后:真 SBV 不含 --> 行
  if (sbvCount > 0) return "sbv";
  return "error";
};

export type BilingualFormat = "ass" | "srt";

/** "both" 模式下双语文件名后缀,插在扩展名前避免跟 translatedOnly 同名 */
export const BILINGUAL_FILENAME_SUFFIX = "_bilingual";

/**
 * 在文件名扩展名前插入 _bilingual 后缀。
 * 用于 exportMode="both" 时区分两份文件(ASS/LRC 源、SRT+format=srt 三种场景下
 * translatedOnly 和 bilingual 扩展名相同,不加后缀会被浏览器覆盖下载)。
 * - "subtitle.srt" → "subtitle_bilingual.srt"
 * - "my.video.srt" → "my.video_bilingual.srt"(只替换最后一段)
 * - "noext" → "noext_bilingual"(无扩展名时直接追加,边界防御)
 */
export const appendBilingualSuffix = (filename: string): string => {
  // dotIndex<=0 覆盖"无点"和"点在首位"(.gitignore 这种隐藏文件 → 无扩展可插)两种边界
  const dotIndex = filename.lastIndexOf(".");
  if (dotIndex <= 0) return `${filename}${BILINGUAL_FILENAME_SUFFIX}`;
  return `${filename.slice(0, dotIndex)}${BILINGUAL_FILENAME_SUFFIX}${filename.slice(dotIndex)}`;
};

export const getOutputFileExtension = (fileType: string, bilingualSubtitle: boolean, bilingualFormat: BilingualFormat = "ass", sourceExt?: string): string => {
  if (fileType === "lrc") {
    return "lrc";
  }
  // SBV 双语是原地叠行(仍是合法 SBV 多行 cue),不参与 ASS/SRT 格式选择
  if (fileType === "sbv") {
    return "sbv";
  }
  if (fileType === "ass") {
    // SSA(v4.00)走同一条 ass 管线(in-place 行替换,输出保持 v4.00 结构)——
    // 按源文件扩展名回写 .ssa,而不是给 v4.00 内容贴 .ass 名
    return sourceExt === "ssa" ? "ssa" : "ass";
  }
  // SRT/VTT 双语按用户选择:format=ass 转 ASS,format=srt 输出 SRT(VTT 走 vttToSrt 后处理)
  if (bilingualSubtitle) {
    return bilingualFormat === "ass" ? "ass" : "srt";
  }
  if (fileType === "vtt") {
    return "vtt";
  }
  return "srt";
};

// 预编译正则表达式用于检测纯数字行(SRT 的 cue 序号)
const INTEGER_REGEX = /^\d+$/;

export const filterSubLines = (lines: string[], fileType: string) => {
  const contentLines: string[] = [];
  const contentIndices: number[] = [];
  let startExtracting = false;
  let assContentStartIndex = 9;
  let formatFound = false;
  // NOTE/STYLE/REGION 块状态:这些块是多行的(到下一个空行结束),只跳过首行会把
  // 注释正文当 cue 文本送翻译并聚合进上一个 cue。
  let inMetaBlock = false;

  // VTT pre-pass:标记 cue identifier 行的 index。WebVTT 规范:cue id 是紧挨 timecode
  // 上方的单行,且其上方为空行(或文件首)。不识别会把它当内容送 LLM 翻译,然后
  // findTimeLineBefore 还会把它算进上一个 cue 导致双语聚合错位。
  const cueIdIndices = new Set<number>();
  if (fileType === "vtt") {
    for (let i = 1; i < lines.length; i++) {
      if (!VTT_SRT_TIME.test(lines[i].trim())) continue;
      const prev = lines[i - 1].trim();
      if (prev === "") continue;
      // 要求上一行是空行(或在文件起始的 WEBVTT 头之后) —— 严格按规范,避免把"无空行隔开
      // 的多行 cue 内容"误判为 cue id
      if (i - 2 >= 0 && lines[i - 2].trim() !== "") continue;
      if (prev.startsWith("WEBVTT")) continue;
      if (/^(NOTE|STYLE|REGION)(\s|$)/.test(prev)) continue;
      cueIdIndices.add(i - 1);
    }
  }

  if (fileType === "ass") {
    const eventIndex = lines.findIndex((line) => /^\[events\]$/i.test(line.trim()));
    if (eventIndex !== -1) {
      for (let i = eventIndex; i < lines.length; i++) {
        if (/^format:/i.test(lines[i])) {
          const formatLine = lines[i];
          assContentStartIndex = formatLine.split(",").length - 1;
          formatFound = true;
          break;
        }
      }
    }

    if (!formatFound) {
      const dialogueLines = lines.filter((line) => /^dialogue:/i.test(line)).slice(0, 100);
      if (dialogueLines.length > 0) {
        const commaCounts = dialogueLines.map((line) => line.split(",").length - 1);
        assContentStartIndex = Math.min(...commaCounts);
      }
    }
  }

  // 序号递增追踪:紧凑 SRT(cue 间无空行)的序号前一行是上个 cue 的文本,
  // 单靠"前空行"条件会把 #2 起的所有序号当 cue 文本送翻译。
  let lastSeqNumber = 0;
  lines.forEach((line, index) => {
    let isContent = false;
    let extractedContent = "";
    const trimmedLine = line.trim();

    if (fileType === "srt" || fileType === "vtt") {
      // 统一用 VTT_SRT_TIME(逗号/点分隔通吃 + Tab/多空格容忍):此前 vtt 分支
      // 的点专属正则会把"WEBVTT 头 + 逗号时间码"的混合文件的时间码行当 cue
      // 文本送翻译。
      const isTimecode = VTT_SRT_TIME.test(trimmedLine);
      if (!startExtracting && isTimecode) {
        startExtracting = true;
        // 首个时间码出现前的纯整数行是第 1 个 cue 序号(此前 startExtracting
        // 为 false 未处理)—— 用它播种 lastSeqNumber,否则紧凑 SRT 的 #2 起
        // 都对不上递增序列而被当 cue 文本。
        const prev = (lines[index - 1] ?? "").trim();
        if (INTEGER_REGEX.test(prev)) lastSeqNumber = Number(prev);
      }

      if (startExtracting) {
        // SRT 序号 = 纯整数行 且 下一行是时间码 且【上一行为空/文件首 或
        // 数值恰为上个序号+1】。第三组条件同时覆盖两类文件:规范文件的序号
        // 在空行后;紧凑文件(cue 间无空行)靠递增序列识别 —— 数字台词恰好
        // 贴下个时间码时既不在空行后也不等于 lastSeq+1,正确判为内容。
        const isSeqNumber =
          INTEGER_REGEX.test(trimmedLine) &&
          VTT_SRT_TIME.test((lines[index + 1] ?? "").trim()) &&
          (index === 0 || lines[index - 1].trim() === "" || Number(trimmedLine) === lastSeqNumber + 1);
        if (isSeqNumber) lastSeqNumber = Number(trimmedLine);

        if (fileType === "vtt") {
          // WebVTT non-cue blocks per spec — NOTE (comments), STYLE (CSS),
          // REGION (positioning)。块到下一个空行结束;只在块边界(上一行为空
          // 或文件头)起始,cue 文本里以 "NOTE " 开头的台词不受影响。
          const atBlockBoundary = index === 0 || lines[index - 1].trim() === "";
          if (atBlockBoundary && /^(NOTE|STYLE|REGION)(\s|$)/.test(trimmedLine)) inMetaBlock = true;
          if (inMetaBlock) {
            if (trimmedLine === "") inMetaBlock = false;
            // 止损(与 vttToSrt 同款):块未按规范以空行结束、直接跟时间码 ——
            // 不恢复的话后续所有 cue 文本都被当注释吞掉。
            else if (isTimecode) inMetaBlock = false;
          }
          if (!inMetaBlock && !(atBlockBoundary && /^(NOTE|STYLE|REGION)(\s|$)/.test(trimmedLine))) {
            const isWebVTTHeader = trimmedLine.startsWith("WEBVTT");
            // HLS 级联段的元数据头(X-TIMESTAMP-MAP=...)不是 cue 文本
            const isHlsHeader = trimmedLine.startsWith("X-TIMESTAMP-MAP");
            isContent = trimmedLine !== "" && !isSeqNumber && !isTimecode && !isWebVTTHeader && !isHlsHeader && !cueIdIndices.has(index);
          }
          // Strip YouTube VTT inline tags — 必须用带类名的形式(<c.colorE5E5E5>
          // 是 YouTube 的标准输出),裸 <c> 正则会留下不成对的开标签污染译文。
          extractedContent = line.replace(VTT_INLINE_C_TAG, "").replace(VTT_INLINE_TIMESTAMP, "");
        } else {
          isContent = trimmedLine !== "" && !isSeqNumber && !isTimecode;
          extractedContent = line;
        }
      }
    } else if (fileType === "sbv") {
      // SBV 结构 = 时间行 + 文本行 + 空行分隔,无 cue 序号、无头部 ——
      // 首个时间行之后,非空且非时间行的都是 cue 文本(数字台词也保留)
      const isSbvTimecode = SBV_TIME_REGEX.test(trimmedLine);
      if (!startExtracting && isSbvTimecode) {
        startExtracting = true;
      }

      if (startExtracting) {
        isContent = trimmedLine !== "" && !isSbvTimecode;
        extractedContent = line;
      }
    } else if (fileType === "lrc") {
      if (!startExtracting && LRC_TIME_REGEX.test(trimmedLine)) {
        startExtracting = true;
      }

      if (startExtracting) {
        extractedContent = trimmedLine.replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "").trim();
        // 只有当去除时间标记后内容不为空时，才认为是有效内容
        // (纯时间标记行如 "[01:23.45]" 是 LRC 的间奏锚点,不应送 LLM 翻译)。
        // 只判非空,不复用 isValidSubtitleLine:它的整数过滤是给 SRT cue 序号
        // 用的,LRC 没有序号 —— 纯数字歌词(倒数 "3"、年份 "1999")曾被它
        // 静默丢弃,永不翻译且无任何提示。
        isContent = extractedContent !== "";
      }
    } else if (fileType === "ass") {
      // 大小写不敏感 —— 检测器(detectSubtitleFormat)接受 "dialogue:",提取器
      // 此前大小写敏感,导致小写 ASS 文件被判定支持却提取不出任何内容。
      const isDialogue = /^dialogue:/i.test(trimmedLine);
      if (!startExtracting && isDialogue) {
        startExtracting = true;
      }

      if (startExtracting) {
        const parts = line.split(",");
        if (isDialogue && parts.length > assContentStartIndex) {
          extractedContent = parts.slice(assContentStartIndex).join(",").trim();
          // 只判提取后的 Text 字段非空(同 LRC 分支),不复用 isValidSubtitleLine:
          // 它校验的是整行 "Dialogue:...",对空 Text 的 sign/计时占位行永远返回 true,
          // 把 "" 当内容行推入 —— 非上下文路径会把空串发给翻译 API(白烧请求 + 污染
          // 缓存),LLM 路径关掉 context 感知时更会把幻觉文本写回原本空白的字幕行。
          // 不用 isValidSubtitleLine(extractedContent):它的纯整数过滤是给 SRT 序号的,
          // 会误杀正文是 "3"/"1999" 的 ASS 台词。
          isContent = extractedContent !== "";
        }
      }
    }

    if (isContent) {
      contentLines.push(extractedContent);
      contentIndices.push(index);
    }
  });

  return { contentLines, contentIndices, assContentStartIndex };
};

/**
 * 从 index 位置向上扫描 lines,找最近的 VTT/SRT 时间码行的【行号】。
 * 返回行号而非文本:双语聚合用它做 Map key —— 两个不同 cue 的时间码文本
 * 可能逐字节相同(叠放双说话人字幕、机器生成的占位时间码),按文本 key 会把
 * 后面 cue 的内容"传送"到前面合并、并在 SRT 路径留下空壳 cue。行号天然唯一。
 * trim 后再测试 —— 管线里其它所有匹配点都 trim,唯独这里曾不 trim,导致带
 * 前导空白时间码的文件双语 ASS 导出完全为空。
 * timeRegex 可换成 SBV_TIME_REGEX 等其它格式的时间行匹配(默认 VTT/SRT 箭头时间码)。
 */
export const findTimeLineIndexBefore = (lines: string[], index: number, timeRegex: RegExp = VTT_SRT_TIME): number => {
  for (let i = index - 1; i >= 0; i--) {
    if (timeRegex.test(lines[i].trim())) return i;
  }
  return -1;
};

/** 从 index 位置向上扫描 lines,找最近的时间码行(trim 后的文本) */
export const findTimeLineBefore = (lines: string[], index: number, timeRegex?: RegExp): string => {
  const i = findTimeLineIndexBefore(lines, index, timeRegex);
  return i === -1 ? "" : lines[i].trim();
};

// 将 WebVTT 或 SRT 的时间格式 "00:01:32.783" 或 "00:01:32,783" 转换为 ASS 的时间格式 "0:01:32.78"
// 同时处理有小时和无小时的情况
const TIME_REGEX = /^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})$/;
export const convertTimeToAss = (time: string): string => {
  const match = time.match(TIME_REGEX);
  if (!match) return time;
  const [, hours, minutes, seconds, ms] = match;
  // 毫秒 → 两位厘秒:先右侧补零到 3 位毫秒再取前两位。".5" 是 500ms = 50 厘秒
  // —— 旧实现 padStart 把它当 05(=50ms),双语 ASS 时间轴偏移近半秒。
  const msValue = ms.padEnd(3, "0").slice(0, 2);
  return `${parseInt(hours || "0", 10)}:${minutes}:${seconds}.${msValue}`;
};

/**
 * 构建 ASS 双语字幕的 [Events] body(Dialogue 行列表,不含 assHeader)。
 * 用于 SRT/VTT 源 + 双语 + format=ass 场景。
 *
 * 关键设计:用原 timeLine 字符串而非 ASS 转换后时间做 Map key —— ASS 时间精度只到厘秒,
 * 两个 ms 级差异的独立 cue 转换后 key 相同会被错误合并(回归点);Map 保留插入顺序。
 *
 * libass 渲染规则:先出现的 Dialogue 画在底,后出现的画在上。所以:
 * - isOriginalFirst=true(原文在上)→ 原文是 second(Default 样式,画在上),译文是 first(Secondary,画在底)
 * - isOriginalFirst=false → 反过来
 *
 * 多行 cue(同 timeLine 多条 content) 在同一 Dialogue pair 内用 \N 聚合,
 * 不会膨胀成多对 Dialogue。
 */
export const buildAssBilingualBody = (
  lines: string[],
  contentIndices: number[],
  translatedLines: string[],
  isOriginalFirst: boolean,
  // 清理后的原文(filterSubLines 的 contentLines,已剥 VTT 内联标签)。ASS 不认识
  // <c.color…>/卡拉 OK 时间戳,直接嵌 lines[index] 原始行会把字面标签渲染上屏。
  // 可选参数:不传时退回原始行(旧调用方兼容)。
  cleanedContents?: string[]
): string => {
  type CueEntry = { assStart: string; assEnd: string; first: string; second: string };
  // Map key = 时间码行的【行号】(findTimeLineIndexBefore):文本 key 会把时间码
  // 逐字节相同的两个独立 cue 错误合并(内容跨文件"传送")。行号唯一,同一物理
  // cue 的多行内容仍正确聚合。
  const subtitles = new Map<number, CueEntry>();

  contentIndices.forEach((index, i) => {
    const timeIdx = findTimeLineIndexBefore(lines, index);
    if (timeIdx === -1) return;
    const timeLine = lines[timeIdx].trim();

    const originalText = cleanedContents?.[i] ?? lines[index];
    const translatedText = translatedLines[i];
    const firstText = isOriginalFirst ? translatedText : originalText;
    const secondText = isOriginalFirst ? originalText : translatedText;

    const existing = subtitles.get(timeIdx);
    if (existing) {
      existing.first += `\\N${firstText}`;
      existing.second += `\\N${secondText}`;
    } else {
      const [startTime, endTime] = timeLine.split(TIME_ARROW_SPLIT).map((t) => t.trim().split(/\s/)[0]);
      subtitles.set(timeIdx, {
        assStart: convertTimeToAss(startTime.trim()),
        assEnd: convertTimeToAss(endTime.trim()),
        first: firstText,
        second: secondText,
      });
    }
  });

  return Array.from(subtitles.values())
    .map(
      ({ assStart, assEnd, first, second }) =>
        `Dialogue: 0,${assStart},${assEnd},Secondary,NTP,0000,0000,0000,,${first}\nDialogue: 0,${assStart},${assEnd},Default,NTP,0000,0000,0000,,${second}`
    )
    .join("\n");
};

// VTT 内联标签:<c.classname>、</c>、卡拉 OK 时间戳 <00:00:06.040>
const VTT_INLINE_C_TAG = /<\/?c\b[^>]*>/gi;
const VTT_INLINE_TIMESTAMP = /<\d{1,2}:\d{2}(?::\d{2})?(?:\.\d{1,3})?>/g;

// VTT 时间码 [H+:]MM:SS.mmm → SRT 时间码 HH:MM:SS,mmm
const VTT_TIME_REGEX = /^(?:(\d+):)?(\d{2}):(\d{2})\.(\d{1,3})$/;
const vttTimeToSrtTime = (time: string): string => {
  const m = time.match(VTT_TIME_REGEX);
  if (!m) return time.replace(".", ",");
  const [, h, mm, ss, ms] = m;
  const hh = String(parseInt(h || "0", 10)).padStart(2, "0");
  const ms3 = ms.padEnd(3, "0").slice(0, 3);
  return `${hh}:${mm}:${ss},${ms3}`;
};

const normalizeVttTimeLine = (line: string): string => {
  // 抽 start/end,丢弃 cue settings(SRT 不支持 line:/position: 等)
  const match = line.match(/^(\S+)\s+-->\s+(\S+)/);
  if (!match) return line;
  return `${vttTimeToSrtTime(match[1])} --> ${vttTimeToSrtTime(match[2])}`;
};

/**
 * VTT → SRT 文本转换:
 * - 删除 WEBVTT 头(直到第一个空行)
 * - 删除 NOTE / STYLE / REGION 块
 * - 时间码 . → , 并补齐 HH:MM:SS,mmm 格式
 * - 剥离 VTT 特有内联标签 <c>、卡拉 OK 时间戳
 * cue identifier、空行、内容行原样保留
 */
export const vttToSrt = (vttText: string): string => {
  const lines = vttText.split(/\r?\n/);
  const out: string[] = [];
  let skipUntilBlank = false;
  let cueNumber = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    // 块边界 = 文件头或上一行为空。NOTE/WEBVTT 只在块边界才是块起始 ——
    // cue 文本里以 "NOTE " 开头的台词不能被当注释整块删除。
    const atBlockBoundary = i === 0 || lines[i - 1].trim() === "";

    if (skipUntilBlank) {
      if (trimmed === "") {
        skipUntilBlank = false;
      } else if (VTT_SRT_TIME.test(trimmed)) {
        // 头/注释块未按规范以空行结束、直接跟 cue(WEBVTT 头后无空行的常见
        // 手写文件)—— 止损:停止跳过并按时间码处理,否则整个首 cue 被吞。
        skipUntilBlank = false;
      } else {
        continue;
      }
    }

    // VTT 头(WEBVTT 行,之后 metadata 直到空行)。不限 i===0:HLS 级联段
    // 会在文件中部再次出现 WEBVTT / X-TIMESTAMP-MAP 头。
    if (atBlockBoundary && /^WEBVTT(\s|$)/i.test(trimmed)) {
      skipUntilBlank = true;
      continue;
    }

    // NOTE / STYLE / REGION 块整块跳过(到下一个空行;仅块边界起始)
    if (atBlockBoundary && /^(NOTE|STYLE|REGION)(\s|$)/.test(trimmed)) {
      skipUntilBlank = true;
      continue;
    }

    // 时间码行:SRT 规范要求纯数字序号紧贴时间码上方 —— 丢弃 VTT 的 cue
    // identifier(具名 id 严格解析器会拒绝,数字 id 会与重编号冲突),统一
    // 重新编号。id 判定按源侧块结构(上一行非空且再上一行为空/文件头),
    // 与 filterSubLines 的 cueIdIndices 同一规则 —— 防止把无空行分隔的
    // 上一 cue 的最后一行内容误删。
    if (VTT_SRT_TIME.test(trimmed)) {
      const prevIsCueId = i >= 1 && lines[i - 1].trim() !== "" && !VTT_SRT_TIME.test(lines[i - 1].trim()) && (i - 2 < 0 || lines[i - 2].trim() === "");
      // pop 前必须确认源侧的 cue id 行真的被【输出】过:若它是被 skipUntilBlank
      // 吞掉的 NOTE/WEBVTT 行(无空行直接跟时间码的畸形文件),盲 pop 会吃掉
      // 上一个 cue 的空行分隔符,把两个 cue 在结构上粘连。
      const strippedPrev = i >= 1 ? lines[i - 1].replace(VTT_INLINE_C_TAG, "").replace(VTT_INLINE_TIMESTAMP, "") : "";
      if (prevIsCueId && out.length > 0 && out[out.length - 1] === strippedPrev) {
        out.pop();
      }
      cueNumber++;
      out.push(String(cueNumber));
      out.push(normalizeVttTimeLine(trimmed));
      continue;
    }

    // 内容行 / cue identifier / 空行:剥离 VTT 内联标签后原样保留
    out.push(line.replace(VTT_INLINE_C_TAG, "").replace(VTT_INLINE_TIMESTAMP, ""));
  }

  // 清头部空行;合并 3+ 连续空行为 1 个(VTT 块之间可能有多余空行)
  return out.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
};

/**
 * 从【已知 cue 结构】直接生成 VTT 源的 SRT 双语输出,而不是把译文插进 VTT 文本
 * 后再用 vttToSrt 重新解析。那次重解析仅凭 VTT_SRT_TIME 正则判定 cue 边界 ——
 * 一旦某 cue 的【原文或译文正文行本身以时间码开头】(屏显内容恰好是时间码区间),
 * 就会被误判为新 cue,把该 cue 拆开、丢掉一条译文并使其后全部重新编号错位。
 * 这里 cue 边界已知(findTimeLineIndexBefore 取每条内容行前的时间码行),据此直接
 * 拼 SRT,绝不重扫正文。对规范输入与旧 vttToSrt 路径逐字节一致(时间码 .→,、
 * 丢弃 cue settings / WEBVTT / NOTE / cue id、剥 VTT 内联标签、cue 间一个空行)。
 */
export const buildVttBilingualSrt = (lines: string[], contentIndices: number[], translatedLines: string[], isOriginalFirst: boolean): string => {
  const stripInline = (s: string) => s.replace(VTT_INLINE_C_TAG, "").replace(VTT_INLINE_TIMESTAMP, "");
  type CueGroup = { timeLine: string; origs: string[]; trans: string[] };
  // key = 时间码行号(同 generateSubtitle 的双语聚合):时间码文本相同的两个独立 cue 不合并
  const cueGroups = new Map<number, CueGroup>();
  contentIndices.forEach((index, i) => {
    const timeIdx = findTimeLineIndexBefore(lines, index);
    if (timeIdx === -1) return;
    const existing = cueGroups.get(timeIdx);
    if (existing) {
      existing.origs.push(lines[index]);
      existing.trans.push(translatedLines[i]);
    } else {
      cueGroups.set(timeIdx, { timeLine: lines[timeIdx], origs: [lines[index]], trans: [translatedLines[i]] });
    }
  });

  let seq = 0;
  const cues: string[] = [];
  for (const group of cueGroups.values()) {
    seq += 1;
    const allOrig = group.origs.map(stripInline).join("\n");
    const allTrans = group.trans.map(stripInline).join("\n");
    const body = isOriginalFirst ? `${allOrig}\n${allTrans}` : `${allTrans}\n${allOrig}`;
    cues.push(`${seq}\n${normalizeVttTimeLine(group.timeLine.trim())}\n${body}`);
  }
  // 与 vttToSrt 收尾一致:合并 3+ 连续空行(空译文留下的尾随空行 + cue 间空行)
  return cues.join("\n\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
};

// ASS 覆盖标签处理：翻译前剥离，翻译后还原
// 匹配行首连续的 ASS 覆盖标签块，如 {\an8}、{\an8\i1\b1}
const ASS_LEADING_TAGS_REGEX = /^(\{[^}]*\})+/;
// 匹配所有 ASS 覆盖标签块（用于剥离内联标签）
const ASS_ALL_TAGS_REGEX = /\{[^}]*\}/g;
// 匹配 ASS 换行符 \N 和 \n（字面反斜杠+字母，非转义字符）
const ASS_NEWLINE_REGEX = /\\[Nn]/g;

// 绘图模式检测:{\p1}..{\p9}(含小数 \p1.5 等)开启矢量绘图,其后的"文本"
// 是坐标指令(m 0 0 l 100 0 …),不是语言内容。
const ASS_DRAWING_MODE_REGEX = /\{[^}]*\\p\s*[1-9]/;

interface AssTagMap {
  /** 行首的覆盖标签，如 "{\an8}" */
  leadingTags: string;
  /** 整行原样保留(绘图模式等不可翻译行):还原时直接返回该值 */
  verbatim?: string;
}

/**
 * 翻译前：剥离 ASS 覆盖标签，将 \N/\n 转为真实换行
 * - {\...} 头部标签记录后剥离，内联标签直接剥离
 * - \N/\n 转为 \n，让 AI 自然理解换行
 * - 绘图模式行({\p1} 矢量遮罩)整行跳过:坐标串不是文本,送翻译会被改写,
 *   双语导出还会把坐标垃圾渲染上屏。cleanLines 占位 ""(空白行不进翻译),
 *   还原时原样返回。
 */
export const prepareAssForTranslation = (contentLines: string[]): { cleanLines: string[]; tagMaps: AssTagMap[] } => {
  const cleanLines: string[] = [];
  const tagMaps: AssTagMap[] = [];

  for (const line of contentLines) {
    if (ASS_DRAWING_MODE_REGEX.test(line)) {
      tagMaps.push({ leadingTags: "", verbatim: line });
      cleanLines.push("");
      continue;
    }

    // 1. 提取行首的连续覆盖标签
    let leadingTags = "";
    let remaining = line;
    const leadingMatch = line.match(ASS_LEADING_TAGS_REGEX);
    if (leadingMatch) {
      leadingTags = leadingMatch[0];
      remaining = line.substring(leadingTags.length);
    }

    // 2. 剥离剩余文本中的内联覆盖标签
    remaining = remaining.replace(ASS_ALL_TAGS_REGEX, "");

    // 3. 将 ASS 换行符 \N/\n 转为真实换行
    remaining = remaining.replace(ASS_NEWLINE_REGEX, "\n");

    tagMaps.push({ leadingTags });
    cleanLines.push(remaining);
  }

  return { cleanLines, tagMaps };
};

/**
 * 翻译后：将真实换行转回 \N，还原行首覆盖标签;verbatim 行原样返回
 */
export const restoreAssAfterTranslation = (translatedLines: string[], tagMaps: AssTagMap[]): string[] => {
  return translatedLines.map((line, i) => {
    const map = tagMaps[i];
    if (!map) return line;
    if (map.verbatim !== undefined) return map.verbatim;

    // 1. 将真实换行转回 ASS 硬换行 \N
    let restored = line.replace(/\n/g, "\\N");

    // 2. 还原行首覆盖标签
    if (map.leadingTags) {
      restored = map.leadingTags + restored;
    }

    return restored;
  });
};

// ASS 文件头模板
export const assHeader = `[Script Info]
Title: Bilingual Subtitles
ScriptType: v4.00+
WrapStyle: 0
ScaledBorderAndShadow: Yes
PlayResX: 1920
PlayResY: 1080
Collisions: Normal

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Noto Sans,70,&H00FFFFFF,&H0000FFFF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,30,30,35,1
Style: Secondary,Noto Sans,55,&H003CF7F4,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,30,30,35,1

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
