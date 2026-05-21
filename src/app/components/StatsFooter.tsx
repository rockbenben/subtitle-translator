"use client";

import { Flex, Tooltip, theme } from "antd";
import { LockOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

/**
 * Editor-status-bar 风格的统计行,被 SourceArea 和 ResultCard 共用。
 *
 * 设计点:
 * - 整行用 mono 字体 + `font-variant-numeric: tabular-nums`,数字增长时宽度不跳动
 * - 用 · (middle dot) 而不是 / 作分隔符 —— 排版上更克制
 * - 字色分三层:数字 colorText (主)、标签 colorTextSecondary (次)、分隔符 colorTextTertiary (faint)
 *   营造层次感而非依赖加粗
 * - 只读指示用 LockOutlined (语义准确),warning 色
 */
const MONO_STACK = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

interface StatsFooterProps {
  charCount: string;
  lineCount: string;
  /** 只读状态(超过字符上限时由 useTextStats 标记)。true 时显示锁图标 + 提示 */
  isReadOnly?: boolean;
}

const StatsFooter = ({ charCount, lineCount, isReadOnly }: StatsFooterProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  return (
    <Flex justify="space-between" align="center" className="mt-2">
      <div>
        {isReadOnly && (
          <Tooltip title={t("readOnlyModeTooltip")}>
            <Flex
              align="center"
              gap={6}
              style={{
                fontSize: token.fontSizeSM,
                color: token.colorWarning,
                fontFamily: MONO_STACK,
                letterSpacing: "0.02em",
              }}>
              <LockOutlined style={{ fontSize: token.fontSizeSM }} />
              <span>{t("readOnlyMode")}</span>
            </Flex>
          </Tooltip>
        )}
      </div>
      <Flex
        align="baseline"
        gap={6}
        style={{
          fontSize: token.fontSizeSM,
          fontFamily: MONO_STACK,
          fontVariantNumeric: "tabular-nums",
        }}>
        <span style={{ color: token.colorText, fontWeight: 500 }}>{charCount}</span>
        <span style={{ color: token.colorTextSecondary }}>{t("charLabel")}</span>
        <span style={{ color: token.colorTextTertiary, padding: "0 2px" }}>·</span>
        <span style={{ color: token.colorText, fontWeight: 500 }}>{lineCount}</span>
        <span style={{ color: token.colorTextSecondary }}>{t("lineLabel")}</span>
      </Flex>
    </Flex>
  );
};

export default StatsFooter;
