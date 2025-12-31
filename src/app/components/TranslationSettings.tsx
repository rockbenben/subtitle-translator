"use client";

import { useState, memo } from "react";
import { Tabs, Form, Input, InputNumber, Card, Typography, Button, Space, Tooltip, App, Switch } from "antd";
import { TRANSLATION_SERVICES, LLM_MODELS, DEFAULT_SYS_PROMPT, DEFAULT_USER_PROMPT, testTranslation, clearTranslationCache } from "@/app/lib/translation";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { useTranslations } from "next-intl";

const { Text, Link } = Typography;
const { TextArea } = Input;

const TranslationSettings = () => {
  const tCommon = useTranslations("common");
  const t = useTranslations("TranslationSettings");
  const { message } = App.useApp();
  const { translationMethod, setTranslationMethod, translationConfigs, getCurrentConfig, handleConfigChange, resetTranslationConfig, sysPrompt, setSysPrompt, userPrompt, setUserPrompt } =
    useTranslationContext();
  const [testingService, setTestingService] = useState<string | null>(null);

  const resetTranslationCache = async () => {
    try {
      const count = await clearTranslationCache();
      message.success(`Translation cache has been reset (${count} entries cleared)`);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      message.error("Failed to clear translation cache");
    }
  };

  const handleTabChange = (key: string) => {
    setTranslationMethod(key);
  };

  const handleResetToDefault = (service: string) => {
    resetTranslationConfig(service);
    if (LLM_MODELS.includes(service)) {
      setSysPrompt(DEFAULT_SYS_PROMPT);
      setUserPrompt(DEFAULT_USER_PROMPT);
    }
  };

  const handleTestConfig = async (service: string, serviceLabel?: string) => {
    const config = translationConfigs?.[service];
    if (!config) {
      message.error(t("testConfigFail"));
      return;
    }

    if (config.apiKey !== undefined && service !== "llm" && !`${config.apiKey}`.trim()) {
      message.error(tCommon("enterApiKey"));
      return;
    }

    if (config.url !== undefined) {
      const urlValue = `${config.url ?? ""}`.trim();
      if (!urlValue && (service === "llm" || service === "azureopenai")) {
        message.error(tCommon("enterLlmUrl"));
        return;
      }
    }

    try {
      setTestingService(service);
      const isLLMService = LLM_MODELS.includes(service);
      const isSuccess = await testTranslation(service, config, isLLMService ? sysPrompt : undefined, isLLMService ? userPrompt : undefined);
      if (isSuccess) {
        message.success(`${serviceLabel || service} - ${t("testConfigSuccess")}`);
      } else {
        message.error(t("testConfigFail"));
      }
    } catch (error) {
      console.error("Test config failed", error);
      message.error(t("testConfigFail"));
    } finally {
      setTestingService(null);
    }
  };

  const renderSettings = (service: string) => {
    const currentService = TRANSLATION_SERVICES.find((s) => s.value === service);
    const config = getCurrentConfig();
    const isLLMModel = LLM_MODELS.includes(service);

    return (
      <div className="p-4">
        <Card
          title={
            <Space>
              {currentService?.label}
              {currentService?.docs && (
                <Link type="secondary" href={currentService.docs} target="_blank">
                  {`API ${t("docs")}`}
                </Link>
              )}
            </Space>
          }
          extra={
            <Space wrap>
              <Tooltip title={t("resetCacheTooltip")}>
                <Button onClick={resetTranslationCache}>{t("resetCache")}</Button>
              </Tooltip>
              <Tooltip title={t("testConfigTooltip")}>
                <Button type="primary" loading={testingService === service} onClick={() => handleTestConfig(service, currentService?.label)}>
                  {t("testConfig")}
                </Button>
              </Tooltip>
              <Button onClick={() => handleResetToDefault(service)}>{t("resetConfig")}</Button>
            </Space>
          }>
          <Form layout="vertical">
            {config?.url !== undefined && (
              <Form.Item
                label={`API ${t("url")}`}
                extra={service === "llm" ? t("urlExtra") : service === "azureopenai" ? undefined : t("deeplxUrlExtra")}
                required={service === "llm" || service === "azureopenai"}>
                <Input
                  placeholder={
                    service === "llm"
                      ? `${tCommon("example")}: http://127.0.0.1:11434/v1/chat/completions`
                      : service === "azureopenai"
                      ? `${tCommon("example")}: https://your-resource-name.openai.azure.com`
                      : `${tCommon("example")}: http://192.168.2.3:32770/translate`
                  }
                  value={config?.url}
                  onChange={(e) => handleConfigChange(service, "url", e.target.value)}
                  aria-label={`API ${t("url")}`}
                />
              </Form.Item>
            )}

            {config?.apiKey !== undefined && (
              <Form.Item
                label={
                  <Space>
                    {`${currentService?.label} API Key`}
                    {currentService?.apiKeyUrl && (
                      <Link href={currentService.apiKeyUrl} target="_blank">
                        {tCommon("getApiKey") || "Get API Key"}
                      </Link>
                    )}
                  </Space>
                }
                required={service !== "llm"}>
                <Input.Password
                  autoComplete="off"
                  placeholder={`${tCommon("enter")} ${currentService?.label} API Key`}
                  value={config.apiKey as string | undefined}
                  onChange={(e) => handleConfigChange(service, "apiKey", e.target.value)}
                  aria-label={`${currentService?.label} API Key`}
                />
              </Form.Item>
            )}

            {service === "deepseek" && (
              <Form.Item label={t("useRelay")} extra={t("useRelayTooltip")}>
                <Switch checked={config?.useRelay as boolean | undefined} onChange={(checked) => handleConfigChange(service, "useRelay", checked)} aria-label={t("useRelay")} />
              </Form.Item>
            )}

            {config?.region !== undefined && (
              <Form.Item label="Azure Region" required>
                <Input
                  placeholder={`${tCommon("enter")} Azure API Region`}
                  value={config?.region as string | undefined}
                  onChange={(e) => handleConfigChange(service, "region", e.target.value)}
                  aria-label="Azure Region"
                />
              </Form.Item>
            )}

            {config?.model !== undefined && (
              <Form.Item label={`LLM ${tCommon("model")}`} extra={t("modelExtra")}>
                <Input value={config.model as string | undefined} onChange={(e) => handleConfigChange(service, "model", e.target.value)} aria-label={`LLM ${tCommon("model")}`} />
              </Form.Item>
            )}

            {config?.apiVersion !== undefined && (
              <Form.Item label={`LLM API Version`} extra={`${tCommon("example")}: 2024-07-18`}>
                <Input value={config.apiVersion as string | undefined} onChange={(e) => handleConfigChange(service, "apiVersion", e.target.value)} aria-label="LLM API Version" />
              </Form.Item>
            )}
            {config?.temperature !== undefined && (
              <Form.Item label="Temperature" extra={t("temperatureExtra")}>
                <InputNumber
                  min={0}
                  max={1.99}
                  step={0.1}
                  value={config.temperature as number | undefined}
                  onChange={(value) => handleConfigChange(service, "temperature", value ?? 0)}
                  style={{ width: "100%" }}
                  aria-label="Temperature"
                />
              </Form.Item>
            )}
            {isLLMModel && (
              <>
                <Form.Item label={t("systemPrompt")} extra={t("systemPromptExtra")}>
                  <TextArea value={sysPrompt} onChange={(e) => setSysPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} aria-label={t("systemPrompt")} />
                </Form.Item>
                <Form.Item
                  label={t("userPrompt")}
                  extra={`${t("userPromptExtra")}: \${sourceLanguage} ${t("for")} ${tCommon("sourceLanguage")}, \${targetLanguage} ${t("for")} ${tCommon("targetLanguage")}, \${content} ${t(
                    "for"
                  )} ${t("textToTranslate")}, \${fullText} ${t("for")} full text`}>
                  <TextArea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} aria-label={t("userPrompt")} />
                </Form.Item>
              </>
            )}

            {config?.chunkSize !== undefined && (
              <Form.Item label={t("chunkSize")} extra={t("chunkSizeExtra")}>
                <Input type="number" value={config.chunkSize as number | undefined} onChange={(e) => handleConfigChange(service, "chunkSize", e.target.value)} aria-label={t("chunkSize")} />
              </Form.Item>
            )}

            {config?.delayTime !== undefined && (
              <Form.Item label={`${t("delayTime")} (ms)`}>
                <Input type="number" value={config.delayTime as number | undefined} onChange={(e) => handleConfigChange(service, "delayTime", e.target.value)} aria-label={t("delayTime")} />
              </Form.Item>
            )}

            {config?.batchSize !== undefined && (
              <Form.Item label={t("batchSize")} extra={t("batchSizeExtra")}>
                <Input type="number" value={config?.batchSize as number | undefined} onChange={(e) => handleConfigChange(service, "batchSize", e.target.value)} aria-label={t("batchSize")} />
              </Form.Item>
            )}

            {isLLMModel && config?.contextWindow !== undefined && (
              <Form.Item label={t("contextWindow")} extra={t("contextWindowExtra")}>
                <Input
                  type="number"
                  value={config?.contextWindow as number | undefined}
                  onChange={(e) => handleConfigChange(service, "contextWindow", e.target.value)}
                  aria-label={t("contextWindow")}
                />
              </Form.Item>
            )}

            <div className="mt-4 pt-4 border-t">
              <Text type="secondary">
                {t("CurrentTransConfig")}: {currentService?.label}
              </Text>
            </div>
          </Form>
        </Card>
      </div>
    );
  };

  return (
    <div className="flex flex-col md:flex-row">
      <Tabs
        activeKey={translationMethod}
        onChange={handleTabChange}
        tabPlacement="start"
        className="w-full"
        destroyOnHidden
        items={TRANSLATION_SERVICES.map((service) => ({
          key: service.value,
          label: service.label,
          children: renderSettings(service.value),
        }))}
      />
    </div>
  );
};

export default memo(TranslationSettings);
