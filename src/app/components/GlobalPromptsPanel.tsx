"use client";

import { Form, Input, Typography } from "antd";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import PageCard from "@/app/components/styled/PageCard";
import PromptPresetPicker from "@/app/components/PromptPresetPicker";
import { useIsMobile } from "@/app/hooks/useIsMobile";

const { Text } = Typography;
const { TextArea } = Input;

/**
 * Standalone panel for the LLM system/user prompts. Promoted out of the
 * API Settings tab into its own top-level Tab (per Theme 5 redesign).
 * Prompts are shared across every LLM provider, so dedicating a tab to
 * them is clearer than nesting under per-provider settings.
 *
 * Hosts the prompt-preset picker (PromptPresetPicker) at the top, letting
 * users save / switch named prompt sets independently of API config presets.
 */
const GlobalPromptsPanel = () => {
  const t = useTranslations("TranslationSettings");
  const tCommon = useTranslations("common");
  const isMobile = useIsMobile();
  const { systemPrompt, setSystemPrompt, userPrompt, setUserPrompt } = useTranslationContext();

  // Mobile: the secondary hint moves below the title (Card title/extra share
  // one flex row on Antd — long titles + hint overlap at ~290px). Body padding
  // shrinks to claw back input width inside the nested Drawer + Card stack.
  const hint = <Text type="secondary">{t("globalPromptsExtra")}</Text>;

  return (
    <PageCard
      title={t("globalPrompts")}
      extra={isMobile ? null : hint}
      styles={isMobile ? { body: { padding: 12 } } : undefined}>
      {isMobile && <div style={{ marginBottom: 12 }}>{hint}</div>}
      <PromptPresetPicker />
      <Form layout="vertical">
        <Form.Item label={t("systemPrompt")} extra={t("systemPromptExtra")} style={{ marginBottom: 12 }}>
          <TextArea value={systemPrompt} onChange={(e) => setSystemPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 10 }} aria-label={t("systemPrompt")} />
        </Form.Item>
        <Form.Item
          label={t("userPrompt")}
          extra={`${t("userPromptExtra")}: \${sourceLanguage} ${t("for")} ${tCommon("sourceLanguage")}, \${targetLanguage} ${t("for")} ${tCommon("targetLanguage")}, \${content} ${t("for")} ${t("textToTranslate")}, \${fullText} ${t("for")} full text`}
          style={{ marginBottom: 0 }}>
          <TextArea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} autoSize={{ minRows: 3, maxRows: 16 }} aria-label={t("userPrompt")} />
        </Form.Item>
      </Form>
    </PageCard>
  );
};

export default GlobalPromptsPanel;
