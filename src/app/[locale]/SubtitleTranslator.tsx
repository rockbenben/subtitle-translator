"use client";

import React, { useState } from "react";
import { Flex, Card, Button, Typography, Input, Upload, Form, Space, App, Tooltip, Segmented, Spin, Row, Col, Divider, Collapse, theme } from "antd";
import { CopyOutlined, InboxOutlined, SettingOutlined, FileTextOutlined, ClearOutlined, FormatPainterOutlined, GlobalOutlined, ImportOutlined, SaveOutlined, ControlOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useExportFilename } from "@/app/hooks/useExportFilename";

import { splitTextIntoLines, downloadFile, splitBySpaces, getErrorMessage, getFileTypePresetConfig } from "@/app/utils";
import { VTT_SRT_TIME, LRC_TIME_REGEX_GLOBAL, detectSubtitleFormat, getOutputFileExtension, filterSubLines, convertTimeToAss, assHeader, prepareAssForTranslation, restoreAssAfterTranslation } from "./subtitleUtils";
import { LLM_MODELS } from "@/app/lib/translation";
import { delay } from "@/app/hooks/translation";
import { useLanguageOptions } from "@/app/components/languages";
import LanguageSelector from "@/app/components/LanguageSelector";
import ApiStatusBlock from "@/app/components/ApiStatusBlock";
import ContextTranslationBlock from "@/app/components/ContextTranslationBlock";
import TranslationProgressModal from "@/app/components/TranslationProgressModal";
import { useTranslationContext } from "@/app/components/TranslationContext";
import ResultCard from "@/app/components/ResultCard";
import AdvancedTranslationSettings from "@/app/components/AdvancedTranslationSettings";
import TranslateFailurePanel from "@/app/components/TranslateFailurePanel";

import MultiLanguageSettingsModal from "@/app/components/MultiLanguageSettingsModal";
import SourceArea from "@/app/components/SourceArea";

const { TextArea } = Input;
const { Dragger } = Upload;
const { Text } = Typography;

const uploadFileTypes = getFileTypePresetConfig("subtitle");

const SubtitleTranslator = () => {
  const tSubtitle = useTranslations("SubtitleTranslator");
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
    translateBatch,
    runTranslation,
    sourceLanguage,
    targetLanguage,
    targetLanguages,
    setTargetLanguages,
    useCache,
    setUseCache,
    removeChars,
    setRemoveChars,
    multiLanguageMode,
    setMultiLanguageMode,
    translatedText,
    setTranslatedText,
    translateFailedCount,
    translateFailedLines,
    isTranslating,
    setIsTranslating,
    progressPercent,
    setProgressPercent,
    progressInfo,
    handleLanguageChange,
    handleSwapLanguages,
    validate,
    retryCount,
    setRetryCount,
    requestTimeoutSec,
    setRequestTimeoutSec,
  } = useTranslationContext();
  const { message } = App.useApp();
  const { token } = theme.useToken();
  const cardStyle: React.CSSProperties = { boxShadow: token.boxShadowTertiary };

  const sourceStats = useTextStats(sourceText);
  const resultStats = useTextStats(translatedText);

  // Export mode: 'translatedOnly' | 'bilingual' | 'both'
  const [exportMode, setExportMode] = useLocalStorage<"translatedOnly" | "bilingual" | "both">("subtitle-translator-exportMode", "translatedOnly");
  const [bilingualPosition, setBilingualPosition] = useLocalStorage("subtitle-translator-bilingualPosition", "below"); // 'above' or 'below'

  // Derived states for backward compatibility
  const needsBilingual = exportMode === "bilingual" || exportMode === "both";
  const showBilingualPosition = needsBilingual;
  const [contextAware, setContextAware] = useLocalStorage("subtitle-translator-contextAware", true); // 上下文感知翻译开关
  const [collapseKeys, setCollapseKeys] = useLocalStorage<string[]>("subtitle-translator-collapseKeys", ["SubtitleTranslator"]);
  const [multiLangModalOpen, setMultiLangModalOpen] = useState(false);
  // 提取出的纯文本预览 — 只在 SubtitleTranslator 和 MDTranslator 用,
  // 不应该污染 TranslationProvider 的共享 state。
  const [extractedText, setExtractedText] = useState("");
  const { customFileName, setCustomFileName, generateFileName } = useExportFilename("subtitle-translator");

  // 源文本变化时复位 extracted/translated 预览。用 render-time pattern 而非
  // useEffect+setState (react-hooks/set-state-in-effect 禁止后者)。
  const [prevSourceText, setPrevSourceText] = useState(sourceText);
  if (prevSourceText !== sourceText) {
    setPrevSourceText(sourceText);
    setExtractedText("");
    setTranslatedText("");
  }

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
    const targetLanguagesToUse = multiLanguageMode ? targetLanguages : [targetLanguage];

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
          const timeMatches = originalLine.match(LRC_TIME_REGEX_GLOBAL) || [];
          const timePrefix = timeMatches.join("");

          if (isBilingual) {
            const translatedLine = translatedLines[i];
            const originalContent = originalLine.replace(LRC_TIME_REGEX_GLOBAL, "").trim();

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

    // ASS 标签保护：翻译前剥离覆盖标签和 \N，翻译后还原
    const isAss = fileType === "ass";
    const { cleanLines, tagMaps } = isAss ? prepareAssForTranslation(contentLines) : { cleanLines: contentLines, tagMaps: [] };

    // For each target language, perform translation
    for (const currentTargetLang of targetLanguagesToUse) {
      try {
        // Translate content using the specific target language
        const rawTranslatedLines = await translateBatch(cleanLines, translationMethod, currentTargetLang, fileIndex, totalFiles, contextAware ? "subtitle" : undefined);
        const translatedLines = isAss ? restoreAssAfterTranslation(rawTranslatedLines, tagMaps) : rawTranslatedLines;

        // Generate file name base
        const langLabel = currentTargetLang;
        const fileName = fileNameSet || multipleFiles[0]?.name || "subtitle";
        const translatedOnlyExt = getOutputFileExtension(fileType, false);
        const bilingualExt = getOutputFileExtension(fileType, true);

        // Handle different export modes
        if (exportMode === "both") {
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
        console.error(error);

        const errorMessage = getErrorMessage(error);
        const langLabel = sourceOptions.find((o) => o.value === currentTargetLang)?.label || currentTargetLang;
        const content = needsBilingual ? `${errorMessage} ${tSubtitle("bilingualError")}` : `${errorMessage} ${langLabel} ${t("translationError")}`;

        message.error(content, 60);
      }
    }

    // Show success message after all languages completed (for single file multi-language mode)
    if (multiLanguageMode && targetLanguagesToUse.length > 1 && multipleFiles.length <= 1) {
      const fileCount = exportMode === "both" ? targetLanguagesToUse.length * 2 : targetLanguagesToUse.length;
      message.success(`${t("translationExported")} (${fileCount} ${t("exportedFile")})`);
    }
  };

  const handleMultipleTranslate = async () => {
    if (multipleFiles.length === 0) {
      message.error(tSubtitle("noFileUploaded"));
      return;
    }

    // validate 不再自管 isTranslating, 这里用 try/finally 兜底,
    // 让 progress modal 在 test ping → 文件循环之间保持连续可见。
    setIsTranslating(true);
    setProgressPercent(0);

    try {
      const isValid = await validate();
      if (!isValid) return;

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
      message.success(t("translationExported"), 10);
    } finally {
      setIsTranslating(false);
    }
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
                  disabled={isTranslating}
                  onClick={() => {
                    resetUpload();
                    setTranslatedText("");
                    message.success(t("resetUploadSuccess"));
                  }}
                  icon={<ClearOutlined />}
                  aria-label={t("clearAll")}>
                  {t("clearAll")}
                </Button>
              </Tooltip>
            }
            style={cardStyle}>
            <Dragger
              customRequest={({ file }) => handleFileUpload(file as File)}
              accept={uploadFileTypes.accept}
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
              <p className="ant-upload-hint">
                {t("supportedFormats")} {uploadFileTypes.label}
              </p>
            </Dragger>

            {uploadMode === "single" && (
              <SourceArea
                sourceText={sourceText}
                setSourceText={setSourceText}
                stats={sourceStats}
                placeholder={t("pasteUploadContent")}
                ariaLabel={t("sourceArea")}
                className="mt-1"
              />
            )}

            <Divider />

            <Flex gap="small" wrap className="mt-auto pt-4">
              <Button
                type="primary"
                size="large"
                icon={<GlobalOutlined spin={isTranslating} />}
                className="flex-1"
                onClick={() => (uploadMode === "single" ? runTranslation(performTranslation, sourceText, contextAware ? "subtitle" : undefined) : handleMultipleTranslate())}
                disabled={isTranslating}
                loading={isTranslating}>
                {multiLanguageMode ? `${t("translate")} (${targetLanguages.length})` : t("translate")}
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
            style={cardStyle}
            extra={
              <Space>
                <Tooltip title={t("exportSettingTooltip")}>
                  <Button
                    type="text"
                    icon={<SaveOutlined />}
                    size="small"
                    disabled={isTranslating}
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
                    disabled={isTranslating}
                    onClick={async () => {
                      await importSettings();
                    }}
                    aria-label={t("importSettingTooltip")}
                  />
                </Tooltip>
                <Tooltip title={t("batchEditMultiLangTooltip")}>
                  <Button type="text" icon={<GlobalOutlined />} size="small" disabled={isTranslating} onClick={() => setMultiLangModalOpen(true)} aria-label={t("batchEditMultiLangTooltip")} />
                </Tooltip>
              </Space>
            }>
            <Form layout="vertical" className="w-full !mb-3">
              <LanguageSelector
                sourceLanguage={sourceLanguage}
                targetLanguage={targetLanguage}
                targetLanguages={targetLanguages}
                multiLanguageMode={multiLanguageMode}
                handleLanguageChange={handleLanguageChange}
                handleSwapLanguages={handleSwapLanguages}
                setTargetLanguages={setTargetLanguages}
                setMultiLanguageMode={setMultiLanguageMode}
              />
            </Form>

            <ApiStatusBlock disabled={isTranslating} />

            {LLM_MODELS.includes(translationMethod) && (
              <ContextTranslationBlock
                enabled={contextAware}
                onEnabledChange={setContextAware}
                disabled={isTranslating}
              />
            )}

            <Collapse
              ghost
              size="small"
              activeKey={collapseKeys}
              onChange={(keys) => setCollapseKeys(typeof keys === "string" ? [keys] : keys)}
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
                    <div
                      style={{
                        padding: token.paddingSM,
                        background: "transparent",
                        border: `1px solid ${token.colorBorderSecondary}`,
                        borderRadius: token.borderRadiusLG,
                        display: "flex",
                        flexDirection: "column",
                        gap: token.marginXS,
                      }}>
                      <Segmented
                        block
                        size="small"
                        value={exportMode}
                        onChange={(value) => setExportMode(value as "translatedOnly" | "bilingual" | "both")}
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
                      requestTimeoutSec={requestTimeoutSec}
                      setRequestTimeoutSec={setRequestTimeoutSec}
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

      {/* Partial-failure panel: auto-retried once, still-failed lines kept originals */}
      <TranslateFailurePanel
        count={translateFailedCount}
        lines={translateFailedLines}
        disabled={isTranslating}
        onRetry={() => (uploadMode === "single" ? runTranslation(performTranslation, sourceText, contextAware ? "subtitle" : undefined) : handleMultipleTranslate())}
      />

      {/* Results Section */}
      {uploadMode === "single" && (translatedText || extractedText) && (
        <div className="mt-6">
          <Row gutter={[24, 24]}>
            {translatedText && !(multiLanguageMode && targetLanguages.length > 1) && (
              <Col xs={24} lg={extractedText ? 12 : 24}>
                <ResultCard
                  title={t("translationResult")}
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
                  className="h-full"
                  style={{ boxShadow: token.boxShadowTertiary }}
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

      <TranslationProgressModal
        open={isTranslating}
        percent={progressPercent}
        multiLanguageMode={multiLanguageMode}
        targetLanguageCount={targetLanguages.length}
        currentCount={progressInfo.current}
        totalCount={progressInfo.total}
      />

      <MultiLanguageSettingsModal
        open={multiLangModalOpen}
        onClose={() => setMultiLangModalOpen(false)}
        targetLanguages={targetLanguages}
        setTargetLanguages={setTargetLanguages}
        setMultiLanguageMode={setMultiLanguageMode}
      />
    </Spin>
  );
};

export default SubtitleTranslator;
