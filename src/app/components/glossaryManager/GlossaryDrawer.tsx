"use client";

import { useMemo, useState } from "react";
import { Drawer, Table, Input, Button, Select, Space, Upload, App, Typography } from "antd";
import { PlusOutlined, DeleteOutlined, UploadOutlined, DownloadOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useTranslationContext } from "@/app/components/TranslationContext";
import { languages } from "@/app/lib/translation/languages-data";
import { downloadFile } from "@/app/utils";
import type { GlossaryTerm } from "@/app/lib/translation/glossary";

const LANG_OPTIONS = languages.filter((l) => l.value !== "auto").map((l) => ({ label: `${l.name} (${l.nativelabel})`, value: l.value }));

const GlossaryDrawer = ({ open, onClose }: { open: boolean; onClose: () => void }) => {
  const t = useTranslations("TranslationGlossary");
  const tCommon = useTranslations("common");
  const { message } = App.useApp();
  const { activeGlossaryPreset, activeGlossaryPresetId, updateGlossaryPreset, targetLanguage } = useTranslationContext();
  const [selectedLang, setSelectedLang] = useState<string>(targetLanguage || "zh");

  const allTerms = useMemo(() => activeGlossaryPreset?.terms ?? [], [activeGlossaryPreset]);
  // Terms for the selected language, each carrying its index into the FULL
  // allTerms array (`__originalIdx`, matching RuleTable) so edits map back correctly.
  const visibleTerms = useMemo(() => allTerms.map((term, i) => ({ ...term, __originalIdx: i })).filter((term) => term.targetLang === selectedLang), [allTerms, selectedLang]);

  const saveTerms = (next: GlossaryTerm[]) => {
    if (activeGlossaryPresetId) updateGlossaryPreset(activeGlossaryPresetId, { terms: next });
  };
  const editTerm = (originalIdx: number, patch: Partial<GlossaryTerm>) => saveTerms(allTerms.map((term, i) => (i === originalIdx ? { ...term, ...patch } : term)));
  const removeTerm = (originalIdx: number) => saveTerms(allTerms.filter((_, i) => i !== originalIdx));
  const addTerm = () => saveTerms([...allTerms, { from: "", to: "", targetLang: selectedLang }]);

  // Tabs/newlines are the TSV field/record separators — collapse them to a space
  // so a value that contains one can't corrupt the export or the round-trip.
  const cleanCell = (s: string) => s.replace(/[\t\r\n]+/g, " ").trim();

  const exportTsv = () => {
    const tsv = visibleTerms.map((term) => `${cleanCell(term.from)}\t${cleanCell(term.to)}`).join("\n");
    downloadFile(tsv, `glossary-${selectedLang}.tsv`, "text/tab-separated-values");
  };
  const importTsv = (file: File) => {
    const reader = new FileReader();
    reader.onload = () => {
      const parsed: GlossaryTerm[] = String(reader.result)
        .split(/\r?\n/) // tolerate Windows CRLF and Unix LF
        .map((line) => line.split("\t"))
        // 双列都必须非空:只有源列的残行(单列清单、截断的导出)曾把已有
        // 完整词条的 target 静默清空。
        .filter((cols) => cleanCell(cols[0] ?? "") && cleanCell(cols[1] ?? ""))
        .map((cols) => ({ from: cleanCell(cols[0] ?? ""), to: cleanCell(cols[1] ?? ""), targetLang: selectedLang }));
      // Merge, don't wipe. Key this language's terms by trimmed source; the
      // imported rows overlay (so they add new, update same-source, and the Map
      // collapses file-internal duplicates and stray trailing-space clashes).
      // 大小写【敏感】:引擎明确支持 'Polish'/'polish' 这类大小写区分词对
      // (glossary.ts case-exact-wins),lowercase 归一会把其中一条静默删除。
      const normalize = (from: string) => from.trim();
      const byKey = new Map<string, GlossaryTerm>();
      for (const term of allTerms) if (term.targetLang === selectedLang) byKey.set(normalize(term.from), term);
      for (const term of parsed) byKey.set(normalize(term.from), term);
      const otherLangs = allTerms.filter((term) => term.targetLang !== selectedLang);
      saveTerms([...otherLangs, ...byKey.values()]);
      message.success(t("importDone", { count: parsed.length }));
    };
    // Don't swallow a failed read (locked file, odd encoding) silently.
    reader.onerror = () => message.error(tCommon("fileReadFailed"));
    reader.readAsText(file);
    return false;
  };

  const columns = [
    { title: t("colFrom"), dataIndex: "from", render: (_: string, term: (typeof visibleTerms)[number]) => <Input value={term.from} placeholder={t("fromPlaceholder")} aria-label={t("fromPlaceholder")} onChange={(e) => editTerm(term.__originalIdx, { from: e.target.value })} /> },
    { title: t("colTo"), dataIndex: "to", render: (_: string, term: (typeof visibleTerms)[number]) => <Input value={term.to} placeholder={t("toPlaceholder")} aria-label={t("toPlaceholder")} onChange={(e) => editTerm(term.__originalIdx, { to: e.target.value })} /> },
    { title: "", width: 48, render: (_: unknown, term: (typeof visibleTerms)[number]) => <Button danger type="text" icon={<DeleteOutlined />} aria-label={tCommon("remove")} onClick={() => removeTerm(term.__originalIdx)} /> },
  ];

  return (
    <Drawer title={`${t("drawerTitle")}${activeGlossaryPreset ? ` · ${activeGlossaryPreset.name}` : ""}`} open={open} onClose={onClose} size="min(520px, 90vw)">
      <Space style={{ width: "100%", marginBottom: 12 }} wrap>
        <span id="glossary-lang-label">{tCommon("targetLanguage")}</span>
        <Select aria-labelledby="glossary-lang-label" style={{ minWidth: 200 }} showSearch optionFilterProp="label" value={selectedLang} onChange={setSelectedLang} options={LANG_OPTIONS} />
        <Upload accept=".tsv,.txt" showUploadList={false} beforeUpload={importTsv}>
          <Button icon={<UploadOutlined />}>{t("importTsv")}</Button>
        </Upload>
        <Button icon={<DownloadOutlined />} onClick={exportTsv} disabled={visibleTerms.length === 0}>{t("exportTsv")}</Button>
      </Space>
      <Typography.Paragraph type="secondary" style={{ marginBottom: 12 }}>{t("langHint")}</Typography.Paragraph>
      <Table size="small" rowKey="__originalIdx" columns={columns} dataSource={visibleTerms} pagination={false} locale={{ emptyText: t("noTermsForLang") }} />
      <Button block type="dashed" icon={<PlusOutlined />} style={{ marginTop: 12 }} onClick={addTerm}>{t("addTerm")}</Button>
    </Drawer>
  );
};

export default GlossaryDrawer;
