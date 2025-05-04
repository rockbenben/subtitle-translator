// 过滤掉只包含空白的行，并根据 shouldTrim 参数决定是否去掉每行的首尾空白
export const cleanLines = (text: string, shouldTrim: boolean = false): string[] =>
  text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => (shouldTrim ? line.trim() : line));

// 截断字符串到指定长度，默认长度为 100K
const MAX_LENGTH = 100000;
export const truncate = (str: string, num: number = MAX_LENGTH): string => (str.length <= num ? str : `${str.slice(0, num)}...`);

const compactFormatter = new Intl.NumberFormat("en-US", {
  notation: "compact",
  compactDisplay: "short",
});

const MAX_CHAR_LENGTH = 1000000;
export const getTextStats = (str: string, num: number = MAX_CHAR_LENGTH) => {
  const totalChars = str.length;
  const totalLines = str.split("\n").length;
  const isTooLong = totalChars > num;
  const displayText = isTooLong ? truncate(str) : str;

  return {
    charCount: compactFormatter.format(totalChars),
    lineCount: compactFormatter.format(totalLines),
    isTooLong,
    displayText,
  };
};
