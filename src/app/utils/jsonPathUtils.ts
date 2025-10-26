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
export const filterObjectPropertyMatches = (results, keyName) => {
  return results.filter(result => {
    const pathStr = result.path;
    
    // 如果键名是纯数字，我们需要特别小心
    const isNumericKey = /^\d+$/.test(keyName);
    if (isNumericKey) {
      // 对于数字键，需要区分对象属性访问和数组索引访问
      
      // 查找所有包含这个数字的路径段
      const segments = pathStr.match(/\[[^\]]+\]/g) || [];
      
      for (let i = 0; i < segments.length; i++) {
        const segment = segments[i];
        
        // 检查当前段是否匹配我们的键
        if (segment === `[${keyName}]` || segment === `['${keyName}']` || segment === `["${keyName}"]`) {
          // 找到匹配的段，现在检查它是否是数组索引访问
          
          // 如果这是路径中的最后一个段，并且前面的段表示数组
          // 我们需要检查前一个段的上下文
          if (i > 0) {
            const prevSegment = segments[i - 1];
            
            // 如果前一个段是数字（数组索引），或者是字符串键名
            // 我们需要检查这个上下文来判断当前段是否是数组索引
            
            // 简单启发式：如果这个数字段紧跟在一个字符串键后面
            // 而且这个字符串键很可能是数组（比如包含 'content', 'items', 'list' 等）
            const prevIsStringKey = /\['[^']*'\]/.test(prevSegment);
            const prevKeyName = prevSegment.match(/\['([^']*)'\]/)?.[1];
            
            if (prevIsStringKey && prevKeyName) {
              // 检查前面的键名是否暗示这是一个数组
              const arrayLikeKeys = ['content', 'items', 'list', 'array', 'data'];
              const isArrayLikeKey = arrayLikeKeys.some(arrayKey => 
                prevKeyName.toLowerCase().includes(arrayKey)
              );
              
              if (isArrayLikeKey) {
                // 这很可能是数组索引访问，过滤掉
                return false;
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
    } else {
      // 对于非数字键，所有匹配都应该是有效的对象属性
      return true;
    }
  });
};

/**
 * 安全的 JSONPath 查询函数，自动过滤数字键的数组索引匹配
 * 
 * @param {Object} options - JSONPath 查询选项
 * @param {string} options.path - JSONPath 表达式
 * @param {Object} options.json - 要查询的 JSON 对象
 * @param {string} options.resultType - 结果类型，默认 "all"
 * @param {string} keyName - 查询的键名，用于过滤
 * @returns {Array} 过滤后的查询结果
 */
export const safeJSONPathQuery = ({ path, json, resultType = "all" }, keyName) => {
  const { JSONPath } = require('jsonpath-plus');
  const results = JSONPath({ path, json, resultType });
  
  // 如果路径是 $..keyName 格式，应用过滤
  if (path.startsWith('$..') && keyName) {
    return filterObjectPropertyMatches(results, keyName);
  }
  
  return results;
};
