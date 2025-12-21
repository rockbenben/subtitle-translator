import { useState, useEffect, useRef } from "react";
import { loadFromLocalStorage, saveToLocalStorage } from "@/app/utils/localStorageUtils";

export function useLocalStorage<T>(key: string, defaultValue: T) {
  // Initialize with defaultValue to ensure server and client match during hydration
  const [value, setValue] = useState<T>(defaultValue);

  // Load from local storage after mount
  useEffect(() => {
    const storedValue = loadFromLocalStorage(key);
    if (storedValue !== null) {
      setValue(storedValue);
    }
  }, [key]);

  const isMounted = useRef(false);

  useEffect(() => {
    if (isMounted.current) {
      saveToLocalStorage(key, value);
    } else {
      isMounted.current = true;
    }
  }, [key, value]);

  return [value, setValue] as const;
}
