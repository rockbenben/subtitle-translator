"use client";

import { Tabs, Form, Input, Card, Typography, Button, Space, Tooltip, message } from "antd";
import { TRANSLATION_SERVICES, LLM_MODELS, CACHE_PREFIX } from "@/app/components/translateAPI";
import useTranslateData from "@/app/hooks/useTranslateData";
import { useTranslations } from "next-intl";

const { Text, Link } = Typography;
const { TextArea } = Input;

const TranslationSettings = () => {
  const tCommon = useTranslations("common");
  const t = useTranslations("TranslationSettings");
  const [messageApi, contextHolder] = message.useMessage();
  const { translationMethod, setTranslationMethod, getCurrentConfig, handleConfigChange, resetTranslationConfig, sysPrompt, setSysPrompt, userPrompt, setUserPrompt } = useTranslateData();
  const resetTranslationCache = async () => {
    try {
      // 异步分批删除缓存，避免UI阻塞
      const allKeys = Object.keys(localStorage);
      const cacheKeys = allKeys.filter((key) => key.startsWith(CACHE_PREFIX));

      // 分批处理，每批删除100个
      const batchSize = 100;
      for (let i = 0; i < cacheKeys.length; i += batchSize) {
        const batch = cacheKeys.slice(i, i + batchSize);
        batch.forEach((key) => localStorage.removeItem(key));

        // 让出控制权给UI线程
        if (i + batchSize < cacheKeys.length) {
          await new Promise((resolve) => setTimeout(resolve, 0));
        }
      }

      messageApi.success(`Translation cache has been reset (${cacheKeys.length} entries cleared)`);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      messageApi.error("Failed to clear translation cache");
    }
  };
  const handleTabChange = (key: string) => {
    setTranslationMethod(key);
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
              <Button onClick={() => resetTranslationConfig(service)}>{t("resetConfig")}</Button>
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
                />
              </Form.Item>
            )}

            {config?.apiKey !== undefined && (
              <Form.Item label={`${currentService?.label} API Key`} required={service !== "llm"}>
                <Input.Password
                  autoComplete="off"
                  placeholder={`${tCommon("enter")} ${currentService?.label} API Key`}
                  value={config.apiKey}
                  onChange={(e) => handleConfigChange(service, "apiKey", e.target.value)}
                />
              </Form.Item>
            )}

            {config?.region !== undefined && (
              <Form.Item label="Azure Region" required>
                <Input placeholder={`${tCommon("enter")} Azure API Region`} value={config?.region} onChange={(e) => handleConfigChange(service, "region", e.target.value)} />
              </Form.Item>
            )}

            {config?.model !== undefined && (
              <Form.Item label={`LLM ${tCommon("model")}`} extra={t("modelExtra")}>
                <Input value={config.model} onChange={(e) => handleConfigChange(service, "model", e.target.value)} />
              </Form.Item>
            )}

            {config?.apiVersion !== undefined && (
              <Form.Item label={`LLM API Version`} extra={`${tCommon("example")}: 2024-07-18`}>
                <Input value={config.apiVersion} onChange={(e) => handleConfigChange(service, "apiVersion", e.target.value)} />
              </Form.Item>
            )}
            {config?.temperature !== undefined && (
              <Form.Item label="Temperature" extra={t("temperatureExtra")}>
                <Input type="number" value={config.temperature} onChange={(e) => handleConfigChange(service, "temperature", e.target.value)} />
              </Form.Item>
            )}
            {isLLMModel && (
              <>
                <Form.Item label={t("systemPrompt")} extra={t("systemPromptExtra")}>
                  <TextArea value={sysPrompt} onChange={(e) => setSysPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
                </Form.Item>
                <Form.Item
                  label={t("userPrompt")}
                  extra={`${t("userPromptExtra")}: \${sourceLanguage} ${t("for")} ${tCommon("sourceLanguage")}, \${targetLanguage} ${t("for")} ${tCommon("targetLanguage")}, \${content} ${t(
                    "for"
                  )} ${t("textToTranslate")}`}>
                  <TextArea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} />
                </Form.Item>
              </>
            )}

            {config?.chunkSize !== undefined && (
              <Form.Item label={t("chunkSize")} extra={t("chunkSizeExtra")}>
                <Input type="number" value={config.chunkSize} onChange={(e) => handleConfigChange(service, "chunkSize", e.target.value)} />
              </Form.Item>
            )}

            {config?.delayTime !== undefined && (
              <Form.Item label={`${t("delayTime")} (ms)`}>
                <Input type="number" value={config.delayTime} onChange={(e) => handleConfigChange(service, "delayTime", e.target.value)} />
              </Form.Item>
            )}

            <Form.Item label={t("limit")} extra={t("limitExtra")}>
              <Input type="number" value={config?.limit} onChange={(e) => handleConfigChange(service, "limit", e.target.value)} />
            </Form.Item>

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
    <div className="flex">
      {contextHolder}
      <Tabs
        activeKey={translationMethod}
        onChange={handleTabChange}
        tabPosition="left"
        className="w-full"
        items={TRANSLATION_SERVICES.map((service) => ({
          key: service.value,
          label: service.label,
          children: renderSettings(service.value),
        }))}
      />
    </div>
  );
};

export default TranslationSettings;
