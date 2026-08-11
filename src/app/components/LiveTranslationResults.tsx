"use client";

import { useEffect, useRef } from "react";
import { Empty, Spin, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import type { LiveLine } from "@/app/hooks/useTranslationProgress";

const { Text } = Typography;

interface LiveTranslationResultsProps {
  /** Live lines accumulated so far (index, original ↔ translation). */
  lines: LiveLine[];
  /** True while a translation run is in flight — drives the spinner. */
  isTranslating: boolean;
  /** Optional max lines rendered (default 200) — keeps the panel bounded. */
  maxLines?: number;
}

/**
 * 实时翻译结果流 —— 与进度条并行的第二通道:每一行译完立即出现在这里,
 * 不等整批结束。只读面板(original ↔ translation 并排),菜单位置在
 * 进度条正下方;详情由内联透出的转述文案。失败行标琥珀「未译出」,
 * 细节归下方的失败面板。
 */
const LiveTranslationResults = ({ lines, isTranslating, maxLines = 200 }: LiveTranslationResultsProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  // 新行到达时把滚动容器钉在最新一行 —— 用户在盯实时流,别让他追着跳。
  useEffect(() => {
    if (lines.length === 0) return;
    endRef.current?.scrollIntoView({ block: "end" });
  }, [lines]);

  const shown = lines.slice(-maxLines);
  const liveCount = isTranslating && lines.length === 0;

  return (
    <div
      ref={containerRef}
      role="region"
      aria-label={t("liveResults")}
      style={{
        border: `1px solid ${token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        marginTop: 12,
        maxHeight: 320,
        overflowY: "auto",
      }}>
      <div className="flex items-center justify-between" style={{ padding: "10px 14px 6px", gap: 8 }}>
        <Text strong style={{ fontSize: 13 }}>
          {t("liveResults")}
        </Text>
        {isTranslating && lines.length > 0 && (
          <Text type="secondary" style={{ fontSize: 12 }}>
            {lines.length} {t("liveLinesCount")}
          </Text>
        )}
      </div>

      {liveCount ? (
        <div style={{ padding: "16px 14px 20px", color: token.colorTextTertiary }}>
          <Spin size="small" style={{ marginRight: 8 }} />
          <span style={{ fontSize: 13 }}>{t("liveWaiting")}</span>
        </div>
      ) : lines.length === 0 ? (
        <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t("liveEmpty")} style={{ padding: "18px 0" }} />
      ) : (
        <div className="flex flex-col" style={{ padding: "0 14px 14px", gap: 10 }}>
          {shown.map((line) => (
            <div key={line.index} className="flex flex-col" style={{ gap: 2 }}>
              <div className="flex items-center" style={{ gap: 8 }}>
                <span
                  className="font-mono"
                  style={{
                    fontSize: 11,
                    color: line.failed ? token.colorWarning : token.colorTextTertiary,
                    flexShrink: 0,
                  }}>
                  #{line.index + 1}
                </span>
                {line.failed && (
                  <Text type="warning" style={{ fontSize: 11 }}>
                    {t("liveNotTranslated")}
                  </Text>
                )}
              </div>
              <Text type="secondary" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
                {line.original}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  whiteSpace: "pre-wrap",
                  color: line.failed ? token.colorTextQuaternary : token.colorText,
                }}>
                {line.failed ? line.original : line.translation}
              </Text>
            </div>
          ))}
          <div ref={endRef} />
        </div>
      )}
    </div>
  );
};

export default LiveTranslationResults;