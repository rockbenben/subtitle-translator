"use client";

import React, { useState, useEffect } from "react";
import { Flex, Card, Button, Typography, Input, Upload, Form, Space, App, Tooltip, Segmented, Spin, Row, Col, Divider, Switch, Collapse } from "antd";
import { CopyOutlined, InboxOutlined, SettingOutlined, FileTextOutlined, ClearOutlined, FormatPainterOutlined, GlobalOutlined, ImportOutlined, SaveOutlined, ControlOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useExportFilename } from "@/app/hooks/useExportFilename";

import { splitTextIntoLines, downloadFile, splitBySpaces, getErrorMessage } from "@/app/utils";
import { VTT_SRT_TIME, LRC_TIME_REGEX, detectSubtitleFormat, getOutputFileExtension, filterSubLines, convertTimeToAss, assHeader } from "./subtitleUtils";
import { LLM_MODELS } from "@/app/lib/translation";
import { useLanguageOptions } from "@/app/components/languages";
import LanguageSelector from "@/app/components/LanguageSelector";
import TranslationAPISelector from "@/app/components/TranslationAPISelector";
import TranslationProgressModal from "@/app/components/TranslationProgressModal";
import { useTranslationContext } from "@/app/components/TranslationContext";
import ResultCard from "@/app/components/ResultCard";
import AdvancedTranslationSettings from "@/app/components/AdvancedTranslationSettings";

import MultiLanguageSettingsModal from "@/app/components/MultiLanguageSettingsModal";

const { TextArea } = Input;
const { Dragger } = Upload;
const { Text } = Typography;

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
    retryCount,
    setRetryCount,
    retryTimeout,
    setRetryTimeout,
  } = useTranslationContext();
  const { message } = App.useApp();

  const sourceStats = useTextStats(sourceText);
  const resultStats = useTextStats(translatedText);

  // Export mode: 'translatedOnly' | 'bilingual' | 'both'
  const [subtitleExportMode, setSubtitleExportMode] = useLocalStorage<"translatedOnly" | "bilingual" | "both">("subtitleExportMode", "translatedOnly");
  const [bilingualPosition, setBilingualPosition] = useLocalStorage("subtitleBilingualPosition", "below"); // 'above' or 'below'

  // Derived states for backward compatibility
  const needsBilingual = subtitleExportMode === "bilingual" || subtitleExportMode === "both";
  const showBilingualPosition = needsBilingual;
  const [contextAwareTranslation, setContextAwareTranslation] = useLocalStorage("subtitleContextAwareTranslation", true); // 上下文感知翻译开关
  const [activeCollapseKeys, setActiveCollapseKeys] = useLocalStorage<string[]>("subtitleTranslatorCollapseKeys", ["subtitle"]);
  const [multiLangModalOpen, setMultiLangModalOpen] = useState(false);
  const { customFileName, setCustomFileName, generateFileName } = useExportFilename("subtitle");

  useEffect(() => {
    setExtractedText("");
    setTranslatedText("");
  }, [sourceText, setExtractedText, setTranslatedText]);

  const performTranslation = async (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number) => {
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
      return;
    }

    // Get content lines and assContentStartIndex from filterSubLines (eliminates duplicate calculation)
    const { contentLines, contentIndices, styleBlockLines, assContentStartIndex } = filterSubLines(lines, fileType);

    // Early return if no content to translate
    if (contentLines.length === 0) {
      message.warning(tSubtitle("noExtractedText"));
      return;
    }

    // Determine target languages to translate to
    const targetLanguagesToUse = multiLanguageMode ? target_langs : [targetLanguage];

    // If no target languages selected in multi-language mode, show error
    if (multiLanguageMode && targetLanguagesToUse.length === 0) {
      message.error(t("noTargetLanguage"));
      return;
    }

    // Helper function to generate subtitle output based on bilingual mode
    // Defined outside the loop to avoid repeated function creation
    const generateSubtitle = (isBilingual: boolean, translatedLines: string[]): string => {
      // Copy array to avoid modifying the original lines
      const translatedTextArray = [...lines];

      contentIndices.forEach((index, i) => {
        if (fileType === "ass") {
          const originalLine = lines[index];
          const prefix = originalLine.substring(0, originalLine.split(",", assContentStartIndex).join(",").length + 1);
          if (isBilingual) {
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

          if (isBilingual) {
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
          // SRT/VTT: direct replacement or bilingual format
          translatedTextArray[index] = isBilingual ? `${lines[index]}\n${translatedLines[i]}` : translatedLines[i];
        }
      });

      let finalSubtitle = "";

      // 处理双语模式下的 SRT 和 VTT 字幕，则将内容转换为 .ass 格式
      if (isBilingual && (fileType === "srt" || fileType === "vtt")) {
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

          const [startTime, endTime] = timeLine.split(" --> ").map((t) => t.trim().split(/\s/)[0]);
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

      return finalSubtitle;
    };

    // For each target language, perform translation
    for (const currentTargetLang of targetLanguagesToUse) {
      try {
        // Translate content using the specific target language
        const translatedLines = await translateContent(contentLines, translationMethod, currentTargetLang, fileIndex, totalFiles, contextAwareTranslation ? "subtitle" : undefined);

        // Generate file name base
        const langLabel = currentTargetLang;
        const fileName = fileNameSet || multipleFiles[0]?.name || "subtitle";
        const translatedOnlyExt = getOutputFileExtension(fileType, false);
        const bilingualExt = getOutputFileExtension(fileType, true);

        // Handle different export modes
        if (subtitleExportMode === "both") {
          // Generate and download both translated-only and bilingual versions
          const translatedOnlySubtitle = generateSubtitle(false, translatedLines);
          const bilingualSubtitle = generateSubtitle(true, translatedLines);

          const translatedOnlyFileName = generateFileName(fileName, langLabel, translatedOnlyExt);
          const bilingualFileName = generateFileName(fileName, langLabel, bilingualExt);

          await downloadFile(translatedOnlySubtitle, translatedOnlyFileName);
          await downloadFile(bilingualSubtitle, bilingualFileName);

          // Show success message for single file mode
          if (!multiLanguageMode && multipleFiles.length <= 1) {
            message.success(`${t("exportedFile")}: ${translatedOnlyFileName}, ${bilingualFileName}`);
          }

          // Display bilingual version in the result area (more comprehensive)
          if (!multiLanguageMode || (multiLanguageMode && currentTargetLang === targetLanguagesToUse[0])) {
            setTranslatedText(bilingualSubtitle);
          }
        } else {
          // Generate single version based on mode
          const finalSubtitle = generateSubtitle(needsBilingual, translatedLines);
          const fileExt = getOutputFileExtension(fileType, needsBilingual);
          const downloadFileName = generateFileName(fileName, langLabel, fileExt);

          // Always download in multi-language mode
          if (multiLanguageMode || multipleFiles.length > 1) {
            await downloadFile(finalSubtitle, downloadFileName);
          }

          if (!multiLanguageMode || (multiLanguageMode && currentTargetLang === targetLanguagesToUse[0])) {
            setTranslatedText(finalSubtitle);
          }
        }

        if (multiLanguageMode && currentTargetLang !== targetLanguagesToUse[targetLanguagesToUse.length - 1]) {
          await delay(500);
        }
      } catch (error: unknown) {
        console.log(error);

        const errorMessage = getErrorMessage(error);
        const langLabel = sourceOptions.find((o) => o.value === currentTargetLang)?.label || currentTargetLang;
        const content = needsBilingual ? `${errorMessage} ${tSubtitle("bilingualError")}` : `${errorMessage} ${langLabel} ${t("translationError")}`;

        message.error(content, 5);
      }
    }

    // Show success message after all languages completed (for single file multi-language mode)
    if (multiLanguageMode && targetLanguagesToUse.length > 1 && multipleFiles.length <= 1) {
      const fileCount = subtitleExportMode === "both" ? targetLanguagesToUse.length * 2 : targetLanguagesToUse.length;
      message.success(`${t("translationExported")} (${fileCount} ${t("exportedFile")})`);
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
    message.success(t("translationExported"), 10);
  };

  const handleExportFile = () => {
    const uploadFileName = multipleFiles[0]?.name || "subtitle";
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);

    // 如果 needsBilingual 为 true，则优先使用 .ass
    const fileExt = getOutputFileExtension(fileType, needsBilingual);

    // Use custom filename if set, otherwise use default pattern
    const fileName = generateFileName(uploadFileName, targetLanguage, fileExt);
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
    <Spin spinning={isFileProcessing} description="Please wait..." size="large">
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
            className="shadow-md border-transparent hover:shadow-lg transition-shadow duration-300">
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
                  <Flex justify="end" className="mt-2">
                    <Typography.Text type="secondary" className="!text-xs">
                      {sourceStats.charCount} {t("charLabel")} / {sourceStats.lineCount} {t("lineLabel")}
                    </Typography.Text>
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
          <Card
            title={
              <Space>
                <SettingOutlined /> {t("configuration")}
              </Space>
            }
            className="shadow-md border-transparent hover:shadow-lg transition-shadow duration-300"
            extra={
              <Space>
                <Tooltip title={t("exportSettingTooltip")}>
                  <Button
                    type="text"
                    icon={<SaveOutlined />}
                    size="small"
                    disabled={translateInProgress}
                    onClick={async () => {
                      await exportSettings();
                    }}
                    aria-label={t("exportSettingTooltip")}
                  />
                </Tooltip>
                <Tooltip title={t("importSettingTooltip")}>
                  <Button
                    type="text"
                    icon={<ImportOutlined />}
                    size="small"
                    disabled={translateInProgress}
                    onClick={async () => {
                      await importSettings();
                    }}
                    aria-label={t("importSettingTooltip")}
                  />
                </Tooltip>
                <Tooltip title={t("batchEditMultiLangTooltip")}>
                  <Button type="text" icon={<GlobalOutlined />} size="small" disabled={translateInProgress} onClick={() => setMultiLangModalOpen(true)} aria-label={t("batchEditMultiLangTooltip")} />
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

              {LLM_MODELS.includes(translationMethod) && (
                <Flex justify="space-between" align="center">
                  <Tooltip title={t("contextAwareTranslationTooltip")}>
                    <span>{t("contextAwareTranslation")}</span>
                  </Tooltip>
                  <Switch size="small" checked={contextAwareTranslation} onChange={setContextAwareTranslation} aria-label={t("contextAwareTranslation")} />
                </Flex>
              )}
            </Form>

            <Divider className="!my-3" />

            <Collapse
              ghost
              size="small"
              activeKey={activeCollapseKeys}
              onChange={(keys) => setActiveCollapseKeys(typeof keys === "string" ? [keys] : keys)}
              items={[
                {
                  key: "subtitle",
                  label: (
                    <Space>
                      <FileTextOutlined />
                      <Text strong>{tSubtitle("subtitleFormat")}</Text>
                    </Space>
                  ),
                  children: (
                    <Form layout="vertical" className="w-full">
                      <Form.Item className="!mb-0">
                        <div className="flex flex-col gap-2">
                          <Segmented
                            block
                            size="small"
                            value={subtitleExportMode}
                            onChange={(value) => setSubtitleExportMode(value as "translatedOnly" | "bilingual" | "both")}
                            options={[
                              { label: tSubtitle("translatedOnly"), value: "translatedOnly" },
                              { label: tSubtitle("bilingual"), value: "bilingual" },
                              {
                                label: (
                                  <Tooltip title={tSubtitle("bilingualTooltip")}>
                                    <div>{tSubtitle("exportBoth")}</div>
                                  </Tooltip>
                                ),
                                value: "both",
                              },
                            ]}
                          />

                          {showBilingualPosition && (
                            <Segmented
                              block
                              size="small"
                              value={bilingualPosition}
                              onChange={(value) => setBilingualPosition(value as "above" | "below")}
                              options={[
                                { label: tSubtitle("translationAbove"), value: "above" },
                                { label: tSubtitle("translationBelow"), value: "below" },
                              ]}
                            />
                          )}
                        </div>
                      </Form.Item>
                    </Form>
                  ),
                },
                {
                  key: "advanced",
                  label: (
                    <Space>
                      <ControlOutlined />
                      <Text strong>{t("advancedSettings")}</Text>
                    </Space>
                  ),
                  children: (
                    <AdvancedTranslationSettings
                      customFileName={customFileName}
                      setCustomFileName={setCustomFileName}
                      removeChars={removeChars}
                      setRemoveChars={setRemoveChars}
                      retryCount={retryCount}
                      setRetryCount={setRetryCount}
                      retryTimeout={retryTimeout}
                      setRetryTimeout={setRetryTimeout}
                      useCache={useCache}
                      setUseCache={setUseCache}
                      singleFileMode={singleFileMode}
                      setSingleFileMode={setSingleFileMode}
                    />
                  ),
                },
              ]}
            />
          </Card>
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
                  className="shadow-md border-transparent hover:shadow-lg transition-shadow duration-300 h-full"
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

      <TranslationProgressModal open={translateInProgress} percent={progressPercent} multiLanguageMode={multiLanguageMode} targetLanguageCount={target_langs.length} />

      <MultiLanguageSettingsModal
        open={multiLangModalOpen}
        onClose={() => setMultiLangModalOpen(false)}
        target_langs={target_langs}
        setTarget_langs={setTarget_langs}
        setMultiLanguageMode={setMultiLanguageMode}
      />
    </Spin>
  );
};

export default SubtitleTranslator;
