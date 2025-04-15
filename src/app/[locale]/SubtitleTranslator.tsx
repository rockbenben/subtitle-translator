"use client";

import React, { useState, useEffect } from "react";
import { Flex, Card, Button, Input, Upload, Form, Space, message, Select, Modal, Checkbox, Progress, Tooltip, Radio, Switch } from "antd";
import { CopyOutlined, DownloadOutlined, InboxOutlined } from "@ant-design/icons";
import { downloadFile, VTT_SRT_TIME, detectSubtitleFormat, getOutputFileExtension, isValidSubtitleLine, convertTimeToAss, assHeader } from "@/app/utils";
import { categorizedOptions } from "@/app/components/translateAPI";
import { useLanguageOptions, filterLanguageOption } from "@/app/components/languages";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import useTranslateData from "@/app/hooks/useTranslateData";
import { useTranslations } from "next-intl";

const { TextArea } = Input;
const { Dragger } = Upload;

const SubtitleTranslator = () => {
  const tSubtitle = useTranslations("subtitle");
  const t = useTranslations("common");

  const { sourceOptions, targetOptions } = useLanguageOptions();
  const { copyToClipboard } = useCopyToClipboard();
  const { fileList, multipleFiles, readFile, sourceText, setSourceText, uploadMode, singleFileMode, setSingleFileMode, handleFileUpload, handleUploadRemove, handleUploadChange, resetUpload } =
    useFileUpload();
  const {
    translationMethod,
    setTranslationMethod,
    translateContent,
    handleTranslate,
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
  } = useTranslateData();
  const [messageApi, contextHolder] = message.useMessage();

  const [bilingualSubtitle, setBilingualSubtitle] = useState(false);
  const [bilingualPosition, setBilingualPosition] = useState("below"); // 'above' or 'below'

  useEffect(() => {
    setExtractedText("");
    setTranslatedText("");
  }, [sourceText]);

  const filterContentLines = (lines: string[], fileType: string) => {
    const contentLines: string[] = [];
    const contentIndices: number[] = [];
    const styleBlockLines: string[] = [];
    let startExtracting = false;
    let assContentStartIndex = 9;
    let formatFound = false;

    if (fileType === "ass") {
      const eventIndex = lines.findIndex((line) => line.trim() === "[Events]");
      if (eventIndex !== -1) {
        for (let i = eventIndex; i < lines.length; i++) {
          if (lines[i].startsWith("Format:")) {
            const formatLine = lines[i];
            assContentStartIndex = formatLine.split(",").length - 1;
            formatFound = true;
            break;
          }
        }
      }

      if (!formatFound) {
        const dialogueLines = lines.filter((line) => line.startsWith("Dialogue:")).slice(0, 100);
        if (dialogueLines.length > 0) {
          const commaCounts = dialogueLines.map((line) => line.split(",").length - 1);
          assContentStartIndex = Math.min(...commaCounts);
        }
      }
    }

    lines.forEach((line, index) => {
      let isContent = false;
      const trimmedLine = line.trim();

      if (fileType === "srt" || fileType === "vtt") {
        if (!startExtracting) {
          const isTimecode = /^[\d:,]+ --> [\d:,]+$/.test(line) || /^[\d:.]+ --> [\d:.]+$/.test(line);
          if (isTimecode) {
            startExtracting = true;
          }
        }

        if (startExtracting) {
          if (fileType === "vtt") {
            const isTimecode = /^[\d:.]+ --> [\d:.]+$/.test(trimmedLine);
            const isWebVTTHeader = trimmedLine.startsWith("WEBVTT");
            const isComment = trimmedLine.startsWith("#");
            isContent = isValidSubtitleLine(line) && !isTimecode && !isWebVTTHeader && !isComment;
          } else {
            const isTimecode = /^[\d:,]+ --> [\d:,]+$/.test(trimmedLine);
            isContent = isValidSubtitleLine(line) && !isTimecode;
          }
        }
      } else if (fileType === "ass") {
        if (!startExtracting && trimmedLine.startsWith("Dialogue:")) {
          startExtracting = true;
        }

        if (startExtracting) {
          const parts = line.split(",");
          isContent = line.startsWith("Dialogue:") && parts.length > assContentStartIndex;
          if (isContent) {
            line = parts.slice(assContentStartIndex).join(",").trim();
          }
        }
      }

      if (isContent) {
        contentLines.push(line);
        contentIndices.push(index);
      }
    });

    return { contentLines, contentIndices, styleBlockLines };
  };

  const performTranslation = async (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number) => {
    const lines = sourceText.split("\n");
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

    const { contentLines, contentIndices, styleBlockLines } = filterContentLines(lines, fileType);

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
        const finalTranslatedLines = await translateContent(contentLines, translationMethod, currentTargetLang, fileIndex, totalFiles);
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
          } else {
            // 非 .ass 文件处理
            translatedTextArray[index] = bilingualSubtitle ? `${lines[index]}\n${finalTranslatedLines[i]}` : finalTranslatedLines[i];
          }
        });

        let finalSubtitle = "";

        // 处理非 .ass 文件的双语模式，将内容转换为 .ass 格式
        if (fileType !== "ass" && bilingualSubtitle) {
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
                first: `Dialogue: 0,${assStartTime},${assEndTime},Default,NTP,0000,0000,0000,,${firstText}`,
                second: `Dialogue: 0,${assStartTime},${assEndTime},Secondary,NTP,0000,0000,0000,,${secondText}`,
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
    const lines = sourceText.split("\n");
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
    const lines = sourceText.split("\n");
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      messageApi.error(tSubtitle("unsupportedSub"));
    }
    const { contentLines } = filterContentLines(lines, fileType);
    const extractedText = contentLines.join("\n");

    if (!extractedText) {
      messageApi.error(tSubtitle("noExtractedText"));
      return;
    }

    setExtractedText(extractedText);
    copyToClipboard(extractedText, messageApi, tSubtitle("textExtracted"));
  };

  const config = getCurrentConfig();

  return (
    <>
      {contextHolder}
      <Dragger
        customRequest={({ file }) => handleFileUpload(file as File)}
        accept=".srt,.ass,.vtt"
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
        <TextArea placeholder={tSubtitle("pasteUploadContent")} value={sourceText} onChange={(e) => setSourceText(e.target.value)} rows={8} className="mt-1 mb-2" allowClear />
      )}
      <Form layout="inline" labelWrap className="gap-1 mb-2">
        <Form.Item label={t("translationAPI")}>
          <Space.Compact>
            <Select showSearch value={translationMethod} onChange={(e) => setTranslationMethod(e)} options={categorizedOptions} style={{ minWidth: 150 }} />
            {config?.apiKey !== undefined && translationMethod !== "llm" && (
              <Input.Password
                autoComplete="off"
                placeholder={`${t("enter")} ${translationMethod} API Key`}
                value={config.apiKey}
                onChange={(e) => handleConfigChange(translationMethod, "apiKey", e.target.value)}
              />
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
            <Tooltip title={t("multiLanguageModeTooltip")}>
              <Switch checked={multiLanguageMode} onChange={(checked) => setMultiLanguageMode(checked)} checkedChildren={t("multiLanguageMode")} unCheckedChildren={t("singleLanguageMode")} />
            </Tooltip>
          </Space>
        </Form.Item>
      </Form>
      <Flex gap="small">
        <Button type="primary" block onClick={() => (uploadMode === "single" ? handleTranslate(performTranslation, sourceText) : handleMultipleTranslate())} disabled={translateInProgress}>
          {multiLanguageMode ? `${t("translate")} | ${t("totalLanguages")}${target_langs.length || 0}` : t("translate")}
        </Button>
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
        {uploadMode === "single" && sourceText && <Button onClick={handleExtractText}>{t("extractText")}</Button>}
      </Flex>
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
              <TextArea value={translatedText} rows={10} readOnly />
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
    </>
  );
};

export default SubtitleTranslator;
