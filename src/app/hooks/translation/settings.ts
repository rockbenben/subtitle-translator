// Translation settings export/import utilities

import { downloadFile } from "@/app/utils";
import type { TranslationConfig } from "@/app/lib/translation";
import type { GlossaryPreset } from "@/app/lib/translation/glossary";

export interface TranslationSettings {
  translationConfigs: Record<string, TranslationConfig>;
  systemPrompt: string;
  userPrompt: string;
  translationMethod: string;
  sourceLanguage: string;
  targetLanguage: string;
  targetLanguages: string[];
  multiLanguageMode: boolean;
  llmPresets?: Array<{ id: string; name: string; config: TranslationConfig }>;
  activeLlmPresetId?: string;
  promptPresets?: Array<{ id: string; name: string; systemPrompt: string; userPrompt: string }>;
  activePromptPresetId?: string;
  glossaryPresets?: GlossaryPreset[];
  activeGlossaryPresetId?: string;
  glossaryEnabled?: boolean;
  // 翻译行为调优项,跨设备同步时这些数值也要带上；默认使用缓存，不记忆
  retryCount?: number;
  requestTimeoutSec?: number;
  removeChars?: string;
  exportDate?: string;
  version?: string;
}

/**
 * Export translation settings to a JSON file
 * Returns true on success, throws error on failure
 */
export const exportTranslationSettings = async (settings: Omit<TranslationSettings, "exportDate" | "version">): Promise<void> => {
  const exportData: TranslationSettings = {
    ...settings,
    exportDate: new Date().toISOString(),
    version: "1.0",
  };

  const jsonString = JSON.stringify(exportData, null, 2);
  // en-CA = 本地日历日 YYYY-MM-DD:toISOString 是 UTC 日期,UTC+8 用户 0-8 点
  // 导出时文件名落在【昨天】(exportDate 字段保留完整 ISO 时间戳,不受影响)。
  const fileName = `translation-settings-${new Intl.DateTimeFormat("en-CA").format(new Date())}.json`;

  await downloadFile(jsonString, fileName, "application/json");
};

/**
 * Light structural sanity check: a parseable JSON object is not necessarily a
 * settings file. Verify a couple of expected top-level keys/types so we reject
 * foreign/malformed JSON instead of applying it and showing a false success.
 */
const isTranslationSettings = (value: unknown): value is TranslationSettings => {
  if (typeof value !== "object" || value === null) return false;
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.translationMethod === "string" &&
    typeof obj.translationConfigs === "object" &&
    obj.translationConfigs !== null &&
    Array.isArray(obj.targetLanguages)
  );
};

// Per-field expected types. Import applies fields individually with
// `!== undefined` gates, so a wrong-typed field (systemPrompt: null,
// glossaryPresets: {} — hand-edited or corrupted files) would land in
// localStorage as-is and persistently crash every consumer of that value
// until storage is hand-cleared. Sanitizing drops the bad field — the import
// simply skips it, keeping the user's existing value.
const FIELD_KINDS: Record<keyof Omit<TranslationSettings, "translationMethod" | "translationConfigs" | "targetLanguages">, "string" | "boolean" | "number" | "array"> = {
  systemPrompt: "string",
  userPrompt: "string",
  sourceLanguage: "string",
  targetLanguage: "string",
  multiLanguageMode: "boolean",
  llmPresets: "array",
  activeLlmPresetId: "string",
  promptPresets: "array",
  activePromptPresetId: "string",
  glossaryPresets: "array",
  activeGlossaryPresetId: "string",
  glossaryEnabled: "boolean",
  retryCount: "number",
  requestTimeoutSec: "number",
  removeChars: "string",
  exportDate: "string",
  version: "string",
};

const matchesKind = (value: unknown, kind: "string" | "boolean" | "number" | "array"): boolean => (kind === "array" ? Array.isArray(value) : typeof value === kind);

// Exported for unit tests (same pattern as buildYandexModelUri in services/llm.ts).
export const sanitizeSettings = (settings: TranslationSettings): TranslationSettings => {
  const out = { ...settings } as Record<string, unknown>;
  for (const [field, kind] of Object.entries(FIELD_KINDS)) {
    if (out[field] !== undefined && !matchesKind(out[field], kind)) {
      delete out[field];
    }
  }
  // 数值字段还要做【范围】校验(与 AdvancedTranslationSettings 的 InputNumber
  // min/max 同界):requestTimeoutSec: 0 通过 typeof 检查落盘后,每个请求在
  // 下一个宏任务就被 abort(且 abort 不可重试)—— 全部翻译 + 连接测试 + 预检
  // 持久失败,直到用户摸到高级设置重填。越界一律丢字段,导入保留现值。
  const NUMERIC_BOUNDS: Record<string, [number, number]> = { retryCount: [1, 10], requestTimeoutSec: [5, 1200] };
  for (const [field, [min, max]] of Object.entries(NUMERIC_BOUNDS)) {
    const v = out[field];
    if (typeof v === "number" && (!Number.isFinite(v) || v < min || v > max)) {
      delete out[field];
    }
  }
  // llmPresets / promptPresets 深度校验:与下方 glossaryPresets 同因 ——
  // Array.isArray 不够。[null] 会让设置抽屉每次打开都在 llmPresets.map(p =>
  // p.name) 上抛 TypeError;promptPresets 里 systemPrompt 非字符串的预设被
  // load 后落盘 translation-systemPrompt,useTranslationState 的
  // systemPrompt.trim() 在每次渲染抛错 → 所有翻译工具持久白屏直到手清存储。
  // 不合形状的预设直接丢弃。
  if (Array.isArray(out.llmPresets)) {
    out.llmPresets = (out.llmPresets as unknown[]).filter(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { id?: unknown }).id === "string" &&
        typeof (p as { name?: unknown }).name === "string" &&
        typeof (p as { config?: unknown }).config === "object" &&
        (p as { config?: unknown }).config !== null,
    );
  }
  if (Array.isArray(out.promptPresets)) {
    out.promptPresets = (out.promptPresets as unknown[]).filter(
      (p) =>
        typeof p === "object" &&
        p !== null &&
        typeof (p as { id?: unknown }).id === "string" &&
        typeof (p as { name?: unknown }).name === "string" &&
        typeof (p as { systemPrompt?: unknown }).systemPrompt === "string" &&
        typeof (p as { userPrompt?: unknown }).userPrompt === "string",
    );
  }
  // glossaryPresets 深度校验:Array.isArray 不够 —— terms 里混入非字符串
  // source/target(手编文件、坏导出、改名前 {from,to} 形状的旧文件)会进
  // localStorage,后续 term.source.trim() 在每次翻译时抛 TypeError,工具
  // 持久性白屏直到手清存储。不合形状的词条直接丢弃(不做 from/to 迁移)。
  if (Array.isArray(out.glossaryPresets)) {
    out.glossaryPresets = (out.glossaryPresets as unknown[])
      .filter((p): p is { id: string; name: string; terms: unknown } => typeof p === "object" && p !== null && typeof (p as { id?: unknown }).id === "string" && typeof (p as { name?: unknown }).name === "string")
      .map((p) => ({
        ...p,
        terms: Array.isArray(p.terms)
          ? (p.terms as unknown[]).filter(
              (t): t is { source: string; target: string; targetLang: string } =>
                typeof t === "object" && t !== null && typeof (t as { source?: unknown }).source === "string" && typeof (t as { target?: unknown }).target === "string" && typeof (t as { targetLang?: unknown }).targetLang === "string",
            )
          : [],
      }));
  }
  return out as unknown as TranslationSettings;
};

/**
 * Create file input and read JSON settings file
 * Returns parsed settings, throws error on failure
 */
export const createSettingsFileInput = (
  onSettingsLoaded: (settings: TranslationSettings) => void,
  readFile: (file: File, callback: (content: string) => void) => void,
): Promise<TranslationSettings> => {
  return new Promise((resolve, reject) => {
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = ".json";
    fileInput.style.display = "none";

    fileInput.onchange = (event) => {
      const file = (event.target as HTMLInputElement).files?.[0];
      if (!file) {
        reject(new Error("No file selected"));
        return;
      }

      readFile(file, (content) => {
        try {
          const parsed = JSON.parse(content) as unknown;

          if (!isTranslationSettings(parsed)) {
            reject(new Error("Not a valid translation settings file. / 不是有效的翻译设置文件。"));
            return;
          }

          const sanitized = sanitizeSettings(parsed);
          onSettingsLoaded(sanitized);
          resolve(sanitized);
        } catch (parseError) {
          console.error("Parse error:", parseError);
          reject(new Error("Failed to parse settings file. / 无法解析设置文件。"));
        }
      });
    };

    fileInput.onerror = () => {
      reject(new Error("Failed to read file"));
    };

    document.body.appendChild(fileInput);
    fileInput.click();

    // Cleanup DOM element after change fires or after user cancels (no change event)
    const cleanup = () => {
      if (document.body.contains(fileInput)) {
        document.body.removeChild(fileInput);
      }
    };

    // Use change event for cleanup after file selection; use focusback for cancel detection
    fileInput.addEventListener("change", () => setTimeout(cleanup, 0), { once: true });
    window.addEventListener("focus", () => setTimeout(cleanup, 300), { once: true });
  });
};
