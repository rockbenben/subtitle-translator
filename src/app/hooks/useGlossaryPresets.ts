"use client";

import { useMemo } from "react";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { usePresetCollection } from "@/app/hooks/usePresetCollection";
import { applyGlossaryToText, type GlossaryPreset, type GlossaryTerm } from "@/app/lib/translation/glossary";

const NO_TERMS: GlossaryTerm[] = [];

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
 * Pure derivation of the per-target-language helpers — extracted so it can be
 * unit-tested without React. The per-request system-prompt block is composed
 * downstream (translateSingle) from getGlossaryTerms, filtered to the terms
 * the request text actually contains.
 */
export const deriveGlossaryHelpers = (glossaryEnabled: boolean, activePreset: GlossaryPreset | undefined) => {
  // Reference-stable per-language term arrays: glossary.ts memoizes its
  // compiled regex set on the array reference, and applyGlossary runs once per
  // translated line — a fresh array per call would recompile per line.
  const termsByLang = new Map<string, GlossaryTerm[]>();
  const getGlossaryTerms = (targetLang: string): GlossaryTerm[] => {
    if (!glossaryEnabled || !activePreset) return NO_TERMS;
    let terms = termsByLang.get(targetLang);
    if (!terms) {
      // The hook hands in a sanitized preset (sanitizePresetTerms), but this
      // helper is also exported for tests/direct use — keep the shape guard.
      terms = (activePreset.terms ?? []).filter((t) => t.targetLang === targetLang && typeof t.source === "string" && t.source.trim());
      termsByLang.set(targetLang, terms);
    }
    return terms;
  };
  const applyGlossary = (text: string, targetLang: string): string => applyGlossaryToText(text, getGlossaryTerms(targetLang));
  return { getGlossaryTerms, applyGlossary };
};

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
