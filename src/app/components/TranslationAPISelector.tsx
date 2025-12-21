"use client";

import { Form, Select, Input, Space, Tooltip } from "antd";
import { categorizedOptions, findMethodLabel, type TranslationConfig } from "@/app/lib/translation";
import { useTranslations } from "next-intl";

interface TranslationAPISelectorProps {
  translationMethod: string;
  setTranslationMethod: (value: string) => void;
  config: TranslationConfig | undefined;
  handleConfigChange: (method: string, key: string, value: string | number | boolean) => void;
}

/**
 * Shared component for selecting translation API and entering API key.
 * Used in SubtitleTranslator, MDTranslator, and JSONTranslator.
 */
const TranslationAPISelector = ({ translationMethod, setTranslationMethod, config, handleConfigChange }: TranslationAPISelectorProps) => {
  const t = useTranslations("common");
  const methodLabel = findMethodLabel(translationMethod);

  return (
    <Form.Item label={t("translationAPI")} style={{ marginTop: 8 }}>
      <Space.Compact className="w-full">
        <Select showSearch value={translationMethod} onChange={(e) => setTranslationMethod(e)} options={categorizedOptions} style={{ width: "40%" }} aria-label={t("translationAPI")} />
        {config?.apiKey !== undefined && translationMethod !== "llm" && (
          <Tooltip title={`${t("enter")} ${methodLabel} API Key`}>
            <Input.Password
              autoComplete="off"
              placeholder={`API Key`}
              value={config.apiKey as string | undefined}
              onChange={(e) => handleConfigChange(translationMethod, "apiKey", e.target.value)}
              style={{ width: "60%" }}
              aria-label={`${methodLabel} API Key`}
            />
          </Tooltip>
        )}
      </Space.Compact>
    </Form.Item>
  );
};

export default TranslationAPISelector;
