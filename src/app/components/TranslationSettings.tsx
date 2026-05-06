"use client";

import { useEffect, useMemo, useState } from "react";
import { Form, Input, InputNumber, Card, Typography, Button, Space, Tooltip, App, Switch, Select, Modal, Popconfirm, Tag, Alert } from "antd";
import { SaveOutlined, PlusOutlined, DeleteOutlined } from "@ant-design/icons";
import {
  TRANSLATION_SERVICES,
  LLM_MODELS,
  DEFAULT_SYS_PROMPT,
  DEFAULT_USER_PROMPT,
  URL_IS_PRIMARY_CRED,
  testTranslation,
  clearTranslationCache,
  getDefaultConfig,
  getThinkingModelPattern,
  getProviderEndpoints,
  migrateConfig,
  categorizedOptions,
  completeOpenAICompatUrl,
  type TranslateTextParams,
} from "@/app/lib/translation";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { useTranslations } from "next-intl";
import Section from "@/app/components/styled/Section";
import GlobalPromptsPanel from "@/app/components/GlobalPromptsPanel";

const { Text, Link } = Typography;
const { TextArea } = Input;
const { CheckableTag } = Tag;

// Services usable without user credentials — always surfaced in the configured-chips row
const NO_KEY_REQUIRED = new Set(["gtxFreeAPI"]);

// Services whose URL field accepts an OpenAI-compatible /chat/completions endpoint;
// safe to auto-complete on blur. azureopenai is excluded (URL is a base, code
// builds the deployment path); deepl/deeplx use private protocols.
const URL_AUTO_COMPLETE_SERVICES = new Set(["llm", "doubao", "qwen", "qwenMt", "nvidia", "translategemma"]);

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

  // Thinking toggle visibility:
  //   - Service has `enableThinking` in its config (claude, nvidia): always show.
  //   - Service has model-conditional thinking via `thinkingModelPattern` (deepseek):
  //     show only when the current model matches; the toggle's value is read from
  //     config.enableThinking (undefined => off).
  const thinkingPattern = getThinkingModelPattern(service);
  const currentModel = (config?.model as string | undefined) ?? "";
  const showThinkingToggle = config?.enableThinking !== undefined || (!!thinkingPattern && thinkingPattern.test(currentModel));

  const llmPresetIsEmpty = llmPresets.length === 0;
  const llmPresetPlaceholder = llmPresetIsEmpty ? t("presetEmptyHint") : t("presetSelect");

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

    // URL_IS_PRIMARY_CRED services treat URL as the credential — apiKey is
    // optional (local LM Studio / llama.cpp typically don't require one).
    if (config.apiKey !== undefined && !URL_IS_PRIMARY_CRED.has(service) && !`${config.apiKey}`.trim()) {
      message.error(tCommon("enterApiKey"));
      return;
    }

    if (config.url !== undefined) {
      const urlValue = `${config.url ?? ""}`.trim();
      if (!urlValue && (URL_IS_PRIMARY_CRED.has(service) || service === "azureopenai")) {
        message.error(tCommon("enterApiUrl"));
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
      case "translategemma":
        // Both URL-primary self-hosted services share the LM Studio default —
        // 1234 is easier to remember than 11434 (Ollama) and LM Studio runs
        // both general LLMs and TranslateGemma equally. Endpoints chips offer
        // Ollama / llama.cpp etc. for users on different runtimes.
        return `${tCommon("example")}: http://127.0.0.1:1234/v1/chat/completions`;
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
      {/* Custom (OpenAI-compatible) discoverability hint — many users miss that
          this provider accepts ANY OpenAI-compatible endpoint, not just Ollama */}
      {service === "llm" && <Alert type="info" showIcon title={t("customApiHelp")} style={{ marginBottom: 16 }} />}
      {/* llm provider-only preset picker — sits above the grouped sections */}
      {service === "llm" && (
        <div style={{ marginBottom: 0 }}>
          <Space.Compact style={{ width: "100%" }}>
            <Select
              style={{ flex: 1 }}
              placeholder={llmPresetPlaceholder}
              value={activePresetId || undefined}
              onChange={(value) => loadLlmPreset(value)}
              allowClear
              onClear={() => loadLlmPreset("")}
              options={llmPresets.map((p) => ({ label: p.name, value: p.id }))}
            />
            <Tooltip title={t("presetUpdate")}>
              <Button
                icon={<SaveOutlined />}
                disabled={!activePresetId}
                aria-label={t("presetUpdate")}
                onClick={() => {
                  if (!activePresetId) return;
                  updateLlmPreset(activePresetId);
                  message.success(t("presetUpdated"));
                }}
              />
            </Tooltip>
            <Tooltip title={t("presetSave")}>
              <Button
                icon={<PlusOutlined />}
                aria-label={t("presetSave")}
                onClick={() => {
                  setPresetName("");
                  setPresetModalOpen(true);
                }}
              />
            </Tooltip>
            <Popconfirm
              title={t("presetDeleteConfirm")}
              onConfirm={() => {
                if (activePresetId) {
                  deleteLlmPreset(activePresetId);
                  message.success(t("presetDeleted"));
                }
              }}
              disabled={!activePresetId}>
              <Tooltip title={t("presetDelete")}>
                <Button
                  danger
                  icon={<DeleteOutlined />}
                  disabled={!activePresetId}
                  aria-label={t("presetDelete")}
                />
              </Tooltip>
            </Popconfirm>
          </Space.Compact>
          <Modal title={t("presetSave")} open={presetModalOpen} onOk={handleSavePreset} onCancel={() => setPresetModalOpen(false)}>
            <Input placeholder={t("presetNamePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onPressEnter={handleSavePreset} autoFocus />
          </Modal>
        </div>
      )}

      {/* ========== Credentials group ========== */}
      {(config?.url !== undefined || config?.apiKey !== undefined || config?.region !== undefined || config?.apiVersion !== undefined || config?.useRelay !== undefined) && (
        <Section variant="neutral" style={{ marginTop: 16 }} noGap>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("credentialsGroup")}
          </Text>
          <Form layout="vertical">
            {config?.url !== undefined && (
              <Form.Item
                label={`${t("url")}`}
                extra={URL_IS_PRIMARY_CRED.has(service) ? t("urlExtra") : service === "azureopenai" ? undefined : t("deeplxUrlExtra")}
                required={URL_IS_PRIMARY_CRED.has(service) || service === "azureopenai"}>
                {(() => {
                  const endpoints = getProviderEndpoints(service);
                  if (!endpoints || endpoints.length === 0) return null;
                  const currentUrl = (config?.url as string | undefined)?.trim();
                  // For providers with an implicit runtime default (empty URL falls
                  // back to spec.endpoint = endpoints[0].url), highlight endpoints[0]
                  // when URL is empty. Services whose `defaults.url` is empty (Custom
                  // OpenAI-compat) have no implicit default — empty URL means "not
                  // configured", so don't auto-highlight there. Self-maintaining for
                  // future URL_IS_PRIMARY_CRED services without empty defaults.
                  const noImplicitDefault = !getDefaultConfig(service)?.url;
                  return (
                    <Space wrap size={[4, 8]} style={{ marginBottom: 4 }}>
                      {endpoints.map((ep, i) => {
                        const isActive = currentUrl ? currentUrl === ep.url : !noImplicitDefault && i === 0;
                        return (
                          <Tag
                            key={ep.url}
                            color={isActive ? "blue" : undefined}
                            style={{ cursor: "pointer", margin: 0 }}
                            onClick={() => handleConfigChange(service, "url", ep.url)}>
                            {ep.label}
                          </Tag>
                        );
                      })}
                    </Space>
                  );
                })()}
                <Input
                  placeholder={getUrlPlaceholder(service)}
                  value={config?.url}
                  onChange={(e) => handleConfigChange(service, "url", e.target.value)}
                  onBlur={
                    URL_AUTO_COMPLETE_SERVICES.has(service)
                      ? (e) => {
                          const value = e.target.value.trim();
                          if (!value) return;
                          const normalized = completeOpenAICompatUrl(value);
                          if (normalized !== value) {
                            handleConfigChange(service, "url", normalized);
                            message.info(t("urlAutoCompleted"));
                          }
                        }
                      : undefined
                  }
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
                required={!URL_IS_PRIMARY_CRED.has(service)}>
                <Input.Password
                  autoComplete="off"
                  placeholder={`${tCommon("enter")} ${currentService?.label} API Key`}
                  value={config.apiKey as string | undefined}
                  onChange={(e) => handleConfigChange(service, "apiKey", e.target.value)}
                  aria-label={`${currentService?.label} API Key`}
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
            {config?.apiVersion !== undefined && (
              <Form.Item label={`LLM API Version`} extra={`${tCommon("example")}: 2024-07-18`} style={{ marginBottom: config?.useRelay !== undefined ? 24 : 0 }}>
                <Input value={config.apiVersion as string | undefined} onChange={(e) => handleConfigChange(service, "apiVersion", e.target.value)} aria-label="LLM API Version" />
              </Form.Item>
            )}
            {config?.useRelay !== undefined && (
              <Form.Item label={t("useRelay")} extra={t("useRelayTooltip")} style={{ marginBottom: 0 }}>
                <Switch checked={config.useRelay as boolean | undefined} onChange={(checked) => handleConfigChange(service, "useRelay", checked)} aria-label={t("useRelay")} />
              </Form.Item>
            )}
          </Form>
        </Section>
      )}

      {/* ========== Model group ========== */}
      {(config?.model !== undefined || config?.temperature !== undefined || showThinkingToggle || config?.domains !== undefined || config?.sendSystemPrompt !== undefined) && (
        <Section variant="neutral" style={{ marginTop: 16 }} noGap>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("modelGroup")}
          </Text>
          <Form layout="vertical">
            {config?.model !== undefined && (
              <Form.Item label={`LLM ${tCommon("model")}`} extra={t("modelExtra")}>
                <Input
                  placeholder={service === "llm" ? `${tCommon("example")}: llama3.2, gpt-3.5-turbo, meta-llama/Llama-3.3-70B-Instruct-Turbo` : undefined}
                  value={config.model as string | undefined}
                  onChange={(e) => handleConfigChange(service, "model", e.target.value)}
                  aria-label={`LLM ${tCommon("model")}`}
                />
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
            {showThinkingToggle && (
              <Form.Item label={t("enableThinking")} extra={t("enableThinkingTooltip")}>
                <Switch checked={(config?.enableThinking as boolean | undefined) ?? false} onChange={(checked) => handleConfigChange(service, "enableThinking", checked)} aria-label={t("enableThinking")} />
              </Form.Item>
            )}
            {showThinkingToggle && (config?.enableThinking as boolean | undefined) && (
              <Form.Item label={t("reasoningEffort")} extra={t("reasoningEffortExtra")}>
                <Select
                  value={config?.reasoningEffort ?? "medium"}
                  onChange={(value) => handleConfigChange(service, "reasoningEffort", value)}
                  options={[
                    { value: "low", label: "Low" },
                    { value: "medium", label: "Medium" },
                    { value: "high", label: "High" },
                  ]}
                  aria-label={t("reasoningEffort")}
                />
              </Form.Item>
            )}
            {config?.domains !== undefined && (
              <Form.Item
                label={t("qwenMtDomains")}
                extra={`${tCommon("example")}: The sentence is from Ali Cloud IT domain. It mainly involves computer-related software development and usage methods, including many terms related to computer software and hardware. Pay attention to professional troubleshooting terminologies and sentence patterns when translating. Translate into this IT domain style.`}
                style={{ marginBottom: 0 }}>
                <TextArea
                  value={config.domains as string | undefined}
                  onChange={(e) => handleConfigChange(service, "domains", e.target.value)}
                  autoSize={{ minRows: 2, maxRows: 6 }}
                  aria-label="Domains"
                />
              </Form.Item>
            )}
            {config?.sendSystemPrompt !== undefined && (
              <Form.Item label={t("sendSystemPrompt")} extra={t("sendSystemPromptExtra")} style={{ marginBottom: 0 }}>
                <Switch
                  checked={config?.sendSystemPrompt !== false}
                  onChange={(checked) => handleConfigChange(service, "sendSystemPrompt", checked)}
                  aria-label={t("sendSystemPrompt")}
                />
              </Form.Item>
            )}
          </Form>
        </Section>
      )}

      {/* ========== Call parameters group ========== */}
      {(config?.chunkSize !== undefined ||
        config?.delayTime !== undefined ||
        config?.batchSize !== undefined ||
        (isLLMModel && config?.contextBatchSize !== undefined) ||
        (isLLMModel && config?.contextWindow !== undefined)) && (
        <Section variant="neutral" style={{ marginTop: 16 }} noGap>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("callParamsGroup")}
          </Text>
          <Form layout="vertical">
            {config?.chunkSize !== undefined && (
              <Form.Item label={t("chunkSize")} extra={t("chunkSizeExtra")}>
                <InputNumber min={1} className="!w-full" value={config.chunkSize as number | undefined} onChange={(value) => handleConfigChange(service, "chunkSize", value ?? 1)} aria-label={t("chunkSize")} />
              </Form.Item>
            )}
            {config?.delayTime !== undefined && (
              <Form.Item label={`${t("delayTime")} (ms)`}>
                <InputNumber min={1} className="!w-full" value={config.delayTime as number | undefined} onChange={(value) => handleConfigChange(service, "delayTime", value ?? 1)} aria-label={t("delayTime")} />
              </Form.Item>
            )}
            {config?.batchSize !== undefined && (
              <Form.Item label={t("batchSize")} extra={t("batchSizeExtra")}>
                <InputNumber min={1} className="!w-full" value={config?.batchSize as number | undefined} onChange={(value) => handleConfigChange(service, "batchSize", value ?? 1)} aria-label={t("batchSize")} />
              </Form.Item>
            )}
            {isLLMModel && config?.contextBatchSize !== undefined && (
              <Form.Item label={t("contextBatchSize")} extra={t("contextBatchSizeExtra")}>
                <InputNumber
                  min={1}
                  max={50}
                  className="!w-full"
                  value={config?.contextBatchSize as number | undefined}
                  onChange={(value) => handleConfigChange(service, "contextBatchSize", value ?? 1)}
                  aria-label={t("contextBatchSize")}
                />
              </Form.Item>
            )}
            {isLLMModel && config?.contextWindow !== undefined && (
              <Form.Item label={t("contextWindow")} extra={t("contextWindowExtra")} style={{ marginBottom: 0 }}>
                <InputNumber min={1} max={500} className="!w-full" value={config?.contextWindow as number | undefined} onChange={(value) => handleConfigChange(service, "contextWindow", value ?? 1)} aria-label={t("contextWindow")} />
              </Form.Item>
            )}
          </Form>
        </Section>
      )}
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

  // Active services = no-key-required + has apiKey + has URL (for URL-primary
  // services like Custom OpenAI-compatible) + currently selected. Currently-selected
  // is always included so the user can always "see" and click back to it even if
  // they haven't configured anything yet.
  const activeServices = useMemo(() => {
    const seen = new Set<string>();
    const entries: typeof TRANSLATION_SERVICES = [];
    for (const s of TRANSLATION_SERVICES) {
      const cfg = translationConfigs?.[s.value] as { apiKey?: unknown; url?: unknown } | undefined;
      const hasKey = typeof cfg?.apiKey === "string" && cfg.apiKey.trim() !== "";
      const hasUrlCred = URL_IS_PRIMARY_CRED.has(s.value) && typeof cfg?.url === "string" && cfg.url.trim() !== "";
      const noKeyNeeded = NO_KEY_REQUIRED.has(s.value);
      const isCurrent = s.value === translationMethod;
      if ((hasKey || hasUrlCred || noKeyNeeded || isCurrent) && !seen.has(s.value)) {
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

      {isLLMModel && <GlobalPromptsPanel />}
    </div>
  );
};

export default TranslationSettings;
