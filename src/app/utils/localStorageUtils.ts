// 浏览器「阻止所有 Cookie」/嵌入式 WebView 拒绝存储时,window.localStorage
// 【属性访问本身】抛 SecurityError —— 读路径不护住会让整棵 React 树渲染崩溃
// (仓库没有 error boundary,全站白屏)。读写失败时落到会话级内存 Map:
// 只裸降级成 null 的话,所有 useLocalStorage 背书的受控输入(API key 输入框、
// provider 选择器、导出开关…)写入后 getSnapshot 永远读回默认值 —— 每敲一个
// 键就被弹回,整个设置面板冻死且无任何提示。内存兜底让站点以"会话内可用、
// 不持久化"模式照常工作。
const memoryStore = new Map<string, string>();

export const readLocalStorageRaw = (key: string): string | null => {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return memoryStore.get(key) ?? null;
  }
};

export const loadFromLocalStorage = (key: string) => {
  const storedValue = readLocalStorageRaw(key);
  if (storedValue === null) return null;

  try {
    return JSON.parse(storedValue);
  } catch {
    return null; // 避免返回无法解析的原始字符串
  }
};

// 仅在首次遇到存储配额/隐私模式写入失败时提示一次,避免逐字符写入时反复刷屏
let persistWarned = false;

const isQuotaError = (error: unknown): boolean => {
  if (!(error instanceof DOMException)) return false;
  // 标准 QuotaExceededError(22)、Firefox NS_ERROR_DOM_QUOTA_REACHED(1014)、Safari 私密模式
  return error.name === "QuotaExceededError" || error.name === "NS_ERROR_DOM_QUOTA_REACHED" || error.code === 22 || error.code === 1014;
};

export const saveToLocalStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    // 写失败(存储被禁/配额满)→ 会话内存兜底,readLocalStorageRaw 的 catch
    // 路径会读到它;存储可用但配额满时读路径仍走 localStorage(行为同旧版)。
    try {
      memoryStore.set(key, JSON.stringify(value));
    } catch {
      /* 值不可序列化时维持旧行为:静默丢弃 */
    }
    console.error(`Error saving key "${key}" to localStorage:`, error);
    if (isQuotaError(error) && !persistWarned) {
      persistWarned = true;
      console.warn("localStorage write failed (quota exceeded or private mode); preferences will not be saved.");
      // 静态 message,不依赖 React 上下文;模块级 flag 保证整个会话只提示一次
      void import("antd").then(({ message }) => {
        message.warning("Browser storage is full or in private mode; settings cannot be saved. / 浏览器存储空间不足或处于隐私模式，设置将无法保存。");
      });
    }
  }
};
