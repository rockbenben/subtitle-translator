// 设置文件的形状与消毒 —— 从 hooks/translation/settings.ts 移入的纯函数部分。
// 网页端导入(createSettingsFileInput)与 CLI(-s 读文件)共用同一份校验:
// 越界数值、坏形状预设在【两个入口】都被丢弃,而不是各自维护一半。
// 浏览器专属的导出/文件选择器留在 hooks 侧,那边【只 import 自用、不再转发】
// (转发会让同一符号有两条活的导入路径;lib/__tests__/translationLayerBoundary
// .test.ts 会拒绝任何 `export ... from "@/app/lib/..."`)。需要这里的符号请直接
// 从本模块导入。

import type { RuntimeGlobals, TranslationConfig } from "./types";
import type { GlossaryPreset } from "./glossary";
import { isSafeRelayBaseProtocol } from "./services/shared";

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
  /** User's own relay origin; empty = built-in. Sanitized hard — see below. */
  relayBase?: string;
  removeChars?: string;
  exportDate?: string;
  version?: string;
}

/**
 * Light structural sanity check: a parseable JSON object is not necessarily a
 * settings file. Verify a couple of expected top-level keys/types so we reject
 * foreign/malformed JSON instead of applying it and showing a false success.
 */
export const isTranslationSettings = (value: unknown): value is TranslationSettings => {
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
  relayBase: "string",
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

  // relayBase 比其他字段多一道【协议】校验,因为它决定 apiKey 发到哪台机器:
  // 设置文件是可以互相分享/从聊天记录里捡来的,一个把 relayBase 指向攻击者域名
  // 的文件,用户导入后下一次翻译就把每个 provider 的 key 原样送出去了 —— 类型
  // 检查(是不是 string)拦不住这个。只放行 http/https 的可解析 URL:javascript:
  // / data: / 相对路径一律丢字段,导入保留用户现值(空 = 内置中转)。
  //
  // 注意这【不是】在防用户自己:UI 里手填什么地址是他的自由(要自建中转就得能
  // 填)。这里防的是「从别处来的 JSON」这一条路径。
  // ⚠ 判据是【协议安全】(isSafeRelayBaseProtocol),不是【可用】(isValidRelayBase)。
  // 后者还要求无查询串、不是 /api 端点 —— 那是"能不能用"的问题,该由红框和运行时
  // 抛错告诉用户,不该在导入时静默删字段:`…/relay/?k=SECRET` 是带共享密钥的自建
  // 中转的常见形状,删掉它而同一份文件里的 useRelay:true 与 apiKey 照常导入,
  // 接收方会看到绿色"导入成功",之后每次翻译把 key 发到内置公共中转 —— 正是
  // 这段注释要防的那件事,只是换了条路进来。
  if (typeof out.relayBase === "string" && out.relayBase.trim() && !isSafeRelayBaseProtocol(out.relayBase)) {
    delete out.relayBase;
    // ⚠ 连 useRelay 一起关掉。只删 relayBase 会留下一个更隐蔽的洞:同一份文件里的
    // useRelay:true 与 apiKey 照常导入,而空 relayBase 的语义是「用内置公共中转」
    // —— 用户明明写了自建地址(最常见的是漏了 https://),看到绿色"导入成功",
    // 之后每次翻译都把 key 发到那台公共 Worker,屏幕上没有任何东西提过中转被丢了。
    // 地址不可信时,唯一安全的默认是【不走中转】,让用户自己重新开。
    for (const cfg of Object.values(out.translationConfigs ?? {})) {
      if (cfg && typeof cfg === "object" && "useRelay" in cfg) delete (cfg as Record<string, unknown>).useRelay;
    }
  }

  // per-provider 的数值同样要查。上面那段注释一直宣称「越界一律丢字段,不会流进
  // pipeline」,但 translationConfigs 此前【整个没被看过】:migrateConfig 原样拷进
  // PipelineRuntimeConfig,于是一份手改坏的设置文件配上 `yarn cli -s`,
  // contextBatchSize: 1000 会直接 pLimit(1000) 打出一千个并发请求,把 key 顶成
  // 硬限流甚至封禁;delayTime: 1e9 让 abortableSleep 每行睡十一天,用户读到的是
  // 永久卡死。
  //
  // 边界【严格照抄 TranslationSettings.tsx 的 InputNumber min/max】,一个不多。
  // UI 没有上限的字段(batchSize / chunkSize / delayTime)这里也只补下限 ——
  // 凭空加个 CLI 才有的天花板,就是又造一次「CLI 比网页端更严」。
  const CONFIG_NUMERIC_BOUNDS: Record<string, [number, number]> = {
    temperature: [0, 1.99],
    maxTokens: [0, 128000],
    contextWindow: [1, 500],
    contextBatchSize: [1, 50],
    batchSize: [1, Infinity],
    chunkSize: [1, Infinity],
    delayTime: [1, Infinity],
  };
  // 整数字段:小数会让 p-limit 直接抛 TypeError(见 pipeline 的 pLimit 注释)。
  const CONFIG_INTEGER_FIELDS = new Set(["maxTokens", "contextWindow", "contextBatchSize", "batchSize", "chunkSize", "delayTime"]);
  const sanitizeProviderConfig = (cfg: unknown): void => {
    if (typeof cfg !== "object" || cfg === null) return;
    const bag = cfg as Record<string, unknown>;
    for (const [field, [min, max]] of Object.entries(CONFIG_NUMERIC_BOUNDS)) {
      const v = bag[field];
      if (v === undefined) continue;
      // 非 number 一律【丢字段】而不是放行。原来这里是 `continue`,于是
      // `contextBatchSize: "1000"`(字符串,手改或第三方设置文件)绕过了本模块
      // 存在的全部意义:下游 Number("1000") 照样算出 1000 并 pLimit(1000) ——
      // 正是上面注释声称已挡住的「一千个并发把 key 顶成硬限流甚至封禁」。
      // `chunkSize: "abc"` 更阴:truthy 字符串保留,NaN 比较恒假 → 整份文档
      // 当作一个 chunk 发出,撞上下文长度上限。
      if (typeof v !== "number") {
        delete bag[field];
        continue;
      }
      // 丢字段(而非夹到边界):下游 `?? 默认值` 会补回一个合理值,而夹取会把
      // 「1000 并发」悄悄变成「50 并发」——用户以为设置生效了,其实没有。
      if (!Number.isFinite(v) || v < min || v > max) delete bag[field];
      else if (CONFIG_INTEGER_FIELDS.has(field) && !Number.isInteger(v)) delete bag[field];
    }
  };

  const configs = out.translationConfigs;
  if (typeof configs === "object" && configs !== null) {
    for (const cfg of Object.values(configs as Record<string, unknown>)) sanitizeProviderConfig(cfg);
  }
  // llmPresets / promptPresets 深度校验:与下方 glossaryPresets 同因 ——
  // Array.isArray 不够。[null] 会让设置抽屉每次打开都在 llmPresets.map(p =>
  // p.name) 上抛 TypeError;promptPresets 里 systemPrompt 非字符串的预设被
  // load 后落盘 translation-systemPrompt,useTranslationState 的
  // systemPrompt.trim() 在每次渲染抛错 → 所有翻译工具持久白屏直到手清存储。
  // 不合形状的预设直接丢弃。
  // ⚠ llmPresets[].config 是【第二个入口】:loadLlmPreset 会把它原样拷进
  // translationConfigs.llm,所以上面那句「越界数值不会流进 pipeline」在这里
  // 有一扇侧门 —— 预设里的 contextBatchSize: 1000 照样能打出一千并发。
  // 形状过滤(下方)之后统一再消毒一遍数值。
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
    for (const preset of out.llmPresets as Array<{ config: unknown }>) sanitizeProviderConfig(preset.config);
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
  // targetLanguages 的【元素】校验。三个 preset 数组都做了元素级深度校验,唯独
  // 这个漏了 —— 而它恰恰是 isTranslationSettings 唯一把关的数组(那里也只有
  // Array.isArray),且 FIELD_KINDS 通过 Omit 把它整个排除在类型检查之外。
  // 后果分平台:CLI 在 pathKey 处 `null.toLowerCase()` 直接 fatal(一个字节都
  // 没翻);大小写敏感平台上 /^[A-Za-z0-9_-]+$/ 把 null 强制成 "null" 放行,
  // 写出 movie.null.srt;网页导入则把 [null, 42] 持久化进 localStorage。
  // 丢弃非字符串元素而非整个字段:保住用户其余合法的语言。
  if (Array.isArray(out.targetLanguages)) {
    out.targetLanguages = (out.targetLanguages as unknown[]).filter((l): l is string => typeof l === "string" && l.trim() !== "");
  }
  return out as unknown as TranslationSettings;
};

/**
 * 设置文件顶层的【全局运行旋钮】→ PipelineRuntimeConfig,统一拾取。
 *
 * 这五个字段不属于任何 provider 的 config,却决定每次请求的行为(prompt、
 * 重试预算、超时、中转宿主)。CLI 的 buildConfig 直接展开本函数;网页端
 * 运行态不经 TranslationSettings(状态散在各 useLocalStorage 键,由
 * getSelectedConfig / hook 各自并入),但导入导出走的是同一个类型。
 *
 * 存在的理由与 getSelectedConfig 并入 relayBase 同款:relayBase 曾经在
 * CLI 这边漏接(网页配了自建中转、CLI 照打内置)。新增全局旋钮时改这里,
 * CLI 自动跟上,"两个薄壳各自维护一份清单"的失败模式不再可写。
 */
export const pickRuntimeGlobals = (s: Partial<TranslationSettings>): RuntimeGlobals => ({
  systemPrompt: s.systemPrompt,
  userPrompt: s.userPrompt,
  retryCount: s.retryCount,
  requestTimeoutSec: s.requestTimeoutSec,
  relayBase: s.relayBase,
});
