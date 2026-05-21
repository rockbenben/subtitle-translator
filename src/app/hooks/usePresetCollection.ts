"use client";

import { useLocalStorage } from "@/app/hooks/useLocalStorage";

export type PresetBase = { id: string; name: string };

/**
 * Shared CRUD scaffolding for named-preset collections backed by localStorage.
 * Manages the list + active-id state and exposes add/remove/rename/update.
 * Callers wrap this with their own snapshot/load logic (which preset shape
 * to store, how to apply it on load) — see useLlmPresets, usePromptPresets.
 */
export const usePresetCollection = <T extends PresetBase>(storageKey: string, activeKey: string) => {
  const [items, setItems] = useLocalStorage<T[]>(storageKey, []);
  const [activeId, setActiveId] = useLocalStorage<string>(activeKey, "");

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
