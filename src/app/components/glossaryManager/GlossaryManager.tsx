"use client";

import { useState } from "react";
import { Switch, Button, Space, Typography, Tag, App, Card, Select, Modal, Input, Popconfirm, Tooltip } from "antd";
import { EditOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import GlossaryDrawer from "./GlossaryDrawer";

const { Text } = Typography;

/** 术语表预设的选择 / 新建 / 重命名 / 删除一行。 */
const PresetPicker = () => {
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


/**
 * Standalone glossary card. Rendered for EVERY service (not just LLM ones):
 * the prompt layer needs an LLM, but Qwen-MT consumes native terms and the
 * leak-through net applies to all MT output — hiding the glossary behind the
 * LLM-only prompts panel made it unreachable for exactly those users.
 */
const GlossaryManager = () => {
  const t = useTranslations("TranslationGlossary");
  const { message } = App.useApp();
  const { glossaryEnabled, setGlossaryEnabled, activeGlossaryPreset, glossaryPresets, createGlossaryPreset } = useTranslationContext();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Turning the feature on with no glossary yet seeds a default one, so the user
  // can hit "Edit" and add terms immediately instead of: + → name modal → edit.
  // Toast it — otherwise a preset silently appears in the picker out of nowhere.
  const handleToggle = (checked: boolean) => {
    setGlossaryEnabled(checked);
    if (checked && glossaryPresets.length === 0) {
      createGlossaryPreset(t("defaultName"));
      message.success(t("presetCreated"));
    }
  };

  const completeCount = (activeGlossaryPreset?.terms ?? []).filter((term) => term.source.trim() && term.target.trim()).length;

  return (
    <Card
      title={
        <Space size="small">
          <Switch checked={glossaryEnabled} onChange={handleToggle} aria-label={t("enable")} />
          <span>{t("title")}</span>
          {activeGlossaryPreset && <Tag>{t("termCount", { count: completeCount })}</Tag>}
        </Space>
      }
      // Disabled unless a preset actually exists (a dangling active id from an
      // imported settings file resolves to undefined → editing would no-op).
      extra={
        <Button icon={<EditOutlined />} disabled={!activeGlossaryPreset} onClick={() => setDrawerOpen(true)}>
          {t("edit")}
        </Button>
      }>
      <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
        {t("subtitle")}
      </Text>
      <PresetPicker />
      {/* Remount only on open/close, so the drawer re-reads the current target
          language each time it OPENS, without discarding the user's in-drawer
          language selection when the main target language changes while it's open. */}
      <GlossaryDrawer key={drawerOpen ? "open" : "closed"} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </Card>
  );
};

export default GlossaryManager;
