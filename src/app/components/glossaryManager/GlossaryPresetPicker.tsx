"use client";

import { useState } from "react";
import { Select, Button, Modal, Input, Space, Popconfirm, App, Tooltip } from "antd";
import { PlusOutlined, DeleteOutlined, EditOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";

const GlossaryPresetPicker = () => {
  const t = useTranslations("TranslationGlossary");
  const { message } = App.useApp();
  const { glossaryPresets, activeGlossaryPresetId, setActiveGlossaryPresetId, createGlossaryPreset, deleteGlossaryPreset, renameGlossaryPreset } = useTranslationContext();

  const [createOpen, setCreateOpen] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const handleCreate = () => {
    if (!presetName.trim()) return message.error(t("nameRequired"));
    createGlossaryPreset(presetName.trim());
    setCreateOpen(false);
    message.success(t("presetCreated"));
  };
  const handleRename = () => {
    if (!presetName.trim()) return message.error(t("nameRequired"));
    // Guard the toast too: the active preset can be cleared (Select ×) while this
    // modal is open, which would make the rename a no-op — don't claim success then.
    if (activeGlossaryPresetId) {
      renameGlossaryPreset(activeGlossaryPresetId, presetName.trim());
      message.success(t("presetRenamed"));
    }
    setRenameOpen(false);
  };

  return (
    <Space.Compact style={{ width: "100%" }}>
      <Select
        style={{ flex: 1 }}
        placeholder={glossaryPresets.length === 0 ? t("presetEmptyHint") : t("presetSelect")}
        value={activeGlossaryPresetId || undefined}
        onChange={(v) => setActiveGlossaryPresetId(v)}
        allowClear
        onClear={() => setActiveGlossaryPresetId("")}
        options={glossaryPresets.map((p) => ({ label: p.name, value: p.id }))}
      />
      <Tooltip title={t("presetRename")}>
        <Button icon={<EditOutlined />} disabled={!activeGlossaryPresetId} aria-label={t("presetRename")} onClick={() => { const preset = glossaryPresets.find((p) => p.id === activeGlossaryPresetId); setPresetName(preset?.name || ""); setRenameOpen(true); }} />
      </Tooltip>
      <Tooltip title={t("presetNew")}>
        <Button icon={<PlusOutlined />} aria-label={t("presetNew")} onClick={() => { setPresetName(""); setCreateOpen(true); }} />
      </Tooltip>
      <Popconfirm title={t("presetDeleteConfirm")} disabled={!activeGlossaryPresetId} onConfirm={() => { if (activeGlossaryPresetId) { deleteGlossaryPreset(activeGlossaryPresetId); message.success(t("presetDeleted")); } }}>
        <Tooltip title={t("presetDelete")}>
          <Button danger icon={<DeleteOutlined />} disabled={!activeGlossaryPresetId} aria-label={t("presetDelete")} />
        </Tooltip>
      </Popconfirm>
      <Modal title={t("presetNew")} open={createOpen} onOk={handleCreate} onCancel={() => setCreateOpen(false)}>
        <Input placeholder={t("presetNamePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onPressEnter={handleCreate} autoFocus />
      </Modal>
      <Modal title={t("presetRename")} open={renameOpen} onOk={handleRename} onCancel={() => setRenameOpen(false)}>
        <Input placeholder={t("presetNamePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onPressEnter={handleRename} autoFocus />
      </Modal>
    </Space.Compact>
  );
};

export default GlossaryPresetPicker;
