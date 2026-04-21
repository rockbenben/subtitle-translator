"use client";

import { useSyncExternalStore, useCallback, useRef } from "react";
import { saveToLocalStorage } from "@/app/utils/localStorageUtils";

// Shared subscriber set so every useLocalStorage in the tree re-runs
// getSnapshot when any setter writes (cross-hook consistency), plus the
// browser "storage" event (cross-tab consistency).
const listeners = new Set<() => void>();

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

function notify(): void {
  for (const cb of listeners) cb();
}

export function useLocalStorage<T>(key: string, defaultValue: T): [T, (value: T | ((prev: T) => T)) => void] {
  // Snapshot the initial defaultValue — callers frequently pass inline
  // object/array literals whose identity changes every render, which would
  // destabilize getSnapshot/getServerSnapshot. First value wins for the
  // lifetime of this hook instance; changing defaultValue after mount is
  // not a supported use case and would need a new hook instance anyway.
  const defaultRef = useRef(defaultValue);

  // useSyncExternalStore requires getSnapshot to return the same reference
  // when the underlying data hasn't changed — otherwise React enters an
  // infinite re-render loop. Cache the parsed value keyed by raw string.
  const cacheRef = useRef<{ raw: string | null; value: T; fallback: T } | null>(null);

  const getSnapshot = useCallback((): T => {
    const raw = window.localStorage.getItem(key);
    const fallback = defaultRef.current;
    const cache = cacheRef.current;
    if (cache && cache.raw === raw && cache.fallback === fallback) {
      return cache.value;
    }
    let value: T;
    if (raw === null) {
      value = fallback;
    } else {
      try {
        value = JSON.parse(raw) as T;
      } catch {
        value = fallback;
      }
    }
    cacheRef.current = { raw, value, fallback };
    return value;
  }, [key]);

  const getServerSnapshot = useCallback((): T => defaultRef.current, []);

  // React 18+ uses getServerSnapshot during SSR and hydration, then schedules
  // a post-hydration re-render with getSnapshot — hydration-safe by design
  // (replaces the hand-rolled defaultValue + effect + isDirty flag).
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setAndPersist = useCallback(
    (update: T | ((prev: T) => T)) => {
      const current = cacheRef.current?.value ?? defaultRef.current;
      const next = typeof update === "function" ? (update as (prev: T) => T)(current) : update;
      saveToLocalStorage(key, next);
      // Fan out to all hook instances in this tree
      notify();
    },
    [key],
  );

  return [value, setAndPersist];
}
