"use client";

import { useCallback, useMemo } from "react";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";

export type PresetBase = { id: string; name: string };

// Read-boundary row guard, same defense line as sanitizePresetTerms in
// useGlossaryPresets (2026-06-10 术语行崩溃先例): every preset Select renders
// `.map((p) => p.name)` — one null/malformed row in localStorage (hand-edited
// JSON, imported settings file) throws in render, and without an error boundary
// the whole page becomes "Application error" (2026-07-16 终端用户反馈:
// "更多 Provider 设置"点开必崩). Invalid rows are dropped, not migrated
// (no-backward-compat policy); the next save persists the cleaned list.
const isValidPreset = (p: unknown): p is PresetBase => {
  const row = p as Partial<PresetBase> | null;
  return !!row && typeof row === "object" && typeof row.id === "string" && typeof row.name === "string";
};

const sanitizeRows = <T extends PresetBase>(rows: unknown): T[] => (Array.isArray(rows) ? (rows.filter(isValidPreset) as T[]) : []);

/**
 * Shared CRUD scaffolding for named-preset collections backed by localStorage.
 * Manages the list + active-id state and exposes add/remove/rename/update.
 * Callers wrap this with their own snapshot/load logic (which preset shape
 * to store, how to apply it on load) — see useLlmPresets, usePromptPresets.
 */
export const usePresetCollection = <T extends PresetBase>(storageKey: string, activeKey: string) => {
  const [rawItems, setRawItems] = useLocalStorage<T[]>(storageKey, []);
  // useMemo keyed on the raw reference (stable per raw string in useLocalStorage)
  // so consumers' own memos stay warm across renders.
  const items = useMemo(() => sanitizeRows<T>(rawItems), [rawItems]);
  const [activeId, setActiveId] = useLocalStorage<string>(activeKey, "");

  // Functional updaters must operate on the sanitized list too — useLocalStorage
  // feeds them the raw parsed value, which may still hold the bad rows.
  const setItems = useCallback(
    (update: T[] | ((prev: T[]) => T[])) => {
      setRawItems((prev) => (typeof update === "function" ? update(sanitizeRows<T>(prev)) : update));
    },
    [setRawItems],
  );

  const add = (preset: T) => {
    setItems((prev) => [...prev, preset]);
    setActiveId(preset.id);
  };

  const remove = (id: string) => {
    setItems((prev) => prev.filter((p) => p.id !== id));
    if (activeId === id) setActiveId("");
  };

  const rename = (id: string, name: string) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const update = (id: string, patch: Partial<T>) => {
    setItems((prev) => prev.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  return { items, setItems, activeId, setActiveId, add, remove, rename, update };
};
