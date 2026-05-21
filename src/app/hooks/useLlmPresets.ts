"use client";

import { usePresetCollection } from "@/app/hooks/usePresetCollection";
import { getDefaultConfig, type TranslationConfig } from "@/app/lib/translation";

export type LlmPreset = {
  id: string;
  name: string;
  config: TranslationConfig;
};

type TranslationConfigs = Record<string, TranslationConfig>;

type UseLlmPresetsDeps = {
  translationConfigs: TranslationConfigs;
  setTranslationConfigs: React.Dispatch<React.SetStateAction<TranslationConfigs>>;
};

/**
 * CRUD for named "Custom LLM" API config presets. Each preset snapshots the
 * current llm service config so a user can jump between e.g. local Ollama
 * and a remote gateway without re-typing settings. Prompts are managed
 * separately via usePromptPresets.
 */
export const useLlmPresets = ({ translationConfigs, setTranslationConfigs }: UseLlmPresetsDeps) => {
  const {
    items: llmPresets,
    setItems: setLlmPresets,
    activeId: activeLlmPresetId,
    setActiveId,
    add,
    remove: deleteLlmPreset,
    rename: renameLlmPreset,
    update,
  } = usePresetCollection<LlmPreset>("translation-llmPresets", "translation-activeLlmPresetId");

  const getLlmConfig = () => translationConfigs["llm"] || getDefaultConfig("llm");

  const saveLlmPreset = (name: string) => {
    const config = getLlmConfig();
    if (!config) return undefined;
    const preset: LlmPreset = { id: String(Date.now()), name, config: { ...config } };
    add(preset);
    return preset;
  };

  const loadLlmPreset = (id: string) => {
    if (!id) {
      setActiveId("");
      return;
    }
    const preset = llmPresets.find((p) => p.id === id);
    if (!preset) return;
    setTranslationConfigs((prev) => ({ ...prev, llm: { ...preset.config } }));
    setActiveId(id);
  };

  const updateLlmPreset = (id: string) => {
    const config = getLlmConfig();
    if (!config) return;
    update(id, { config: { ...config } });
  };

  return {
    llmPresets,
    setLlmPresets,
    activeLlmPresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    renameLlmPreset,
    updateLlmPreset,
  };
};
