"use client";

import { useEffect, useMemo, useState } from "react";
import { Form, Input, InputNumber, Card, Typography, Button, Space, Tooltip, App, Switch, Select, Modal, Popconfirm, Tag } from "antd";
import {
  TRANSLATION_SERVICES,
  LLM_MODELS,
  DEFAULT_SYS_PROMPT,
  DEFAULT_USER_PROMPT,
  testTranslation,
  clearTranslationCache,
  getDefaultConfig,
  migrateConfig,
  categorizedOptions,
  type TranslateTextParams,
} from "@/app/lib/translation";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { useTranslations } from "next-intl";

const { Text, Link } = Typography;
const { TextArea } = Input;
const { CheckableTag } = Tag;

// Services usable without user credentials — always surfaced in the configured-chips row
const NO_KEY_REQUIRED = new Set(["gtxFreeAPI"]);

// Global LLM prompts card — shared across all LLM services (lifted out of per-service tab)
const GlobalPromptsCard = () => {
  const t = useTranslations("TranslationSettings");
  const tCommon = useTranslations("common");
  const { sysPrompt, setSysPrompt, userPrompt, setUserPrompt } = useTranslationContext();

  return (
    <Card size="small" title={t("globalPrompts")} extra={<Text type="secondary">{t("globalPromptsExtra")}</Text>}>
      <Form layout="vertical">
        <Form.Item label={t("systemPrompt")} extra={t("systemPromptExtra")} style={{ marginBottom: 12 }}>
          <TextArea value={sysPrompt} onChange={(e) => setSysPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} aria-label={t("systemPrompt")} />
        </Form.Item>
        <Form.Item
          label={t("userPrompt")}
          extra={`${t("userPromptExtra")}: \${sourceLanguage} ${t("for")} ${tCommon("sourceLanguage")}, \${targetLanguage} ${t("for")} ${tCommon("targetLanguage")}, \${content} ${t("for")} ${t("textToTranslate")}, \${fullText} ${t("for")} full text`}
          style={{ marginBottom: 0 }}>
          <TextArea value={userPrompt} onChange={(e) => setUserPrompt(e.target.value)} autoSize={{ minRows: 2, maxRows: 6 }} aria-label={t("userPrompt")} />
        </Form.Item>
      </Form>
    </Card>
  );
};

const ServiceSettingsForm = ({ service }: { service: string }) => {
  const tCommon = useTranslations("common");
  const t = useTranslations("TranslationSettings");
  const { message } = App.useApp();
  const {
    translationConfigs,
    handleConfigChange,
    resetTranslationConfig,
    sysPrompt,
    setSysPrompt,
    userPrompt,
    setUserPrompt,
    llmPresets,
    activePresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    updateLlmPreset,
  } = useTranslationContext();

  const [testingService, setTestingService] = useState<string | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const currentService = TRANSLATION_SERVICES.find((s) => s.value === service);
  const isLLMModel = LLM_MODELS.includes(service);

  const defaultConfig = getDefaultConfig(service);
  const config = migrateConfig(translationConfigs?.[service], defaultConfig);

  const handleSavePreset = () => {
    if (!presetName.trim()) {
      message.error(t("presetNameRequired"));
      return;
    }
    saveLlmPreset(presetName.trim());
    setPresetModalOpen(false);
    message.success(t("presetSaved"));
  };

  const resetTranslationCache = async () => {
    try {
      const count = await clearTranslationCache();
      message.success(`${t("resetCacheSuccess")} (${count})`);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      message.error(t("resetCacheFail"));
    }
  };

  const handleResetToDefault = () => {
    resetTranslationConfig(service);
    if (isLLMModel) {
      setSysPrompt(DEFAULT_SYS_PROMPT);
      setUserPrompt(DEFAULT_USER_PROMPT);
    }
  };

  const handleTestConfig = async () => {
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
      const isSuccess = await testTranslation(service, config as Partial<TranslateTextParams>, isLLMModel ? sysPrompt : undefined, isLLMModel ? userPrompt : undefined);
      if (isSuccess) {
        message.success(`${currentService?.label || service} - ${t("testConfigSuccess")}`);
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

  const getUrlPlaceholder = (serviceValue: string) => {
    switch (serviceValue) {
      case "llm":
        return `${tCommon("example")}: http://127.0.0.1:11434/v1/chat/completions`;
      case "nvidia":
        return `${tCommon("example")}: https://integrate.api.nvidia.com/v1/chat/completions`;
      case "azureopenai":
        return `${tCommon("example")}: https://your-resource-name.openai.azure.com`;
      case "qwenMt":
        return `${tCommon("example")}: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`;
      default:
        return `${tCommon("example")}: http://192.168.2.3:32770/translate`; // deeplx default
    }
  };

  return (
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
            <Button type="primary" loading={testingService === service} onClick={handleTestConfig}>
              {t("testConfig")}
            </Button>
          </Tooltip>
          <Button onClick={handleResetToDefault}>{t("resetConfig")}</Button>
        </Space>
      }>
      <Form layout="vertical">
        {service === "llm" && (
          <Form.Item label={t("presetSelect")}>
            <Space.Compact style={{ width: "100%" }}>
              <Select
                style={{ flex: 1 }}
                placeholder={t("presetSelect")}
                value={activePresetId || undefined}
                onChange={(value) => loadLlmPreset(value)}
                allowClear
                onClear={() => loadLlmPreset("")}
                options={llmPresets.map((p) => ({ label: p.name, value: p.id }))}
              />
              {activePresetId ? (
                <Button
                  onClick={() => {
                    updateLlmPreset(activePresetId);
                    message.success(t("presetUpdated"));
                  }}>
                  {t("presetUpdate")}
                </Button>
              ) : null}
              <Button
                onClick={() => {
                  setPresetName("");
                  setPresetModalOpen(true);
                }}>
                {t("presetSave")}
              </Button>
              <Popconfirm
                title={t("presetDeleteConfirm")}
                onConfirm={() => {
                  if (activePresetId) {
                    deleteLlmPreset(activePresetId);
                    message.success(t("presetDeleted"));
                  }
                }}
                disabled={!activePresetId}>
                <Button danger disabled={!activePresetId}>
                  {t("presetDelete")}
                </Button>
              </Popconfirm>
            </Space.Compact>
            <Modal title={t("presetSave")} open={presetModalOpen} onOk={handleSavePreset} onCancel={() => setPresetModalOpen(false)}>
              <Input placeholder={t("presetNamePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onPressEnter={handleSavePreset} autoFocus />
            </Modal>
          </Form.Item>
        )}
        {config?.url !== undefined && (
          <Form.Item
            label={`${t("url")}`}
            extra={service === "llm" ? t("urlExtra") : service === "azureopenai" ? undefined : t("deeplxUrlExtra")}
            required={service === "llm" || service === "azureopenai"}>
            <Input placeholder={getUrlPlaceholder(service)} value={config?.url} onChange={(e) => handleConfigChange(service, "url", e.target.value)} aria-label={`API ${t("url")}`} />
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

        {config?.useRelay !== undefined && (
          <Form.Item label={t("useRelay")} extra={t("useRelayTooltip")}>
            <Switch checked={config.useRelay as boolean | undefined} onChange={(checked) => handleConfigChange(service, "useRelay", checked)} aria-label={t("useRelay")} />
          </Form.Item>
        )}

        {config?.enableThinking !== undefined && (
          <Form.Item label={t("enableThinking")} extra={t("enableThinkingTooltip")}>
            <Switch checked={config.enableThinking as boolean | undefined} onChange={(checked) => handleConfigChange(service, "enableThinking", checked)} aria-label={t("enableThinking")} />
          </Form.Item>
        )}

        {config?.domains !== undefined && (
          <Form.Item
            label={t("qwenMtDomains")}
            extra={`${tCommon("example")}: The sentence is from Ali Cloud IT domain. It mainly involves computer-related software development and usage methods, including many terms related to computer software and hardware. Pay attention to professional troubleshooting terminologies and sentence patterns when translating. Translate into this IT domain style.`}>
            <TextArea
              value={config.domains as string | undefined}
              onChange={(e) => handleConfigChange(service, "domains", e.target.value)}
              autoSize={{ minRows: 2, maxRows: 6 }}
              aria-label="Domains"
            />
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
              className="w-full"
              aria-label="Temperature"
            />
          </Form.Item>
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
            <Input type="number" value={config?.contextWindow as number | undefined} onChange={(e) => handleConfigChange(service, "contextWindow", e.target.value)} aria-label={t("contextWindow")} />
          </Form.Item>
        )}
      </Form>
    </Card>
  );
};

const TranslationSettings = () => {
  const t = useTranslations("TranslationSettings");
  const { translationMethod, setTranslationMethod, translationConfigs } = useTranslationContext();
  const isLLMModel = LLM_MODELS.includes(translationMethod);

  // Guard against stale localStorage keys (e.g. a renamed service like "aliyun" -> "qwenMt").
  // getCurrentConfig's internal fallback only covers the translation call path; without this,
  // the Select would render an unmatched raw value and chips wouldn't include the current service.
  useEffect(() => {
    if (!TRANSLATION_SERVICES.some((s) => s.value === translationMethod)) {
      setTranslationMethod("gtxFreeAPI");
    }
  }, [translationMethod, setTranslationMethod]);

  // Active services = no-key-required + has apiKey + currently selected.
  // Currently-selected is always included so the user can always "see" and click back to it
  // even if they haven't configured an apiKey yet.
  const activeServices = useMemo(() => {
    const seen = new Set<string>();
    const entries: typeof TRANSLATION_SERVICES = [];
    for (const s of TRANSLATION_SERVICES) {
      const cfg = translationConfigs?.[s.value] as { apiKey?: unknown } | undefined;
      const hasKey = typeof cfg?.apiKey === "string" && cfg.apiKey.trim() !== "";
      const noKeyNeeded = NO_KEY_REQUIRED.has(s.value);
      const isCurrent = s.value === translationMethod;
      if ((hasKey || noKeyNeeded || isCurrent) && !seen.has(s.value)) {
        seen.add(s.value);
        entries.push(s);
      }
    }
    return entries;
  }, [translationConfigs, translationMethod]);

  return (
    <div className="flex flex-col gap-4">
      <Card size="small">
        <Space orientation="vertical" size="small" style={{ width: "100%" }}>
          <Space wrap size="small">
            <Text>{t("selectService")}:</Text>
            <Select
              style={{ minWidth: 240 }}
              showSearch={{ optionFilterProp: "label" }}
              value={translationMethod}
              onChange={setTranslationMethod}
              options={categorizedOptions}
              aria-label={t("selectService")}
            />
          </Space>
          {activeServices.length > 0 && (
            <Space wrap size={[4, 4]}>
              <Text type="secondary">{t("configuredServices")}:</Text>
              {activeServices.map((s) => (
                <CheckableTag key={s.value} checked={s.value === translationMethod} onChange={() => setTranslationMethod(s.value)}>
                  {s.label}
                </CheckableTag>
              ))}
            </Space>
          )}
        </Space>
      </Card>

      <ServiceSettingsForm key={translationMethod} service={translationMethod} />

      {isLLMModel && <GlobalPromptsCard />}
    </div>
  );
};

export default TranslationSettings;
