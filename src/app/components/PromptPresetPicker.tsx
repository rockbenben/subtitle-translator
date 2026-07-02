"use client";

import { useState } from "react";
import { Select, Button, Modal, Input, Space, Popconfirm, App, Tooltip } from "antd";
import { SaveOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { DEFAULT_PROMPT_PRESET_ID } from "@/app/hooks/usePromptPresets";

/**
 * Picker for prompt presets (systemPrompt + userPrompt). Mirrors the API config
 * preset block in ServiceSettingsForm but operates on the independent
 * promptPresets store. Lives at the top of GlobalPromptsPanel.
 */
const PromptPresetPicker = () => {
  const t = useTranslations("TranslationSettings");
  const { message } = App.useApp();
  const {
    promptPresets,
    activePromptPresetId,
    savePromptPreset,
    loadPromptPreset,
    updatePromptPreset,
    deletePromptPreset,
  } = useTranslationContext();

  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.error(t("presetNameRequired"));
      return;
    }
    savePromptPreset(presetName.trim());
    setPresetModalOpen(false);
    message.success(t("presetSaved"));
  };

  // The default-prompt entry is always present and read-only: selecting it loads
  // the factory prompts, but it can't be overwritten or deleted. "Save to current"
  // and "delete" act on a selected user preset only — disabled otherwise.
  const isDefaultActive = activePromptPresetId === DEFAULT_PROMPT_PRESET_ID;
  const canEditActive = !!activePromptPresetId && !isDefaultActive;
  const options = [{ label: t("presetDefault"), value: DEFAULT_PROMPT_PRESET_ID }, ...promptPresets.map((p) => ({ label: p.name, value: p.id }))];

  return (
    <div style={{ marginBottom: 16 }}>
      <Space.Compact style={{ width: "100%" }}>
        <Select
          style={{ flex: 1 }}
          placeholder={t("presetSelect")}
          aria-label={t("presetSelect")}
          value={activePromptPresetId || undefined}
          onChange={(value) => loadPromptPreset(value)}
          allowClear
          onClear={() => loadPromptPreset("")}
          options={options}
        />
        <Tooltip title={isDefaultActive ? t("presetDefaultReadonly") : t("presetUpdate")}>
          <Button
            icon={<SaveOutlined />}
            disabled={!canEditActive}
            aria-label={t("presetUpdate")}
            onClick={() => {
              if (!canEditActive) return;
              updatePromptPreset(activePromptPresetId);
              message.success(t("presetUpdated"));
            }}
          />
        </Tooltip>
        <Tooltip title={t("presetSave")}>
          <Button
            icon={<PlusOutlined />}
            aria-label={t("presetSave")}
            onClick={() => {
              setPresetName("");
              setPresetModalOpen(true);
            }}
          />
        </Tooltip>
        <Popconfirm
          title={t("presetDeleteConfirm")}
          onConfirm={() => {
            if (canEditActive) {
              deletePromptPreset(activePromptPresetId);
              message.success(t("presetDeleted"));
            }
          }}
          disabled={!canEditActive}>
          <Tooltip title={isDefaultActive ? t("presetDefaultReadonly") : t("presetDelete")}>
            <Button
              danger
              icon={<DeleteOutlined />}
              disabled={!canEditActive}
              aria-label={t("presetDelete")}
            />
          </Tooltip>
        </Popconfirm>
      </Space.Compact>
      <Modal
        title={t("presetSave")}
        open={presetModalOpen}
        onOk={handleSavePreset}
        onCancel={() => setPresetModalOpen(false)}>
        <Input
          placeholder={t("presetNamePlaceholder")}
          value={presetName}
          onChange={(e) => setPresetName(e.target.value)}
          onPressEnter={handleSavePreset}
          autoFocus
        />
      </Modal>
    </div>
  );
};

export default PromptPresetPicker;
