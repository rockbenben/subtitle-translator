"use client";

import dynamic from "next/dynamic";
import { Drawer, Spin } from "antd";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { useIsMobile } from "@/app/hooks/useIsMobile";

// Lazy-load the full settings surface — heavy form + provider-specific sections.
// Same chunk-splitting benefit as the previous Advanced-tab dynamic import.
const TranslationSettings = dynamic(() => import("@/app/components/TranslationSettings"), {
  loading: () => (
    <div className="flex justify-center items-center py-20">
      <Spin size="large" />
    </div>
  ),
});

/**
 * Right-side Drawer that wraps the full TranslationSettings surface
 * (provider chips, ServiceSettingsForm, prompt presets). Replaces the
 * previous "Advanced" Tab — main translation UI stays visible behind.
 *
 * destroyOnHidden=false: keep unsaved form edits across open/close cycles.
 */
const ApiSettingsDrawer = () => {
  const t = useTranslations("common");
  const isMobile = useIsMobile();
  const { apiSettingsOpen, setApiSettingsOpen } = useTranslationContext();

  return (
    <Drawer
      title={t("translationAPI")}
      open={apiSettingsOpen}
      onClose={() => setApiSettingsOpen(false)}
      // 自适应:手机端拉满屏避免有效宽度被 90vw 浪费;桌面端封顶 1400px 同时
      // 留 10% 给主翻译界面。antd 6 的 size 接受任意 CSS 字符串原样透传。
      size={isMobile ? "100vw" : "min(1400px, 90vw)"}
      destroyOnHidden={false}>
      <TranslationSettings />
    </Drawer>
  );
};

export default ApiSettingsDrawer;
