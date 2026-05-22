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

// Parse a raw localStorage value to T, falling back when null or invalid JSON.
// Shared between getSnapshot (for read path) and setAndPersist (for functional-
// updater latest-value read — see comment in setAndPersist).
function parseStored<T>(raw: string | null, fallback: T): T {
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
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
    const value = parseStored(raw, fallback);
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
      // Functional updaters must see the LATEST value, not the snapshot from
      // last render. `notify()` schedules React's getSnapshot re-run for the
      // next paint — cacheRef hasn't updated yet — so back-to-back functional
      // updaters in the same tick would both read the same stale value and
      // the second write would clobber the first. Read straight from
      // localStorage instead (which IS up-to-date because saveToLocalStorage
      // ran synchronously in the prior call).
      const next =
        typeof update === "function"
          ? (update as (prev: T) => T)(parseStored(window.localStorage.getItem(key), defaultRef.current))
          : update;
      saveToLocalStorage(key, next);
      // Fan out to all hook instances in this tree
      notify();
    },
    [key],
  );

  return [value, setAndPersist];
}
