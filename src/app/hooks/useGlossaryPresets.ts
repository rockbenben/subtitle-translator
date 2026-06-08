"use client";

import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { usePresetCollection } from "@/app/hooks/usePresetCollection";
import { applyGlossaryToText, buildGlossaryPromptBlock, type GlossaryPreset, type GlossaryTerm } from "@/app/lib/translation/glossary";

/**
 * Pure derivation of the per-target-language helpers — extracted so it can be
 * unit-tested without React. `effectiveSystemPrompt` is the base the glossary
 * block is appended to.
 */
export const deriveGlossaryHelpers = (glossaryEnabled: boolean, activePreset: GlossaryPreset | undefined, effectiveSystemPrompt: string) => {
  const getGlossaryTerms = (targetLang: string): GlossaryTerm[] => {
    if (!glossaryEnabled || !activePreset) return [];
    // `terms` guarded: an imported/hand-edited preset could lack the array.
    return (activePreset.terms ?? []).filter((t) => t.targetLang === targetLang && t.from.trim());
  };
  const buildTranslationSystemPrompt = (targetLang: string): string => effectiveSystemPrompt + buildGlossaryPromptBlock(getGlossaryTerms(targetLang));
  const applyGlossary = (text: string, targetLang: string): string => applyGlossaryToText(text, getGlossaryTerms(targetLang));
  return { getGlossaryTerms, buildTranslationSystemPrompt, applyGlossary };
};

/**
 * Named glossary presets + master toggle, backed by localStorage. Mirrors
 * usePromptPresets. Exposes per-target-language helpers used by the translation
 * paths (translateBatch + the JSON loop).
 */
export const useGlossaryPresets = (effectiveSystemPrompt: string) => {
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

  const activeGlossaryPreset = glossaryPresets.find((p) => p.id === activeGlossaryPresetId);
  const helpers = deriveGlossaryHelpers(glossaryEnabled, activeGlossaryPreset, effectiveSystemPrompt);

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
