"use client";

import { usePresetCollection } from "@/app/hooks/usePresetCollection";
import { DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT } from "@/app/lib/translation/config";

export type PromptPreset = {
  id: string;
  name: string;
  systemPrompt: string;
  userPrompt: string;
};

// Sentinel id for the always-present "default prompt" entry in the picker. User
// presets use String(Date.now()) (numeric), so this never collides. It's a way
// back to the factory prompts after the user has saved/edited their own presets.
export const DEFAULT_PROMPT_PRESET_ID = "default";

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
    if (id === DEFAULT_PROMPT_PRESET_ID) {
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setUserPrompt(DEFAULT_USER_PROMPT);
      setActivePromptPresetId(DEFAULT_PROMPT_PRESET_ID);
      return;
    }
    const preset = promptPresets.find((p) => p.id === id);
    if (!preset) return;
    setSystemPrompt(preset.systemPrompt);
    setUserPrompt(preset.userPrompt);
    setActivePromptPresetId(id);
  };

  // The default entry is read-only — it can't be overwritten or deleted (the
  // picker disables those buttons too; these guards are the safety net).
  const updatePromptPreset = (id: string) => {
    if (id === DEFAULT_PROMPT_PRESET_ID) return;
    update(id, { systemPrompt: effectiveSystemPrompt, userPrompt: effectiveUserPrompt });
  };

  const removePromptPreset = (id: string) => {
    if (id === DEFAULT_PROMPT_PRESET_ID) return;
    deletePromptPreset(id);
  };

  return {
    promptPresets,
    setPromptPresets,
    activePromptPresetId,
    setActivePromptPresetId,
    savePromptPreset,
    loadPromptPreset,
    deletePromptPreset: removePromptPreset,
    renamePromptPreset,
    updatePromptPreset,
  };
};
