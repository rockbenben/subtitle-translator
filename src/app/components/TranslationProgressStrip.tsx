"use client";

import type { CSSProperties } from "react";
import { Button, ConfigProvider, Progress, Typography, theme } from "antd";
import { CloseOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";

const { Text } = Typography;

interface TranslationProgressStripProps {
  /** Whether a translation run is currently in flight */
  isTranslating: boolean;
  /** Progress percentage (0-100) */
  percent: number;
  /** Cancel the in-flight run (requestCancel from the hook) */
  onCancel?: () => void;
  /** Dismiss the held DONE / STOPPED state (resets progress so the strip closes) */
  onDismiss?: () => void;
  /**
   * Whether an interrupted run can be resumed from the line cache. Pass the
   * tool's `useCache` — with the cache off there is no checkpoint, and
   * promising "会从断点继续" would be a lie.
   */
  resumable?: boolean;
  /** Whether multi-language mode is enabled */
  multiLanguageMode?: boolean;
  /** Number of target languages */
  targetLanguageCount?: number;
  /** Lines / items completed so far — rendered as a "current / total" hint */
  currentCount?: number;
  /** Total lines / items — omit (or 0) to hide the hint */
  totalCount?: number;
  /**
   * 本轮有没有失败 —— 行级(hook 的 `failedCount`)【或】整语种级(`failedLangs`)。
   * 进度只知道「每一行都试过了」,不知道有几行是回填原文、哪个语种整个挂了 ——
   * 不传的话一轮有失败的运行会打绿色的「翻译完成」,正压在失败面板上方自相矛盾。
   * 【是布尔不是计数】:数字由失败面板报,同屏两处报同一个数没有意义。
   */
  failed?: boolean;
  /**
   * 本轮是否真的有【行级】失败。用来决定 INCOMPLETE 的标题措辞:
   * `failed` 对文件级失败(批量里某个文件格式不支持 / 解码失败)也为真,而那种
   * 情况下一行都没失败、也没有任何原文被"保留"—— 再打「失败的行已保留原文」
   * 就是在陈述一件没发生的事,而失败面板此时又是空的(没有解释、没有重试入口)。
   */
  lineFailures?: boolean;
}

/**
 * 内联翻译进度条 —— 前身是全屏的 TranslationProgressModal,砍掉遮罩改为内联,
 * 是「翻译中界面不再锁死 + 可取消」反馈的落点:进度就长在翻译按钮下方,旁边是
 * 取消按钮,页面其余部分保持可交互。
 *
 * 三态【纯派生】自 (isTranslating, percent) —— 没有内部 state / effect / timer,
 * 完成不会被错过,也不会跟自己竞态:
 *   running = isTranslating
 *   done    = !isTranslating && percent >= 100
 *   stopped = !isTranslating && 0 < percent < 100   (取消,或整轮失败)
 *   showing = isTranslating || percent > 0
 *
 * stopped 是这条 strip 的要点:**取消后它不消失,而是变成一张续跑凭据** ——
 * 停在第几行、还能不能续,都留在原地。逐行缓存本来就是断点,但那件事此前只在
 * 一闪而过的 toast 里说过一次,界面上不留痕,用户没有理由相信「再点一次不会
 * 从头再来」。done / stopped 都保持到用户点 ✕(onDismiss 复位进度即关闭)。
 */
const TranslationProgressStrip = ({ isTranslating, percent, onCancel, onDismiss, resumable = true, multiLanguageMode = false, targetLanguageCount = 0, currentCount, totalCount, failed = false, lineFailures = false }: TranslationProgressStripProps) => {
  const t = useTranslations("common");
  const { token } = theme.useToken();

  const done = !isTranslating && percent >= 100;
  const stopped = !isTranslating && percent > 0 && percent < 100;
  // 跑完但有软失败:进度上是 100%(每行都试过了),结果上不是成功 —— 绿色
  // 的「翻译完成」会盖过下方失败面板。降级成琥珀 + 明说几行没成。
  const doneWithFailures = done && failed;
  if (!isTranslating && percent <= 0) return null;

  // Show at least 1% once translation has kicked off, so the bar moves even
  // while the first batch is still in-flight and no lines have returned yet.
  const displayPercent = percent >= 100 ? 100 : percent > 0 ? Math.min(Math.max(1, Math.floor(percent)), 99) : 0;
  const hasCountInfo = typeof currentCount === "number" && typeof totalCount === "number" && totalCount > 0;
  const accent = doneWithFailures || stopped ? token.colorWarning : done ? token.colorSuccess : token.colorPrimary;
  const marker = doneWithFailures ? "INCOMPLETE" : done ? "DONE" : stopped ? "STOPPED" : "IN PROGRESS";
  const headline = doneWithFailures ? (lineFailures ? t("translateDonePartial") : t("translateDoneIncomplete")) : done ? t("translateDone") : stopped ? t("translationStopped") : t("translating");
  // 副文案分两种承诺,都只在缓存开着时说 —— 缓存关掉就没有断点,别撒谎。
  // 运行中:先给出取消的底气;停下后:告诉他怎么续。
  const subline = !resumable ? null : stopped ? t("resumeFromCache") : !done ? t("cancelKeepsProgress") : null;

  const monoCaps: CSSProperties = { fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase" };

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        border: `1px solid ${stopped || doneWithFailures ? token.colorWarningBorder : token.colorBorderSecondary}`,
        borderRadius: token.borderRadiusLG,
        background: token.colorBgContainer,
        padding: "12px 14px",
        marginTop: 12,
      }}>
      {/* 结束且有失败:这条 strip 收成【一行状态标记】。
          进度在这一刻已经没有职责了 —— 结果与行动都归下方的失败面板(它就在
          十几像素外,已经说了「翻译失败 N 行」和怎么办)。而进度条本身是喊
          「全完成了」最大声的元素:去掉百分比数字后,满格的琥珀色长条照样在
          说同一句谎。计数也不在这里重复,免得同屏两处报同一个数;右上角那个
          ✕ 就只有「关闭」一个含义。 */}
      {!doneWithFailures && (
        <>
          {/* Status marker + count */}
          <div className="font-mono flex items-center justify-between" style={{ ...monoCaps, color: token.colorTextTertiary, marginBottom: 10 }} aria-live="off">
            <span className="flex items-center" style={{ gap: 7 }}>
              {/* Static status marker — the bar's `active` shimmer carries the motion. */}
              <span aria-hidden style={{ width: 7, height: 7, background: accent, display: "inline-block" }} />
              {marker}
              <span className="font-display" style={{ fontSize: 15, fontWeight: 700, letterSpacing: 0, textTransform: "none", color: done ? token.colorSuccess : token.colorText, fontVariantNumeric: "tabular-nums" }}>
                {displayPercent}%
              </span>
            </span>
            {hasCountInfo && (
              <span>
                <span style={{ color: token.colorText }}>{currentCount}</span>
                <span style={{ opacity: 0.5 }}> / {totalCount}</span>
              </span>
            )}
          </div>

          <Progress percent={displayPercent} status={done ? "success" : stopped ? "normal" : "active"} strokeColor={stopped ? token.colorWarning : undefined} showInfo={false} strokeLinecap="butt" size={{ height: 6 }} style={{ marginBottom: 0, lineHeight: 1 }} />
        </>
      )}

      {/* Localized status line + cancel / dismiss */}
      <div className="flex items-start justify-between" style={{ marginTop: doneWithFailures ? 0 : 10, gap: 12 }}>
        <span className="flex flex-col" style={{ gap: 2, minWidth: 0 }}>
          <span className="flex items-baseline flex-wrap" style={{ gap: 8 }}>
            {doneWithFailures && (
              <span className="font-mono flex items-center" style={{ ...monoCaps, color: token.colorWarning, gap: 7, alignSelf: "center" }}>
                <span aria-hidden style={{ width: 7, height: 7, background: accent, display: "inline-block" }} />
                {marker}
              </span>
            )}
            <Text strong style={{ fontSize: 13 }}>
              {headline}
            </Text>
            {isTranslating && multiLanguageMode && targetLanguageCount > 0 && (
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("multiTranslating")} <Text strong>{targetLanguageCount}</Text>
              </Text>
            )}
          </span>
          {subline && (
            <Text type="secondary" style={{ fontSize: 12 }}>
              {subline}
            </Text>
          )}
        </span>
        {/* 取消【不是】危险动作 —— 已译内容全在缓存里,再点一次就续上。用 danger
            红会让它读成「放弃/销毁」,与这条 strip 想传达的意思正好相反。
            autoInsertSpace:false 挡掉 antd 给两字中文按钮插的那个空格(「取 消」)。*/}
        {isTranslating
          ? onCancel && (
              <ConfigProvider button={{ autoInsertSpace: false }}>
                <Button size="small" onClick={onCancel} style={{ flexShrink: 0 }}>
                  {t("cancel")}
                </Button>
              </ConfigProvider>
            )
          : onDismiss && <Button size="small" type="text" icon={<CloseOutlined />} onClick={onDismiss} aria-label={t("dismiss")} style={{ flexShrink: 0 }} />}
      </div>
    </div>
  );
};

export default TranslationProgressStrip;
