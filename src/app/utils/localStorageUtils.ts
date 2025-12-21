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

export const saveToLocalStorage = (key: string, value: unknown) => {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    console.error(`Error saving key "${key}" to localStorage:`, error);
  }
};
