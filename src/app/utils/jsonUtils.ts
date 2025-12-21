/**
 * 预处理输入字符串并尝试将其解析为 JSON。
 * 如果输入不是有效的 JSON，尝试修复常见的格式问题并重新解析。
 * 如果处理失败，则抛出错误。
 */

import type { JsonObject, JsonValue } from "@/app/types";

// 轻量增强：移除 UTF-8 BOM
const stripBOM = (s: string) => (s && s.charCodeAt(0) === 0xfeff ? s.slice(1) : s);

// 严格尝试解析：不做额外包裹，仅返回解析结果或 null
// `JSON.parse()` 的运行时返回值一定是 JSON-safe 的，因此可视为 `JsonValue`。
const tryParse = (str: string): JsonValue | null => {
  try {
    return JSON.parse(str) as JsonValue;
  } catch {
    return null;
  }
};

const TRAILING_COMMA_END_REGEX = /,\s*$/;
const TRAILING_COMMA_REGEX = /,\s*([}\]])/g;
const KEY_FIX_REGEX = /([{,]\s*)([a-zA-Z0-9_\.]+)(\s*:\s*)/g;
const GENERAL_KEY_FIX_REGEX = /(['"])?([a-zA-Z0-9_\.]+)(['"])?:/g;

// JSON type guards
export const isJsonObject = (value: JsonValue): value is JsonObject => typeof value === "object" && value !== null && !Array.isArray(value);

export const preprocessJson = (input: string): JsonValue => {
  // 0) 基础清理
  const base = stripBOM(String(input));
  let parsed = tryParse(base);
  if (parsed !== null) return parsed;

  // 1) 去除首尾空白与尾逗号（含 } 或 ] 前的尾逗号）
  // 1) 去除首尾空白与尾逗号（含 } 或 ] 前的尾逗号）
  const trimmed = base.trim();
  const noTrailingCommas = trimmed.replace(TRAILING_COMMA_END_REGEX, "").replace(TRAILING_COMMA_REGEX, "$1");

  parsed = tryParse(noTrailingCommas);
  if (parsed !== null) return parsed;

  // 2) 在“已具备基本结构”的前提下，尽量只做键名补引号等温和修复
  const candidates: Array<() => string> = [
    // 给未加引号的键名补引号
    () => noTrailingCommas.replace(KEY_FIX_REGEX, '$1"$2"$3'),
    // 同样的修复，外层尝试包裹一次对象
    () => `{${noTrailingCommas}}`.replace(KEY_FIX_REGEX, '$1"$2"$3'),
    // 同样的修复，外层尝试包裹一次数组
    () => `[${noTrailingCommas}]`.replace(KEY_FIX_REGEX, '$1"$2"$3'),
    // 最后再兜底一次：将形如 foo: 或 "foo": 补成标准键
    () => noTrailingCommas.replace(GENERAL_KEY_FIX_REGEX, '"$2":'),
  ];

  for (const candidate of candidates) {
    const transformed = candidate();
    parsed = tryParse(transformed);
    if (parsed !== null) return parsed;
  }

  throw new Error("Unable to parse JSON 无法解析 JSON 数据。");
};

/**
 * 去除 JSON 字符串的最外层包裹（{} 或 []），返回内部内容。
 */
export const stripJsonWrapper = (input: string): string => {
  const trimmed = stripBOM(input).trim();
  if ((trimmed.startsWith("{") && trimmed.endsWith("}")) || (trimmed.startsWith("[") && trimmed.endsWith("]"))) {
    return trimmed.slice(1, -1).trim();
  }
  throw new Error("JSON format error: 缺少有效的外层包裹结构，请检查格式");
};
