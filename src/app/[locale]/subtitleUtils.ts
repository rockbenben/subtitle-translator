// 用于匹配 VTT/SRT 时间行（支持默认小时省略、多位数小时以及 1 到 3 位毫秒值）
export const VTT_SRT_TIME = /^(?:\d+:)?\d{2}:\d{2}[,.]\d{1,3} --> (?:\d+:)?\d{2}:\d{2}[,.]\d{1,3}/;
// LRC 格式的时间标记正则表达式
export const LRC_TIME_REGEX = /^\[\d{2}:\d{2}(\.\d{2,3})?\]/;
// Same pattern with global flag — for `.match` / `.replace` across a line that
// may have multiple time tags (e.g. karaoke lines). Pre-compiled at module
// scope so the bilingual-output loop in SubtitleTranslator doesn't `new
// RegExp()` per line × per call (was 2× per LRC line on every export).
export const LRC_TIME_REGEX_GLOBAL = /\[\d{2}:\d{2}(?:\.\d{2,3})?\]/g;
const LRC_METADATA_REGEX = /^\[(ar|ti|al|by|offset|re|ve):/i;

// 识别字幕文件的类型
export const detectSubtitleFormat = (lines: string[]): "ass" | "vtt" | "srt" | "lrc" | "error" => {
  // 获取前 50 行，并去除其中的空行
  const nonEmptyLines = lines.slice(0, 50).filter((line) => line.trim().length > 0);
  let assCount = 0,
    vttCount = 0,
    srtCount = 0,
    lrcCount = 0;

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const trimmed = nonEmptyLines[i].trim();

    // ASS 格式判断：如果存在 [script info]，或对话行符合 ASS 格式
    if (/^\[script info\]/i.test(trimmed)) return "ass";

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
  }

  // 根据时间行分隔符数量判断;同票时 VTT > SRT(VTT 解析更宽容、能兜底 SRT 类型时间码),
  // 与 ASS/LRC 的 >= 一致
  if (assCount > 0 && assCount >= Math.max(vttCount, srtCount, lrcCount)) {
    return "ass";
  }
  if (lrcCount > 0 && lrcCount >= Math.max(vttCount, srtCount)) {
    return "lrc";
  }
  if (vttCount > 0 && vttCount >= srtCount) return "vtt";
  if (srtCount > 0) return "srt";
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

export const getOutputFileExtension = (fileType: string, bilingualSubtitle: boolean, bilingualFormat: BilingualFormat = "ass"): string => {
  if (fileType === "lrc") {
    return "lrc";
  }
  if (fileType === "ass") {
    return "ass";
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
// 检测当前行是否为有效字幕内容(非空 且 非纯整数序号)
const isValidSubtitleLine = (str: string): boolean => {
  const trimmedStr = str.trim();
  return trimmedStr !== "" && !INTEGER_REGEX.test(trimmedStr);
};

export const filterSubLines = (lines: string[], fileType: string) => {
  const contentLines: string[] = [];
  const contentIndices: number[] = [];
  let startExtracting = false;
  let assContentStartIndex = 9;
  let formatFound = false;

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
    const eventIndex = lines.findIndex((line) => line.trim() === "[Events]");
    if (eventIndex !== -1) {
      for (let i = eventIndex; i < lines.length; i++) {
        if (lines[i].startsWith("Format:")) {
          const formatLine = lines[i];
          assContentStartIndex = formatLine.split(",").length - 1;
          formatFound = true;
          break;
        }
      }
    }

    if (!formatFound) {
      const dialogueLines = lines.filter((line) => line.startsWith("Dialogue:")).slice(0, 100);
      if (dialogueLines.length > 0) {
        const commaCounts = dialogueLines.map((line) => line.split(",").length - 1);
        assContentStartIndex = Math.min(...commaCounts);
      }
    }
  }

  lines.forEach((line, index) => {
    let isContent = false;
    let extractedContent = "";
    const trimmedLine = line.trim();

    if (fileType === "srt" || fileType === "vtt") {
      if (!startExtracting) {
        // 用 trimmedLine 跟下方 isTimecode 检测一致 —— 带前导空白的 SRT 文件首个时间码也能识别
        const isTimecode = /^[\d:,]+ --> [\d:,]+/.test(trimmedLine) || /^[\d:.]+ --> [\d:.]+/.test(trimmedLine);
        if (isTimecode) {
          startExtracting = true;
        }
      }

      if (startExtracting) {
        if (fileType === "vtt") {
          const isTimecode = /^[\d:.]+ --> [\d:.]+/.test(trimmedLine);
          const isWebVTTHeader = trimmedLine.startsWith("WEBVTT");
          // WebVTT non-cue blocks per spec — NOTE (comments), STYLE (CSS),
          // REGION (positioning). Previously checked `startsWith("#")` which
          // is Markdown syntax, not WebVTT: real NOTE blocks were treated as
          // cue text and hashtag-starting cues were dropped.
          const isMetaBlock = /^(NOTE|STYLE|REGION)(\s|$)/.test(trimmedLine);
          isContent = isValidSubtitleLine(line) && !isTimecode && !isWebVTTHeader && !isMetaBlock && !cueIdIndices.has(index);
          // Strip YouTube VTT inline tags: <c>, </c>, and karaoke timestamps like <00:00:06.040>
          extractedContent = line.replace(/<\/?c>/g, "").replace(/<[\d:.]+>/g, "");
        } else {
          const isTimecode = /^[\d:,]+ --> [\d:,]+/.test(trimmedLine);
          isContent = isValidSubtitleLine(line) && !isTimecode;
          extractedContent = line;
        }
      }
    } else if (fileType === "lrc") {
      if (!startExtracting && LRC_TIME_REGEX.test(trimmedLine)) {
        startExtracting = true;
      }

      if (startExtracting) {
        extractedContent = trimmedLine.replace(/\[\d{2}:\d{2}(\.\d{2,3})?\]/g, "").trim();
        // 只有当去除时间标记后内容不为空时，才认为是有效内容
        // (纯时间标记行如 "[01:23.45]" 是 LRC 的间奏锚点,不应送 LLM 翻译)
        isContent = isValidSubtitleLine(extractedContent);
      }
    } else if (fileType === "ass") {
      if (!startExtracting && trimmedLine.startsWith("Dialogue:")) {
        startExtracting = true;
      }

      if (startExtracting) {
        const parts = line.split(",");
        if (line.startsWith("Dialogue:") && parts.length > assContentStartIndex) {
          extractedContent = parts.slice(assContentStartIndex).join(",").trim();
          isContent = isValidSubtitleLine(line);
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

/** 从 index 位置向上扫描 lines,找最近的 VTT/SRT 时间码行 */
export const findTimeLineBefore = (lines: string[], index: number): string => {
  for (let i = index - 1; i >= 0; i--) {
    if (VTT_SRT_TIME.test(lines[i])) return lines[i];
  }
  return "";
};

// 将 WebVTT 或 SRT 的时间格式 "00:01:32.783" 或 "00:01:32,783" 转换为 ASS 的时间格式 "0:01:32.78"
// 同时处理有小时和无小时的情况
const TIME_REGEX = /^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})$/;
export const convertTimeToAss = (time: string): string => {
  const match = time.match(TIME_REGEX);
  if (!match) return time;
  const [, hours, minutes, seconds, ms] = match;
  // 处理毫秒：确保转换为两位厘秒。如果输入是毫秒（3 位数），取前两位；如果只有一位数如 9，用 0 填充，显示为 09。
  const msValue = ms.length >= 2 ? ms.substring(0, 2) : ms.padStart(2, "0");
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
  isOriginalFirst: boolean
): string => {
  type CueEntry = { assStart: string; assEnd: string; first: string; second: string };
  const subtitles = new Map<string, CueEntry>();

  contentIndices.forEach((index, i) => {
    const timeLine = findTimeLineBefore(lines, index);
    if (!timeLine) return;

    const originalText = lines[index];
    const translatedText = translatedLines[i];
    const firstText = isOriginalFirst ? translatedText : originalText;
    const secondText = isOriginalFirst ? originalText : translatedText;

    const existing = subtitles.get(timeLine);
    if (existing) {
      existing.first += `\\N${firstText}`;
      existing.second += `\\N${secondText}`;
    } else {
      const [startTime, endTime] = timeLine.split(" --> ").map((t) => t.trim().split(/\s/)[0]);
      subtitles.set(timeLine, {
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

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (skipUntilBlank) {
      if (trimmed === "") skipUntilBlank = false;
      continue;
    }

    // VTT 头(首行 WEBVTT,之后 metadata 直到空行)
    if (i === 0 && /^WEBVTT(\s|$)/i.test(trimmed)) {
      skipUntilBlank = true;
      continue;
    }

    // NOTE / STYLE / REGION 块整块跳过(到下一个空行)
    if (/^(NOTE|STYLE|REGION)(\s|$)/.test(trimmed)) {
      skipUntilBlank = true;
      continue;
    }

    // 时间码行
    if (VTT_SRT_TIME.test(trimmed)) {
      out.push(normalizeVttTimeLine(trimmed));
      continue;
    }

    // 内容行 / cue identifier / 空行:剥离 VTT 内联标签后原样保留
    out.push(line.replace(VTT_INLINE_C_TAG, "").replace(VTT_INLINE_TIMESTAMP, ""));
  }

  // 清头部空行;合并 3+ 连续空行为 1 个(VTT 块之间可能有多余空行)
  return out.join("\n").replace(/^\n+/, "").replace(/\n{3,}/g, "\n\n");
};

// ASS 覆盖标签处理：翻译前剥离，翻译后还原
// 匹配行首连续的 ASS 覆盖标签块，如 {\an8}、{\an8\i1\b1}
const ASS_LEADING_TAGS_REGEX = /^(\{[^}]*\})+/;
// 匹配所有 ASS 覆盖标签块（用于剥离内联标签）
const ASS_ALL_TAGS_REGEX = /\{[^}]*\}/g;
// 匹配 ASS 换行符 \N 和 \n（字面反斜杠+字母，非转义字符）
const ASS_NEWLINE_REGEX = /\\[Nn]/g;

interface AssTagMap {
  /** 行首的覆盖标签，如 "{\an8}" */
  leadingTags: string;
}

/**
 * 翻译前：剥离 ASS 覆盖标签，将 \N/\n 转为真实换行
 * - {\...} 头部标签记录后剥离，内联标签直接剥离
 * - \N/\n 转为 \n，让 AI 自然理解换行
 */
export const prepareAssForTranslation = (contentLines: string[]): { cleanLines: string[]; tagMaps: AssTagMap[] } => {
  const cleanLines: string[] = [];
  const tagMaps: AssTagMap[] = [];

  for (const line of contentLines) {
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
 * 翻译后：将真实换行转回 \N，还原行首覆盖标签
 */
export const restoreAssAfterTranslation = (translatedLines: string[], tagMaps: AssTagMap[]): string[] => {
  return translatedLines.map((line, i) => {
    const map = tagMaps[i];
    if (!map) return line;

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
