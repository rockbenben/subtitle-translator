"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Flex, Card, Button, Typography, Input, Upload, Form, Space, message, Select, Modal, Checkbox, Progress, Tooltip, Radio, Switch, Spin, Table } from "antd";
import { CopyOutlined, DownloadOutlined, InboxOutlined, UploadOutlined } from "@ant-design/icons";
import { splitTextIntoLines, getTextStats, downloadFile } from "@/app/utils";
import { VTT_SRT_TIME, LRC_TIME_REGEX, detectSubtitleFormat, getOutputFileExtension, filterSubLines, convertTimeToAss, assHeader } from "./subtitleUtils";
import { categorizedOptions, findMethodLabel, LLM_MODELS } from "@/app/components/translateAPI";
import { useLanguageOptions, filterLanguageOption } from "@/app/components/languages";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import useTranslateData from "@/app/hooks/useTranslateData";
import { useTranslations } from "next-intl";
import { useAuth } from "@/app/components/AuthContext";

const { TextArea } = Input;
const { Dragger } = Upload;
const { Paragraph } = Typography;

const SubtitleTranslator = () => {
  const tSubtitle = useTranslations("subtitle");
  const t = useTranslations("common");

  const { sourceOptions, targetOptions } = useLanguageOptions();
  const { copyToClipboard } = useCopyToClipboard();
  const {
    isFileProcessing,
    fileList,
    multipleFiles,
    readFile,
    sourceText,
    setSourceText,
    uploadMode,
    singleFileMode,
    setSingleFileMode,
    handleFileUpload,
    handleUploadRemove,
    handleUploadChange,
    resetUpload,
  } = useFileUpload();
  const {
    exportSettings,
    importSettings,
    translationMethod,
    setTranslationMethod,
    translateContent,
    handleTranslate,
    handleServerTranslate,
    getCurrentConfig,
    handleConfigChange,
    sourceLanguage,
    targetLanguage,
    target_langs,
    setTarget_langs,
    useCache,
    setUseCache,
    multiLanguageMode,
    setMultiLanguageMode,
    translatedText,
    setTranslatedText,
    translateInProgress,
    setTranslateInProgress,
    progressPercent,
    setProgressPercent,
    extractedText,
    setExtractedText,
    handleLanguageChange,
    delay,
    validateTranslate,
    serverJobMethod,
    setServerJobMethod,
    serverUseContext,
    setServerUseContext,
    isClient,
  } = useTranslateData();
  const [messageApi, contextHolder] = message.useMessage();

  const sourceStats = useMemo(() => getTextStats(sourceText), [sourceText]);
  const resultStats = useMemo(() => getTextStats(translatedText), [translatedText]);

  const [bilingualSubtitle, setBilingualSubtitle] = useState(false);
  const [bilingualPosition, setBilingualPosition] = useState("below"); // 'above' or 'below'
  const [contextAwareTranslation, setContextAwareTranslation] = useState(true); // 上下文感知翻译开关
  const { token, baseUrl } = useAuth();
  const [serverFiles, setServerFiles] = useState<any[]>([]);
  const [selectedServerFileIds, setSelectedServerFileIds] = useState<string[]>([]);
  const [serverModels, setServerModels] = useState<{ id: string; label: string }[]>([]);
  const [modelsLoading, setModelsLoading] = useState(false);
  const [jobs, setJobs] = useState<any[]>([]);
  const [autoJobs, setAutoJobs] = useState<boolean>(true);
  const [viewerFileId, setViewerFileId] = useState<string | null>(null);
  const [viewerLang, setViewerLang] = useState<"original" | "english" | "japanese" | "chinese">("original");
  const [viewerSegs, setViewerSegs] = useState<any[]>([]);
  const [viewerLoading, setViewerLoading] = useState(false);

  useEffect(() => {
    setExtractedText("");
    setTranslatedText("");
  }, [sourceText, setExtractedText, setTranslatedText]);

  // Fetch server files for current user when in server mode
  const fetchServerFiles = useCallback(async () => {
    if (translationMethod !== "server" || !token) return;
    try {
      const resp = await fetch(`${baseUrl}/api/files`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`Failed to load files (${resp.status})`);
      const items = await resp.json();
      setServerFiles(items || []);
    } catch (e) {
      console.error(e);
      messageApi.error((e as Error).message);
    }
  }, [translationMethod, token, baseUrl, messageApi]);

  useEffect(() => {
    if (isClient) fetchServerFiles();
  }, [fetchServerFiles, isClient]);

  const fetchJobs = useCallback(async () => {
    if (translationMethod !== "server" || !token) return;
    try {
      const resp = await fetch(`${baseUrl}/api/translate/jobs?status=active&limit=100`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`Failed to load jobs (${resp.status})`);
      const data = await resp.json();
      setJobs(data || []);
    } catch (e) {
      console.error(e);
    }
  }, [translationMethod, token, baseUrl]);

  useEffect(() => {
    if (isClient) fetchJobs();
  }, [fetchJobs, isClient]);

  useEffect(() => {
    if (!autoJobs || !isClient) return;
    const id = setInterval(() => {
      fetchJobs();
    }, 60000);
    return () => clearInterval(id);
  }, [autoJobs, fetchJobs, isClient]);

  const fetchServerModels = useCallback(async () => {
    if (translationMethod !== "server" || !token) return;
    setModelsLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/api/models`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`Failed to load models (${resp.status})`);
      const data = await resp.json();
      setServerModels(data?.models || []);
    } catch (e) {
      console.error(e);
      messageApi.error((e as Error).message);
    } finally {
      setModelsLoading(false);
    }
  }, [translationMethod, token, baseUrl, messageApi]);

  useEffect(() => {
    if (isClient) fetchServerModels();
  }, [fetchServerModels, isClient]);

  // --- DB Viewer helpers ---
  const msToSrt = (m: number) => {
    if (typeof m !== "number" || isNaN(m)) return "";
    let ms = Math.max(0, Math.floor(m));
    const h = Math.floor(ms / 3600000);
    ms %= 3600000;
    const min = Math.floor(ms / 60000);
    ms %= 60000;
    const s = Math.floor(ms / 1000);
    const milli = ms % 1000;
    const pad = (n: number, l = 2) => String(n).padStart(l, "0");
    return `${pad(h)}:${pad(min)}:${pad(s)},${pad(milli, 3)}`;
  };

  const fetchViewerSegs = useCallback(async () => {
    if (!isClient || translationMethod !== "server" || !token || !viewerFileId) return;
    setViewerLoading(true);
    try {
      const resp = await fetch(`${baseUrl}/api/files/${viewerFileId}`, { headers: { Authorization: `Bearer ${token}` } });
      if (!resp.ok) throw new Error(`Failed to load segments (${resp.status})`);
      const data = await resp.json();
      setViewerSegs(data?.segments || []);
    } catch (e) {
      console.error(e);
      messageApi.error((e as Error).message);
    } finally {
      setViewerLoading(false);
    }
  }, [isClient, translationMethod, token, viewerFileId, baseUrl, messageApi]);

  useEffect(() => {
    fetchViewerSegs();
  }, [fetchViewerSegs]);

  const langToCol = (lang: string) => {
    const l = (lang || '').toLowerCase();
    if (l.startsWith('ja')) return 'japanese';
    if (l.startsWith('zh')) return 'chinese';
    return 'english';
  };

  const confirmOverwriteIfNeeded = async (): Promise<boolean> => {
    if (translationMethod !== 'server') return true;
    if (!token) return false;
    const langs = multiLanguageMode ? target_langs : [targetLanguage];
    if (!selectedServerFileIds.length || !langs.length) return true;

    const warnings: Array<{ file: string; langs: string[] }> = [];
    for (const id of selectedServerFileIds) {
      try {
        const resp = await fetch(`${baseUrl}/api/files/${id}`, { headers: { Authorization: `Bearer ${token}` } });
        if (!resp.ok) continue;
        const data = await resp.json();
        const hitLangs: string[] = [];
        for (const lg of langs) {
          const col = langToCol(lg);
          if (Array.isArray(data?.segments) && data.segments.some((s: any) => (s?.[col] || '').trim())) {
            hitLangs.push(lg);
          }
        }
        if (hitLangs.length) warnings.push({ file: data?.originalName || data?.title || id, langs: hitLangs });
      } catch {}
    }

    if (!warnings.length) return true;

    const list = warnings
      .map((w) => `• ${w.file}: ${w.langs.join(', ')}`)
      .join('\n');

    return await new Promise((resolve) => {
      Modal.confirm({
        title: 'Overwrite existing translations?',
        content: (
          <div style={{ whiteSpace: 'pre-wrap' }}>
            The following files already contain translations for the selected language(s):
            {'\n'}
            {list}
            {'\n'}
            This will overwrite existing content. Continue?
          </div>
        ),
        okText: 'Overwrite',
        cancelText: 'Cancel',
        onOk: () => resolve(true),
        onCancel: () => resolve(false),
      });
    });
  };

  const uploadToServer = async () => {
    if (translationMethod !== "server") return;
    if (!token) {
      messageApi.error("Please sign in to the server first");
      return;
    }
    if (!multipleFiles || multipleFiles.length === 0) {
      messageApi.error(tSubtitle("noFileUploaded"));
      return;
    }
    try {
      let count = 0;
      for (const f of multipleFiles) {
        const fd = new FormData();
        fd.append("file", f);
        const resp = await fetch(`${baseUrl}/api/files`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: fd,
        });
        if (!resp.ok) {
          const err = await resp.json().catch(() => ({}));
          throw new Error(err?.error || `Upload failed ${resp.status}`);
        }
        count++;
      }
      messageApi.success(`${count} file(s) uploaded to server`);
      await fetchServerFiles();
    } catch (e) {
      console.error(e);
      messageApi.error((e as Error).message);
    }
  };

  const performTranslation = async (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number, isSubtitleMode: boolean = true) => {
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      messageApi.error(tSubtitle("unsupportedSub"));
      return;
    }
    let assContentStartIndex = 9;

    if (fileType === "ass") {
      const eventIndex = lines.findIndex((line) => line.trim() === "[Events]");
      if (eventIndex !== -1) {
        for (let i = eventIndex; i < lines.length; i++) {
          if (lines[i].startsWith("Format:")) {
            const formatLine = lines[i];
            assContentStartIndex = formatLine.split(",").length - 1;
            break;
          }
        }
      }

      if (assContentStartIndex === 9) {
        const dialogueLines = lines.filter((line) => line.startsWith("Dialogue:")).slice(0, 100);
        if (dialogueLines.length > 0) {
          const commaCounts = dialogueLines.map((line) => line.split(",").length - 1);
          assContentStartIndex = Math.min(...commaCounts);
        }
      }
    }

    const { contentLines, contentIndices, styleBlockLines } = filterSubLines(lines, fileType);

    // Determine target languages to translate to
    const targetLanguagesToUse = multiLanguageMode ? target_langs : [targetLanguage];

    // If no target languages selected in multi-language mode, show error
    if (multiLanguageMode && targetLanguagesToUse.length === 0) {
      messageApi.error(t("noTargetLanguage"));
      return;
    }

    // For each target language, perform translation
    for (const currentTargetLang of targetLanguagesToUse) {
      try {
        // Translate content using the specific target language
        const finalTranslatedLines = await translateContent(contentLines, translationMethod, currentTargetLang, fileIndex, totalFiles, isSubtitleMode && contextAwareTranslation);
        // Copy array to avoid modifying the original lines
        const translatedTextArray = [...lines];

        contentIndices.forEach((index, i) => {
          if (fileType === "ass") {
            const originalLine = lines[index];
            const prefix = originalLine.substring(0, originalLine.split(",", assContentStartIndex).join(",").length + 1);
            if (bilingualSubtitle) {
              const translatedLine = finalTranslatedLines[i];
              translatedTextArray[index] =
                bilingualPosition === "below" ? `${originalLine}\\N${translatedLine}` : `${prefix}${translatedLine}\\N${originalLine.split(",").slice(assContentStartIndex).join(",").trim()}`;
            } else {
              translatedTextArray[index] = `${prefix}${finalTranslatedLines[i]}`;
            }
          } else if (fileType === "lrc") {
            const originalLine = lines[index];
            // 提取原始行中的所有时间标记
            const timeMatches = originalLine.match(new RegExp(LRC_TIME_REGEX.source, "g")) || [];
            const timePrefix = timeMatches.join("");

            if (bilingualSubtitle) {
              const translatedLine = finalTranslatedLines[i];
              const originalContent = originalLine.replace(new RegExp(LRC_TIME_REGEX.source, "g"), "").trim();

              if (bilingualPosition === "below") {
                // 原文在上，翻译在下
                translatedTextArray[index] = `${timePrefix} ${originalContent} / ${translatedLine}`;
              } else {
                // 翻译在上，原文在下
                translatedTextArray[index] = `${timePrefix} ${translatedLine} / ${originalContent}`;
              }
            } else {
              // 仅显示翻译
              translatedTextArray[index] = `${timePrefix} ${finalTranslatedLines[i]}`;
            }
          } else {
            // 非 .ass 文件处理
            translatedTextArray[index] = bilingualSubtitle ? `${lines[index]}\n${finalTranslatedLines[i]}` : finalTranslatedLines[i];
          }
        });

        let finalSubtitle = "";

        // 处理双语模式下的 SRT 和 VTT 字幕，则将内容转换为 .ass 格式
        if (bilingualSubtitle && (fileType === "srt" || fileType === "vtt")) {
          let subtitles = {};
          // 处理时间线和双语字幕的对齐
          contentIndices.forEach((index, i) => {
            // 提取 WebVTT/SRT 时间线，向上寻找有效的时间轴
            let timeLine = "";
            let searchIndex = index - 1;

            while (searchIndex >= 0) {
              if (VTT_SRT_TIME.test(lines[searchIndex])) {
                timeLine = lines[searchIndex];
                break;
              }
              searchIndex--;
            }

            if (!timeLine) return;

            const [startTime, endTime] = timeLine.split(" --> ");
            const assStartTime = convertTimeToAss(startTime.trim());
            const assEndTime = convertTimeToAss(endTime.trim());
            const key = `${assStartTime} --> ${assEndTime}`;

            // 根据 bilingualPosition 决定原文和译文的顺序
            const originalText = lines[index];
            const translatedText = finalTranslatedLines[i];

            // 根据位置设置字幕行
            const isOriginalFirst = bilingualPosition === "above";
            const firstText = isOriginalFirst ? originalText : translatedText;
            const secondText = isOriginalFirst ? translatedText : originalText;

            // 构建或更新字幕对象
            if (subtitles[key]) {
              subtitles[key].first += `\\N${firstText}`;
              subtitles[key].second += `\\N${secondText}`;
            } else {
              subtitles[key] = {
                first: `Dialogue: 0,${assStartTime},${assEndTime},Secondary,NTP,0000,0000,0000,,${firstText}`,
                second: `Dialogue: 0,${assStartTime},${assEndTime},Default,NTP,0000,0000,0000,,${secondText}`,
              };
            }
          });

          const assBody = Object.values(subtitles)
            .map(({ first, second }) => `${first}\n${second}`)
            .join("\n");

          finalSubtitle = `${assHeader}\n${assBody}`;
        } else {
          finalSubtitle = [...translatedTextArray.slice(0, contentIndices[0]), ...styleBlockLines, ...translatedTextArray.slice(contentIndices[0])].join("\n");
        }

        // Create language-specific file name for download
        const langLabel = currentTargetLang;
        const fileExtension = `.${getOutputFileExtension(fileType, bilingualSubtitle)}`;
        const fileName = fileNameSet || multipleFiles[0]?.name || "subtitle";
        const lastDotIndex = fileName.lastIndexOf(".");
        const fileNameWithoutExt = lastDotIndex !== -1 ? fileName.slice(0, lastDotIndex) : fileName;
        const downloadFileName = `${fileNameWithoutExt}_${langLabel}${fileExtension}`;

        // Always download in multi-language mode
        if (multiLanguageMode || multipleFiles.length > 1) {
          await downloadFile(finalSubtitle, downloadFileName);
        }

        if (!multiLanguageMode || (multiLanguageMode && currentTargetLang === targetLanguagesToUse[0])) {
          setTranslatedText(finalSubtitle);
        }

        if (multiLanguageMode && currentTargetLang !== targetLanguagesToUse[targetLanguagesToUse.length - 1]) {
          await delay(500);
        }
      } catch (error) {
        console.log(error);
        messageApi.open({
          type: "error",
          content: bilingualSubtitle
            ? `${error.message} ${tSubtitle("bilingualError")}`
            : `${error.message} ${sourceOptions.find((option) => option.value === currentTargetLang)?.label || currentTargetLang}  ${t("translationError")}`,
          duration: 5,
        });
      }
    }
  };

  const handleMultipleTranslate = async () => {
    const isValid = await validateTranslate();
    if (!isValid) {
      return;
    }

    if (multipleFiles.length === 0) {
      messageApi.error(tSubtitle("noFileUploaded"));
      return;
    }

    setTranslateInProgress(true);
    setProgressPercent(0);

    for (let i = 0; i < multipleFiles.length; i++) {
      const currentFile = multipleFiles[i];
      await new Promise<void>((resolve) => {
        readFile(currentFile, async (text) => {
          await performTranslation(text, currentFile.name, i, multipleFiles.length);
          await delay(1500);
          resolve();
        });
      });
    }

    //setMultipleFiles([]);
    setTranslateInProgress(false);
    messageApi.success(tSubtitle("translationComplete"), 10);
  };

  const handleExportFile = () => {
    const uploadFileName = multipleFiles[0]?.name;
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);

    // 如果 bilingualSubtitle 为 true，则优先使用 .ass
    const fileExtension = `.${getOutputFileExtension(fileType, bilingualSubtitle)}`;

    // 如果文件名存在，查找最后一个点的位置，如果存在则替换扩展名，否则直接添加
    const fileName = uploadFileName ? uploadFileName.replace(/\.[^/.]+$/, "") + fileExtension : `subtitle${fileExtension}`;
    downloadFile(translatedText, fileName);
    return fileName;
  };

  const handleExtractText = () => {
    if (!sourceText.trim()) {
      messageApi.error(tSubtitle("noSourceText"));
      return;
    }
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      messageApi.error(tSubtitle("unsupportedSub"));
    }
    const { contentLines } = filterSubLines(lines, fileType);
    const extractedText = contentLines.join("\n").trim();

    if (!extractedText) {
      messageApi.error(tSubtitle("noExtractedText"));
      return;
    }

    setExtractedText(extractedText);
    copyToClipboard(extractedText, messageApi, tSubtitle("textExtracted"));
  };

  const config = getCurrentConfig();

  return (
    <Spin spinning={isFileProcessing} size="large">
      {contextHolder}
      <Dragger
        customRequest={({ file }) => handleFileUpload(file as File)}
        accept=".srt,.ass,.vtt,.lrc"
        multiple={!singleFileMode}
        showUploadList
        beforeUpload={singleFileMode ? resetUpload : undefined}
        onRemove={handleUploadRemove}
        onChange={handleUploadChange}
        fileList={fileList}>
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{tSubtitle("dragAndDropText")}</p>
      </Dragger>
      {uploadMode === "single" && (
        <TextArea
          placeholder={tSubtitle("pasteUploadContent")}
          value={sourceStats.displayText}
          onChange={!sourceStats.isTooLong ? (e) => setSourceText(e.target.value) : undefined}
          rows={8}
          className="mt-1 mb-2"
          allowClear
          readOnly={sourceStats.isTooLong}
        />
      )}
      {sourceText && (
        <Paragraph type="secondary" className="-mt-1 mb-2">
          {t("inputStatsTitle")}: {sourceStats.charCount} {t("charLabel")}, {sourceStats.lineCount} {t("lineLabel")}
        </Paragraph>
      )}
      <Form layout="inline" labelWrap className="gap-1 mb-2">
        <Form.Item label={t("translationAPI")}>
          <Space.Compact>
            <Select showSearch value={translationMethod} onChange={(e) => setTranslationMethod(e)} options={categorizedOptions} style={{ minWidth: 150 }} />
            {config?.apiKey !== undefined && translationMethod !== "llm" && (
              <Tooltip title={`${t("enter")} ${findMethodLabel(translationMethod)} API Key`}>
                <Input.Password
                  autoComplete="off"
                  placeholder={`API Key ${findMethodLabel(translationMethod)} `}
                  value={config.apiKey}
                  onChange={(e) => handleConfigChange(translationMethod, "apiKey", e.target.value)}
                />
              </Tooltip>
            )}
          </Space.Compact>
        </Form.Item>
        <Form.Item label={t("sourceLanguage")}>
          <Select
            value={sourceLanguage}
            onChange={(e) => handleLanguageChange("source", e)}
            options={sourceOptions}
            showSearch
            placeholder={t("selectSourceLanguage")}
            optionFilterProp="children"
            filterOption={(input, option) => filterLanguageOption({ input, option })}
            style={{ minWidth: 120 }}
          />
        </Form.Item>
        <Space wrap>
        <Form.Item label={t("targetLanguage")}>
          {!multiLanguageMode ? (
            <Select
              value={targetLanguage}
              onChange={(e) => handleLanguageChange("target", e)}
              options={targetOptions}
              showSearch
              placeholder={t("selectTargetLanguage")}
              optionFilterProp="children"
              filterOption={(input, option) => filterLanguageOption({ input, option })}
              style={{ minWidth: 120 }}
            />
          ) : (
            <Select
              mode="multiple"
              allowClear
              value={target_langs}
              onChange={(e) => setTarget_langs(e)}
              options={targetOptions}
              placeholder={t("selectMultiTargetLanguages")}
              optionFilterProp="children"
              filterOption={(input, option) => filterLanguageOption({ input, option })}
              style={{ minWidth: 300 }}
            />
          )}
        </Form.Item>
        {isClient && translationMethod === "server" && (
          <Form.Item label="Model">
            <Space wrap>
              <Select
                showSearch
                loading={modelsLoading}
                placeholder="Select server model"
                style={{ minWidth: 260 }}
                value={(getCurrentConfig() as any)?.model}
                onChange={(v) => handleConfigChange("server", "model", v)}
                options={serverModels.map((m) => ({ value: m.id, label: m.label }))}
                optionFilterProp="label"
              />
              <Button onClick={fetchServerModels}>Refresh</Button>
            </Space>
          </Form.Item>
        )}
        {isClient && translationMethod === "server" && (
          <Form.Item label="Processing">
            <Radio.Group
              value={serverJobMethod}
              onChange={(e) => setServerJobMethod(e.target.value)}
              optionType="button"
              buttonStyle="solid"
              size="small">
              <Radio.Button value="single">Single</Radio.Button>
              <Radio.Button value="batch">Batch</Radio.Button>
            </Radio.Group>
          </Form.Item>
        )}
        {isClient && translationMethod === "server" && (
          <Form.Item label="Context">
            <Tooltip title="Use neighboring lines as context for higher quality">
              <Checkbox checked={serverUseContext} onChange={(e) => setServerUseContext(e.target.checked)}>Context-aware</Checkbox>
            </Tooltip>
          </Form.Item>
        )}
        </Space>
        <Form.Item label={tSubtitle("subtitleFormat")}>
          <Space wrap>
            <Tooltip title={tSubtitle("bilingualTooltip")}>
              <Checkbox checked={bilingualSubtitle} onChange={(e) => setBilingualSubtitle(e.target.checked)}>
                {tSubtitle("bilingual")}
              </Checkbox>
            </Tooltip>
            {bilingualSubtitle && (
              <Radio.Group value={bilingualPosition} onChange={(e) => setBilingualPosition(e.target.value)} optionType="button" buttonStyle="solid" size="small">
                <Radio.Button value="above">{tSubtitle("translationAbove")}</Radio.Button>
                <Radio.Button value="below">{tSubtitle("translationBelow")}</Radio.Button>
              </Radio.Group>
            )}
          </Space>
        </Form.Item>
        <Form.Item label={t("advancedSettings")}>
          <Space wrap>
            <Tooltip title={t("singleFileModeTooltip")}>
              <Checkbox checked={singleFileMode} onChange={(e) => setSingleFileMode(e.target.checked)}>
                {t("singleFileMode")}
              </Checkbox>
            </Tooltip>
            <Tooltip title={t("useCacheTooltip")}>
              <Checkbox checked={useCache} onChange={(e) => setUseCache(e.target.checked)}>
                {t("useCache")}
              </Checkbox>
            </Tooltip>
            {LLM_MODELS.includes(translationMethod) && (
              <Tooltip title={t("contextAwareTranslationTooltip")}>
                <Checkbox checked={contextAwareTranslation} onChange={(e) => setContextAwareTranslation(e.target.checked)}>
                  {t("contextAwareTranslation")}
                </Checkbox>
              </Tooltip>
            )}
            <Tooltip title={t("multiLanguageModeTooltip")}>
              <Switch checked={multiLanguageMode} onChange={(checked) => setMultiLanguageMode(checked)} checkedChildren={t("multiLanguageMode")} unCheckedChildren={t("singleLanguageMode")} />
            </Tooltip>
          </Space>
        </Form.Item>
      </Form>
      <Flex gap="small">
        <Button
          type="primary"
          block
          onClick={async () =>
            translationMethod === "server"
              ? (selectedServerFileIds && selectedServerFileIds.length > 0
                  ? (await confirmOverwriteIfNeeded()) &&
                    handleServerTranslate(selectedServerFileIds, {
                      bilingualSubtitle,
                      bilingualPosition,
                    })
                  : messageApi.error("Please select a server file"))
              : uploadMode === "single"
              ? handleTranslate(performTranslation, sourceText, contextAwareTranslation)
              : handleMultipleTranslate()
          }
          disabled={translateInProgress}>
          {multiLanguageMode ? `${t("translate")} | ${t("totalLanguages")}${target_langs.length || 0}` : t("translate")}
        </Button>
        <Tooltip title={t("exportSettingTooltip")}>
          <Button
            icon={<DownloadOutlined />}
            onClick={async () => {
              await exportSettings();
            }}>
            {t("exportSetting")}
          </Button>
        </Tooltip>
        <Tooltip title={t("importSettingTooltip")}>
          <Button
            icon={<UploadOutlined />}
            onClick={async () => {
              await importSettings();
            }}>
            {t("importSetting")}
          </Button>
        </Tooltip>
        <Tooltip title={t("resetUploadTooltip")}>
          <Button
            onClick={() => {
              resetUpload();
              setTranslatedText("");
              messageApi.success(t("resetUploadSuccess"));
            }}>
            {t("resetUpload")}
          </Button>
        </Tooltip>
        {translationMethod === "server" && (
          <Tooltip title={"Upload selected files to server DB"}>
            <Button onClick={uploadToServer}>Upload to Server</Button>
          </Tooltip>
        )}
        {uploadMode === "single" && sourceText && <Button onClick={handleExtractText}>{t("extractText")}</Button>}
      </Flex>
      {isClient && translationMethod === "server" && (
        <Card className="mt-3" title={"Server Files"} extra={<Button onClick={fetchServerFiles}>Refresh</Button>}>
          <Space wrap>
            <Select
              mode="multiple"
              maxTagCount="responsive"
              style={{ minWidth: 420 }}
              placeholder={"Select one or more files saved on server"}
              value={selectedServerFileIds}
              onChange={(v) => setSelectedServerFileIds(v)}
              options={serverFiles.map((f) => ({
                value: f.id,
                label: `${f.originalName || f.title} · ${new Date(f.createdAt).toLocaleString()} · ${f._count?.segments || 0} segs`,
              }))}
              showSearch
              optionFilterProp="label"
            />
          </Space>
        </Card>
      )}
      {isClient && translationMethod === "server" && (
        <Card
          className="mt-3"
          title={"Batch Jobs"}
          extra={
            <Space>
              <Button onClick={fetchJobs}>Refresh</Button>
              <Checkbox checked={autoJobs} onChange={(e) => setAutoJobs(e.target.checked)}>
                Auto 1min
              </Checkbox>
            </Space>
          }>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(160px,1fr) 1fr 110px 90px 110px',
              gap: 8,
              alignItems: 'center',
            }}>
            <strong>File</strong>
            <strong>Job ID</strong>
            <strong>Status</strong>
            <strong>Progress</strong>
            <span></span>
            {jobs.map((j) => {
              const fileName = (j && j.file && (j.file.originalName || j.file.title)) || '—';
              return (
                <React.Fragment key={j.id}>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={fileName}>
                    {fileName}
                  </span>
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }} title={j.id}>
                    {j.id}
                  </span>
                  <span>{j.status}</span>
                  <span>{j.progress}%</span>
                  <Button
                    size="small"
                    onClick={async () => {
                      try {
                        await fetch(`${baseUrl}/api/translate/jobs/${j.id}/poll`, {
                          method: 'POST',
                          headers: { Authorization: `Bearer ${token}` },
                        });
                        await fetchJobs();
                      } catch (err) {
                        console.error(err);
                      }
                    }}>
                    Poll Now
                  </Button>
                </React.Fragment>
              );
            })}
          </div>
        </Card>
      )}

      {isClient && translationMethod === "server" && (
        <Card
          className="mt-3"
          title={"DB Viewer"}
          extra={
            <Space>
              <Button onClick={fetchViewerSegs}>Refresh</Button>
            </Space>
          }>
          <Space wrap style={{ marginBottom: 8 }}>
            <Select
              style={{ minWidth: 360 }}
              placeholder={"Select a file to view"}
              value={viewerFileId || undefined}
              onChange={(v) => setViewerFileId(v)}
              options={serverFiles.map((f) => ({ value: f.id, label: `${f.originalName || f.title} · ${(f._count?.segments || 0)} segs` }))}
              showSearch
              optionFilterProp="label"
            />
            <Select
              value={viewerLang}
              onChange={(v) => setViewerLang(v)}
              options={[
                { value: "original", label: "Original" },
                { value: "japanese", label: "Japanese" },
                { value: "english", label: "English" },
                { value: "chinese", label: "Chinese" },
              ]}
              style={{ minWidth: 160 }}
            />
          </Space>
          <Table
            size="small"
            loading={viewerLoading}
            rowKey={(r) => r.id}
            dataSource={viewerSegs}
            pagination={{ pageSize: 20, showSizeChanger: true }}
            columns={[
              { title: "#", dataIndex: "index", width: 70 },
              { title: "Start", dataIndex: "startMs", width: 120, render: (v: number) => msToSrt(v) },
              { title: "End", dataIndex: "endMs", width: 120, render: (v: number) => msToSrt(v) },
              {
                title: viewerLang.charAt(0).toUpperCase() + viewerLang.slice(1),
                dataIndex: viewerLang,
                render: (_: any, row: any) => row?.[viewerLang] || (viewerLang === "original" ? row?.original : ""),
              },
            ]}
          />
        </Card>
      )}
      {uploadMode === "single" && (
        <>
          {translatedText && !(multiLanguageMode && target_langs.length > 1) && (
            <Card
              title={t("translationResult")}
              className="mt-3"
              extra={
                <Space wrap>
                  <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(translatedText, messageApi)}>
                    {t("copy")}
                  </Button>
                  <Button
                    icon={<DownloadOutlined />}
                    onClick={() => {
                      const fileName = handleExportFile();
                      messageApi.success(`${t("exportedFile")}: ${fileName}`);
                    }}>
                    {t("exportFile")}
                  </Button>
                </Space>
              }>
              <TextArea value={resultStats.displayText} rows={10} readOnly />
              <Paragraph type="secondary" className="-mb-2">
                {t("outputStatsTitle")}: {resultStats.charCount} {t("charLabel")}, {resultStats.lineCount} {t("lineLabel")}
              </Paragraph>
            </Card>
          )}
          {extractedText && (
            <Card
              title={t("extractedText")}
              className="mt-3"
              extra={
                <Button icon={<CopyOutlined />} onClick={() => copyToClipboard(extractedText, messageApi)}>
                  {t("copy")}
                </Button>
              }>
              <TextArea value={extractedText} rows={10} readOnly />
            </Card>
          )}
        </>
      )}
      {translateInProgress && (
        <Modal title={t("translating")} open={translateInProgress} footer={null} closable={false}>
          <div className="text-center">
            <Progress type="circle" percent={Math.round(progressPercent * 100) / 100} />
            {multiLanguageMode && target_langs.length > 0 && <p className="mt-4">{`${t("multiTranslating")} ${target_langs.length}`}</p>}
          </div>
        </Modal>
      )}
    </Spin>
  );
};

export default SubtitleTranslator;
