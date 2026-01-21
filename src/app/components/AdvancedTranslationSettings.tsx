"use client";

import React from "react";
import { Flex, Input, InputNumber, Row, Col, Tooltip, Switch, Divider, Form } from "antd";
import { useTranslations } from "next-intl";

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

  return (
    <Flex vertical gap="middle">
      <Flex vertical gap="small">
        {/* Component-specific settings */}
        {children}

        {/* Single File Mode */}
        {setSingleFileMode && (
          <Flex justify="space-between" align="center">
            <Tooltip title={t("singleFileModeTooltip")}>
              <span>{t("singleFileMode")}</span>
            </Tooltip>
            <Switch size="small" checked={singleFileMode} onChange={setSingleFileMode} aria-label={t("singleFileMode")} />
          </Flex>
        )}

        {/* Use cache toggle */}
        <Flex justify="space-between" align="center">
          <Tooltip title={t("useCacheTooltip")}>
            <span>{t("useCache")}</span>
          </Tooltip>
          <Switch size="small" checked={useCache} onChange={setUseCache} aria-label={t("useCache")} />
        </Flex>
      </Flex>
      {/* Retry count and timeout - Grouped in Form for alignment */}
      <Form layout="vertical" component="div">
        <Row gutter={16}>
          <Col span={12}>
            <Form.Item label={t("retryCount")} tooltip={t("retryCountTooltip")} style={{ marginBottom: 0 }}>
              <InputNumber min={1} max={10} value={retryCount} onChange={(value) => setRetryCount(value ?? 3)} style={{ width: "100%" }} aria-label={t("retryCount")} />
            </Form.Item>
          </Col>
          <Col span={12}>
            <Form.Item label={t("retryTimeout")} tooltip={t("retryTimeoutTooltip")} style={{ marginBottom: 0 }}>
              <InputNumber min={5} max={1200} value={retryTimeout} onChange={(value) => setRetryTimeout(value ?? 30)} suffix="s" style={{ width: "100%" }} aria-label={t("retryTimeout")} />
            </Form.Item>
          </Col>
        </Row>
      </Form>

      <Divider style={{ margin: "0" }} />

      {/* Output Settings Group */}
      <Form layout="vertical" component="div">
        {/* Remove chars input */}
        <Form.Item label={t("removeCharsAfterTranslation")} tooltip={t("removeCharsAfterTranslationTooltip")}>
          <Input placeholder={`${t("example")}: ♪ <i> </i>`} value={removeChars} onChange={(e) => setRemoveChars(e.target.value)} allowClear aria-label={t("removeCharsAfterTranslation")} />
        </Form.Item>

        {/* Export filename input */}
        <Form.Item label={t("customExportFilename")} tooltip={t("customExportFilenameTooltip")} style={{ marginBottom: 0 }}>
          <Input value={customFileName} placeholder="{name}_{lang}.{ext}" onChange={(e) => setCustomFileName(e.target.value)} allowClear aria-label={t("customExportFilename")} />
        </Form.Item>
      </Form>
    </Flex>
  );
};

export default AdvancedTranslationSettings;
