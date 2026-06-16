"use client";

import { useMemo, useState } from "react";
import { App, Button, Card, Input, Table, Typography, theme } from "antd";
import { DownloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { downloadFile } from "@/app/utils";
import { parseReviewTexts, replaceReviewText } from "./subtitleCues";

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
const BilingualReviewPanel = ({ sourceText, sourceFormat, translatedText, translatedFormat }: Props) => {
  const t = useTranslations("SubtitleTranslator");
  const { token } = theme.useToken();
  const { message } = App.useApp();
  const [edits, setEdits] = useState<Map<number, string>>(new Map());

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
  const setEdit = (index: number, val: string) =>
    setEdits((prev) => {
      const next = new Map(prev);
      next.set(index, val);
      return next;
    });

  const handleApplyDownload = () => {
    const fmt = translatedFormat ?? "srt";
    const out = replaceReviewText(translatedText, fmt, edits);
    void downloadFile(out, `subtitle_reviewed.${fmt}`);
    message.success(t("reviewDownloaded"));
  };

  const columns = [
    { title: "#", dataIndex: "index", width: 50 },
    {
      title: t("reviewColSource"),
      dataIndex: "src",
      render: (s: string) => (
        <div style={{ whiteSpace: "pre-wrap" }}>
          <Text type="secondary">{s}</Text>
        </div>
      ),
    },
    {
      title: t("reviewColTarget"),
      dataIndex: "trg",
      render: (_: string, p: Pair) => (
        <TextArea value={valueOf(p)} onChange={(e) => setEdit(p.index, e.target.value)} disabled={!p.editable} autoSize={{ minRows: 1, maxRows: 4 }} aria-label={`${t("reviewColTarget")} #${p.index}`} />
      ),
    },
  ];

  return (
    <Card
      className="mt-6"
      title={t("reviewTitle")}
      style={{ boxShadow: token.boxShadowTertiary }}
      extra={
        <Button type="primary" size="small" icon={<DownloadOutlined />} onClick={handleApplyDownload} disabled={edits.size === 0}>
          {t("reviewApplyDownload")}
        </Button>
      }>
      <Table<Pair> size="small" rowKey="index" columns={columns} dataSource={pairs} pagination={pairs.length > 30 ? { pageSize: 30, size: "small" } : false} scroll={{ x: "max-content" }} />
    </Card>
  );
};

export default BilingualReviewPanel;
