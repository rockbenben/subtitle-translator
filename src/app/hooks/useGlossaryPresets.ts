"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { usePresetCollection } from "@/app/hooks/usePresetCollection";
// 纯函数部分(deriveGlossaryHelpers)住在 lib/translation/glossary —— CLI 与
// 本 hook 共用同一份过滤谓词与 memo 策略,消费方直接从 lib 导入,不设 shim。
import { deriveGlossaryHelpers, type GlossaryPreset, type GlossaryTerm } from "@/app/lib/translation/glossary";

const isValidTerm = (t: unknown): t is GlossaryTerm => {
  const term = t as Partial<GlossaryTerm> | null;
  return !!term && typeof term === "object" && typeof term.source === "string" && typeof term.target === "string" && typeof term.targetLang === "string";
};

/**
 * Read-boundary sanitizer: every consumer of the active preset (drawer table,
 * manager badge, engine helpers) assumes GlossaryTerm shape and calls
 * `.source.trim()` per row. localStorage can hold rows that violate it —
 * pre-rename `{from,to}` entries, hand-edited JSON — and ONE bad row crashed
 * the drawer on open (2026-06-10). Invalid rows are dropped, not migrated
 * (no-backward-compat policy); the next save persists the cleaned list.
 */
export const sanitizePresetTerms = (preset: GlossaryPreset | undefined): GlossaryPreset | undefined =>
  preset ? { ...preset, terms: (Array.isArray(preset.terms) ? preset.terms : []).filter(isValidTerm) } : undefined;

/**
 * Named glossary presets + master toggle, backed by localStorage. Mirrors
 * usePromptPresets. Exposes per-target-language helpers used by the translation
 * paths (translateBatch + the JSON loop).
 */
export const useGlossaryPresets = () => {
  const [glossaryEnabled, setGlossaryEnabled] = useLocalStorage<boolean>("translation-glossaryEnabled", false);
  const {
    items: glossaryPresets,
    setItems: setGlossaryPresets,
    activeId: activeGlossaryPresetId,
    setActiveId: setActiveGlossaryPresetId,
    add,
    remove: deleteGlossaryPreset,
    rename: renameGlossaryPreset,
    update: updateGlossaryPreset,
  } = usePresetCollection<GlossaryPreset>("translation-glossaryPresets", "translation-activeGlossaryPresetId");

  const createGlossaryPreset = (name: string) => {
    const preset: GlossaryPreset = { id: String(Date.now()), name, terms: [] };
    add(preset);
    return preset;
  };

  // useMemo keeps the sanitized object reference-stable across renders (the
  // raw preset is a stable member of the presets state array), so the drawer's
  // useMemos and glossary.ts's compiled-regex WeakMap stay warm.
  const rawActivePreset = glossaryPresets.find((p) => p.id === activeGlossaryPresetId);
  const activeGlossaryPreset = useMemo(() => sanitizePresetTerms(rawActivePreset), [rawActivePreset]);
  const helpers = deriveGlossaryHelpers(glossaryEnabled, activeGlossaryPreset);

  return {
    glossaryEnabled,
    setGlossaryEnabled,
    glossaryPresets,
    setGlossaryPresets,
    activeGlossaryPresetId,
    setActiveGlossaryPresetId,
    activeGlossaryPreset,
    createGlossaryPreset,
    deleteGlossaryPreset,
    renameGlossaryPreset,
    updateGlossaryPreset,
    ...helpers,
  };
};
