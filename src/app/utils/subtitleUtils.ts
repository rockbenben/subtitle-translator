// 用于匹配 VTT/SRT 时间行（支持默认小时省略、多位数小时以及 1 到 3 位毫秒值）
export const VTT_SRT_TIME = /^(?:\d+:)?\d{2}:\d{2}[,.]\d{1,3} --> (?:\d+:)?\d{2}:\d{2}[,.]\d{1,3}$/;

// 识别字幕文件的类型
export const detectSubtitleFormat = (lines: string[]): "ass" | "vtt" | "srt" | "error" => {
  // 获取前 50 行，并去除其中的空行
  const nonEmptyLines = lines.slice(0, 50).filter((line) => line.trim().length > 0);
  let assCount = 0,
    vttCount = 0,
    srtCount = 0;

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
  }

  // 根据时间行分隔符数量判断
  if (assCount > 0 && assCount >= Math.max(vttCount, srtCount)) {
    return "ass";
  }
  if (vttCount > srtCount) return "vtt";
  if (srtCount > 0) return "srt";
  return "error";
};

export const getOutputFileExtension = (fileType: string, bilingualSubtitle: boolean): string => {
  if (bilingualSubtitle || fileType === "ass") {
    return "ass";
  } else if (fileType === "vtt") {
    return "vtt";
  } else {
    return "srt";
  }
};

// 预编译正则表达式用于检测纯数字行
const INTEGER_REGEX = /^\d+$/;
// 检测当前行是否为整数和空行
export const isValidSubtitleLine = (str: string): boolean => {
  const trimmedStr = str.trim();
  return trimmedStr !== "" && !INTEGER_REGEX.test(trimmedStr);
};

// 将 WebVTT 或 SRT 的时间格式 "00:01:32.783" 或 "00:01:32,783" 转换为 ASS 的时间格式 "0:01:32.78"
// 同时处理有小时和无小时的情况
const TIME_REGEX = /^(?:(\d+):)?(\d{2}):(\d{2})[,.](\d{1,3})$/;
export const convertTimeToAss = (time: string): string => {
  const match = time.match(TIME_REGEX);
  if (!match) return time;
  const [_, hours, minutes, seconds, ms] = match;
  // 处理毫秒：确保转换为两位厘秒。如果输入是毫秒（3 位数），取前两位；如果只有一位数如 9，用 0 填充，显示为 09。
  const msValue = ms.length >= 2 ? ms.substring(0, 2) : ms.padStart(2, "0");
  return `${parseInt(hours || "0", 10)}:${minutes}:${seconds}.${msValue}`;
};

// ASS 文件头模板
export const assHeader = `[Script Info]
ScriptType: v4.00+
Collisions: Normal
ScaledBorderAndShadow: Yes
WrapStyle: 0
Synch Point: 0
Title: Bilingual Subtitles

[V4+ Styles]
Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, Alignment, MarginL, MarginR, MarginV, Encoding
Style: Default,Microsoft YaHei,18,&H00FFFFFF,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,40,134
Style: Secondary,Microsoft YaHei,16,&H003CF7F4,&H000000FF,&H00000000,&H00000000,0,0,0,0,100,100,0,0,1,2,1,2,10,10,20,134

[Events]
Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, Effect, Text`;
