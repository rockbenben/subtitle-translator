"use client";

import React, { useState, useEffect } from "react";
import { Flex, Card, Button, Typography, Input, Upload, Form, Space, App, Modal, Checkbox, Progress, Tooltip, Radio, Spin, Row, Col, Divider } from "antd";
import {
  CopyOutlined,
  DownloadOutlined,
  InboxOutlined,
  UploadOutlined,
  SettingOutlined,
  DownOutlined,
  UpOutlined,
  FileTextOutlined,
  ClearOutlined,
  FormatPainterOutlined,
  GlobalOutlined,
} from "@ant-design/icons";
import { splitTextIntoLines, downloadFile, splitBySpaces, getErrorMessage } from "@/app/utils";
import { VTT_SRT_TIME, LRC_TIME_REGEX, detectSubtitleFormat, getOutputFileExtension, filterSubLines, convertTimeToAss, assHeader } from "./subtitleUtils";
import { LLM_MODELS } from "@/app/lib/translation";
import { useLanguageOptions } from "@/app/components/languages";
import LanguageSelector from "@/app/components/LanguageSelector";
import TranslationAPISelector from "@/app/components/TranslationAPISelector";
import { useTranslationContext } from "@/app/components/TranslationContext";
import ResultCard from "@/app/components/ResultCard";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useTranslations } from "next-intl";

const { TextArea } = Input;
const { Dragger } = Upload;
const { Paragraph } = Typography;

const SubtitleTranslator = () => {
  const tSubtitle = useTranslations("subtitle");
  const t = useTranslations("common");

  const { sourceOptions } = useLanguageOptions();
  const { copyToClipboard } = useCopyToClipboard();
  // ... useFileUpload destructuring ...
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
  // ... useTranslationContext destructuring ...
  const {
    exportSettings,
    importSettings,
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
    removeChars,
    setRemoveChars,
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
  } = useTranslationContext();
  const { message } = App.useApp();

  const sourceStats = useTextStats(sourceText);
  const resultStats = useTextStats(translatedText);

  const [bilingualSubtitle, setBilingualSubtitle] = useLocalStorage("subtitleBilingualSubtitle", false);
  const [bilingualPosition, setBilingualPosition] = useLocalStorage("subtitleBilingualPosition", "below"); // 'above' or 'below'
  const [contextAwareTranslation, setContextAwareTranslation] = useLocalStorage("subtitleContextAwareTranslation", true); // 上下文感知翻译开关
  const [showAdvancedPanel, setShowAdvancedPanel] = useState(true);

  useEffect(() => {
    setExtractedText("");
    setTranslatedText("");
  }, [sourceText, setExtractedText, setTranslatedText]);

  const performTranslation = async (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number, documentType?: "subtitle" | "markdown" | "generic") => {
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
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
      message.error(t("noTargetLanguage"));
      return;
    }

    // For each target language, perform translation
    for (const currentTargetLang of targetLanguagesToUse) {
      try {
        // Translate content using the specific target language
        const translatedLines = await translateContent(contentLines, translationMethod, currentTargetLang, fileIndex, totalFiles, contextAwareTranslation ? "subtitle" : undefined);

        // Copy array to avoid modifying the original lines
        const translatedTextArray = [...lines];

        contentIndices.forEach((index, i) => {
          if (fileType === "ass") {
            const originalLine = lines[index];
            const prefix = originalLine.substring(0, originalLine.split(",", assContentStartIndex).join(",").length + 1);
            if (bilingualSubtitle) {
              const translatedLine = translatedLines[i];
              translatedTextArray[index] =
                bilingualPosition === "below" ? `${originalLine}\\N${translatedLine}` : `${prefix}${translatedLine}\\N${originalLine.split(",").slice(assContentStartIndex).join(",").trim()}`;
            } else {
              translatedTextArray[index] = `${prefix}${translatedLines[i]}`;
            }
          } else if (fileType === "lrc") {
            const originalLine = lines[index];
            // 提取原始行中的所有时间标记
            const timeMatches = originalLine.match(new RegExp(LRC_TIME_REGEX.source, "g")) || [];
            const timePrefix = timeMatches.join("");

            if (bilingualSubtitle) {
              const translatedLine = translatedLines[i];
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
              translatedTextArray[index] = `${timePrefix} ${translatedLines[i]}`;
            }
          } else {
            // 非 .ass 文件处理
            translatedTextArray[index] = bilingualSubtitle ? `${lines[index]}\n${translatedLines[i]}` : translatedLines[i];
          }
        });

        let finalSubtitle = "";

        // 处理双语模式下的 SRT 和 VTT 字幕，则将内容转换为 .ass 格式
        if (bilingualSubtitle && (fileType === "srt" || fileType === "vtt")) {
          const subtitles: Record<string, { first: string; second: string }> = {};
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
            const translatedText = translatedLines[i];

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

        // Remove specified characters from the final subtitle text (after all formatting is done)
        if (removeChars.trim()) {
          const charsToRemove = splitBySpaces(removeChars);
          charsToRemove.forEach((char) => {
            finalSubtitle = finalSubtitle.replaceAll(char, "");
          });
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
      } catch (error: unknown) {
        console.log(error);

        const errorMessage = getErrorMessage(error);
        const langLabel = sourceOptions.find((o) => o.value === currentTargetLang)?.label || currentTargetLang;
        const content = bilingualSubtitle ? `${errorMessage} ${tSubtitle("bilingualError")}` : `${errorMessage} ${langLabel} ${t("translationError")}`;

        message.error(content, 5);
      }
    }
  };

  const handleMultipleTranslate = async () => {
    const isValid = await validateTranslate();
    if (!isValid) {
      return;
    }

    if (multipleFiles.length === 0) {
      message.error(tSubtitle("noFileUploaded"));
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
    message.success(t("translationComplete"), 10);
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
      message.error(tSubtitle("noSourceText"));
      return;
    }
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
    }
    const { contentLines } = filterSubLines(lines, fileType);
    const extractedText = contentLines.join("\n").trim();

    if (!extractedText) {
      message.error(tSubtitle("noExtractedText"));
      return;
    }

    setExtractedText(extractedText);
    copyToClipboard(extractedText, tSubtitle("textExtracted"));
  };

  const config = getCurrentConfig();

  return (
    <Spin spinning={isFileProcessing} size="large">
      <Row gutter={[24, 24]}>
        {/* Left Column: Upload and Main Actions */}
        <Col xs={24} lg={14} xl={15}>
          <Card
            title={
              <Space>
                <InboxOutlined /> {t("sourceArea")}
              </Space>
            }
            extra={
              <Tooltip title={t("resetUploadTooltip")}>
                <Button
                  type="text"
                  danger
                  disabled={translateInProgress}
                  onClick={() => {
                    resetUpload();
                    setTranslatedText("");
                    message.success(t("resetUploadSuccess"));
                  }}
                  icon={<ClearOutlined />}
                  aria-label={t("resetUpload")}>
                  {t("resetUpload")}
                </Button>
              </Tooltip>
            }
            className="h-full shadow-sm">
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
              <p className="ant-upload-text">{t("dragAndDropText")}</p>
              <p className="ant-upload-hint">{t("supportedFormats")} .srt, .ass, .vtt, .lrc</p>
            </Dragger>

            {uploadMode === "single" && (
              <>
                <TextArea
                  placeholder={t("pasteUploadContent")}
                  value={sourceStats.isEditable ? sourceText : sourceStats.displayText}
                  onChange={sourceStats.isEditable ? (e) => setSourceText(e.target.value) : undefined}
                  rows={8}
                  className="mt-1"
                  allowClear
                  readOnly={!sourceStats.isEditable}
                  aria-label={t("sourceArea")}
                />
                {sourceText && (
                  <Flex justify="end">
                    <Paragraph type="secondary">
                      {t("inputStatsTitle")}: {sourceStats.charCount} {t("charLabel")}, {sourceStats.lineCount} {t("lineLabel")}
                    </Paragraph>
                  </Flex>
                )}
              </>
            )}

            <Divider />

            <Flex gap="small" wrap className="mt-auto pt-4">
              <Button
                type="primary"
                size="large"
                icon={<GlobalOutlined spin={translateInProgress} />}
                className="flex-1 shadow-md"
                onClick={() => (uploadMode === "single" ? handleTranslate(performTranslation, sourceText, contextAwareTranslation ? "subtitle" : undefined) : handleMultipleTranslate())}
                disabled={translateInProgress}
                loading={translateInProgress}>
                {multiLanguageMode ? `${t("translate")} (${target_langs.length})` : t("translate")}
              </Button>

              {uploadMode === "single" && sourceText && (
                <Button size="large" onClick={handleExtractText} icon={<FormatPainterOutlined />}>
                  {t("extractText")}
                </Button>
              )}
            </Flex>
          </Card>
        </Col>

        {/* Right Column: Settings and Configuration */}
        <Col xs={24} lg={10} xl={9}>
          <Flex vertical gap="middle">
            {/* Translation Configuration */}
            <Card
              title={
                <Space>
                  <SettingOutlined /> {t("configuration")}
                </Space>
              }
              className="shadow-sm"
              extra={
                <Space>
                  <Tooltip title={t("importSettingTooltip")}>
                    <Button
                      type="text"
                      icon={<UploadOutlined />}
                      size="small"
                      disabled={translateInProgress}
                      onClick={async () => {
                        await importSettings();
                      }}
                    />
                  </Tooltip>
                  <Tooltip title={t("exportSettingTooltip")}>
                    <Button
                      type="text"
                      icon={<DownloadOutlined />}
                      size="small"
                      disabled={translateInProgress}
                      onClick={async () => {
                        await exportSettings();
                      }}
                    />
                  </Tooltip>
                </Space>
              }>
              <Form layout="vertical" className="w-full">
                {/* Language Selection */}
                <LanguageSelector
                  sourceLanguage={sourceLanguage}
                  targetLanguage={targetLanguage}
                  target_langs={target_langs}
                  multiLanguageMode={multiLanguageMode}
                  handleLanguageChange={handleLanguageChange}
                  setTarget_langs={setTarget_langs}
                  setMultiLanguageMode={setMultiLanguageMode}
                />

                {/* API Settings */}
                <TranslationAPISelector translationMethod={translationMethod} setTranslationMethod={setTranslationMethod} config={config} handleConfigChange={handleConfigChange} />

                {/* Subtitle Options */}
                <Form.Item label={tSubtitle("subtitleFormat")} style={{ marginTop: -12, marginBottom: 6 }}>
                  <div className="flex flex-col gap-2">
                    <Checkbox checked={bilingualSubtitle} onChange={(e) => setBilingualSubtitle(e.target.checked)}>
                      {tSubtitle("bilingual")}
                    </Checkbox>

                    {bilingualSubtitle && (
                      <Radio.Group value={bilingualPosition} onChange={(e) => setBilingualPosition(e.target.value)} optionType="button" buttonStyle="solid" size="small" className="w-full flex">
                        <Radio.Button value="above" className="flex-1 text-center">
                          {tSubtitle("translationAbove")}
                        </Radio.Button>
                        <Radio.Button value="below" className="flex-1 text-center">
                          {tSubtitle("translationBelow")}
                        </Radio.Button>
                      </Radio.Group>
                    )}
                  </div>
                </Form.Item>
              </Form>
            </Card>

            {/* Advanced Settings */}
            <Card
              title={
                <div className="cursor-pointer flex items-center justify-between w-full" onClick={() => setShowAdvancedPanel(!showAdvancedPanel)}>
                  <Space>
                    <SettingOutlined /> {t("advancedSettings")}
                  </Space>
                  {showAdvancedPanel ? <UpOutlined style={{ fontSize: "12px" }} /> : <DownOutlined style={{ fontSize: "12px" }} />}
                </div>
              }
              className="shadow-sm"
              styles={{
                body: {
                  display: showAdvancedPanel ? "block" : "none",
                },
              }}>
              <Form layout="vertical">
                <Row gutter={[16, 16]}>
                  <Col span={12}>
                    <Tooltip title={t("singleFileModeTooltip")}>
                      <Checkbox checked={singleFileMode} onChange={(e) => setSingleFileMode(e.target.checked)}>
                        {t("singleFileMode")}
                      </Checkbox>
                    </Tooltip>
                  </Col>
                  <Col span={12}>
                    <Tooltip title={t("useCacheTooltip")}>
                      <Checkbox checked={useCache} onChange={(e) => setUseCache(e.target.checked)}>
                        {t("useCache")}
                      </Checkbox>
                    </Tooltip>
                  </Col>
                  {LLM_MODELS.includes(translationMethod) && (
                    <Col span={24}>
                      <Tooltip title={t("contextAwareTranslationTooltip")}>
                        <Checkbox checked={contextAwareTranslation} onChange={(e) => setContextAwareTranslation(e.target.checked)}>
                          {t("contextAwareTranslation")}
                        </Checkbox>
                      </Tooltip>
                    </Col>
                  )}
                  <Col span={24}>
                    <Form.Item label={t("removeCharsAfterTranslation")}>
                      <Input
                        placeholder={`${t("example")}: ♪ <i> </i>`}
                        value={removeChars}
                        onChange={(e) => setRemoveChars(e.target.value)}
                        allowClear
                        aria-label={t("removeCharsAfterTranslation")}
                      />
                    </Form.Item>
                  </Col>
                </Row>
              </Form>
            </Card>
          </Flex>
        </Col>
      </Row>

      {/* Results Section */}
      {uploadMode === "single" && (translatedText || extractedText) && (
        <div className="mt-6">
          <Row gutter={[24, 24]}>
            {translatedText && !(multiLanguageMode && target_langs.length > 1) && (
              <Col xs={24} lg={extractedText ? 12 : 24}>
                <ResultCard
                  content={resultStats.displayText}
                  charCount={resultStats.charCount}
                  lineCount={resultStats.lineCount}
                  onCopy={() => copyToClipboard(translatedText)}
                  onExport={() => {
                    const fileName = handleExportFile();
                    message.success(`${t("exportedFile")}: ${fileName}`);
                  }}
                />
              </Col>
            )}

            {extractedText && (
              <Col xs={24} lg={translatedText ? 12 : 24}>
                <Card
                  title={
                    <Space>
                      <FileTextOutlined /> {t("extractedText")}
                    </Space>
                  }
                  className="shadow-sm h-full"
                  extra={
                    <Button type="text" icon={<CopyOutlined />} onClick={() => copyToClipboard(extractedText)}>
                      {t("copy")}
                    </Button>
                  }>
                  <TextArea value={extractedText} rows={10} readOnly aria-label={t("extractedText")} />
                </Card>
              </Col>
            )}
          </Row>
        </div>
      )}

      {/* Helper Actions */}

      {translateInProgress && (
        <Modal title={t("translating")} open={translateInProgress} footer={null} closable={false} centered width={300}>
          <div className="text-center py-4">
            <Progress type="circle" percent={Math.round(progressPercent * 100) / 100} />
            {multiLanguageMode && target_langs.length > 0 && <p className="mt-4 font-medium">{`${t("multiTranslating")} ${target_langs.length}`}</p>}
            <p className="mt-2 text-gray-500">{t("pleaseWait")}</p>
          </div>
        </Modal>
      )}
    </Spin>
  );
};

export default SubtitleTranslator;
