/**
 * JSONPath 工具函数
 * 用于处理 JSONPath 查询结果的过滤和处理
 */

/**
 * 过滤 JSONPath 结果，只保留真正的对象属性匹配，排除数组索引匹配
 * 这个函数主要解决数字键名（如 "1", "2" 等）同时匹配对象属性和数组索引的问题
 *
 * @param {Array} results - JSONPath 查询返回的结果数组
 * @param {string} keyName - 要查询的键名
 * @returns {Array} 过滤后的结果数组，只包含真正的对象属性匹配
 *
 * @example
 * // 这个函数解决数字键匹配数组索引的问题
 * // 保留对象属性匹配，过滤掉数组索引匹配
 */
// 预编译正则表达式和常量
const NUMERIC_KEY_REGEX = /^\d+$/;
const SEGMENT_MATCH_REGEX = /\[[^\]]+\]/g;
const STRING_KEY_CONTEXT_REGEX = /\['[^']*'\]/;
const STRING_KEY_EXTRACT_REGEX = /\['([^']*)'\]/;
const ARRAY_LIKE_KEYS = new Set(["content", "items", "list", "array", "data"]);

export const filterObjectPropertyMatches = <T extends { path: string }>(results: T[], keyName: string): T[] => {
  // 如果键名不是纯数字，不需要进行复杂过滤
  if (!NUMERIC_KEY_REGEX.test(keyName)) {
    return results;
  }

  // 预先构造匹配目标段的字符串，避免在循环中重复拼接
  const targetSegmentBracket = `[${keyName}]`;
  const targetSegmentSingleQuote = `['${keyName}']`;
  const targetSegmentDoubleQuote = `["${keyName}"]`;

  return results.filter((result) => {
    const pathStr = result.path;

    // 查找所有包含这个数字的路径段
    const segments = pathStr.match(SEGMENT_MATCH_REGEX) || [];

    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i];

      // 检查当前段是否匹配我们的键
      // 使用预构造的字符串进行比较
      if (segment === targetSegmentBracket || segment === targetSegmentSingleQuote || segment === targetSegmentDoubleQuote) {
        // 找到匹配的段，现在检查它是否是数组索引访问

        // 如果这是路径中的最后一个段，并且前面的段表示数组
        // 我们需要检查前一个段的上下文
        if (i > 0) {
          const prevSegment = segments[i - 1];

          // 如果前一个段是数字（数组索引），或者是字符串键名
          // 我们需要检查这个上下文来判断当前段是否是数组索引

          // 简单启发式：如果这个数字段紧跟在一个字符串键后面
          // 而且这个字符串键很可能是数组（比如包含 'content', 'items', 'list' 等）
          if (STRING_KEY_CONTEXT_REGEX.test(prevSegment)) {
            const match = prevSegment.match(STRING_KEY_EXTRACT_REGEX);
            const prevKeyName = match?.[1];

            if (prevKeyName) {
              // 检查前面的键名是否暗示这是一个数组
              const lowerPrevKey = prevKeyName.toLowerCase();
              const isArrayLikeKey = Array.from(ARRAY_LIKE_KEYS).some((arrayKey) => lowerPrevKey.includes(arrayKey));

              if (isArrayLikeKey) {
                // 这很可能是数组索引访问，过滤掉
                return false;
              }
            }
          }
        } else {
          // 这是根级别的访问，应该是对象属性
          return true;
        }
      }
    }

    // 如果没有找到匹配或者通过了所有检查，保留
    return true;
  });
};
