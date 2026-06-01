export const loadFromLocalStorage = (key: string) => {
  if (typeof window === "undefined") return null;
  const storedValue = localStorage.getItem(key);
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
