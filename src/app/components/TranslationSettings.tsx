"use client";

import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import { Form, Input, InputNumber, AutoComplete, Card, Typography, Button, Space, Flex, Tooltip, App, Switch, Select, Modal, Popconfirm, Tag, theme } from "antd";
import { SaveOutlined, PlusOutlined, DeleteOutlined, InfoCircleOutlined } from "@ant-design/icons";
import {
  TRANSLATION_PROVIDERS,
  LLM_MODELS,
  DEFAULT_SYSTEM_PROMPT,
  DEFAULT_USER_PROMPT,
  BINARY_EFFORT_VENDORS,
  URL_IS_PRIMARY_CRED,
  deriveThinkingParams,
  getConfigStatus,
  testTranslation,
  clearTranslationCache,
  getDefaultConfig,
  isThinkingModel,
  isThinkingCapableProvider,
  isCustomModel,
  getProviderEndpoints,
  getProviderModels,
  migrateConfig,
  categorizedOptions,
  completeOpenAICompatUrl,
  supportsGlossary,
  type ReasoningEffort,
  type TranslateTextParams,
} from "@/app/lib/translation";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { useTranslations } from "next-intl";
import Section from "@/app/components/styled/Section";
import GlobalPromptsPanel from "@/app/components/GlobalPromptsPanel";
import GlossaryManager from "@/app/components/glossaryManager/GlossaryManager";
import { useIsMobile } from "@/app/hooks/useIsMobile";

const { Text, Link } = Typography;
const { TextArea } = Input;
const { CheckableTag } = Tag;

// Services whose URL field accepts an OpenAI-compatible /chat/completions endpoint;
// safe to auto-complete on blur. azureopenai is excluded (URL is a base, code
// builds the deployment path); deepl/deeplx use private protocols.
const URL_AUTO_COMPLETE_SERVICES = new Set(["llm", "doubao", "qwen", "qwenMt", "nvidia", "translategemma"]);

const ServiceSettingsForm = ({ service }: { service: string }) => {
  const tCommon = useTranslations("common");
  const t = useTranslations("TranslationSettings");
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const isMobile = useIsMobile();
  const {
    translationConfigs,
    handleConfigChange,
    resetTranslationConfig,
    systemPrompt,
    setSystemPrompt,
    userPrompt,
    setUserPrompt,
    llmPresets,
    activeLlmPresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    updateLlmPreset,
  } = useTranslationContext();

  const [testingService, setTestingService] = useState<string | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const currentService = TRANSLATION_PROVIDERS.find((s) => s.value === service);
  const isLLMModel = LLM_MODELS.includes(service);

  const defaultConfig = getDefaultConfig(service);
  const config = migrateConfig(translationConfigs?.[service], defaultConfig);

  // Thinking-effort visibility: per-model gate via `models[].thinking: true`
  // in registry. State stored per-model in `config.thinkingEffort[sku]` where
  // the value IS the effort literal — entry presence = enabled at that effort,
  // absence = off (we don't persist OFF state, per "如果没开启不记录"). The
  // Select's "off" option removes the entry; any effort writes it directly.
  // Binary-effort vendors (Doubao/Zhipu/Moonshot/MiniMax/Hunyuan) collapse
  // Low/Medium/High to the same wire payload — UI shows Off/On for them to
  // avoid hinting at granularity that doesn't exist. "On" stores "medium" as
  // a canonical value; the wire builder only checks effort presence anyway.
  //
  // Also shown for a CUSTOM (unlisted) SKU on a thinking-capable provider, so the
  // user can opt into thinking on a model we haven't tagged yet (e.g. a freshly
  // released one). Listed-but-untagged models (mistral-large-3) stay hidden — we
  // know they don't think.
  //
  // Custom models get a THREE-state control Off/On/Auto, DEFAULT Off: Off sends an
  // EXPLICIT disable (so a server-default-ON custom model — e.g. mimo-v2-omni — is
  // actually off, not just "following the server default"); On enables; Auto omits
  // the param (the escape valve for a non-thinking SKU that a STRICT provider would
  // 422 on the disable — pick Auto to translate it normally). Default is Off, not
  // Auto, so nothing silently keeps thinking on. Tagged models stay 2-state Off/On.
  const currentModel = config?.model ?? "";
  const isModelThinkingTagged = isThinkingModel(service, currentModel);
  const showThinkingControl = isModelThinkingTagged || (isThinkingCapableProvider(service) && isCustomModel(service, currentModel));
  const customThinking = showThinkingControl && !isModelThinkingTagged;
  const isBinaryEffort = BINARY_EFFORT_VENDORS.has(service);
  const thinkingEffortRecord = config?.thinkingEffort ?? {};
  const currentModelEffort = thinkingEffortRecord[currentModel];
  // Stored directive → Select value. Unified across tagged/custom: tagged never stores
  // "auto" (its 2-state UI can't produce it), so that branch is simply dead there.
  // absence → "off" (default); "auto" → "auto"; effort → "on" (binary) or the literal.
  const thinkingSelectValue = isBinaryEffort ? (currentModelEffort === "auto" ? "auto" : currentModelEffort ? "on" : "off") : (currentModelEffort ?? "off");

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
      setSystemPrompt(DEFAULT_SYSTEM_PROMPT);
      setUserPrompt(DEFAULT_USER_PROMPT);
    }
    message.success(t("resetConfigSuccess"));
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
      // Mirror orchestrator's gate so the Test button exercises the same wire
      // payload as actual translation (effort level — undefined = thinking off).
      const testParams: Partial<TranslateTextParams> = {
        ...(config as Partial<TranslateTextParams>),
        reasoningEffort: deriveThinkingParams(service, config),
      };
      // 30s 超时:黑洞端点否则让 Test 按钮永远转圈(同 ApiStatusBlock)。
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      const testError = await testTranslation(service, testParams, isLLMModel ? systemPrompt : undefined, isLLMModel ? userPrompt : undefined, controller.signal).finally(() => clearTimeout(timeout));
      if (!testError) {
        message.success(`${currentService?.label || service} - ${t("testConfigSuccess")}`);
      } else {
        // Surface the real reason (401/403/CORS/timeout/…), not a generic "test failed".
        message.error(`${t("testConfigFail")}: ${testError}`, 10);
      }
    } catch (error) {
      // Pre-flight errors (e.g. deriveThinkingParams) — testTranslation itself no longer throws.
      console.error("Test config failed", error);
      message.error(error instanceof Error && error.message ? `${t("testConfigFail")}: ${error.message}` : t("testConfigFail"), 10);
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

  const cardTitle = (
    <Flex wrap align="center" gap={8}>
      <span>{currentService?.label}</span>
      {currentService?.docs && (
        <Link type="secondary" href={currentService.docs} target="_blank">
          {`API ${t("docs")}`}
        </Link>
      )}
    </Flex>
  );

  // Action buttons live in Card.extra on desktop and in a body row on mobile —
  // antd Card's title/extra share one flex row, and three buttons + a title
  // overflow the ~290px content area inside the Drawer at phone widths.
  const actionButtons = (
    <Space wrap>
      <Popconfirm title={t("resetCacheConfirm")} onConfirm={resetTranslationCache} okText={t("resetCache")} cancelText={tCommon("cancel")} okButtonProps={{ danger: true }}>
        <Tooltip title={t("resetCacheTooltip")}>
          <Button>{t("resetCache")}</Button>
        </Tooltip>
      </Popconfirm>
      <Tooltip title={t("testConfigTooltip")}>
        <Button type="primary" loading={testingService === service} onClick={handleTestConfig}>
          {t("testConfig")}
        </Button>
      </Tooltip>
      <Button onClick={handleResetToDefault}>{t("resetConfig")}</Button>
    </Space>
  );

  // LLM preset bar: Select + 3 icon buttons. Desktop = single compact row;
  // mobile = Select on its own row (so preset names stay readable) + buttons
  // below in a Compact row.
  const llmPresetSelect = (
    <Select
      style={isMobile ? { width: "100%" } : { flex: 1 }}
      placeholder={llmPresetPlaceholder}
      value={activeLlmPresetId || undefined}
      onChange={(value) => loadLlmPreset(value)}
      allowClear
      onClear={() => loadLlmPreset("")}
      options={llmPresets.map((p) => ({ label: p.name, value: p.id }))}
    />
  );
  const llmPresetButtons = (
    <Fragment>
      <Tooltip title={t("presetUpdate")}>
        <Button
          icon={<SaveOutlined />}
          disabled={!activeLlmPresetId}
          aria-label={t("presetUpdate")}
          onClick={() => {
            if (!activeLlmPresetId) return;
            updateLlmPreset(activeLlmPresetId);
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
          if (activeLlmPresetId) {
            deleteLlmPreset(activeLlmPresetId);
            message.success(t("presetDeleted"));
          }
        }}
        disabled={!activeLlmPresetId}>
        <Tooltip title={t("presetDelete")}>
          <Button danger icon={<DeleteOutlined />} disabled={!activeLlmPresetId} aria-label={t("presetDelete")} />
        </Tooltip>
      </Popconfirm>
    </Fragment>
  );

  return (
    <Card
      title={cardTitle}
      extra={isMobile ? null : actionButtons}
      // Tighter body padding on mobile reclaims ~24px for input width — the
      // outer Drawer + Card + nested Section already double-pad otherwise.
      styles={isMobile ? { body: { padding: 12 } } : undefined}>
      {isMobile && <div style={{ marginBottom: 12 }}>{actionButtons}</div>}
      {/* Custom (OpenAI-compatible) discoverability hint — many users miss that
          this provider accepts ANY OpenAI-compatible endpoint, not just Ollama.
          Rendered as muted helper text, not an Alert: colorInfo is the vermilion
          brand accent, so an info Alert reads like a warning for a casual hint. */}
      {service === "llm" && (
        <Text type="secondary" style={{ display: "block", marginBottom: 16, fontSize: 13 }}>
          <InfoCircleOutlined style={{ marginInlineEnd: 6 }} />
          {t("customApiHelp")}
        </Text>
      )}
      {/* llm provider-only preset picker — sits above the grouped sections */}
      {service === "llm" && (
        <div style={{ marginBottom: 0 }}>
          {isMobile ? (
            <Flex vertical gap={token.marginXS}>
              {llmPresetSelect}
              <Space.Compact style={{ width: "100%" }}>{llmPresetButtons}</Space.Compact>
            </Flex>
          ) : (
            <Space.Compact style={{ width: "100%" }}>
              {llmPresetSelect}
              {llmPresetButtons}
            </Space.Compact>
          )}
          <Modal title={t("presetSave")} open={presetModalOpen} onOk={handleSavePreset} onCancel={() => setPresetModalOpen(false)} width={isMobile ? "90vw" : undefined}>
            <Input placeholder={t("presetNamePlaceholder")} value={presetName} onChange={(e) => setPresetName(e.target.value)} onPressEnter={handleSavePreset} autoFocus />
          </Modal>
        </div>
      )}

      {/* ========== Credentials group ========== */}
      {(config?.url !== undefined || config?.apiKey !== undefined || config?.region !== undefined || config?.folderId !== undefined || config?.apiVersion !== undefined || config?.useRelay !== undefined) && (
        <Section variant="neutral" style={{ marginTop: 16 }} noGap>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("credentialsGroup")}
          </Text>
          <Form layout="vertical">
            {config?.url !== undefined && (
              <Form.Item
                label={`${t("url")}`}
                // URL_IS_PRIMARY_CRED (llm/translategemma): self-hosted, URL is
                // the credential — show generic "supports localhost + remote".
                // azureopenai: URL is the per-tenant resource, no fallback —
                // no helper text (the field itself implies "required").
                // deeplx: empty URL falls back to OUR community deeplx instance,
                // so the "public server" wording is accurate here.
                // Everyone else with a URL field (deepl/nvidia via our proxy,
                // qwen/moonshot/doubao/zhipu/minimax/qwenMt direct to vendor):
                // empty URL falls back to the vendor's official endpoint (or
                // our edge proxy to it). The neutral "default endpoint" wording
                // matches both flavors without misleading users that we run
                // those upstreams.
                extra={
                  URL_IS_PRIMARY_CRED.has(service)
                    ? t("urlExtra")
                    : service === "azureopenai"
                      ? undefined
                      : service === "deeplx"
                        ? t("deeplxUrlExtra")
                        : t("urlOptionalExtra")
                }
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
                            role="button"
                            tabIndex={0}
                            aria-pressed={isActive}
                            style={{
                              cursor: "pointer",
                              margin: 0,
                              ...(isActive
                                ? {
                                    background: token.colorPrimaryBg,
                                    color: token.colorPrimary,
                                    borderColor: token.colorPrimaryBorder,
                                  }
                                : {}),
                            }}
                            onClick={() => handleConfigChange(service, "url", ep.url)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleConfigChange(service, "url", ep.url);
                              }
                            }}>
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
                  spellCheck={false}
                />
              </Form.Item>
            )}
            {config?.apiKey !== undefined && (
              <Form.Item
                label={
                  <Flex wrap align="center" gap={8}>
                    <span>{`${currentService?.label} API Key`}</span>
                    {currentService?.apiKeyUrl && (
                      <Link href={currentService.apiKeyUrl} target="_blank">
                        {tCommon("getApiKey") || "Get API Key"}
                      </Link>
                    )}
                  </Flex>
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
                  spellCheck={false}
                />
              </Form.Item>
            )}
            {config?.folderId !== undefined && (
              // Yandex AI Studio: per-tenant folder ID, assembled into the model
              // URI (gpt://<folderId>/<model>) by the service. Hardcoded label —
              // single rare service, same precedent as "Azure Region" above.
              <Form.Item label="Yandex Folder ID" required extra={`${tCommon("example")}: b1g8a2b3c4d5e6f7g8h9`}>
                <Input
                  placeholder={`${tCommon("enter")} Yandex Cloud Folder ID`}
                  value={config?.folderId as string | undefined}
                  onChange={(e) => handleConfigChange(service, "folderId", e.target.value)}
                  aria-label="Yandex Folder ID"
                  spellCheck={false}
                />
              </Form.Item>
            )}
            {config?.apiVersion !== undefined && (
              <Form.Item label={`LLM API Version`} extra={`${tCommon("example")}: 2025-11-18`} style={{ marginBottom: config?.useRelay !== undefined ? 24 : 0 }}>
                <Input value={config.apiVersion as string | undefined} onChange={(e) => handleConfigChange(service, "apiVersion", e.target.value)} aria-label="LLM API Version" spellCheck={false} />
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
      {(config?.model !== undefined || config?.temperature !== undefined || (isLLMModel && config?.maxTokens !== undefined) || showThinkingControl || config?.domains !== undefined || config?.sendSystemPrompt !== undefined) && (
        <Section variant="neutral" style={{ marginTop: 16 }} noGap>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("modelGroup")}
          </Text>
          <Form layout="vertical">
            {config?.model !== undefined &&
              (() => {
                // AutoComplete = text input + curated dropdown. Empty `models`
                // (provider without curated list) makes it behave like a plain
                // Input — user types any SKU freely.
                const models = getProviderModels(service) as Array<{ label: string; value: string }>;
                const knownValues = new Set(models.map((m) => m.value));
                const defaultModel = (getDefaultConfig(service)?.model as string | undefined) ?? "";
                return (
                  <Form.Item label={`LLM ${tCommon("model")}`} extra={t("modelExtra")}>
                    <AutoComplete
                      options={models}
                      value={config.model as string | undefined}
                      // ?? "":clear(X)按钮触发 onChange(undefined),写入
                      // model: undefined 会让整个 model 字段(连同 thinking
                      // 控件)从 UI 消失 —— 字段可见性判定是 `!== undefined`。
                      onChange={(value) => handleConfigChange(service, "model", value ?? "")}
                      allowClear
                      placeholder={service === "llm" ? `${tCommon("example")}: llama3.2, gpt-3.5-turbo, meta-llama/Llama-3.3-70B-Instruct-Turbo` : undefined}
                      showSearch={{
                        filterOption: (input, option) => {
                          if (!input) return true;
                          // When the input is an exact match for an existing model
                          // SKU, the user has *already selected* it — they're
                          // opening the dropdown to browse alternatives, not to
                          // narrow down. Show all options instead of just that one.
                          if (knownValues.has(input)) return true;
                          const i = input.toLowerCase();
                          // Search both value (SKU) and label (friendly name) —
                          // users may type "DeepSeek" or "deepseek-v4" or "Pro".
                          return String(option?.value ?? "").toLowerCase().includes(i) || String(option?.label ?? "").toLowerCase().includes(i);
                        },
                      }}
                      // Dual-line option render: friendly name (with `default`
                      // tag for the spec's defaultModel) on top, SKU below in
                      // dim small text. Closes the visual gap between the
                      // dropdown label ("Claude Sonnet 4.6") and what lands in
                      // the input field ("claude-sonnet-4-6") — users see the
                      // correspondence at a glance.
                      optionRender={(oriOption) => {
                        const value = String(oriOption.value ?? "");
                        const label = String(oriOption.label ?? value);
                        const isDefault = value === defaultModel;
                        return (
                          <div style={{ paddingBlock: 2 }}>
                            <Flex align="center" gap={6}>
                              <span style={{ fontWeight: isDefault ? 600 : 400 }}>{label}</span>
                              {isDefault && (
                                <Tag
                                  style={{
                                    margin: 0,
                                    fontSize: 10,
                                    lineHeight: "16px",
                                    padding: "0 4px",
                                    color: token.colorPrimary,
                                    background: token.colorPrimaryBg,
                                    borderColor: token.colorPrimaryBorder,
                                  }}>
                                  default
                                </Tag>
                              )}
                            </Flex>
                            {value !== label && <div style={{ fontSize: 12, opacity: 0.55, marginTop: 2 }}>{value}</div>}
                          </div>
                        );
                      }}
                      aria-label={`LLM ${tCommon("model")}`}
                    />
                  </Form.Item>
                );
              })()}
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
            {/* isLLMModel guard: don't render the knob on MT services if a default
                ever leaks maxTokens (MT wire layer ignores it). See registry.ts. */}
            {isLLMModel && config?.maxTokens !== undefined && (
              <Form.Item label={t("maxTokens")} extra={t("maxTokensExtra")}>
                <InputNumber
                  min={0}
                  max={128000}
                  className="!w-full"
                  value={config?.maxTokens as number | undefined}
                  onChange={(value) => handleConfigChange(service, "maxTokens", value ?? 0)}
                  aria-label={t("maxTokens")}
                />
              </Form.Item>
            )}
            {showThinkingControl && (
              <Form.Item label={t("reasoningEffort")} extra={t("reasoningEffortExtra")}>
                <Select<"auto" | "off" | "on" | ReasoningEffort>
                  value={thinkingSelectValue}
                  onChange={(value) => {
                    const next = { ...thinkingEffortRecord };
                    if (value === "off")
                      delete next[currentModel]; // absence = the default Off (wire sends disable)
                    else if (value === "auto") next[currentModel] = "auto"; // custom-only escape: omit
                    else if (value === "on") next[currentModel] = "medium";
                    else next[currentModel] = value;
                    handleConfigChange(service, "thinkingEffort", next);
                  }}
                  options={[
                    { value: "off" as const, label: "Off" },
                    ...(isBinaryEffort
                      ? [{ value: "on" as const, label: "On" }]
                      : [
                          { value: "low" as const, label: "Low" },
                          { value: "medium" as const, label: "Medium" },
                          { value: "high" as const, label: "High" },
                        ]),
                    ...(customThinking ? [{ value: "auto" as const, label: "Auto" }] : []),
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
                <Switch checked={config?.sendSystemPrompt !== false} onChange={(checked) => handleConfigChange(service, "sendSystemPrompt", checked)} aria-label={t("sendSystemPrompt")} />
              </Form.Item>
            )}
          </Form>
        </Section>
      )}

      {/* ========== Call parameters group ========== */}
      {/* Field order follows the user's decision flow: chunk → concurrency → throttle.
          batchSize (non-context) sits next to contextBatchSize (context) so users can
          compare; contextWindow precedes contextBatchSize since you'd size the window
          before deciding how many such batches to fire in parallel. delayTime trails
          as the "if you're getting rate-limited, slow it down" knob. */}
      {(config?.chunkSize !== undefined ||
        config?.batchSize !== undefined ||
        (isLLMModel && config?.contextWindow !== undefined) ||
        (isLLMModel && config?.contextBatchSize !== undefined) ||
        config?.delayTime !== undefined) && (
        <Section variant="neutral" style={{ marginTop: 16 }} noGap>
          <Text strong style={{ display: "block", marginBottom: 8 }}>
            {t("callParamsGroup")}
          </Text>
          <Form layout="vertical">
            {config?.chunkSize !== undefined && (
              <Form.Item label={t("chunkSize")} extra={t("chunkSizeExtra")}>
                <InputNumber
                  min={1}
                  className="!w-full"
                  value={config.chunkSize as number | undefined}
                  onChange={(value) => handleConfigChange(service, "chunkSize", value ?? 1)}
                  aria-label={t("chunkSize")}
                />
              </Form.Item>
            )}
            {config?.batchSize !== undefined && (
              <Form.Item label={t("batchSize")} extra={t("batchSizeExtra")}>
                <InputNumber
                  min={1}
                  className="!w-full"
                  value={config?.batchSize as number | undefined}
                  onChange={(value) => handleConfigChange(service, "batchSize", value ?? 1)}
                  aria-label={t("batchSize")}
                />
              </Form.Item>
            )}
            {isLLMModel && config?.contextWindow !== undefined && (
              <Form.Item label={t("contextWindow")} extra={t("contextWindowExtra")}>
                <InputNumber
                  min={1}
                  max={500}
                  className="!w-full"
                  value={config?.contextWindow as number | undefined}
                  onChange={(value) => handleConfigChange(service, "contextWindow", value ?? 1)}
                  aria-label={t("contextWindow")}
                />
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
            {config?.delayTime !== undefined && (
              <Form.Item label={`${t("delayTime")} (ms)`} style={{ marginBottom: 0 }}>
                <InputNumber
                  min={1}
                  className="!w-full"
                  value={config.delayTime as number | undefined}
                  onChange={(value) => handleConfigChange(service, "delayTime", value ?? 1)}
                  aria-label={t("delayTime")}
                />
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
  const isMobile = useIsMobile();
  const { translationMethod, setTranslationMethod, translationConfigs } = useTranslationContext();
  const isLLMModel = LLM_MODELS.includes(translationMethod);

  // Chips row = every service whose getConfigStatus is non-"needs-config",
  // plus the currently-selected one. getConfigStatus is the same predicate the
  // status block uses, so both surfaces agree (deeplx shows up free out of the
  // box, azureopenai stays hidden until URL+apiKey are both filled, etc).
  //
  // `?? getDefaultConfig(...)`: stored translationConfigs predate any newly
  // ADDED provider (useLocalStorage returns the saved JSON as-is, no default
  // merge), and getConfigStatus(method, undefined) defensively returns "free" —
  // which would list every brand-new credentialed provider as configured for
  // every existing user. Evaluating the registry default instead gives the
  // truthful status (apiKey "" → needs-config → hidden).
  const activeServices = useMemo(
    () =>
      TRANSLATION_PROVIDERS.filter((s) => {
        const status = getConfigStatus(s.value, translationConfigs?.[s.value] ?? getDefaultConfig(s.value));
        return status !== "needs-config" || s.value === translationMethod;
      }),
    [translationConfigs, translationMethod],
  );

  const providerSelect = (
    <Select
      style={isMobile ? { width: "100%" } : { minWidth: 240 }}
      showSearch={{ optionFilterProp: "label" }}
      value={translationMethod}
      onChange={setTranslationMethod}
      options={categorizedOptions}
      aria-label={t("selectService")}
    />
  );

  return (
    <div className="flex flex-col gap-4">
      {/* Drawer-flush 顶部:Drawer 已经有 header+border,这里再套 Card 会成「盒里盒」。
          直接平铺 provider Select + 已配置 chips,跟下面 ServiceSettingsForm 的 Card
          形成「无框→有框」的层级对比,信息密度更清晰。 */}
      <Space orientation="vertical" size="small" style={{ width: "100%" }}>
        {isMobile ? (
          <Flex vertical gap={4} style={{ width: "100%" }}>
            <Text>{t("selectService")}:</Text>
            {providerSelect}
          </Flex>
        ) : (
          <Space wrap size="small">
            <Text>{t("selectService")}:</Text>
            {providerSelect}
          </Space>
        )}
        {activeServices.length > 0 && (
          <Space wrap size={[4, 4]}>
            <Text type="secondary">{t("configuredServices")}:</Text>
            {activeServices.map((s) => (
              <CheckableTag
                key={s.value}
                checked={s.value === translationMethod}
                onChange={() => setTranslationMethod(s.value)}
                // antd's CheckableTagProps omits DOM passthrough props, but the
                // component spreads {...restProps} onto its <span> — so these
                // forward at runtime; the cast just bridges the narrow types.
                {...({
                  role: "button",
                  tabIndex: 0,
                  "aria-pressed": s.value === translationMethod,
                  onKeyDown: (e: KeyboardEvent<HTMLSpanElement>) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setTranslationMethod(s.value);
                    }
                  },
                } as Record<string, unknown>)}>
                {s.label}
              </CheckableTag>
            ))}
          </Space>
        )}
      </Space>

      <ServiceSettingsForm key={translationMethod} service={translationMethod} />

      {/* 术语表独立成卡(此前藏在 LLM-only prompts 面板底部),按服务能力
          展示:LLM 全系走 prompt 注入、qwenMt 走原生 terms;无模型内术语
          通道的纯 MT(GLOSSARY_UNSUPPORTED denylist)不出现 —— 入口出现
          却只有事后漏翻兜底,等于虚假承诺。 */}
      {supportsGlossary(translationMethod) && <GlossaryManager />}

      {isLLMModel && <GlobalPromptsPanel />}
    </div>
  );
};

export default TranslationSettings;
