"use client";

import { useState, useRef, useEffect } from "react";
import { Select, Input, Button, Tag, Space, Flex, Typography, Tooltip, App, theme } from "antd";
import { ApiOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { categorizedOptions, findMethodLabel, testTranslation, URL_IS_PRIMARY_CRED, DEFAULT_SYS_PROMPT, DEFAULT_USER_PROMPT, type TranslationConfig } from "@/app/lib/translation";
import { useTranslationContext } from "@/app/components/TranslationContext";

// Folds the spec's `needs-url` (method === "llm" with empty url) into `needs-config`
// since both share the same Tag copy and section background. See spec § 4.4.
type StatusState = "free" | "needs-config" | "configured" | "testing" | "connected" | "failed";

interface ApiStatusBlockProps {
  onOpenApiSettings?: () => void;
  disabled?: boolean;
}

const deriveBaseStatus = (method: string, config: TranslationConfig | undefined): StatusState => {
  if (!config) return "free";
  // URL_IS_PRIMARY_CRED services (llm, translategemma) are URL-driven: empty URL
  // → needs-config, populated → configured. Skip the apiKey-based logic so
  // translategemma (no apiKey field at all) doesn't fall through to "free".
  if (URL_IS_PRIMARY_CRED.has(method)) {
    if (!config.url || config.url === "") return "needs-config";
    return "configured";
  }
  if (config.apiKey === undefined) return "free";
  if (config.apiKey === "") return "needs-config";
  return "configured";
};

const ApiStatusBlock = ({ onOpenApiSettings, disabled = false }: ApiStatusBlockProps) => {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const { translationMethod, setTranslationMethod, getCurrentConfig, handleConfigChange, sysPrompt, userPrompt } = useTranslationContext();

  const config = getCurrentConfig();
  const methodLabel = findMethodLabel(translationMethod);

  const [sessionStatus, setSessionStatus] = useState<"idle" | "testing" | "connected" | "failed">("idle");

  // Invalidate any stale session test result whenever the tested identity
  // changes — handles edits made from this block AND from the API Settings
  // tab (model/url/apiKey both map to translationConfigs[method]).
  // Ref-based testId prevents a stale testTranslation resolution from
  // writing its result onto the new context after the user changed it.
  const testIdRef = useRef(0);
  useEffect(() => {
    testIdRef.current++;
    setSessionStatus("idle");
  }, [translationMethod, config?.apiKey, config?.url, config?.model]);

  const baseStatus = deriveBaseStatus(translationMethod, config);

  const status: StatusState = sessionStatus === "testing"
    ? "testing"
    : sessionStatus === "connected"
      ? "connected"
      : sessionStatus === "failed"
        ? "failed"
        : baseStatus;

  const handleTest = async () => {
    const id = ++testIdRef.current;
    setSessionStatus("testing");
    const effectiveSys = sysPrompt?.trim() ? sysPrompt : DEFAULT_SYS_PROMPT;
    const effectiveUser = userPrompt?.trim() ? userPrompt : DEFAULT_USER_PROMPT;
    const ok = await testTranslation(translationMethod, config, effectiveSys, effectiveUser);
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

      <Flex justify="space-between" align="center" style={{ marginTop: token.marginXS }}>
        <Button
          size="small"
          icon={<ThunderboltOutlined />}
          onClick={handleTest}
          loading={sessionStatus === "testing"}
          disabled={disabled || status === "needs-config" || status === "testing"}>
          {t("testConnection")}
        </Button>
        {onOpenApiSettings && (
          <Button
            type="link"
            size="small"
            onClick={onOpenApiSettings}
            style={{ padding: 0, fontWeight: 500, textDecoration: "underline", textUnderlineOffset: "3px" }}>
            {t("moreProviderSettings")} →
          </Button>
        )}
      </Flex>
    </section>
  );
};

export default ApiStatusBlock;
