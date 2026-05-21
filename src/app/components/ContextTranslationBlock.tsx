"use client";

import { Form, Switch, InputNumber, Space, Flex, Typography, Tag, theme } from "antd";
import { BranchesOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";

interface ContextTranslationBlockProps {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  disabled?: boolean;
}

const ContextTranslationBlock = ({ enabled, onEnabledChange, disabled = false }: ContextTranslationBlockProps) => {
  const t = useTranslations("common");
  const tSettings = useTranslations("TranslationSettings");
  const { token } = theme.useToken();
  const { translationMethod, getSelectedConfig, handleConfigChange } = useTranslationContext();

  const config = getSelectedConfig();

  const handleParamChange = (field: "contextWindow" | "contextBatchSize", fallback: number, value: number | null) => {
    handleConfigChange(translationMethod, field, value ?? fallback);
  };

  return (
    <section
      style={{
        background: enabled ? token.colorPrimaryBg : "transparent",
        border: `1px solid ${enabled ? token.colorPrimaryBorder : token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        padding: token.paddingSM,
        marginBottom: token.marginSM,
      }}>
      <Flex justify="space-between" align="center">
        <Space size="small">
          <BranchesOutlined />
          <Typography.Text strong>{t("contextAwareTranslation")}</Typography.Text>
          <Tag style={{ background: token.colorPrimaryBg, color: token.colorPrimary, borderColor: token.colorPrimaryBorder, margin: 0 }}>LLM</Tag>
        </Space>
        <Switch
          checked={enabled}
          onChange={onEnabledChange}
          disabled={disabled}
          aria-label={t("contextAwareTranslation")}
        />
      </Flex>
      <Typography.Text type="secondary" style={{ fontSize: token.fontSizeSM, display: "block", marginTop: token.marginXXS }}>
        {t("contextAwareTranslationTooltip")}
      </Typography.Text>

      {enabled && (
        <div
          style={{
            marginTop: token.marginSM,
            paddingLeft: token.paddingSM,
            borderLeft: `2px solid ${token.colorPrimaryBorder}`,
          }}>
          {config?.contextWindow !== undefined && (
            <Form.Item label={tSettings("contextWindow")} className="!mb-2">
              <InputNumber
                min={1}
                max={500}
                step={1}
                value={config.contextWindow as number}
                onChange={(v) => handleParamChange("contextWindow", 100, v)}
                disabled={disabled}
                className="w-full"
                aria-label={tSettings("contextWindow")}
              />
            </Form.Item>
          )}
          {config?.contextBatchSize !== undefined && (
            <Form.Item label={tSettings("contextBatchSize")} className="!mb-0">
              <InputNumber
                min={1}
                max={50}
                step={1}
                value={config.contextBatchSize as number}
                onChange={(v) => handleParamChange("contextBatchSize", 3, v)}
                disabled={disabled}
                className="w-full"
                aria-label={tSettings("contextBatchSize")}
              />
            </Form.Item>
          )}
        </div>
      )}
    </section>
  );
};

export default ContextTranslationBlock;
