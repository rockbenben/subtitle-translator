"use client";

import React from "react";
import { Flex, Input, InputNumber, Row, Col, Tooltip, Switch, Form, theme, Typography } from "antd";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface AdvancedTranslationSettingsProps {
  // Export filename
  customFileName: string;
  setCustomFileName: (value: string) => void;
  // Remove chars
  removeChars: string;
  setRemoveChars: (value: string) => void;
  // Retry settings
  retryCount: number;
  setRetryCount: (value: number) => void;
  retryTimeout: number;
  setRetryTimeout: (value: number) => void;
  // Use cache
  useCache: boolean;
  setUseCache: (value: boolean) => void;
  // Single File Mode
  singleFileMode?: boolean;
  setSingleFileMode?: (value: boolean) => void;
  // Optional: custom children for component-specific settings (rendered before the common settings)
  children?: React.ReactNode;
}

const AdvancedTranslationSettings: React.FC<AdvancedTranslationSettingsProps> = ({
  customFileName,
  setCustomFileName,
  removeChars,
  setRemoveChars,
  retryCount,
  setRetryCount,
  retryTimeout,
  setRetryTimeout,
  useCache,
  setUseCache,
  children,
  singleFileMode,
  setSingleFileMode,
}) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  const blockStyle: React.CSSProperties = {
    padding: "12px",
    backgroundColor: token.colorFillQuaternary,
    borderRadius: token.borderRadiusLG,
    width: "100%",
  };

  return (
    <Flex vertical gap="middle">
      {/* 1. Genernal Switches Block */}
      <div style={blockStyle}>
        <Flex vertical gap="small">
          {/* Component-specific settings (injected checkboxes like Direct Export) */}
          {children}

          {/* Single File Mode */}
          {setSingleFileMode && (
            <Flex justify="space-between" align="center">
              <Tooltip title={t("singleFileModeTooltip")}>
                <Text>{t("singleFileMode")}</Text>
              </Tooltip>
              <Switch size="small" checked={singleFileMode} onChange={setSingleFileMode} aria-label={t("singleFileMode")} />
            </Flex>
          )}

          {/* Use cache toggle */}
          <Flex justify="space-between" align="center">
            <Tooltip title={t("useCacheTooltip")}>
              <Text>{t("useCache")}</Text>
            </Tooltip>
            <Switch size="small" checked={useCache} onChange={setUseCache} aria-label={t("useCache")} />
          </Flex>
        </Flex>
      </div>

      {/* 2. Network / Resilience Block */}
      <div style={blockStyle}>
        <Form layout="vertical" component="div">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t("retryCount")} tooltip={t("retryCountTooltip")} className="!mb-0">
                <InputNumber min={1} max={10} value={retryCount} onChange={(value) => setRetryCount(value ?? 3)} className="!w-full" aria-label={t("retryCount")} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("retryTimeout")} tooltip={t("retryTimeoutTooltip")} className="!mb-0">
                <InputNumber min={5} max={1200} value={retryTimeout} onChange={(value) => setRetryTimeout(value ?? 30)} suffix="s" className="!w-full" aria-label={t("retryTimeout")} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </div>

      {/* 3. Output Formatting Block */}
      <div style={blockStyle}>
        <Form layout="vertical">
          {/* Remove chars input */}
          <Form.Item label={t("removeCharsAfterTranslation")} tooltip={t("removeCharsAfterTranslationTooltip")}>
            <Input placeholder={`${t("example")}: ♪ <i> </i>`} value={removeChars} onChange={(e) => setRemoveChars(e.target.value)} allowClear aria-label={t("removeCharsAfterTranslation")} />
          </Form.Item>

          {/* Export filename input */}
          <Form.Item label={t("customExportFilename")} tooltip={t("customExportFilenameTooltip")} className="!-mt-3 !mb-0">
            <Input value={customFileName} placeholder="{name}_{lang}.{ext}" onChange={(e) => setCustomFileName(e.target.value)} allowClear aria-label={t("customExportFilename")} />
          </Form.Item>
        </Form>
      </div>
    </Flex>
  );
};

export default AdvancedTranslationSettings;
