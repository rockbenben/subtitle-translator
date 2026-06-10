"use client";

import { useState, useRef, useEffect } from "react";
import { Select, Input, Button, Tag, Space, Flex, Typography, Tooltip, App, theme } from "antd";
import { ApiOutlined, BookOutlined, ThunderboltOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { categorizedOptions, deriveThinkingParams, findMethodLabel, getConfigStatus, supportsGlossary, testTranslation, URL_IS_PRIMARY_CRED, DEFAULT_SYSTEM_PROMPT, DEFAULT_USER_PROMPT, type TranslateTextParams } from "@/app/lib/translation";
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
  const tGlossary = useTranslations("TranslationGlossary");
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const isMobile = useIsMobile();
  const { translationMethod, setTranslationMethod, getSelectedConfig, handleConfigChange, systemPrompt, userPrompt, setApiSettingsOpen, glossaryEnabled, activeGlossaryPreset } = useTranslationContext();

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
  // Covers every reachability-relevant field (same definition as pingSignature
  // in validation.ts): region/apiVersion (Azure) and folderId (Yandex) change
  // which tenant/deployment a test actually hit; useRelay changes the entire
  // wire path — flipping it is the documented fix for browser-direct CORS
  // failures, so a stale red "failed" badge must not survive the toggle.
  const identity = `${translationMethod}|${config?.apiKey ?? ""}|${config?.url ?? ""}|${config?.model ?? ""}|${config?.region ?? ""}|${config?.apiVersion ?? ""}|${config?.folderId ?? ""}|${config?.useRelay ?? false}`;
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
    // 30s 超时:黑洞端点(防火墙吞包、挂死的本地服务)否则让状态块永远卡
    // 在 "testing"。
    const controller = new AbortController();
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      controller.abort();
    }, 30_000);
    const error = await testTranslation(translationMethod, testParams, effectiveSystem, effectiveUser, controller.signal).finally(() => clearTimeout(timeout));
    if (id !== testIdRef.current) return;
    if (!error) {
      setSessionStatus("connected");
      message.success(t("apiStatusConnected"));
    } else {
      // testTranslation returns the real failure reason — surface it so the user sees
      // WHY (401/403/CORS/timeout/…) instead of a generic "connection failed".
      // 超时触发的 abort:报"超时"分类,而不是裸的 DOMException abort 文案。
      setSessionStatus("failed");
      message.error(`${t("apiStatusFailed")}: ${timedOut ? t("apiStatusTimeout") : error}`, 10);
    }
  };

  const handleMethodChange = (v: string) => {
    setTranslationMethod(v);
    // render-time identity check above resets sessionStatus on the ensuing render.
  };

  const handleApiKeyChange = (v: string) => {
    handleConfigChange(translationMethod, "apiKey", v);
    // render-time identity check above resets sessionStatus on the ensuing render.
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

      <Flex justify="space-between" align="center" wrap gap={4} style={{ marginTop: token.marginXS }}>
        <Space size="small" wrap>
          <Button
            size="small"
            icon={<ThunderboltOutlined />}
            onClick={handleTest}
            loading={sessionStatus === "testing"}
            disabled={disabled || status === "needs-config" || status === "testing"}>
            {t("testConnection")}
          </Button>
          {/* 术语表主页面入口 —— 此前唯一入口埋在设置抽屉深处,终端用户反馈
              "非常隐蔽"。启用时显示词条数(绿),未启用显示灰色入口;点击都
              进设置抽屉(术语表卡片就在 provider 表单下方)。仅在当前服务
              有模型内术语通道时展示(supportsGlossary denylist 之外)。 */}
          {supportsGlossary(translationMethod) && (
          <Tag
            color={glossaryEnabled && activeGlossaryPreset ? "success" : "default"}
            role="button"
            tabIndex={0}
            aria-label={tGlossary("title")}
            style={{ cursor: "pointer", margin: 0 }}
            onClick={() => setApiSettingsOpen(true)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setApiSettingsOpen(true);
              }
            }}>
            <BookOutlined style={{ marginInlineEnd: 4 }} />
            {glossaryEnabled && activeGlossaryPreset
              ? `${tGlossary("title")} · ${(activeGlossaryPreset.terms ?? []).filter((term) => term.source.trim() && term.target.trim()).length}`
              : tGlossary("title")}
          </Tag>
          )}
        </Space>
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
