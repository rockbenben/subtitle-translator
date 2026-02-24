import { useState, useEffect, useRef } from "react";
import { loadFromLocalStorage, saveToLocalStorage } from "@/app/utils/localStorageUtils";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    if (typeof window === "undefined") return defaultValue;
    const storedValue = loadFromLocalStorage(key);
    return storedValue !== null ? (storedValue as T) : defaultValue;
  });
  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
      saveToLocalStorage(key, value);
    } else {
      isMounted.current = true;
    }
  }, [key, value]);

  return [value, setValue];
}
