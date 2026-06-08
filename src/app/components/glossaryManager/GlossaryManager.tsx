"use client";

import { useState } from "react";
import { Switch, Button, Space, Typography, Tag, App } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import GlossaryPresetPicker from "./GlossaryPresetPicker";
import GlossaryDrawer from "./GlossaryDrawer";

const { Text } = Typography;

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

  return (
    <div style={{ marginTop: 16 }}>
      <Space style={{ width: "100%", justifyContent: "space-between", marginBottom: 8 }} wrap>
        <Space wrap>
          <Switch checked={glossaryEnabled} onChange={handleToggle} aria-label={t("enable")} />
          <Text strong>{t("title")}</Text>
          {activeGlossaryPreset && <Tag>{t("termCount", { count: (activeGlossaryPreset.terms ?? []).filter((term) => term.from.trim() && term.to.trim()).length })}</Tag>}
          <Text type="secondary">{t("subtitle")}</Text>
        </Space>
        {/* Disabled unless a preset actually exists (a dangling active id from an
            imported settings file resolves to undefined → editing would no-op). */}
        <Button icon={<EditOutlined />} disabled={!activeGlossaryPreset} onClick={() => setDrawerOpen(true)}>{t("edit")}</Button>
      </Space>
      <GlossaryPresetPicker />
      {/* Remount only on open/close, so the drawer re-reads the current target
          language each time it OPENS, without discarding the user's in-drawer
          language selection when the main target language changes while it's open. */}
      <GlossaryDrawer key={drawerOpen ? "open" : "closed"} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </div>
  );
};

export default GlossaryManager;
