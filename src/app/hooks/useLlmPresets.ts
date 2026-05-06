"use client";

import { useLocalStorage } from "@/app/hooks/useLocalStorage";
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
  const [llmPresets, setLlmPresets] = useLocalStorage<LlmPreset[]>("llmPresets", []);
  const [activePresetId, setActivePresetId] = useLocalStorage<string>("activePresetId", "");

  const getLlmConfig = () => translationConfigs["llm"] || getDefaultConfig("llm");

  const saveLlmPreset = (name: string) => {
    const config = getLlmConfig();
    if (!config) return undefined;
    const preset: LlmPreset = {
      id: String(Date.now()),
      name,
      config: { ...config },
    };
    setLlmPresets((prev) => [...prev, preset]);
    setActivePresetId(preset.id);
    return preset;
  };

  const loadLlmPreset = (id: string) => {
    if (!id) {
      setActivePresetId("");
      return;
    }
    const preset = llmPresets.find((p) => p.id === id);
    if (!preset) return;
    setTranslationConfigs((prev) => ({
      ...prev,
      llm: { ...preset.config },
    }));
    setActivePresetId(id);
  };

  const deleteLlmPreset = (id: string) => {
    setLlmPresets((prev) => prev.filter((p) => p.id !== id));
    if (activePresetId === id) setActivePresetId("");
  };

  const renameLlmPreset = (id: string, name: string) => {
    setLlmPresets((prev) => prev.map((p) => (p.id === id ? { ...p, name } : p)));
  };

  const updateLlmPreset = (id: string) => {
    const config = getLlmConfig();
    if (!config) return;
    setLlmPresets((prev) => prev.map((p) => (p.id === id ? { ...p, config: { ...config } } : p)));
  };

  return {
    llmPresets,
    setLlmPresets,
    activePresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    renameLlmPreset,
    updateLlmPreset,
  };
};
