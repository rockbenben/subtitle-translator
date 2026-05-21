"use client";

import { usePresetCollection } from "@/app/hooks/usePresetCollection";

export type PromptPreset = {
  id: string;
  name: string;
  systemPrompt: string;
  userPrompt: string;
};

type Deps = {
  effectiveSystemPrompt: string;
  effectiveUserPrompt: string;
  setSystemPrompt: (value: string) => void;
  setUserPrompt: (value: string) => void;
};

/**
 * CRUD for named prompt presets (systemPrompt + userPrompt). Independent of
 * `useLlmPresets` (which manages API config). Decouples prompt switching
 * from API config switching so users can mix-and-match.
 */
export const usePromptPresets = ({ effectiveSystemPrompt, effectiveUserPrompt, setSystemPrompt, setUserPrompt }: Deps) => {
  const {
    items: promptPresets,
    setItems: setPromptPresets,
    activeId: activePromptPresetId,
    setActiveId: setActivePromptPresetId,
    add,
    remove: deletePromptPreset,
    rename: renamePromptPreset,
    update,
  } = usePresetCollection<PromptPreset>("translation-promptPresets", "translation-activePromptPresetId");

  const savePromptPreset = (name: string) => {
    const preset: PromptPreset = {
      id: String(Date.now()),
      name,
      systemPrompt: effectiveSystemPrompt,
      userPrompt: effectiveUserPrompt,
    };
    add(preset);
    return preset;
  };

  const loadPromptPreset = (id: string) => {
    if (!id) {
      setActivePromptPresetId("");
      return;
    }
    const preset = promptPresets.find((p) => p.id === id);
    if (!preset) return;
    setSystemPrompt(preset.systemPrompt);
    setUserPrompt(preset.userPrompt);
    setActivePromptPresetId(id);
  };

  const updatePromptPreset = (id: string) => {
    update(id, { systemPrompt: effectiveSystemPrompt, userPrompt: effectiveUserPrompt });
  };

  return {
    promptPresets,
    setPromptPresets,
    activePromptPresetId,
    setActivePromptPresetId,
    savePromptPreset,
    loadPromptPreset,
    deletePromptPreset,
    renamePromptPreset,
    updatePromptPreset,
  };
};
