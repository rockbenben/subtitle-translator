"use client";

import { useMemo, useState } from "react";
import { Drawer, Table, Input, Button, Select, Space, Upload, App, Typography, Alert, Tooltip, Dropdown } from "antd";
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined, SearchOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { languages } from "@/app/lib/translation/languages-data";
import { downloadFile } from "@/app/utils";
import { mergeImportedTerms, parseGlossaryTsv, type GlossaryTerm } from "@/app/lib/translation/glossary";

const LANG_OPTIONS = languages.filter((l) => l.value !== "auto").map((l) => ({ label: `${l.name} (${l.nativelabel})`, value: l.value }));
const LANG_VALUES: ReadonlySet<string> = new Set(LANG_OPTIONS.map((l) => l.value));

// 大词表(数百条)逐行渲染 Input 会卡;按 DeepL 的管理器形态分页展示。
const PAGE_SIZE = 50;

const GlossaryDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const t = useTranslations("TranslationGlossary");
  const tCommon = useTranslations("common");
  const { message } = App.useApp();
  const { activeGlossaryPreset, activeGlossaryPresetId, updateGlossaryPreset, targetLanguage } = useTranslationContext();
  const [selectedLang, setSelectedLang] = useState<string>(targetLanguage || "zh");
  const [search, setSearch] = useState("");

  const allTerms = useMemo(() => activeGlossaryPreset?.terms ?? [], [activeGlossaryPreset]);
  // Terms for the selected language, each carrying its index into the FULL
  // allTerms array (`__originalIdx`, matching RuleTable) so edits map back correctly.
  const visibleTerms = useMemo(() => allTerms.map((term, i) => ({ ...term, __originalIdx: i })).filter((term) => term.targetLang === selectedLang), [allTerms, selectedLang]);

  // 词表内搜索(DeepL 管理器同款):按原文/译法子串过滤,大小写不敏感。
  const searchedTerms = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return visibleTerms;
    return visibleTerms.filter((term) => term.source.toLowerCase().includes(q) || term.target.toLowerCase().includes(q));
  }, [visibleTerms, search]);

  // DeepL 规则:every entry must be unique —— 同一原文词只有一条会生效
  // (引擎按编译顺序取第一条)。大小写【敏感】:'Polish'/'polish' 是合法词对。
  const duplicateSources = useMemo(() => {
    const counts = new Map<string, number>();
    for (const term of visibleTerms) {
      const key = term.source.trim();
      if (key) counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    return new Set([...counts].filter(([, n]) => n > 1).map(([key]) => key));
  }, [visibleTerms]);

  const completeCount = useMemo(() => visibleTerms.filter((term) => term.source.trim() && term.target.trim()).length, [visibleTerms]);
  const selectedLangLabel = languages.find((l) => l.value === selectedLang)?.nativelabel ?? selectedLang;

  const saveTerms = (next: GlossaryTerm[]) => {
    if (activeGlossaryPresetId) updateGlossaryPreset(activeGlossaryPresetId, { terms: next });
  };
  const editTerm = (originalIdx: number, patch: Partial<GlossaryTerm>) => saveTerms(allTerms.map((term, i) => (i === originalIdx ? { ...term, ...patch } : term)));
  const removeTerm = (originalIdx: number) => saveTerms(allTerms.filter((_, i) => i !== originalIdx));
  // 新词条置顶(DeepL 同款),并清掉搜索词 —— 空行会被当前搜索过滤掉,
  // 用户会以为"添加没反应"。
  const addTerm = () => {
    setSearch("");
    saveTerms([{ source: "", target: "", targetLang: selectedLang }, ...allTerms]);
  };

  // Tabs/newlines are the TSV field/record separators — collapse them to a space
  // so a value that contains one can't corrupt the export or the round-trip.
  const cleanCell = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

  const exportTsv = () => {
    // 主按钮在「全语言有词、当前语言为空」时也可点(disabled 只看 allTerms)——
    // 给提示而不是下载空文件。
    if (visibleTerms.length === 0) {
      message.info(t("noTermsForLang"));
      return;
    }
    const tsv = visibleTerms.map((term) => `${cleanCell(term.source)}\t${cleanCell(term.target)}`).join("\n");
    downloadFile(tsv, `glossary-${selectedLang}.tsv`, "text/tab-separated-values");
  };
  // 3 列变体(source⇥target⇥targetLang):整个预设一个文件,跨设备/分享用。
  // 借鉴 DeepL 的多语言对上传格式 —— 我们只绑目标语言,三列即可。
  const exportAllTsv = () => {
    const tsv = allTerms.map((term) => `${cleanCell(term.source)}\t${cleanCell(term.target)}\t${term.targetLang}`).join("\n");
    downloadFile(tsv, "glossary-all.tsv", "text/tab-separated-values");
  };

  // 固定 TSV 单一格式:制表符在术语文本里几乎不会出现,无需 CSV 的引号/
  // 转义规则,且与电子表格的剪贴板格式(粘贴即 TSV)天然互通。解析/合并
  // 语义(可选第 3 列语言码、merge-don't-wipe、大小写敏感 overlay)在
  // glossary.ts 的纯函数里,带单测。
  const importTsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed = parseGlossaryTsv(String(reader.result), selectedLang, LANG_VALUES);
      saveTerms(mergeImportedTerms(allTerms, parsed));
      message.success(t("importDone", { count: parsed.length }));
    };
    // Don't swallow a failed read (locked file, odd encoding) silently.
    reader.onerror = () => message.error(tCommon("fileReadFailed"));
    reader.readAsText(file);
    return false;
  };

  const columns = [
    {
      title: t("colSource"),
      dataIndex: "source",
      render: (_: string, term: (typeof visibleTerms)[number]) => (
        <Input
          value={term.source}
          placeholder={t("sourcePlaceholder")}
          aria-label={t("sourcePlaceholder")}
          status={duplicateSources.has(term.source.trim()) ? "warning" : undefined}
          onChange={(e) => editTerm(term.__originalIdx, { source: e.target.value })}
        />
      ),
    },
    {
      // DeepL 的列头直接用语言名 —— 多语言词表里"译法"列属于哪门语言一眼可辨。
      title: `${t("colTarget")} · ${selectedLangLabel}`,
      dataIndex: "target",
      render: (_: string, term: (typeof visibleTerms)[number]) => (
        <Input
          value={term.target}
          placeholder={t("targetPlaceholder")}
          aria-label={t("targetPlaceholder")}
          // 半成品行(有原文无译法)引擎会跳过 —— 标出来,免得用户疑惑词条不生效。
          status={term.source.trim() && !term.target.trim() ? "warning" : undefined}
          onChange={(e) => editTerm(term.__originalIdx, { target: e.target.value })}
        />
      ),
    },
    { title: "", width: 48, render: (_: unknown, term: (typeof visibleTerms)[number]) => <Button danger type="text" icon={<DeleteOutlined />} aria-label={tCommon("remove")} onClick={() => removeTerm(term.__originalIdx)} /> },
  ];

  return (
    <Drawer title={`${t("drawerTitle")}${activeGlossaryPreset ? ` · ${activeGlossaryPreset.name}` : ""}`} open={open} onClose={onClose} size="min(520px, 90vw)">
      <Space style={{ width: "100%", marginBottom: 12 }} wrap>
        <span id="glossary-lang-label">{tCommon("targetLanguage")}</span>
        <Select aria-labelledby="glossary-lang-label" style={{ minWidth: 200 }} showSearch optionFilterProp="label" value={selectedLang} onChange={setSelectedLang} options={LANG_OPTIONS} />
        <Tooltip title={t("tsvHint")}>
          <Upload accept=".tsv,.txt" showUploadList={false} beforeUpload={importTsv}>
            <Button icon={<UploadOutlined />}>{t("importTsv")}</Button>
          </Upload>
        </Tooltip>
        {/* Split button: click = current language (2-col, DeepL-TSV compatible);
            menu = all languages (3-col with targetLang). */}
        <Dropdown.Button
          menu={{
            items: [{ key: "all", label: t("exportAllTsv") }],
            onClick: ({ key }) => {
              if (key === "all") exportAllTsv();
            },
          }}
          onClick={exportTsv}
          disabled={allTerms.length === 0}>
          <DownloadOutlined /> {t("exportTsv")}
        </Dropdown.Button>
      </Space>
      <Space style={{ width: "100%", marginBottom: 12, justifyContent: "space-between" }} wrap>
        <Input allowClear prefix={<SearchOutlined />} style={{ width: 220 }} placeholder={t("searchPlaceholder")} aria-label={t("searchPlaceholder")} value={search} onChange={(e) => setSearch(e.target.value)} />
        <Typography.Text type="secondary">{t("termCount", { count: completeCount })}</Typography.Text>
      </Space>
      {/* 终端用户反馈:习惯把术语表写进系统提示词的用户不知道这里该填什么 ——
          一句话讲清行格式 + 自动生效,不留猜测空间。 */}
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>
        {t("exampleHint")}
        <br />
        {t("langHint")}
      </Typography.Paragraph>
      {duplicateSources.size > 0 && <Alert type="warning" showIcon title={t("duplicateHint")} style={{ marginBottom: 12 }} />}
      <Button block type="dashed" icon={<PlusOutlined />} style={{ marginBottom: 12 }} onClick={addTerm}>{t("addTerm")}</Button>
      <Table
        size="small"
        rowKey="__originalIdx"
        columns={columns}
        dataSource={searchedTerms}
        pagination={searchedTerms.length > PAGE_SIZE ? { pageSize: PAGE_SIZE, showSizeChanger: false } : false}
        locale={{ emptyText: t("noTermsForLang") }}
      />
    </Drawer>
  );
};

export default GlossaryDrawer;
