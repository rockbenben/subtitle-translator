"use client";

import React, { useState, useMemo, useRef } from "react";
import { Flex, Card, Button, Typography, Input, Upload, Form, Space, App, Tooltip, Segmented, Spin, Row, Col, Divider, Collapse, Alert, theme } from "antd";
import { CopyOutlined, InboxOutlined, SettingOutlined, FileTextOutlined, ClearOutlined, FormatPainterOutlined, GlobalOutlined, ImportOutlined, SaveOutlined, ControlOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useExportFilename } from "@/app/hooks/useExportFilename";

import { splitTextIntoLines, downloadFile, splitBySpaces, getErrorMessage, isAbortError, isCascadedAbort, isNetworkError, getFileTypePresetConfig } from "@/app/utils";
import {
  LRC_TIME_REGEX_GLOBAL,
  detectSubtitleFormat,
  getOutputFileExtension,
  filterSubLines,
  findTimeLineBefore,
  assHeader,
  prepareAssForTranslation,
  restoreAssAfterTranslation,
  vttToSrt,
  appendBilingualSuffix,
  buildAssBilingualBody,
  type BilingualFormat,
} from "./subtitleUtils";
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
    failedCount,
    failedLines,
    failedLangs,
    setFailedLangs,
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
  // bilingualOrder 标识双语拼接顺序:谁先呈现(SRT/VTT/ASS 多行 = 在上;LRC 行内 = 在前)
  type BilingualOrder = "originalFirst" | "translationFirst";
  const [bilingualOrder, setBilingualOrder] = useLocalStorage<BilingualOrder>("subtitle-translator-bilingualOrder", "originalFirst");
  const isOriginalFirst = bilingualOrder === "originalFirst";
  // SRT/VTT 双语输出格式选择,ASS=转换为 ASS(默认,保留旧行为),SRT=保留源格式叠两行
  // ASS/LRC 源文件忽略此选项(它们各自有专用的双语格式)
  const [bilingualFormat, setBilingualFormat] = useLocalStorage<BilingualFormat>("subtitle-translator-bilingualFormat", "ass");

  // 双语模式标志:exportMode 是 "bilingual" 或 "both" 时需要生成双语版本
  const needsBilingual = exportMode === "bilingual" || exportMode === "both";

  // 源格式检测:单文件看 sourceText,多文件用第一个文件的扩展名作代表
  // deps 只列实际读取的字段(firstFileName),避免整个 multipleFiles 数组引用变化触发重算
  const firstFileName = multipleFiles[0]?.name;
  const sourceFileType = useMemo<"ass" | "vtt" | "srt" | "lrc" | "error" | null>(() => {
    if (sourceText.trim()) {
      return detectSubtitleFormat(splitTextIntoLines(sourceText));
    }
    if (!firstFileName) return null;
    const ext = firstFileName.split(".").pop()?.toLowerCase();
    if (ext === "ass" || ext === "vtt" || ext === "srt" || ext === "lrc") return ext;
    return null;
  }, [sourceText, firstFileName]);

  // ASS/SRT 格式选项只在 SRT/VTT 源 + 双语时显示——ASS/LRC 源选项无法兑现,避免 UI 撒谎
  const showBilingualFormatChoice = needsBilingual && (sourceFileType === "srt" || sourceFileType === "vtt");
  const [contextAware, setContextAware] = useLocalStorage("subtitle-translator-contextAware", true); // 上下文感知翻译开关
  const [collapseKeys, setCollapseKeys] = useLocalStorage<string[]>("subtitle-translator-collapseKeys", ["SubtitleTranslator"]);
  const [multiLangModalOpen, setMultiLangModalOpen] = useState(false);
  // 提取出的纯文本预览 — 只在 SubtitleTranslator 和 MDTranslator 用,
  // 不应该污染 TranslationProvider 的共享 state。
  const [extractedText, setExtractedText] = useState("");
  // 批量翻译时统计失败文件数;handleMultipleTranslate 开始时重置,结束时读取以决定汇总消息。
  // 单文件模式(runTranslation 路径)下也会被写,但不会被读,无副作用。
  const failedFilesRef = useRef(0);
  // 记录最近一次写入 translatedText 时使用的扩展名,导出按钮按它生成文件名;
  // 避免用户翻译后改 exportMode/bilingualFormat,再点导出时扩展名跟内容错位
  const [translatedTextExt, setTranslatedTextExt] = useState<string | null>(null);
  // 标记 translatedText 是否是 exportMode="both" 的 bilingual 版本(需要 _bilingual 后缀);
  // both 模式下同时下载两份文件,如果两份 ext 相同(LRC/ASS/SRT+format=srt)文件名会冲突
  const [needsBilingualSuffix, setNeedsBilingualSuffix] = useState(false);
  // 记录 translatedText 对应的目标语种,handleExportFile 用它生成文件名;
  // 多语言模式下 translatedText 是 targetLangs[0] 而非主 targetLanguage,
  // 不记录的话导出文件名会标错语种(主 targetLanguage 跟 translatedText 内容不匹配)
  const [translatedTextLang, setTranslatedTextLang] = useState<string | null>(null);
  const { customFileName, setCustomFileName, generateFileName } = useExportFilename("subtitle-translator");

  // 源文本变化时复位 extracted/translated 预览。用 render-time pattern 而非
  // useEffect+setState (react-hooks/set-state-in-effect 禁止后者)。
  const [prevSourceText, setPrevSourceText] = useState(sourceText);
  if (prevSourceText !== sourceText) {
    setPrevSourceText(sourceText);
    setExtractedText("");
    setTranslatedText("");
    setTranslatedTextExt(null);
    setNeedsBilingualSuffix(false);
    setTranslatedTextLang(null);
  }

  const performTranslation = async (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number) => {
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
      failedFilesRef.current++;
      return;
    }

    // Get content lines and assContentStartIndex from filterSubLines (eliminates duplicate calculation)
    const { contentLines, contentIndices, assContentStartIndex } = filterSubLines(lines, fileType);

    // Early return if no content to translate
    if (contentLines.length === 0) {
      message.warning(tSubtitle("noExtractedText"));
      failedFilesRef.current++;
      return;
    }

    const targetLangs = multiLanguageMode ? targetLanguages : [targetLanguage];

    if (multiLanguageMode && targetLangs.length === 0) {
      message.error(t("noTargetLanguage"));
      failedFilesRef.current++;
      return;
    }

    // Helper function to generate subtitle output based on bilingual mode
    // Defined outside the loop to avoid repeated function creation
    const generateSubtitle = (isBilingual: boolean, translatedLines: string[]): string => {
      // null = "drop from final join" sentinel,用于 SRT/VTT 多行 cue 聚合后跳过补位行
      const outputLines: (string | null)[] = [...lines];

      contentIndices.forEach((index, i) => {
        if (fileType === "ass") {
          const originalLine = lines[index];
          const prefix = originalLine.substring(0, originalLine.split(",", assContentStartIndex).join(",").length + 1);
          if (isBilingual) {
            const translatedLine = translatedLines[i];
            // restoreAssAfterTranslation 给 translatedLine 重新补了行首覆盖标签(如 {\an8})。
            // 双语拼接时,leading tags 应该只在 \N 前的那一半出现一次——后半部分剥离避免标签重叠。
            const stripLeadingAssTags = (s: string) => s.replace(/^(\{[^}]*\})+/, "");
            const originalContent = originalLine.split(",").slice(assContentStartIndex).join(",").trim();
            outputLines[index] = isOriginalFirst
              ? `${originalLine}\\N${stripLeadingAssTags(translatedLine)}`
              : `${prefix}${translatedLine}\\N${stripLeadingAssTags(originalContent)}`;
          } else {
            outputLines[index] = `${prefix}${translatedLines[i]}`;
          }
        } else if (fileType === "lrc") {
          const originalLine = lines[index];
          // 提取原始行中的所有时间标记
          const timeMatches = originalLine.match(LRC_TIME_REGEX_GLOBAL) || [];
          const timePrefix = timeMatches.join("");

          if (isBilingual) {
            const translatedLine = translatedLines[i];
            const originalContent = originalLine.replace(LRC_TIME_REGEX_GLOBAL, "").trim();
            // LRC 是行内 / 分隔(非真上下),"原文在上"映射为"原文在前"(同 SRT/VTT 多行 cue 视觉一致)
            outputLines[index] = isOriginalFirst
              ? `${timePrefix} ${originalContent} / ${translatedLine}`
              : `${timePrefix} ${translatedLine} / ${originalContent}`;
          } else {
            outputLines[index] = `${timePrefix} ${translatedLines[i]}`;
          }
        } else {
          // SRT/VTT 双语:isOriginalFirst=true 时原文在上,反之译文在上
          if (isBilingual) {
            const orig = lines[index];
            const trans = translatedLines[i];
            outputLines[index] = isOriginalFirst ?`${orig}\n${trans}` : `${trans}\n${orig}`;
          } else {
            outputLines[index] = translatedLines[i];
          }
        }
      });

      let finalSubtitle = "";

      // SRT/VTT 双语统一按 format 选择:format=ass 转 ASS;format=srt 走下方原文叠加分支
      // (VTT 走 srt 分支时,后面再调 vttToSrt 把 .vtt 头/NOTE/时间码差异抹平)
      const shouldConvertToAssBilingual = isBilingual && bilingualFormat === "ass" && (fileType === "srt" || fileType === "vtt");
      if (shouldConvertToAssBilingual) {
        finalSubtitle = `${assHeader}\n${buildAssBilingualBody(lines, contentIndices, translatedLines, isOriginalFirst)}`;
      } else {
        // SRT/VTT 双语 + format=srt:按 cue 聚合,组内"所有原文" + "所有译文",
        // 避免多行 cue 出现"原-译-原-译"交错(逐行替换会留下的副作用)
        if (isBilingual && (fileType === "srt" || fileType === "vtt")) {
          type CueGroup = { firstIndex: number; origs: string[]; trans: string[] };
          const cueGroups = new Map<string, CueGroup>();

          contentIndices.forEach((index, i) => {
            const timeLine = findTimeLineBefore(lines, index);
            if (!timeLine) return;

            const existing = cueGroups.get(timeLine);
            if (existing) {
              existing.origs.push(lines[index]);
              existing.trans.push(translatedLines[i]);
              outputLines[index] = null; // cue 内非首行,从输出中移除
            } else {
              cueGroups.set(timeLine, { firstIndex: index, origs: [lines[index]], trans: [translatedLines[i]] });
            }
          });

          cueGroups.forEach((group) => {
            const allOrig = group.origs.join("\n");
            const allTrans = group.trans.join("\n");
            outputLines[group.firstIndex] = isOriginalFirst ?`${allOrig}\n${allTrans}` : `${allTrans}\n${allOrig}`;
          });
        }

        // filter 去掉 cue 聚合留下的 null 占位
        finalSubtitle = outputLines.filter((line): line is string => line !== null).join("\n");
      }

      // VTT 源 + 双语 + 选 SRT:把 VTT 头/NOTE 块/时间码分隔符差异抹平,真正变成 SRT
      if (isBilingual && bilingualFormat === "srt" && fileType === "vtt") {
        finalSubtitle = vttToSrt(finalSubtitle);
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

    // 跟踪当前文件是否有任何 lang 翻译失败;末尾合并到 failedFilesRef
    let hasFailedLang = false;

    for (const currentTargetLang of targetLangs) {
      try {
        // Translate content using the specific target language
        const rawTranslatedLines = await translateBatch(cleanLines, translationMethod, currentTargetLang, fileIndex, totalFiles, contextAware ? "subtitle" : undefined);
        const translatedLines = isAss ? restoreAssAfterTranslation(rawTranslatedLines, tagMaps) : rawTranslatedLines;

        // Generate file name base
        const langLabel = currentTargetLang;
        const fileName = fileNameSet || multipleFiles[0]?.name || "subtitle";

        // Handle different export modes
        if (exportMode === "both") {
          // Generate and download both translated-only and bilingual versions
          const translatedOnlySubtitle = generateSubtitle(false, translatedLines);
          const bilingualSubtitle = generateSubtitle(true, translatedLines);
          const translatedOnlyExt = getOutputFileExtension(fileType, false);
          const bilingualExt = getOutputFileExtension(fileType, true, bilingualFormat);

          const translatedOnlyFileName = generateFileName(fileName, langLabel, translatedOnlyExt);
          // bilingual 文件在扩展名前插 _bilingual 后缀,避免跟 translatedOnly 文件同名冲突
          // (ASS/LRC 源、SRT+format=srt 三种场景下两个 ext 相同,不区分会被浏览器覆盖下载)
          const bilingualFileName = appendBilingualSuffix(generateFileName(fileName, langLabel, bilingualExt));

          await downloadFile(translatedOnlySubtitle, translatedOnlyFileName);
          await downloadFile(bilingualSubtitle, bilingualFileName);

          // Show success message for single file mode
          if (!multiLanguageMode && multipleFiles.length <= 1) {
            message.success(`${t("exportedFile")}: ${translatedOnlyFileName}, ${bilingualFileName}`);
          }

          // 多语言模式下只把第一个语言写入 translatedText 作 UI 预览;
          // 其它语言已通过 downloadFile 自动落盘,UI 不再重复展示(避免冗余)
          if (currentTargetLang === targetLangs[0]) {
            setTranslatedText(bilingualSubtitle);
            setTranslatedTextExt(bilingualExt);
            setNeedsBilingualSuffix(true);
            setTranslatedTextLang(currentTargetLang);
          }
        } else {
          // Generate single version based on mode
          const finalSubtitle = generateSubtitle(needsBilingual, translatedLines);
          const fileExt = getOutputFileExtension(fileType, needsBilingual, bilingualFormat);
          const downloadFileName = generateFileName(fileName, langLabel, fileExt);

          // Always download in multi-language mode
          if (multiLanguageMode || multipleFiles.length > 1) {
            await downloadFile(finalSubtitle, downloadFileName);
          }

          if (currentTargetLang === targetLangs[0]) {
            setTranslatedText(finalSubtitle);
            setTranslatedTextExt(fileExt);
            setNeedsBilingualSuffix(false);
            setTranslatedTextLang(currentTargetLang);
          }
        }

        if (multiLanguageMode && currentTargetLang !== targetLangs[targetLangs.length - 1]) {
          await delay(500);
        }
      } catch (error: unknown) {
        console.error(error);

        // Cascaded abort = peer auth error already aborted the controller;
        // the real auth error surfaces via the matching peer rejection. Skip
        // the noisy secondary toast.
        if (isCascadedAbort(error)) continue;

        hasFailedLang = true;
        // De-duped: multi-file batch can fire catch for the same lang per file.
        setFailedLangs((prev) => (prev.includes(currentTargetLang) ? prev : [...prev, currentTargetLang]));
        const friendly = isNetworkError(error) ? t("networkUnavailable") : isAbortError(error) ? t("translationTimeout") : null;
        const langLabel = sourceOptions.find((o) => o.value === currentTargetLang)?.label || currentTargetLang;
        // Friendly messages already convey "translation failed" — drop the
        // redundant `${t("translationError")}` suffix, keep langLabel in
        // parentheses for multi-language context.
        const content = friendly
          ? `${friendly} (${langLabel})`
          : needsBilingual
            ? `${getErrorMessage(error)} ${tSubtitle("bilingualError")}`
            : `${getErrorMessage(error)} ${langLabel} ${t("translationError")}`;

        message.error(content, 60);
      }
    }

    if (hasFailedLang) failedFilesRef.current++;

    // Show success message after all languages completed (for single file multi-language mode);
    // 有任何 lang 失败时跳过此消息(per-lang error toast 已显示,避免红+绿对冲)
    if (multiLanguageMode && targetLangs.length > 1 && multipleFiles.length <= 1 && !hasFailedLang) {
      const fileCount = exportMode === "both" ? targetLangs.length * 2 : targetLangs.length;
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
    failedFilesRef.current = 0;
    // Batch path doesn't go through runTranslation — reset lang-failure manually.
    setFailedLangs([]);

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

      // 部分/全失败时不报"已导出"(per-file error toast 已经告知细节),只在有成功时显示汇总
      const total = multipleFiles.length;
      const failed = failedFilesRef.current;
      const succeeded = total - failed;
      if (failed === 0) {
        message.success(t("translationExported"), 10);
      } else if (succeeded > 0) {
        message.warning(`${t("translationExported")} (${succeeded}/${total})`, 10);
      }
      // 全失败:per-file error toast 已显示,无需再叠加 message
    } finally {
      setIsTranslating(false);
    }
  };

  const handleExportFile = () => {
    const uploadFileName = multipleFiles[0]?.name || "subtitle";
    // ResultCard 只在 translatedText 非空时渲染,而 translatedText 写入必伴随 ext/lang
    // 的同帧 setState,所以 handleExportFile 触发时两者必非 null —— ?? 仅作类型收窄兜底
    const fileExt = translatedTextExt ?? "srt";
    const langLabel = translatedTextLang ?? targetLanguage;

    // Use custom filename if set, otherwise use default pattern
    let fileName = generateFileName(uploadFileName, langLabel, fileExt);
    // both 模式下的 bilingual 预览要加 _bilingual 后缀,跟翻译时下载的 bilingual 文件名一致
    if (needsBilingualSuffix) {
      fileName = appendBilingualSuffix(fileName);
    }
    downloadFile(translatedText, fileName);
    return fileName;
  };

  const handleExtractText = () => {
    if (!sourceText.trim()) {
      message.error(tSubtitle("noSourceText"));
      return;
    }
    // 复用 sourceFileType useMemo,免重复 detect
    if (!sourceFileType || sourceFileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
      return;
    }
    const { contentLines } = filterSubLines(splitTextIntoLines(sourceText), sourceFileType);
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
                    setTranslatedTextExt(null);
                    setNeedsBilingualSuffix(false);
                    setTranslatedTextLang(null);
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
                      {sourceText.trim() && sourceFileType === "error" && (
                        <Alert type="warning" showIcon message={tSubtitle("unsupportedSub")} />
                      )}
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

                      {needsBilingual && (
                        <Segmented
                          block
                          size="small"
                          value={bilingualOrder}
                          onChange={(value) => setBilingualOrder(value as BilingualOrder)}
                          options={[
                            // i18n key 跟 enum value 同名;UI 文案保留用户视角的"译文在上/下"
                            { label: tSubtitle("translationFirst"), value: "translationFirst" },
                            { label: tSubtitle("originalFirst"), value: "originalFirst" },
                          ]}
                        />
                      )}

                      {showBilingualFormatChoice && (
                        <Tooltip title={tSubtitle("bilingualFormatTooltip")}>
                          <Segmented
                            block
                            size="small"
                            value={bilingualFormat}
                            onChange={(value) => setBilingualFormat(value as BilingualFormat)}
                            options={[
                              { label: "ASS", value: "ass" },
                              { label: "SRT", value: "srt" },
                            ]}
                          />
                        </Tooltip>
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
        count={failedCount}
        lines={failedLines}
        failedLangs={failedLangs}
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
