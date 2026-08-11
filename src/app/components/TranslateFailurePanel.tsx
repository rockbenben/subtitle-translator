"use client";

import { useEffect, useState } from "react";
import { Alert, Button, Modal, List, Space, App, Tag, Typography, theme } from "antd";

const { Text } = Typography;
import { ReloadOutlined, UnorderedListOutlined, CopyOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
// 直接从引擎导入 —— FailedLine 是 pipeline 的产物类型,不是 hook 的。
// 经 hook 转发会让同一个符号有两条活的导入路径(层边界不变量,见
// lib/__tests__/translationLayerBoundary.test.ts)。
import type { FailedLine } from "@/app/lib/translation";

/**
 * Surfaces partial-failure state from useTranslationState: after the main
 * pass + 10s auto-retry, any lines still failing are reported here.
 *
 * - `count` / `lines`: line-level failures within a single translation run. A
 *    run can span several target langs (multi-language mode) and several files
 *    (batch mode) — failures accumulate across all of them until the next
 *    run/clear. Each `FailedLine` carries the original text plus, when the
 *    source path can supply them, the real 1-based line position, target lang
 *    and source file — so the modal points at the actual location instead of a
 *    meaningless 1..N re-numbering. `lines` lets the user copy the originals
 *    and handle manually.
 * - `failedLangs`: lang-level failures in multi-language batch mode
 *    (entire target lang errored out across all batches — auth bounce, model
 *    refusal). Codes like "ga fo pa" — user copies and re-runs targeting only
 *    those. Independent from line failures; both can be present simultaneously.
 * - `onRetry`: re-runs the translation; cache covers successful lines/langs,
 *   only failed ones actually re-request the API.
 */
export default function TranslateFailurePanel({
  count,
  lines,
  failedLangs = [],
  reason,
  onRetry,
  disabled = false,
}: {
  count: number;
  lines: FailedLine[];
  failedLangs?: string[];
  /** Representative raw API error (e.g. "[422] reasoning_effort is not supported
   *  with this model"). Shown verbatim under the partial-failure notice so the user
   *  sees WHY — e.g. opting into thinking on a custom model the provider rejects. */
  reason?: string;
  onRetry: () => void;
  disabled?: boolean;
}) {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const { copyToClipboard } = useCopyToClipboard();
  const [modalOpen, setModalOpen] = useState(false);
  const { token } = theme.useToken();

  // 【这两块面板不可关闭】,是有意的,别再加 ✕。
  //
  // 历史:曾有一套 closable={{ onClose }} + 本地 dismissed 状态。它从来没生效过
  // —— antd 6 的 isClosable 对对象形式【只认 closable.closeIcon】(Alert.js:137),
  // 没有它就一路落到 !!contextClosable(undefined)= false,✕ 不渲染、onClose 永不
  // 触发,整套是看不出来的死代码。补上 closeIcon 让它"能用"之后才暴露出:关掉面板
  // 会把【唯一的重试入口】一起带走(组件整个 return null),而进度条那边仍在打琥珀
  // 的 INCOMPLETE「失败的行已保留原文」—— 用户被告知产物不完整,却没有任何可点的
  // 补救动作,只能重跑整轮(多语言/批量下会把已成功的语言全部重走一遍)。
  //
  // 所以关闭这件事本身就不该有:面板承载的是重试与查看失败行,它该留到用户处理完
  // 或下一轮 runTranslation 开头的 clearFailures() 为止。要收走视觉噪音,关进度条
  // 那个 ✕ 就够了(它只关自己,不动失败状态)。
  const hasLineFailures = count > 0;
  const hasLangFailures = failedLangs.length > 0;
  const hasFailures = hasLineFailures || hasLangFailures;

  // Visibility: the inline Alert below can sit under a long result, off-screen. Fire a
  // one-shot toast the moment failures appear so it's noticed regardless of scroll —
  // antd auto-dismisses it, no lifecycle bookkeeping. The inline Alert stays put
  // as the place to read the API reason and retry / copy the failed lines.
  useEffect(() => {
    if (hasFailures) message.warning(hasLineFailures ? t("partialFailureTitle", { count }) : t("failedLanguagesTitle", { count: failedLangs.length }));
    // Fire only on the transition INTO a failed state, not on later count tweaks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasFailures]);

  if (!hasFailures) return null;

  // Concurrent soft-fail collection pushes lines out of order, and multi-file
  // batches accumulate several files' failures under one clearFailures — sort by
  // (file, lang, position) so rows group per file and each group reads
  // top-to-bottom like its source (positions are only unique within one file).
  //
  // 位置序号 posOf:物理行号优先,没有就用【单元序数】(FailedLine.index,0 基 → +1)。
  // independent 的失败(JSON 值)没有物理行号 —— 引擎有意不编造(见 pipeline 的
  // failureLine),但 index 一直带着。不消费它的话这类失败全部退化成
  // line=undefined:排序里两两相等 → 保持并发完成顺序(每次运行都不同),显示又
  // 变成 1,2,3 的行序号 —— 900 个键里哪三个失败了完全看不出,重复文案
  // ("OK"/"Cancel")更无从分辨。
  //
  // ⚠ 已知取舍:这一列对 independent 的行显示的是【第几个单元】而非行号,而列
  // 本身没有区分二者的标记。选它是因为"能定位"胜过"不撒谎但没用"——CLI 在同样
  // 的数据上把标签切成「items #」(cli.ts 的 report),网页这一列还没有对应的切换。
  // 真要做,应该在这里加一个 unit/line 的标记,而不是退回 undefined。
  const posOf = (l: FailedLine): number | undefined => l.line ?? (l.index !== undefined ? l.index + 1 : undefined);
  const sortedLines = [...lines].sort((a, b) => {
    const fileCmp = (a.file ?? "").localeCompare(b.file ?? "");
    if (fileCmp !== 0) return fileCmp;
    const langCmp = (a.lang ?? "").localeCompare(b.lang ?? "");
    if (langCmp !== 0) return langCmp;
    return (posOf(a) ?? 0) - (posOf(b) ?? 0);
  });
  // Tag each row with its source file / target lang only when the failures span
  // more than one — a single-file or single-language run needs no per-row noise.
  const distinctLangs = new Set(sortedLines.map((l) => l.lang).filter(Boolean));
  const showLang = distinctLangs.size > 1;
  const distinctFiles = new Set(sortedLines.map((l) => l.file).filter(Boolean));
  const showFile = distinctFiles.size > 1;
  // Pad the index column to the widest number shown (real line no. or sequential).
  // reduce, not Math.max(...spread): a fully-failed large file (huge JSON) could
  // spread tens of thousands of args and hit RangeError("too many arguments").
  const maxNum = sortedLines.reduce((m, l) => Math.max(m, posOf(l) ?? 0), sortedLines.length);
  const numWidth = String(maxNum).length;

  // copyToClipboard 自带「已复制」提示，不再叠加 message.success（原来会把按钮文案
  // 当成功提示再弹一次，一次点击出现两个 toast）。
  // 内嵌换行压平成空格:ASS 多行 cue 的 \N 已被转成真实 \n,原样复制会让剪贴板
  // 物理行数 > 失败条数 —— 拿去外部翻译后逐行贴回(复制按钮存在的工作流)必错位。
  const copyAll = () => {
    copyToClipboard(sortedLines.map((l) => l.text.replace(/\r?\n/g, " ")).join("\n"));
  };

  const copyAllLangs = () => {
    // Space-separated matches what users will paste back into the
    // Quick Entry via Language Codes field (which accepts comma OR space).
    copyToClipboard(failedLangs.join(" "));
  };

  return (
    <>
      {hasLineFailures && (
        <Alert
          type="warning"
          showIcon
          className="!mt-4"
          // 描边不填充,与上方进度条同一种处理:两个琥珀元素统一,谁也不喊。
          // 实心底会让这块「可一键修复的部分失败」比页面上任何东西都重。
          //
          // 【不要限宽】。试过 maxWidth: 840 —— 更怪:这一页是全宽卡片的节奏
          // (下方「翻译结果」卡通栏),一个 840 的框右边缘既不齐左栏也不齐结果卡,
          // 成了悬空的孤儿。框内的空旷不是靠收窄治的,是靠让内容顺着流排
          // (按钮已从右侧 action 槽移进内容流)——治好之后全宽反而是一致的。
          style={{ background: "transparent", borderColor: token.colorWarningBorder }}
          title={
            <div className="flex items-center justify-between flex-wrap" style={{ gap: 12 }}>
              <span>{t("partialFailureTitle", { count })}</span>
              {/* 动作与标题同一行、横排右对齐 —— 与下方「翻译结果」卡(标题左、
                  复制/导出右)同一模式。注意不要用 antd 的 action 槽:那会把按钮
                  【竖排】在四行文字旁边,在这块通栏面板里拉出近八百像素的空洞。 */}
              <Space size="small" wrap>
                <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={onRetry} disabled={disabled}>
                  {t("retryFailedLines")}
                </Button>
                {lines.length > 0 && (
                  <Button size="small" icon={<UnorderedListOutlined />} onClick={() => setModalOpen(true)}>
                    {t("viewFailedLines")}
                  </Button>
                )}
              </Space>
            </div>
          }
          description={
            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              {/* 一句只干一件事:第一句是行动,第二句是原因且降调 ——
                  原先是 93 字的四合一段落,最该被看见的「文件还能用」被埋在中间
                  (那句已上移到进度条标题)。 */}
              <span>{t("partialFailureDesc")}</span>
              <Text type="secondary" style={{ fontSize: 12 }}>
                {t("partialFailureWhy")}
              </Text>
              {/* 排查细节垫底:重试解决不了时才需要读它。 */}
              {reason && (
                <div
                  className="font-mono"
                  style={{
                    fontSize: 12,
                    color: token.colorTextTertiary,
                    background: token.colorFillQuaternary,
                    borderRadius: token.borderRadiusSM,
                    padding: "5px 9px",
                    whiteSpace: "pre-wrap",
                    wordBreak: "break-word",
                    display: "inline-block",
                    maxWidth: "100%",
                  }}>
                  {reason}
                </div>
              )}
            </Space>
          }
        />
      )}

      {hasLangFailures && (
        <Alert
          type="warning"
          showIcon
          className="!mt-4"
          style={{ background: "transparent", borderColor: token.colorWarningBorder }}
          title={t("failedLanguagesTitle", { count: failedLangs.length })}
          description={
            <Space orientation="vertical" size="small" style={{ width: "100%" }}>
              <span>{t("failedLanguagesDesc")}</span>
              <div>
                {failedLangs.map((code) => (
                  <Tag key={code} style={{ marginBottom: 4 }}>
                    {code}
                  </Tag>
                ))}
              </div>
              <Space size="small" wrap>
                {/* hasLineFailures already rendered a retry button — avoid duplicating */}
                {!hasLineFailures && (
                  <Button size="small" type="primary" icon={<ReloadOutlined />} onClick={onRetry} disabled={disabled}>
                    {t("retryFailedLines")}
                  </Button>
                )}
                <Button size="small" icon={<CopyOutlined />} onClick={copyAllLangs}>
                  {t("copyAllFailedLanguages")}
                </Button>
              </Space>
            </Space>
          }
        />
      )}

      <Modal
        open={modalOpen}
        onCancel={() => setModalOpen(false)}
        title={t("failedLinesModalTitle", { count: lines.length })}
        footer={[
          <Button key="copy" icon={<CopyOutlined />} onClick={copyAll}>
            {t("copyAllFailed")}
          </Button>,
          <Button key="close" type="primary" onClick={() => setModalOpen(false)}>
            {t("closeFailedLinesModal")}
          </Button>,
        ]}
        width={720}>
        <List
          size="small"
          bordered
          dataSource={sortedLines}
          style={{ maxHeight: "60vh", overflowY: "auto" }}
          renderItem={(item, idx) => (
            <List.Item>
              <span
                className="font-mono"
                style={{
                  color: token.colorTextTertiary,
                  marginRight: 12,
                  fontSize: 12,
                  letterSpacing: "0.04em",
                  display: "inline-block",
                  minWidth: `${numWidth + 1}ch`,
                  textAlign: "right",
                }}>
                {/* 物理行号 → 单元序数 → 行序号(见 posOf)。 */}
                {String(posOf(item) ?? idx + 1).padStart(numWidth, "0")}
              </span>
              {showFile && item.file && (
                <Tag style={{ marginRight: 8 }} color="default">
                  {item.file}
                </Tag>
              )}
              {showLang && item.lang && (
                <Tag style={{ marginRight: 8 }} color="default">
                  {item.lang}
                </Tag>
              )}
              {item.text}
            </List.Item>
          )}
        />
      </Modal>
    </>
  );
}
