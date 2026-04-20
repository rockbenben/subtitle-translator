import { useState, useEffect, useRef } from "react";
import { loadFromLocalStorage, saveToLocalStorage } from "@/app/utils/localStorageUtils";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Start with defaultValue on BOTH server and first client render.
  // Reading localStorage during useState init would produce different markup
  // than SSR (server has no localStorage, client has the stored value), which
  // React flags as a hydration mismatch and then discards the tree.
  const [value, setValue] = useState<T>(defaultValue);
  const hasHydrated = useRef(false);

  // Declaration order matters: the save effect runs before the load effect on
  // the first commit, so the save guard sees hasHydrated=false and skips — we
  // don't clobber the stored value with defaultValue. The load effect then
  // flips hasHydrated and (if storage had a value) calls setValue, which
  // triggers a re-render where the save effect persists the real value.
  useEffect(() => {
    if (!hasHydrated.current) return;
    saveToLocalStorage(key, value);
  }, [key, value]);

  useEffect(() => {
    const storedValue = loadFromLocalStorage(key);
    if (storedValue !== null) setValue(storedValue as T);
    hasHydrated.current = true;
  }, [key]);

  return [value, setValue];
}
