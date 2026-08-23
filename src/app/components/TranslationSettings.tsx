"use client";

import { Fragment, useMemo, useState, type KeyboardEvent } from "react";
import { Form, Input, InputNumber, AutoComplete, Card, Typography, Button, Space, Flex, Tooltip, App, Switch, Select, Modal, Popconfirm, Tag, theme } from "antd";
import { SaveOutlined, PlusOutlined, DeleteOutlined, InfoCircleOutlined, LockOutlined } from "@ant-design/icons";
import {
  TRANSLATION_PROVIDERS,
  LLM_MODELS,
  BINARY_EFFORT_VENDORS,
  URL_IS_PRIMARY_CRED,
  getConfigStatus,
  isApiKeyOptional,
  testTranslationWithTimeout,
  getDefaultConfig,
  isThinkingModel,
  isThinkingCapableProvider,
  isCustomModel,
  getProviderEndpoints,
  getProviderModels,
  canDisableThinkingForModel,
  classifyEndpointUrl,
  migrateConfig,
  categorizedOptions,
  wireUrlNormalizer,
  usesBuiltinRelay,
  LLM_RELAY_BASE,
  isValidRelayBase,
  supportsGlossary,
  type ReasoningEffort,
} from "@/app/lib/translation";
import { translationCache } from "@/app/lib/storage/indexedDBStorage";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { DEFAULT_PROMPT_PRESET_ID } from "@/app/hooks/usePromptPresets";
import { describeError } from "@/app/utils";
import { useTranslations } from "next-intl";
import Section from "@/app/components/styled/Section";
import GlobalPromptsPanel from "@/app/components/GlobalPromptsPanel";
import GlossaryManager from "@/app/components/glossaryManager/GlossaryManager";
import { useIsMobile } from "@/app/hooks/useIsMobile";

const { Text, Link } = Typography;
const { TextArea } = Input;
const { CheckableTag } = Tag;

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
    userPrompt,
    loadPromptPreset,
    llmPresets,
    activeLlmPresetId,
    saveLlmPreset,
    loadLlmPreset,
    deleteLlmPreset,
    updateLlmPreset,
    requestTimeoutSec,
    relayBase,
    setRelayBase,
  } = useTranslationContext();

  const [testingService, setTestingService] = useState<string | null>(null);
  const [presetModalOpen, setPresetModalOpen] = useState(false);
  const [presetName, setPresetName] = useState("");

  const currentService = TRANSLATION_PROVIDERS.find((s) => s.value === service);
  const isLLMModel = LLM_MODELS.includes(service);

  const defaultConfig = getDefaultConfig(service);
  const config = migrateConfig(translationConfigs?.[service], defaultConfig);
  // 「填了哪个地址」与「走不走中转」是两个正交的轴,所以中转开关【永不置灰】。
  // 曾经按「url 非空 = 自定义 = 开关无效」把它禁用,那既是撒谎(官方变体照样经
  // 中转)又制造死角(关着中转选了变体、直连失败,提示让开中转,开关却是灰的)。
  // 自定义地址 + 中转的组合是合理诉求:自建 Worker 的用户把自己的地址加进
  // PROVIDER_URLS 就能用;对内置公共中转,引擎会对这种组合退回直连且不外发
  // 地址(registry.relayWouldServe),所以开关开着也不会有请求打进公共 Worker。
  const urlKind = classifyEndpointUrl(service, config?.url as string | undefined).kind;
  // 空 = 用内置中转,不算错;非空但不合法(漏 https://、javascript: 等)才标红。
  const relayBaseInvalid = relayBase.trim() !== "" && !isValidRelayBase(relayBase);

  // Thinking-effort visibility: per-model gate via `models[].thinking: true`
  // in registry. State stored per-model in `config.thinkingEffort[sku]` where
  // the value IS the effort literal — entry presence = enabled at that effort,
  // absence = off (we don't persist OFF state, per "如果没开启不记录"). The
  // Select's "off" option removes the entry; any effort writes it directly.
  // Binary-effort vendors (Doubao/Zhipu/MiniMax/SiliconFlow…) collapse
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
  const canOffThisModel = canDisableThinkingForModel(service, currentModel);
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
      const count = await translationCache.clear();
      message.success(`${t("resetCacheSuccess")} (${count})`);
    } catch (error) {
      console.error("Failed to clear cache:", error);
      message.error(t("resetCacheFail"));
    }
  };

  const handleResetToDefault = () => {
    resetTranslationConfig(service);
    // Reuse the default-prompt entry: this restores the factory prompts AND marks
    // the preset picker as "default", so the dropdown reflects the actual state
    // instead of leaving a now-stale custom preset name selected.
    if (isLLMModel) loadPromptPreset(DEFAULT_PROMPT_PRESET_ID);
    // Same staleness for the Custom-LLM preset dropdown (only shown for service
    // "llm", which snapshots this service's config): after reset the live config
    // no longer matches the selected preset, so clear the selection. This also
    // disables its "overwrite" button — otherwise the user could silently save
    // the reset config over their saved preset while it still looked selected.
    if (service === "llm") loadLlmPreset("");
    message.success(t("resetConfigSuccess"));
  };

  const handleTestConfig = async () => {
    if (!config) {
      message.error(t("testConfigFail"));
      return;
    }

    // 判据走 registry 的 isApiKeyOptional(URL 即凭证 ∪ 免配置),不是只看
    // URL_IS_PRIMARY_CRED —— 后者会在某个免配置服务带上可选 apiKey 时,用
    // "enterApiKey" 拦住一个 UI 旁边正标着「free」的服务。
    if (config.apiKey !== undefined && !isApiKeyOptional(service) && !`${config.apiKey}`.trim()) {
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
      // 共用入口统一处理超时(= requestTimeoutSec,与正式翻译同源)与
      // thinking 参数派生 —— 原则与实现都在 testTranslationWithTimeout。
      // 手动并 relayBase:本表单操作的是【任意】service(不限当前选中),走不了
      // getSelectedConfig 咽喉 —— 全仓唯一需要手动合并的消费者。
      const { error: testError, timedOut } = await testTranslationWithTimeout(service, { ...config, relayBase }, requestTimeoutSec, isLLMModel ? systemPrompt : undefined, isLLMModel ? userPrompt : undefined);
      if (!testError) {
        message.success(`${currentService?.label || service} - ${t("testConfigSuccess")}`);
      } else {
        // Surface the real reason + the status-mapped i18n hint, not a generic
        // "test failed". 超时单独归类(与 ApiStatusBlock 一致)。
        message.error(`${t("testConfigFail")}: ${timedOut ? tCommon("translationTimeout") : describeError(testError, tCommon)}`, 10);
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
      case "milmmt":
        // All three URL-primary self-hosted services share the LM Studio
        // default — 1234 is easier to remember than 11434 (Ollama) and LM
        // Studio runs general LLMs and the MT weights equally. Endpoint chips
        // cover the other local runtimes; Custom also lists Ollama, the two MT
        // services deliberately don't (Ollama still applies the Modelfile
        // template on /v1/completions — see RAW_PROMPT_RUNTIME_ENDPOINTS).
        return `${tCommon("example")}: http://127.0.0.1:1234/v1/chat/completions`;
      case "nvidia":
        return `${tCommon("example")}: https://integrate.api.nvidia.com/v1/chat/completions`;
      case "azureopenai":
        return `${tCommon("example")}: https://your-resource-name.openai.azure.com`;
      case "qwenMt":
        return `${tCommon("example")}: https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions`;
      case "deepl":
        return `${tCommon("example")}: https://api-edgeone.newzone.top/api/deepl`;
      case "deeplx":
        return `${tCommon("example")}: http://192.168.2.3:32770/translate`;
      default:
        // 其余都是云厂商的可选自定义 endpoint(自建代理/备用直连地址)。
        // 裸主机即可:openai-compat 自动补 /v1/chat/completions,claude 补
        // /v1/messages —— 通用示例给裸主机最不误导。
        return `${tCommon("example")}: https://your-proxy.example.com`;
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
          Rendered as muted helper text, not an Alert: colorInfo is the brand
          accent, so an info Alert reads louder than a casual hint warrants. */}
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
                // URL_IS_PRIMARY_CRED (llm / translategemma / milmmt): self-hosted,
                // URL is the credential — show generic "supports localhost + remote".
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
                  // 判据是「点了能不能改变什么」:
                  //  - 多个端点 → 能选,渲染。
                  //  - URL 即凭证 → 地址框起始是空的,点一下把它填进去,渲染。
                  //  - 其余单条(claude/yandex 那种为 classifyEndpointUrl 声明官方
                  //    地址的)→ 它写回的就是"留空",点了等于没点,不渲染;
                  //    何况其余单端点 provider 根本没有这一行,有它反倒不一致。
                  if (!endpoints || (endpoints.length < 2 && !URL_IS_PRIMARY_CRED.has(service))) return null;
                  // 高亮判据走 classifyEndpointUrl —— 它已经把「留空」解析成该
                  // provider 实际会打的默认地址,所以留空时默认标签能正确点亮,
                  // 而没有默认端点的服务(URL_IS_PRIMARY_CRED 那几家)一个都不点亮。
                  // ⚠ 曾经用 `!getDefaultConfig(service)?.url` 判「有没有隐式默认」:
                  // openai-compat 的 defaults.url 一律是 ""(逃生口字段无条件配发),
                  // 于是该判据恒为 true,默认标签【从来没亮过】。别再据 defaults.url
                  // 推断默认端点,那是两回事。
                  const activeEndpoint = classifyEndpointUrl(service, config?.url as string | undefined).url;
                  // 选中的芯片自带文档时把链接摆出来 —— 自托管类服务
                  // (Custom / TranslateGemma / MiLMMT) 的芯片背后是一个独立产品
                  // (LM Studio / Ollama / llama.cpp / koboldcpp / LiteLLM…),provider 级的
                  // docs 要么不存在(Custom)要么只讲模型(HF 模型卡),都回答不了
                  // “怎么把这个服务跑起来”—— 而这正是这条路的第一道坑。
                  const activeDocs = endpoints.find((ep) => ep.url === activeEndpoint)?.docs;
                  return (
                    <Space wrap size={[4, 8]} style={{ marginBottom: 4 }}>
                      {endpoints.map((ep) => {
                        const isActive = activeEndpoint === ep.url;
                        // 默认端点写回 ""(而不是完整 URL):cache.ts 把非空
                        // config.url 计进缓存键,点一下默认芯片就会把该 provider
                        // 已有的译文缓存整个作废 —— 而它表达的语义正是"用默认",
                        // 与留空完全等价。非默认端点仍写完整 URL。
                        // ⚠ URL 即凭证的服务除外:它们留空是"还没配"而不是"用默认",
                        // 写回 "" 会让这个芯片变成点了没反应的死键。
                        const nextUrl = !URL_IS_PRIMARY_CRED.has(service) && classifyEndpointUrl(service, ep.url).kind === "default" ? "" : ep.url;
                        return (
                          <Tag
                            key={ep.url}
                            data-endpoint-chip="true"
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
                            onClick={() => handleConfigChange(service, "url", nextUrl)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                handleConfigChange(service, "url", nextUrl);
                              }
                            }}>
                            {ep.label}
                          </Tag>
                        );
                      })}
                      {activeDocs && (
                        <Link type="secondary" href={activeDocs} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12 }}>
                          {t("endpointDocs")}
                        </Link>
                      )}
                    </Space>
                  );
                })()}
                <Input
                  placeholder={getUrlPlaceholder(service)}
                  value={config?.url}
                  onChange={(e) => handleConfigChange(service, "url", e.target.value)}
                  onBlur={(e) => {
                    // 落点是端点芯片 → blur 让位:mousedown 先于 click 触发 blur,
                    // 不让位的话半截输入先被补全(写入一个没人要的值 + 假 toast),
                    // 芯片的官方地址才覆盖进来。relatedTarget 同时覆盖鼠标(chip 有
                    // tabIndex,mousedown 即聚焦)与键盘 Tab 两条路。
                    if ((e.relatedTarget as HTMLElement | null)?.dataset?.endpointChip) return;
                    const value = e.target.value.trim();
                    // blur 补全 = wireUrlNormalizer(registry):对每个 service 用
                    // 【引擎实际会用的】补全器 —— claude 补 /v1/messages,OpenAI-compat
                    // 系补 /chat/completions,私有协议(deepl/azureopenai…)原样返回
                    // 即不补全。此前是手维护清单,claude/yandex 漏在外面:界面留着
                    // bare host、引擎默默补全,界面所见 ≠ 线上所打。
                    // 【不再自动翻中转开关】—— 那个功能曾经存在,是三轮评审里 bug
                    // 最密集的一处(死守卫、focus 追踪、芯片竞态、relayBase 盲区),
                    // 而它防的事故引擎层已兜住:自定义地址 + 内置公共中转由
                    // registry.relayWouldServe 退回直连、地址不外发;开关开着但无效时,
                    // 开关下方的 useRelayCustomUrl 静态文案已把实情写明。开关状态
                    // 只归用户拨,界面不替用户做决定。
                    if (value) {
                      const normalized = wireUrlNormalizer(service)(value);
                      if (normalized !== value) {
                        handleConfigChange(service, "url", normalized);
                        message.info(t("urlAutoCompleted"));
                      }
                    }
                  }}
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
                required={!isApiKeyOptional(service)}
                // 「密钥只存在本地」贴在【正在填的那个输入框下面】—— antd 的
                // extra 槽就是给字段级说明的,字号/灰度/间距都是现成的。
                // 它以前在【每个工具页的页头】上,19 页一字不差,而其中 12 页
                // (文本分割 / 文本对照 / 全部 JSON 工具)根本不收 API key ——
                // 对它们那是句空话,白占首屏。这句话回答的疑问只在 key 输入框
                // 在眼前时才产生,所以它就该长在这里,别再往别处复制第二份。
                extra={
                  <span style={{ display: "inline-flex", alignItems: "flex-start", gap: 6 }}>
                    <LockOutlined aria-hidden style={{ marginTop: "0.25em", flexShrink: 0 }} />
                    <span>{tCommon("apiKeyPrivacy")}</span>
                  </span>
                }>
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
            {/* 这两个开关的说明文字由 antd Form.Item 渲染，不在我们的 JSX 里，
                没法像别处那样用 <label> 整行包住（design-system A5b）。改用 antd
                自己的关联方式：Form.Item htmlFor + Switch id —— 生成的
                <label for> 指向开关按钮，点文字照样能切。id 带 service 前缀，
                因为设置面板会为每个 provider 各渲染一份，裸 id 会重复。 */
            }
            {config?.useRelay !== undefined && (
              // 永不置灰:开关与「填哪个地址」正交。填了自定义地址时换一句提示,
              // 说明这时开关对内置公共中转不起作用(该地址不在它的 allowlist 里,
              // 引擎会退回直连、也不会把地址发过去 —— 见 registry.relayWouldServe),
              // 要经中转就填自建中转地址。是提示,不是禁用:填了自建地址后开关照常生效。
              <Form.Item label={t("useRelay")} htmlFor={`${service}-useRelay`} extra={urlKind === "custom" && usesBuiltinRelay(relayBase) ? t("useRelayCustomUrl") : t("useRelayTooltip")} style={{ marginBottom: config.useRelay ? 24 : 0 }}>
                <Switch id={`${service}-useRelay`} checked={config.useRelay as boolean | undefined} onChange={(checked) => handleConfigChange(service, "useRelay", checked)} aria-label={t("useRelay")} />
              </Form.Item>
            )}
            {/* 中转地址:全局值(不进 per-provider config),只在开关打开时才露出 ——
                关着时它对本次配置毫无影响,常驻只会让人以为改了有用。文案明写
                "对所有 provider 生效",因为它长在 per-provider 表单里,不说清楚
                会被当成只管当前这个。 */}
            {config?.useRelay === true && (
              // 非法值(最常见:漏写 https://)当场标红并说明 —— 否则 relayUrl
              // 会静默回落内置中转,用户以为自建生效了,而任何报错都不指向
              // 「少了协议头」。判据与导入/运行时同一份(isValidRelayBase)。
              <Form.Item label={t("relayBase")} extra={relayBaseInvalid ? t("relayBaseInvalid") : t("relayBaseExtra")} validateStatus={relayBaseInvalid ? "error" : undefined} style={{ marginBottom: 0 }}>
                <Input
                  value={relayBase}
                  onChange={(e) => setRelayBase(e.target.value)}
                  placeholder={LLM_RELAY_BASE}
                  aria-label={t("relayBase")}
                  spellCheck={false}
                  allowClear
                />
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
                  precision={0}
                  onChange={(value) => handleConfigChange(service, "maxTokens", value ?? 0)}
                  aria-label={t("maxTokens")}
                />
              </Form.Item>
            )}
            {showThinkingControl && (
              <Form.Item label={t("reasoningEffort")} extra={canOffThisModel ? t("reasoningEffortExtra") : t("reasoningEffortNoOff")}>
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
                    // 关不掉思考的,这一档【不是关闭】,标成 Off 就是撒谎:用户关思考
                    // 正是为了省 token,而它照常推理照常计费。两种来源都算在内 ——
                    // 整家没有关闭值(gemini/grok/groq,判据从 models[].thinkingLevels
                    // 派生),以及官方标 Always on 的【单个 SKU】(claude 的 fable-5 /
                    // mythos,同门的 opus-5 / sonnet-5 关得掉,所以只能逐 SKU 判)。
                    // 前者发最低档、后者发空由服务端定,对用户是同一句话:关不掉、照常计费。
                    // 标签直接改,不走 i18n —— 这几个档位名本来就是硬编码英文。
                    { value: "off" as const, label: canOffThisModel ? "Off" : "Min" },
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
              <Form.Item label={t("sendSystemPrompt")} htmlFor={`${service}-sendSystemPrompt`} extra={t("sendSystemPromptExtra")} style={{ marginBottom: 0 }}>
                <Switch id={`${service}-sendSystemPrompt`} checked={config?.sendSystemPrompt !== false} onChange={(checked) => handleConfigChange(service, "sendSystemPrompt", checked)} aria-label={t("sendSystemPrompt")} />
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
                  precision={0}
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
                  precision={0}
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
                  precision={0}
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
                  precision={0}
                  onChange={(value) => handleConfigChange(service, "contextBatchSize", value ?? 1)}
                  aria-label={t("contextBatchSize")}
                />
              </Form.Item>
            )}
            {config?.delayTime !== undefined && (
              // 同组其余字段都有 Extra 说明，只有它没有 —— 它是「被限流就调大」的降速
              // 旋钮，这个用途此前只写在上面的代码注释里，用户看不到。
              <Form.Item label={`${t("delayTime")} (ms)`} extra={t("delayTimeExtra")} style={{ marginBottom: 0 }}>
                <InputNumber
                  min={1}
                  className="!w-full"
                  value={config.delayTime as number | undefined}
                  precision={0}
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
