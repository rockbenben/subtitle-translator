"use client";

import { useState } from "react";
import { Switch, Button, Space, Typography, Tag, App } from "antd";
import { EditOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import PageCard from "@/app/components/styled/PageCard";
import GlossaryPresetPicker from "./GlossaryPresetPicker";
import GlossaryDrawer from "./GlossaryDrawer";

const { Text } = Typography;

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
    <PageCard
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
      <GlossaryPresetPicker />
      {/* Remount only on open/close, so the drawer re-reads the current target
          language each time it OPENS, without discarding the user's in-drawer
          language selection when the main target language changes while it's open. */}
      <GlossaryDrawer key={drawerOpen ? "open" : "closed"} open={drawerOpen} onClose={() => setDrawerOpen(false)} />
    </PageCard>
  );
};

export default GlossaryManager;
