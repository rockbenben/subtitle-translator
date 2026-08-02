"use client";

import React from "react";
import { ConfigProvider, Flex, Input, InputNumber, Row, Col, Tooltip, Switch, Form, Typography } from "antd";
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
  // 翻译进行中整块禁用(含调用方塞进来的 children)。整条翻译链跑在点击那一刻的
  // 闭包快照上,运行中改这些只会"看起来生效了"——想改,先取消(缓存即断点)。
  disabled?: boolean;
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
  disabled = false,
  singleFileMode,
  setSingleFileMode,
}) => {
  const t = useTranslations("common");

  return (
    // ConfigProvider componentDisabled:一点锁全(Switch/InputNumber/Input 与
    // children 里的控件都消费 DisabledContext),不用逐控件写 disabled。
    // ⚠ 若日后往里放 Segmented:antd 6 的 Segmented 不读 DisabledContext,得显式传。
    <ConfigProvider componentDisabled={disabled}>
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
            <Input placeholder={`${t("example")}: ♪ <i> </i>`} value={removeChars} onChange={(e) => setRemoveChars(e.target.value)} allowClear aria-label={t("removeCharsAfterTranslation")} spellCheck={false} />
          </Form.Item>
          <Form.Item label={t("customExportFilename")} tooltip={t("customExportFilenameTooltip")} className="!mb-0">
            <Input value={customFileName} placeholder="{name}.{ext}" onChange={(e) => setCustomFileName(e.target.value)} allowClear aria-label={t("customExportFilename")} spellCheck={false} />
          </Form.Item>
        </Form>
      </Section>
    </Flex>
    </ConfigProvider>
  );
};

export default AdvancedTranslationSettings;
