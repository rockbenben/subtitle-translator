"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { loadFromLocalStorage, saveToLocalStorage } from "@/app/utils/localStorageUtils";

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Start with defaultValue on BOTH server and first client render so SSR
  // markup matches. Reading localStorage in useState init would produce
  // different markup on server vs. client, triggering a hydration mismatch.
  const [value, setValue] = useState<T>(defaultValue);
  const isDirty = useRef(false);

  // Load from storage once on mount — unless the user has already written
  // through setAndPersist, in which case their value wins. Without this guard
  // a fast-clicking user could have their change silently overwritten when
  // the load effect resolved a beat later.
  useEffect(() => {
    if (isDirty.current) return;
    const stored = loadFromLocalStorage(key);
    if (stored !== null) setValue(stored as T);
  }, [key]);

  // Persist synchronously inside the state update so the write is committed
  // before React gets a chance to unmount the component for navigation —
  // the previous effect-driven save lost writes when a page change intervened.
  const setAndPersist = useCallback(
    (update: T | ((prev: T) => T)) => {
      isDirty.current = true;
      setValue((prev) => {
        const next = typeof update === "function" ? (update as (prev: T) => T)(prev) : update;
        saveToLocalStorage(key, next);
        return next;
      });
    },
    [key],
  );

  return [value, setAndPersist];
}
