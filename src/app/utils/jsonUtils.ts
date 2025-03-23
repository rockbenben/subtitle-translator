/**
 * 预处理输入字符串并尝试将其解析为 JSON。
 * 如果输入不是有效的 JSON，尝试修复常见的格式问题并重新解析。
 * 如果处理失败，则抛出错误。
 *
 * @param {string} input - 待处理和解析的字符串。
 * @return {any} 解析后的 JSON 数据。
 */
export const preprocessJson = (input: string): any => {
  try {
    return JSON.parse(input); // 直接解析
  } catch {
    let fixedInput = input.trim().replace(/,\s*$/, ""); // 去除末尾逗号

    // 修复未加引号的 JSON 键名（仅适用于简单情况）
    //fixedInput = fixedInput.replace(/([{,]\s*)([a-zA-Z0-9_]+)(\s*:\s*)/g, '$1"$2"$3');
    fixedInput = fixedInput.replace(/(['"])?([a-zA-Z0-9_\.]+)(['"])?:/g, '"$2":');

    try {
      return JSON.parse(fixedInput);
    } catch {
      // 依次尝试用 {} 或 [] 包裹
      for (const wrapper of ["{}", "[]"]) {
        try {
          return JSON.parse(wrapper[0] + fixedInput + wrapper[1]);
        } catch {
          continue;
        }
      }
    }
  }

  throw new Error("Unable to parse JSON 无法解析 JSON 数据。");
};

/**
 * 去除 JSON 字符串的最外层包裹（{} 或 []），返回内部内容。
 *
 * @param {string} input - 需要去除外层包裹的 JSON 字符串。
 * @return {string} 处理后的 JSON 字符串。
 */
export const stripJsonWrapper = (input: string): string => {
  const trimmed = input.trim();

  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return trimmed.slice(1, -1).trim();
  }

  throw new Error("JSON format error: 缺少有效的外层包裹结构，请检查格式");
};
