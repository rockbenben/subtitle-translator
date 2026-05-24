"use client";

import { useState, useRef, useEffect } from "react";
import { Select, Input, Button, Tag, Space, Flex, Typography, Tooltip, App, theme } from "antd";
import { ApiOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { categorizedOptions, deriveThinkingParams, findMethodLabel, getConfigStatus, testTranslation, URL_IS_PRIMARY_CRED, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT, type TranslateTextParams } from "@/app/lib/translation";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { useIsMobile } from "@/app/hooks/useIsMobile";

// Visual states the tag/section can show. The first three come from
// getConfigStatus (registry single-source-of-truth); the last three are
// session-only outcomes from "Test connection".
type StatusState = "free" | "needs-config" | "configured" | "testing" | "connected" | "failed";

interface ApiStatusBlockProps {
  disabled?: boolean;
}

const ApiStatusBlock = ({ disabled = false }: ApiStatusBlockProps) => {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const isMobile = useIsMobile();
  const { translationMethod, setTranslationMethod, getSelectedConfig, handleConfigChange, systemPrompt, userPrompt, setApiSettingsOpen } = useTranslationContext();

  const config = getSelectedConfig();
  const methodLabel = findMethodLabel(translationMethod);

  const [sessionStatus, setSessionStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");
  const [testId, setTestId] = useState(0);

  // Mirror testId into a ref so the async handleTest below can read the
  // latest value after `await` (closure captures snapshot, ref reads live).
  const testIdRef = useRef(testId);
  useEffect(() => {
    testIdRef.current = testId;
  }, [testId]);

  // Invalidate any stale session test result whenever the tested identity
  // changes — handles edits made from this block AND from the API Settings
  // tab (model/url/apiKey both map to translationConfigs[method]).
  // Render-time pattern (React docs § "Adjusting state when a prop changes"):
  // detect against the previous render's snapshot and reset synchronously.
  // React discards the in-progress render and immediately re-renders with
  // the cleared state — no useEffect cascading render needed.
  const identity = `${translationMethod}|${config?.apiKey ?? ""}|${config?.url ?? ""}|${config?.model ?? ""}`;
  const [prevIdentity, setPrevIdentity] = useState(identity);
  if (prevIdentity !== identity) {
    setPrevIdentity(identity);
    setSessionStatus("idle");
    setTestId((t) => t + 1);
  }

  const baseStatus = getConfigStatus(translationMethod, config);

  const status: StatusState = sessionStatus === "testing"
    ? "testing"
    : sessionStatus === "connected"
      ? "connected"
      : sessionStatus === "failed"
        ? "failed"
        : baseStatus;

  const handleTest = async () => {
    const id = testId + 1;
    setTestId(id);
    setSessionStatus("testing");
    const effectiveSystem = systemPrompt?.trim() ? systemPrompt : DEFAULT_SYSTEM_PROMPT;
    const effectiveUser = userPrompt?.trim() ? userPrompt : DEFAULT_USER_PROMPT;
    // Mirror orchestrator's gate so this status-block Test exercises the same
    // wire payload as actual translation (effort level — undefined = off).
    const testParams: Partial<TranslateTextParams> = {
      ...(config as Partial<TranslateTextParams>),
      reasoningEffort: deriveThinkingParams(translationMethod, config),
    };
    const ok = await testTranslation(translationMethod, testParams, effectiveSystem, effectiveUser);
    if (id !== testIdRef.current) return;
    if (ok) {
      setSessionStatus("connected");
      message.success(t("apiStatusConnected"));
    } else {
      setSessionStatus("failed");
      message.error(t("apiStatusFailed"));
    }
  };

  const handleMethodChange = (v: string) => {
    setTranslationMethod(v);
    // useEffect above will reset sessionStatus on the ensuing render; nothing to do here.
  };

  const handleApiKeyChange = (v: string) => {
    handleConfigChange(translationMethod, "apiKey", v);
    // useEffect above will reset sessionStatus on the ensuing render.
  };

  const tagColor: Record<StatusState, string> = {
    free: "default",
    "needs-config": "warning",
    configured: "default",
    testing: "processing",
    connected: "success",
    failed: "error",
  };

  const tagText: Record<StatusState, string> = {
    free: t("apiStatusFreeApi"),
    "needs-config": t("apiStatusNeedsConfig"),
    configured: t("apiStatusConfigured"),
    testing: t("apiStatusTesting"),
    connected: t("apiStatusConnected"),
    failed: t("apiStatusFailed"),
  };

  // Only color the section when there's an actual signal to convey:
  // green = connected (proved working this session), warning = needs-config,
  // error = failed. "free" and "configured" both stay neutral — the user
  // hasn't verified connectivity yet, and Free APIs routinely get blocked
  // regionally or rate-limited, so a default green would be misleading.
  const sectionBg =
    status === "connected" ? token.colorSuccessBg :
    status === "needs-config" ? token.colorWarningBg :
    status === "failed" ? token.colorErrorBg :
    "transparent";

  const sectionBorder =
    status === "connected" ? token.colorSuccessBorder :
    status === "needs-config" ? token.colorWarningBorder :
    status === "failed" ? token.colorErrorBorder :
    token.colorBorderSecondary;

  // Hide apiKey input for URL-primary services (llm — apiKey optional/hidden by intent;
  // translategemma — apiKey not in defaults at all so already hidden, but keep the
  // condition consistent so future URL-primary services don't accidentally show it).
  const showApiKey = config?.apiKey !== undefined && !URL_IS_PRIMARY_CRED.has(translationMethod);

  return (
    <section
      style={{
        background: sectionBg,
        border: `1px solid ${sectionBorder}`,
        borderRadius: token.borderRadiusLG,
        padding: token.paddingSM,
        marginBottom: token.marginSM,
      }}>
      <Flex justify="space-between" align="center" style={{ marginBottom: token.marginXS }}>
        <Space size="small">
          <ApiOutlined />
          <Typography.Text strong>{t("translationAPI")}</Typography.Text>
          <Tag color={tagColor[status]}>{tagText[status]}</Tag>
        </Space>
      </Flex>

      {/* Mobile: stack Select on top, apiKey input below — 145px-each compact
          row truncates "Custom (OpenAI-compatible)" / "Tencent Hunyuan (混元)"
          beyond recognition. Desktop keeps the dense single-row layout. */}
      {isMobile ? (
        <Flex vertical gap={token.marginXS}>
          <Select
            showSearch
            value={translationMethod}
            onChange={handleMethodChange}
            options={categorizedOptions}
            style={{ width: "100%" }}
            disabled={disabled}
            aria-label={t("translationAPI")}
          />
          {showApiKey && (
            <Input.Password
              autoComplete="off"
              placeholder={`${methodLabel} API Key`}
              value={config.apiKey as string | undefined}
              onChange={(e) => handleApiKeyChange(e.target.value)}
              style={{ width: "100%" }}
              disabled={disabled}
              aria-label={`${methodLabel} API Key`}
            />
          )}
        </Flex>
      ) : (
        <Space.Compact className="w-full">
          <Select
            showSearch
            value={translationMethod}
            onChange={handleMethodChange}
            options={categorizedOptions}
            style={{ flex: 1, minWidth: 0 }}
            disabled={disabled}
            aria-label={t("translationAPI")}
          />
          {showApiKey && (
            <Tooltip title={`${t("enter")} ${methodLabel} API Key`}>
              <Input.Password
                autoComplete="off"
                placeholder="API Key"
                value={config.apiKey as string | undefined}
                onChange={(e) => handleApiKeyChange(e.target.value)}
                style={{ flex: 1, minWidth: 0 }}
                disabled={disabled}
                aria-label={`${methodLabel} API Key`}
              />
            </Tooltip>
          )}
        </Space.Compact>
      )}

      <Flex justify="space-between" align="center" style={{ marginTop: token.marginXS }}>
        <Button
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={handleTest}
          loading={sessionStatus === "testing"}
          disabled={disabled || status === "needs-config" || status === "testing"}>
          {t("testConnection")}
        </Button>
        <Button
          type="link"
          size="small"
          onClick={() => setApiSettingsOpen(true)}
          style={{ padding: 0, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }}>
          {t("moreProviderSettings")} →
        </Button>
      </Flex>
    </section>
  );
};

export default ApiStatusBlock;
