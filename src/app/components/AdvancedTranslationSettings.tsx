"use client";

import React from "react";
import { Flex, Input, InputNumber, Row, Col, Tooltip, Switch, Form, Typography } from "antd";
import { useTranslations } from "next-intl";
import Section from "@/app/components/styled/Section";

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
  requestTimeoutSec: number;
  setRequestTimeoutSec: (value: number) => void;
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
  requestTimeoutSec,
  setRequestTimeoutSec,
  useCache,
  setUseCache,
  children,
  singleFileMode,
  setSingleFileMode,
}) => {
  const t = useTranslations("common");

  return (
    <Flex vertical gap="middle">
      {/* 1. General Switches */}
      <Section variant="neutral" noGap>
        <Flex vertical gap="small">
          {children}
          {setSingleFileMode && (
            <Flex justify="space-between" align="center">
              <Tooltip title={t("singleFileModeTooltip")}>
                <Text>{t("singleFileMode")}</Text>
              </Tooltip>
              <Switch size="small" checked={singleFileMode} onChange={setSingleFileMode} aria-label={t("singleFileMode")} />
            </Flex>
          )}
          <Flex justify="space-between" align="center">
            <Tooltip title={t("useCacheTooltip")}>
              <Text>{t("useCache")}</Text>
            </Tooltip>
            <Switch size="small" checked={useCache} onChange={setUseCache} aria-label={t("useCache")} />
          </Flex>
        </Flex>
      </Section>

      {/* 2. Network / Resilience */}
      <Section variant="neutral" noGap>
        <Form layout="vertical" component="div">
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item label={t("retryCount")} tooltip={t("retryCountTooltip")} className="!mb-0">
                <InputNumber min={1} max={10} value={retryCount} onChange={(value) => setRetryCount(value ?? 3)} className="!w-full" aria-label={t("retryCount")} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item label={t("requestTimeoutSec")} tooltip={t("requestTimeoutSecTooltip")} className="!mb-0">
                <InputNumber min={5} max={1200} value={requestTimeoutSec} onChange={(value) => setRequestTimeoutSec(value ?? 30)} suffix="s" className="!w-full" aria-label={t("requestTimeoutSec")} />
              </Form.Item>
            </Col>
          </Row>
        </Form>
      </Section>

      {/* 3. Output Formatting */}
      <Section variant="neutral" noGap>
        <Form layout="vertical">
          <Form.Item label={t("removeCharsAfterTranslation")} tooltip={t("removeCharsAfterTranslationTooltip")} className="!mb-3">
            <Input placeholder={`${t("example")}: ♪ <i> </i>`} value={removeChars} onChange={(e) => setRemoveChars(e.target.value)} allowClear aria-label={t("removeCharsAfterTranslation")} />
          </Form.Item>
          <Form.Item label={t("customExportFilename")} tooltip={t("customExportFilenameTooltip")} className="!mb-0">
            <Input value={customFileName} placeholder="{name}_{lang}.{ext}" onChange={(e) => setCustomFileName(e.target.value)} allowClear aria-label={t("customExportFilename")} />
          </Form.Item>
        </Form>
      </Section>
    </Flex>
  );
};

export default AdvancedTranslationSettings;
