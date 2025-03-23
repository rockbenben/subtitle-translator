// 过滤掉只包含空白的行，并根据 shouldTrim 参数决定是否去掉每行的首尾空白
export const cleanLines = (text: string, shouldTrim: boolean = false): string[] =>
  text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => (shouldTrim ? line.trim() : line));
