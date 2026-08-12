"use client";

import { memo, useCallback, useEffect, useRef, useSyncExternalStore } from "react";
import { Spin, Typography, theme } from "antd";
import { useTranslations } from "next-intl";
import type { LiveLine, LiveLinesStore } from "@/app/hooks/useTranslationProgress";

const { Text } = Typography;

interface LiveTranslationResultsProps {
  /**
   * 实时行的外部 store。传 store 而不是数组:数组要经 TranslationContext 下来,
   * 而那个 context 的 value 每次渲染都是新对象 —— 10 次/秒的 flush 会把整棵
   * 工具树跟着重渲染。订阅只发生在本组件内。
   */
  store: LiveLinesStore;
  /**
   * 本轮【已处理】的行数(进度条的 current)。用来区分两种"面板还是空的":
   * 一行都没处理过 = 还在等第一行;处理过却一行都没成功 = 整轮都在失败。
   */
  processedCount: number;
}

/** 单行 —— memo 化:LiveLine 对象在 Map 里身份稳定(只有重发/标失败才换新), */
/** 所以窗口滚动时未变的行整片跳过 re-render,不必为此引入虚拟列表。 */
const LiveRow = memo(({ line, notTranslatedLabel }: { line: LiveLine; notTranslatedLabel: string }) => {
  const { token } = theme.useToken();
  return (
    <div className="flex flex-col" style={{ gap: 2 }}>
      <div className="flex items-center" style={{ gap: 8 }}>
        {/* ⚠ 显示物理源行号(line.line),不是批内序数。正下方的失败面板报的
            就是物理行号,两者同为等宽 #N 样式并排 —— 各报一套坐标的话,用户
            照着这里跳到"第 12 行"会落在时间轴上。缺映射时(独立值模式)才
            回落到序数。 */}
        <span className="font-mono" style={{ fontSize: 11, color: line.failed ? token.colorWarning : token.colorTextTertiary, flexShrink: 0 }}>
          #{line.line ?? line.index + 1}
        </span>
        {line.failed && (
          <Text type="warning" style={{ fontSize: 11 }}>
            {notTranslatedLabel}
          </Text>
        )}
      </div>
      <Text type="secondary" style={{ fontSize: 12, whiteSpace: "pre-wrap" }}>
        {line.original}
      </Text>
      {/* 失败行【不】再渲染一行译文:那一行只能是原文的副本(软填约定),
          上下两行一模一样看起来像渲染坏了。琥珀的「未译出」已经说清了。 */}
      {!line.failed && <Text style={{ fontSize: 13, whiteSpace: "pre-wrap" }}>{line.translation}</Text>}
    </div>
  );
});
LiveRow.displayName = "LiveRow";

/**
 * 实时翻译结果流 —— 与进度条并行的第二通道:每一行定稿立即出现在这里,
 * 不等整批结束。只读面板(原文 ↕ 译文),位置在进度条正下方。失败行标琥珀
 * 「未译出」,细节归下方的失败面板。
 *
 * 行数窗口与排序都在 useTranslationProgress 里做完了 —— 这里【不】再切一刀:
 * 两处各设一个上限,改其中一个就会得到一个说不清到底显示多少行的面板。
 */
const LiveTranslationResults = ({ store, processedCount }: LiveTranslationResultsProps) => {
  const lines = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const t = useTranslations("SubtitleTranslator");
  const { token } = theme.useToken();
  const containerRef = useRef<HTMLDivElement>(null);

  // 钉底是【状态】不是【规则】:用户上滚(离底部 > 40px)即冻结,滚回底部即
  // 解冻 —— 面板的价值之一是中途抽查译文质量,无条件跟随等于「可以看,不许读」。
  //
  // ⚠ 冻结做在 store 里(setPaused)而不是这里存一份副本:窗口每 100ms 从头部
  // 淘汰旧行,光固定 scrollTop 是不够的,同一个偏移会指向越来越靠后的内容,
  // 用户正在读的那段一路上滑、最后干脆被淘汰掉。store 冻结时快照身份不变,
  // 本组件连重渲染都不会发生,什么都不动。
  //
  // ⚠ 只写 container.scrollTop,不用 scrollIntoView —— 后者滚的是「最近的
  // 可滚动祖先」,面板还没滚满时那就是【页面本身】,每来一批行页面跳一次。
  const handleScroll = useCallback(() => {
    const el = containerRef.current;
    // 程序性置底也触发 onScroll,但算出来就是「在底部」,不会误冻结。
    if (el) store.setPaused(el.scrollHeight - el.scrollTop - el.clientHeight >= 40);
  }, [store]);

  // 冻结期间 lines 的身份不变 → 本 effect 不会跑 → 滚动条不动。
  useEffect(() => {
    const el = containerRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [lines]);

  // 两种"面板是空的",说的是完全不同的两件事 —— 只看 lines.length 会在整轮
  // 全失败时一直转着圈说「等待第一行译文…」,而上方进度条已经走到 100%
  // INCOMPLETE,恰是用户最需要信号的时刻断言了相反的事。
  const emptyHint = lines.length > 0 ? null : processedCount > 0 ? t("liveNoneSucceeded") : t("liveWaiting");

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
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
      {/* 不在这里报行数:lines 是被窗口截过的,显示出来是【渲染条数】而不是
          已完成行数,3000 行的文件会一直写着"200"。真正的计数就在正上方的
          进度条里(current / total),同屏两处报同一件事、其中一处还是错的。 */}
      <div style={{ padding: "10px 14px 6px" }}>
        <Text strong style={{ fontSize: 13 }}>
          {t("liveResults")}
        </Text>
      </div>

      {emptyHint ? (
        <div style={{ padding: "16px 14px 20px", color: token.colorTextTertiary }}>
          {/* 一行都还没处理过才转圈;已经在处理却零成功,转圈就是在撒谎。 */}
          {processedCount === 0 && <Spin size="small" style={{ marginRight: 8 }} />}
          <span style={{ fontSize: 13 }}>{emptyHint}</span>
        </div>
      ) : (
        <div className="flex flex-col" style={{ padding: "0 14px 14px", gap: 10 }}>
          {lines.map((line) => (
            <LiveRow key={line.index} line={line} notTranslatedLabel={t("liveNotTranslated")} />
          ))}
        </div>
      )}
    </div>
  );
};

export default LiveTranslationResults;
