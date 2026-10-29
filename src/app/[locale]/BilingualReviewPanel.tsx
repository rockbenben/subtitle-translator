"use client";

import { useEffect, useMemo, useState } from "react";
import { Button, Card, Input, Table, Typography, theme } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { parseReviewTexts, replaceReviewText } from "./subtitleCues";
import { useFileExport } from "@/app/hooks/useFileExport";
import { useIsMobile } from "@/app/hooks/useIsMobile";

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  sourceText: string;
  /** 源字幕格式(sourceFileType) */
  sourceFormat: string | null;
  /** 译文字幕全文(translatedText) */
  translatedText: string;
  /** 译文格式(translatedTextExt) */
  translatedFormat: string | null;
  /** 应用校对结果时同步回页面上的译文(否则主结果与导出的校对稿会不一致) */
  onApply?: (text: string) => void;
  /** 多语言模式下预览的语种；单语言模式不必显示 */
  languageLabel?: string;
  /** 多语言模式下把语种写进校对稿文件名，避免与其它语言的稿件混淆 */
  languageCode?: string;
  /** 有未应用的编辑时通知父组件，避免上方「复制 / 导出」悄悄导出旧译文 */
  onDirtyChange?: (dirty: boolean) => void;
}

interface Pair {
  index: number;
  src: string;
  trg: string;
  /** 译文里存在该 index 的 cue(replaceCueText 写得回去)才可编辑 */
  editable: boolean;
}

/**
 * 对照校对面板:把源字幕与译文字幕按行序并排(timed 格式按 cue,lrc 按内容
 * 行),译文列可逐行编辑,应用后用 replaceReviewText 写回译文字幕(保留时间
 * 码/序号/结构)并下载。与翻译流程解耦(只读 sourceText/translatedText)。
 * 解析不出任何行时不渲染。
 */
const BilingualReviewPanel = ({ sourceText, sourceFormat, translatedText, translatedFormat, onApply, languageLabel, languageCode, onDirtyChange }: Props) => {
  const t = useTranslations("SubtitleTranslator");
  const { token } = theme.useToken();
  const exportFile = useFileExport();
  const isMobile = useIsMobile();
  const [edits, setEdits] = useState<Map<number, string>>(new Map());

  useEffect(() => {
    onDirtyChange?.(edits.size > 0);
  }, [edits.size, onDirtyChange]);

  // 面板因失败/切换输出模式/清空而卸载时，父组件不能继续以为有未应用修改。
  useEffect(() => () => onDirtyChange?.(false), [onDirtyChange]);

  // 译文变化(重新翻译)时清空编辑,避免旧编辑残留误导
  const [prevTrans, setPrevTrans] = useState(translatedText);
  if (translatedText !== prevTrans) {
    setPrevTrans(translatedText);
    setEdits(new Map());
  }

  const pairs = useMemo<Pair[]>(() => {
    const src = parseReviewTexts(sourceText, sourceFormat ?? "");
    const trg = parseReviewTexts(translatedText, translatedFormat ?? "");
    if (trg.length === 0) return [];
    const n = Math.max(src.length, trg.length);
    const out: Pair[] = [];
    for (let i = 0; i < n; i++) out.push({ index: i + 1, src: src[i] ?? "", trg: trg[i] ?? "", editable: i < trg.length });
    return out;
  }, [sourceText, sourceFormat, translatedText, translatedFormat]);

  if (pairs.length === 0) return null;

  const valueOf = (p: Pair) => edits.get(p.index) ?? p.trg;
  // 改回原文就不算待应用编辑：留着会让 dirty 永远为真，上方复制/导出
  // 一直被「请先应用」拦住，而 apply 产出的文本其实与原文一致。
  const setEdit = (index: number, val: string, original: string) =>
    setEdits((prev) => {
      const next = new Map(prev);
      if (val === original) next.delete(index);
      else next.set(index, val);
      return next;
    });

  const handleApplyDownload = () => {
    const fmt = translatedFormat ?? "srt";
    const out = replaceReviewText(translatedText, fmt, edits);
    const base = languageCode ? `subtitle_reviewed.${languageCode}` : "subtitle_reviewed";
    onApply?.(out);
    // 编辑已写进下载稿与主结果；不依赖父组件回写 translatedText 后才由
    // prop 变化清空（父组件没刷新时 dirty 会一直停在 true）。
    setEdits(new Map());
    void exportFile(out, `${base}.${fmt}`, undefined, t("reviewDownloaded"));
  };

  const columns = [
    // 手机窄屏只留「原文 / 译文」两列；否则译文列会被横向滚动条推到屏幕外，
    // 而校对的主要动作恰恰是改译文。
    { title: "#", dataIndex: "index", width: 50, responsive: ["md" as const] },
    {
      title: t("reviewColSource"),
      dataIndex: "src",
      width: isMobile ? "45%" : undefined,
      // dir=auto 在 div 上只是 isolate(整块一个方向);多行 cue 要逐行判定得显式 plaintext
      render: (s: string) => (
        <div dir="auto" style={{ whiteSpace: "pre-wrap", unicodeBidi: "plaintext" }}>
          <Text type="secondary">{s}</Text>
        </div>
      ),
    },
    {
      title: t("reviewColTarget"),
      dataIndex: "trg",
      width: isMobile ? "55%" : undefined,
      render: (_: string, p: Pair) => (
        <TextArea value={valueOf(p)} onChange={(e) => setEdit(p.index, e.target.value, p.trg)} disabled={!p.editable} dir="auto" autoSize={{ minRows: 1, maxRows: 4 }} aria-label={`${t("reviewColTarget")} #${p.index}`} />
      ),
    },
  ];

  return (
    <Card
      className="mt-6"
      title={languageLabel ? `${t("reviewTitle")} - ${languageLabel}` : t("reviewTitle")}
      style={{ boxShadow: token.boxShadowTertiary }}
      extra={
        <Button type="primary" size="small" icon={<DownloadOutlined aria-hidden />} onClick={handleApplyDownload} disabled={edits.size === 0}>
          {t("reviewApplyDownload")}
        </Button>
      }>
      <Table<Pair>
        size="small"
        rowKey="index"
        columns={columns}
        dataSource={pairs}
        pagination={pairs.length > 30 ? { pageSize: 30, size: "small" } : false}
        scroll={isMobile ? undefined : { x: "max-content" }}
        tableLayout={isMobile ? "fixed" : undefined}
      />
    </Card>
  );
};

export default BilingualReviewPanel;
