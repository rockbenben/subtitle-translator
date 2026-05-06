"use client";

import { useLocalStorage } from "@/app/hooks/useLocalStorage";

export type PromptPreset = {
  id: string;
  name: string;
  sysPrompt: string;
  userPrompt: string;
};

type Deps = {
  effectiveSysPrompt: string;
  effectiveUserPrompt: string;
  setSysPrompt: (value: string) => void;
  setUserPrompt: (value: string) => void;
};

/**
 * CRUD for named prompt presets (sysPrompt + userPrompt). Independent of
 * `useLlmPresets` (which manages API config). Decouples prompt switching
 * from API config switching so users can mix-and-match.
 */
export const usePromptPresets = ({ effectiveSysPrompt, effectiveUserPrompt, setSysPrompt, setUserPrompt }: Deps) => {
  const [promptPresets, setPromptPresets] = useLocalStorage<PromptPreset[]>("promptPresets", []);
  const [activePromptPresetId, setActivePromptPresetId] = useLocalStorage<string>("activePromptPresetId", "");

  const savePromptPreset = (name: string) => {
    const preset: PromptPreset = {
      id: String(Date.now()),
      name,
      sysPrompt: effectiveSysPrompt,
      userPrompt: effectiveUserPrompt,
    };
    setPromptPresets((prev) => [...prev, preset]);
    setActivePromptPresetId(preset.id);
    return preset;
  };

  const loadPromptPreset = (id: string) => {
    if (!id) {
      setActivePromptPresetId("");
      return;
    }
    const preset = promptPresets.find((p) => p.id === id);
    if (!preset) return;
    setSysPrompt(preset.sysPrompt);
    setUserPrompt(preset.userPrompt);
    setActivePromptPresetId(id);
  };

  const deletePromptPreset = (id: string) => {
    setPromptPresets((prev) => prev.filter((p) => p.id !== id));
    if (activePromptPresetId === id) setActivePromptPresetId("");
  };

  const renamePromptPreset = (id: string, name: string) => {
    setPromptPresets((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const updatePromptPreset = (id: string) => {
    setPromptPresets((prev) =>
      prev.map((p) =>
        p.id === id ? { ...p, sysPrompt: effectiveSysPrompt, userPrompt: effectiveUserPrompt } : p,
      ),
    );
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
