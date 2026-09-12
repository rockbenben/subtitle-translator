"use client";

import React, { useState, useMemo } from "react";
import { Flex, Card, Button, Typography, Form, Space, App, Tooltip, Segmented, Spin, Row, Col, Divider, Collapse, Alert, theme } from "antd";
import { SettingOutlined, FileTextOutlined, FormatPainterOutlined, GlobalOutlined, ImportOutlined, SaveOutlined, ControlOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useResetOnSourceChange } from "@/app/hooks/useResetOnSourceChange";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useExportFilename } from "@/app/hooks/useExportFilename";

import { splitTextIntoLines, downloadFile, applyRemoveCharsToLines, describeError, getFileTypePresetConfig } from "@/app/utils";
import {
  detectSubtitleFormat,
  normalizeSrtVariantTimecodes,
  getOutputFileExtension,
  filterSubLines,
  ASS_STYLE_PRESETS,
  prepareAssForTranslation,
  restoreAssAfterTranslation,
  applyRemoveCharsToAssLines,
  appendBilingualSuffix,
  assembleSubtitleOutput,
  SUBTITLE_DEFAULTS,
  type BilingualFormat,
  type AssStyleConfig,
  type AssStylePreset,
} from "@/app/lib/translation/formats/subtitle";
import { LLM_MODELS } from "@/app/lib/translation";
import { transformSkippingSoftFilled } from "@/app/lib/translation/softFill";
import { delay } from "@/app/lib/translation/retry";
import LanguageSelector from "@/app/components/LanguageSelector";
import ApiStatusBlock from "@/app/components/ApiStatusBlock";
import ContextTranslationBlock from "@/app/components/ContextTranslationBlock";
import TranslationProgressStrip from "@/app/components/TranslationProgressStrip";
import LiveTranslationResults from "./LiveTranslationResults";
import { useTranslationContext } from "@/app/components/TranslationContext";
import ResultCard from "@/app/components/ResultCard";
import Section from "@/app/components/styled/Section";
import BilingualReviewPanel from "./BilingualReviewPanel";
import AdvancedTranslationSettings from "@/app/components/AdvancedTranslationSettings";
import TranslateFailurePanel from "@/app/components/TranslateFailurePanel";

import MultiLanguageSettingsModal from "@/app/components/MultiLanguageSettingsModal";
import UploadSourceCard from "@/app/components/UploadSourceCard";

import dynamic from "next/dynamic";
import { useFileExport, describeExport } from "@/app/hooks/useFileExport";
import { useLockExportFolder } from "@/app/components/ExportFolder";
const AssStyleDrawer = dynamic(() => import("./AssStyleDrawer"), { ssr: false });

const { Text } = Typography;

const uploadFileTypes = getFileTypePresetConfig("subtitle");

const SubtitleTranslator = () => {
  const tSubtitle = useTranslations("SubtitleTranslator");
  const t = useTranslations("common");

  const { copyToClipboard } = useCopyToClipboard();
  // ... useFileUpload destructuring ...
  const upload = useFileUpload("subtitle-translator");
  const {
    isFileProcessing,
    multipleFiles,
    readFile,
    sourceText,
    uploadMode,
    singleFileMode,
    setSingleFileMode,
  } = upload;
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
    failedReason,
    clearFailures,
    hadRunFailures,
    runHadFailures,
    runRetry,
    isScopedRetry,
    getActiveTargetLangs,
    isDisposed,
    isTranslating,
    resetProgress,
    liveLinesStore,
    clearLiveLines,
    recordLiveLine,
    progressPercent,
    progressInfo,
    handleLanguageChange,
    handleSwapLanguages,
    requestCancel,
    isCancelRequested,
    retryCount,
    setRetryCount,
    requestTimeoutSec,
    setRequestTimeoutSec,
    runBatchTranslation,
    reportLangFailure,
    noteFileFailure,
  } = useTranslationContext();

  // 运行中锁住页面级「导出目录」入口:写入是每个文件现读句柄,跑到一半改目录
  // 会把同一批产物劈进两个文件夹。控件在 ToolPage 里,prop 传不上去,故用环境锁。
  useLockExportFolder(isTranslating);
  const { message } = App.useApp();
  const exportFile = useFileExport();
  const { token } = theme.useToken();

  const sourceStats = useTextStats(sourceText);
  const resultStats = useTextStats(translatedText);

  // Export mode: 'translatedOnly' | 'bilingual' | 'both'
  const [exportMode, setExportMode] = useLocalStorage<"translatedOnly" | "bilingual" | "both">("subtitle-translator-exportMode", "translatedOnly");
  // bilingualOrder 标识双语拼接顺序:谁先呈现(SRT/VTT/ASS 多行 = 在上;LRC 行内 = 在前)
  // 默认译文在上:符合中外双语惯例(译文为主、较大、在上;原文较小在下)。
  type BilingualOrder = "originalFirst" | "translationFirst";
  const [bilingualOrder, setBilingualOrder] = useLocalStorage<BilingualOrder>("subtitle-translator-bilingualOrder", "translationFirst");
  const isOriginalFirst = bilingualOrder === "originalFirst";
  // SRT/VTT 双语输出格式选择,ASS=转换为 ASS(默认,保留旧行为),SRT=保留源格式叠两行
  // ASS/LRC 源文件忽略此选项(它们各自有专用的双语格式)
  const [bilingualFormat, setBilingualFormat] = useLocalStorage<BilingualFormat>("subtitle-translator-bilingualFormat", "ass");
  // key 带 -v2:结构从位置(top/bottom)改为角色(translation/original),旧存值形状不兼容,
  // 直接换 key 让旧值过期、回落到新默认(不写迁移垫片,符合项目"旧版过期"约定)。
  const [assStyle, setAssStyle] = useLocalStorage<AssStyleConfig>("subtitle-translator-assStyle-v2", ASS_STYLE_PRESETS.default);
  const [assPreset, setAssPreset] = useLocalStorage<AssStylePreset | "custom">("subtitle-translator-assPreset", "default");
  // 自定义配置单独存:切到预设再切回「自定义」时恢复,避免一切换自定义就丢。
  const [assCustomStyle, setAssCustomStyle] = useLocalStorage<AssStyleConfig>("subtitle-translator-assCustomStyle", ASS_STYLE_PRESETS.default);
  // 单一入口:同步 config + preset;preset 为 custom 时把配置落进 customStyle。
  const handleAssChange = (cfg: AssStyleConfig, p: AssStylePreset | "custom") => {
    setAssStyle(cfg);
    setAssPreset(p);
    if (p === "custom") setAssCustomStyle(cfg);
  };
  // 原生 ASS 双语:false=逐行沿用源样式(默认);true=放弃源样式、用本工具预设重新排版。
  const [assNativeRebuild, setAssNativeRebuild] = useLocalStorage<boolean>("subtitle-translator-assNativeRebuild", false);

  // 双语模式标志:exportMode 是 "bilingual" 或 "both" 时需要生成双语版本
  const needsBilingual = exportMode === "bilingual" || exportMode === "both";

  // 源格式检测:单文件看 sourceText,多文件用第一个文件的扩展名作代表
  // deps 只列实际读取的字段(firstFileName),避免整个 multipleFiles 数组引用变化触发重算
  const firstFileName = multipleFiles[0]?.name;
  const sourceFileType = useMemo<"ass" | "vtt" | "srt" | "lrc" | "sbv" | "error" | null>(() => {
    if (sourceText.trim()) {
      return detectSubtitleFormat(splitTextIntoLines(sourceText));
    }
    if (!firstFileName) return null;
    const ext = firstFileName.split(".").pop()?.toLowerCase();
    if (ext === "ass" || ext === "vtt" || ext === "srt" || ext === "lrc" || ext === "sbv") return ext;
    // SSA(v4.00)与 ASS 共用同一条管线,内部 fileType 统一为 "ass"
    if (ext === "ssa") return "ass";
    return null;
  }, [sourceText, firstFileName]);

  // ASS/SRT 格式选项只在 SRT/VTT 源 + 双语时显示——ASS/LRC 源选项无法兑现,避免 UI 撒谎
  const showBilingualFormatChoice = needsBilingual && (sourceFileType === "srt" || sourceFileType === "vtt");
  // 原生 ASS 双语:显示「沿用源样式 / 重新排版」选择;选重新排版才用本工具样式。
  const nativeAss = sourceFileType === "ass";
  const showNativeRebuildChoice = needsBilingual && nativeAss;
  // 「ASS 样式」可调:SRT/VTT 转 ASS,或 原生 ASS + 重新排版。
  const showAssStyle = (showBilingualFormatChoice && bilingualFormat === "ass") || (showNativeRebuildChoice && assNativeRebuild);
  const [contextAware, setContextAware] = useLocalStorage("subtitle-translator-contextAware", SUBTITLE_DEFAULTS.contextAware); // 上下文感知翻译开关,默认值与 CLI 共用
  // 面板 key 必须与下方 Collapse items 的 key("subtitle"/"advanced")一致 ——
  // 旧默认值 "SubtitleTranslator" 不匹配任何面板,导出控件永远默认收起。
  const [collapseKeys, setCollapseKeys] = useLocalStorage<string[]>("subtitle-translator-collapseKeys", ["subtitle"]);
  const [multiLangModalOpen, setMultiLangModalOpen] = useState(false);
  const [assStyleOpen, setAssStyleOpen] = useState(false);
  // 提取出的纯文本预览 — 只在 SubtitleTranslator 和 MDTranslator 用,
  // 不应该污染 TranslationProvider 的共享 state。
  const [extractedText, setExtractedText] = useState("");
  // 记录最近一次写入 translatedText 时使用的扩展名,导出按钮按它生成文件名;
  // 避免用户翻译后改 exportMode/bilingualFormat,再点导出时扩展名跟内容错位
  const [translatedTextExt, setTranslatedTextExt] = useState<string | null>(null);
  // 标记 translatedText 是否是 exportMode="both" 的 bilingual 版本(需要 _bilingual 后缀);
  // both 模式下同时下载两份文件,如果两份 ext 相同(LRC/ASS/SRT+format=srt)文件名会冲突
  const [needsBilingualSuffix, setNeedsBilingualSuffix] = useState(false);
  // 记录 translatedText 是否含原文(双语产物)。校对面板不能只看【当前】
  // exportMode:双语翻译后把开关切回 translatedOnly,旧的双语产物仍在
  // translatedText 里(改设置不清结果,见上),按 index 与源配对必错位
  // (format=ass 时是 2N 条 Dialogue)。
  const [translatedTextBilingual, setTranslatedTextBilingual] = useState(false);
  // 记录 translatedText 对应的目标语种,handleExportFile 用它生成文件名;
  // 多语言模式下 translatedText 是 previewLang(常规跑 = targetLangs[0];scoped
  // 重试时保持上一次预览的语种)而非主 targetLanguage,不记录的话导出文件名会
  // 标错语种(主 targetLanguage 跟 translatedText 内容不匹配)
  const [translatedTextLang, setTranslatedTextLang] = useState<string | null>(null);
  const { customFileName, setCustomFileName, generateFileName } = useExportFilename("subtitle-translator");

  // 源文本变化时只复位"源派生"的本地预览(extractedText)。译文结果及其元数据
  // (translatedText / translatedTextExt / needsBilingualSuffix / translatedTextLang)保留——
  // 和 JSON 翻译一致:改源后旧结果不清,直到重新翻译。既符合"保留旧结果",又不必在 render
  // 阶段去 set 共享 context 的 translatedText(那会更新 TranslationProvider → setState-in-render 警告)。
  useResetOnSourceChange(sourceText, () => setExtractedText(""));

  const performTranslation = async (sourceText: string, fileNameSet?: string, fileIndex?: number, totalFiles?: number) => {
    const rawLines = splitTextIntoLines(sourceText);
    const detectedType = detectSubtitleFormat(rawLines);
    if (detectedType === "error") {
      message.error(tSubtitle("unsupportedSub"));
      noteFileFailure();
      return;
    }
    // 非规范时间码(裸秒 / 省毫秒,可与规范 cue 混排)先归一成标准时间码,
    // 装配写回的物理行与 filterSubLines 看到的必须是同一份 —— 否则 cue 边界对不上。
    const fileType = detectedType;
    const lines = normalizeSrtVariantTimecodes(rawLines, fileType);

    // Get content lines and assContentStartIndex from filterSubLines (eliminates duplicate calculation)
    const { contentLines, contentIndices, assContentStartIndex } = filterSubLines(lines, fileType);

    // Early return if no content to translate
    if (contentLines.length === 0) {
      message.warning(tSubtitle("noExtractedText"));
      noteFileFailure();
      return;
    }

    // On a failure-panel retry (runRetry) this is narrowed to the langs still
    // needing work — successful languages aren't re-walked/re-downloaded.
    const targetLangs = getActiveTargetLangs();

    if (multiLanguageMode && targetLangs.length === 0) {
      message.error(t("noTargetLanguage"));
      noteFileFailure();
      return;
    }

    // 预览语言:常规跑 = 本轮第一个语言(旧行为);多语言 scoped 重试 = 保持
    // 当前预览的语言 —— 仅当它也在重试范围内时刷新,否则不动预览。不加这条,
    // 重试会把用户正在校对的 targetLangs[0](现在是第一个【失败】语言)静默
    // 换掉;重试再失败时预览也不会被清空(runTranslation 在 scoped 重试下不清
    // translatedText)。单语言模式恒取 targetLangs[0]:预览是唯一输出。
    const previewLang = multiLanguageMode && isScopedRetry() && translatedTextLang ? (targetLangs.includes(translatedTextLang) ? translatedTextLang : null) : targetLangs[0];

    const fileName = fileNameSet || multipleFiles[0]?.name || "subtitle";
    // 源文件物理扩展名:SSA 与 ASS 共用 "ass" 管线,导出时靠它回写 .ssa
    const dotIdx = fileName.lastIndexOf(".");
    const sourceExt = dotIdx > 0 ? fileName.slice(dotIdx + 1).toLowerCase() : undefined;

    // Helper to generate subtitle output based on bilingual mode — assembly
    // itself lives in formats/subtitle assembleSubtitleOutput (shared with the CLI).
    // softFilledIndices:双语装配据此判断哪些行只出一半 —— 必须是【引擎给的
    // 软失败下标】而不是"译文==原文"的字符串比较,否则专有名词/数字/♪ 这类
    // 合法译成自身的行会被吃掉一半(见 formats/subtitle 的 isSoftFilledHalf)。
    const generateSubtitle = (isBilingual: boolean, translatedLines: string[], exportLang: string, softFilledIndices?: ReadonlySet<number>): string =>
      assembleSubtitleOutput({ lines, contentIndices, contentLines, translatedLines, fileType, assContentStartIndex, tagMaps, isBilingual, isOriginalFirst, bilingualFormat, assNativeRebuild, assStyle, sourceLanguage, exportLang, softFilledIndices });

    // ASS 标签保护：翻译前剥离覆盖标签和 \N，翻译后还原
    const isAss = fileType === "ass";
    const { cleanLines, tagMaps } = isAss ? prepareAssForTranslation(contentLines) : { cleanLines: contentLines, tagMaps: [] };

    // contentIndices 把每条 cue 文本行映射回源文件物理行 —— 失败面板要报的是
    // 用户在文件里能找到的行号,不是"第 N 条可译行"的序数。
    const sourceLineNumbers = contentIndices.map((index) => index + 1);

    // 跟踪当前文件是否有任何 lang 翻译失败;末尾合并到 failedFilesRef
    let hasFailedLang = false;

    for (const currentTargetLang of targetLangs) {
      // 取消刹车:translateBatch 的入口守卫本来也会把后续语言逐个抛掉(级联标记
      // → 下面 catch 静默 continue),在这里刹住只是不做那 N 次空转。
      if (isCancelRequested()) break;
      // 每个语言(或文件)开始前清掉上一轮的实时行 —— 新一轮结果从空列表
      // 重新累积(多语言循环里每个 lang 的流是独立的)。
      clearLiveLines();
      try {
        // Translate content using the specific target language
        // 软填(保留原文)槽位:removeChars 绝不能碰 —— 碰了就写出既非原文也非
        // 译文的东西,而失败面板同屏正说着"失败的行已保留原文"。
        // 规则与 CLI 共用同一份实现:lib/translation/softFill。
        const softFilled = new Set<number>();
        const rawTranslatedLines = await translateBatch(cleanLines, translationMethod, currentTargetLang, fileIndex, totalFiles, contextAware ? "subtitle" : undefined, {
          lineNumbers: sourceLineNumbers,
          fileName,
          collectSoftFilled: softFilled,
          // 实时逐行流:引擎每定稿一行就推一个事件,这里立刻上屏 —— 不等整批
          // 返回。「这一行最终没译出」的标记由 hook 在失败面板更新时统一处理
          // (markLiveLinesFailed),这里只管内容流。
          //
          // ⚠ ASS 必须在这里还原成人能读的形态。发给引擎的是 cleanLines
          // (prepareAssForTranslation 把 `\N`+标签串换成了 ###n### 占位符),
          // 引擎忠实地把它当"原文"发回来 —— 直接上屏就是满面板的 ###0###。
          // 原文取 contentLines(文件里的真样子),译文过一遍与导出同一个
          // restoreAssAfterTranslation:面板看到的和最终文件里的是同一形态。
          onLineTranslated: (result) => {
            recordLiveLine(
              isAss
                ? {
                    ...result,
                    original: contentLines[result.index] ?? result.original,
                    translation: restoreAssAfterTranslation([result.translation], [tagMaps[result.index]])[0],
                  }
                : result,
            );
          },
        });
        // removeChars 只清理【原始译文】,且必须在 ASS 标签/verbatim 还原【之前】
        // 应用 —— restore 之后应用会损坏 \N 硬换行、{\anX} 标签和绘图坐标行。
        // ASS 用 token 感知版(跳过 ###n### 保护槽),其余格式用通用版;
        // 实现与 CLI 共用同一份(formats/subtitle + textUtils)。
        const cleanedTranslated = transformSkippingSoftFilled(rawTranslatedLines, softFilled, (ls) => (isAss ? applyRemoveCharsToAssLines(ls, removeChars) : applyRemoveCharsToLines(ls, removeChars)));
        const translatedLines = isAss ? restoreAssAfterTranslation(cleanedTranslated, tagMaps) : cleanedTranslated;

        // Generate file name base
        const langLabel = currentTargetLang;

        // Handle different export modes
        if (exportMode === "both") {
          // Generate and download both translated-only and bilingual versions
          const translatedOnlySubtitle = generateSubtitle(false, translatedLines, currentTargetLang, softFilled);
          const bilingualSubtitle = generateSubtitle(true, translatedLines, currentTargetLang, softFilled);
          const translatedOnlyExt = getOutputFileExtension(fileType, false, bilingualFormat, sourceExt);
          // 原生 ASS 重新排版产出 v4.00+,即使源是 .ssa 也回写 .ass(仅双语版被重排)。
          const bilingualExt = fileType === "ass" && assNativeRebuild ? "ass" : getOutputFileExtension(fileType, true, bilingualFormat, sourceExt);

          const translatedOnlyFileName = generateFileName(fileName, langLabel, translatedOnlyExt, multiLanguageMode);
          // bilingual 文件在扩展名前插 _bilingual 后缀,避免跟 translatedOnly 文件同名冲突
          // (ASS/LRC 源、SRT+format=srt 三种场景下两个 ext 相同,不区分会被浏览器覆盖下载)
          const bilingualFileName = appendBilingualSuffix(generateFileName(fileName, langLabel, bilingualExt, multiLanguageMode));

          // 记下实际写入名:导出目录下重跑会让路成 `x (1).srt`,toast 必须照实报
          const writtenOnly = await downloadFile(translatedOnlySubtitle, translatedOnlyFileName);
          const writtenBilingual = await downloadFile(bilingualSubtitle, bilingualFileName);

          // Show success message for single file mode — 行级软失败时降级,
          // 不跟失败面板唱反调
          if (!multiLanguageMode && multipleFiles.length <= 1 && !hadRunFailures()) {
            // 两个文件同一目录,合成一条:报的是实际写入名(可能带让路后缀)
            message.success(describeExport(t, { fileName: `${writtenOnly.fileName}, ${writtenBilingual.fileName}`, dir: writtenOnly.dir }));
          }

          // 多语言模式下只把 previewLang(常规跑 = 第一个语言)写入 translatedText
          // 作 UI 预览;其它语言已通过 downloadFile 自动落盘,UI 不再重复展示
          if (currentTargetLang === previewLang) {
            setTranslatedText(bilingualSubtitle);
            setTranslatedTextExt(bilingualExt);
            setNeedsBilingualSuffix(true);
            setTranslatedTextBilingual(true);
            setTranslatedTextLang(currentTargetLang);
          }
        } else {
          // Generate single version based on mode
          const finalSubtitle = generateSubtitle(needsBilingual, translatedLines, currentTargetLang, softFilled);
          // 原生 ASS 重新排版(双语)产出 v4.00+ → .ass,即使源是 .ssa。
          const fileExt = fileType === "ass" && needsBilingual && assNativeRebuild ? "ass" : getOutputFileExtension(fileType, needsBilingual, bilingualFormat, sourceExt);
          const downloadFileName = generateFileName(fileName, langLabel, fileExt, multiLanguageMode);

          // Always download in multi-language mode
          if (multiLanguageMode || multipleFiles.length > 1) {
            await downloadFile(finalSubtitle, downloadFileName);
          }

          if (currentTargetLang === previewLang) {
            setTranslatedText(finalSubtitle);
            setTranslatedTextExt(fileExt);
            setNeedsBilingualSuffix(false);
            setTranslatedTextBilingual(needsBilingual);
            setTranslatedTextLang(currentTargetLang);
          }
        }

        if (multiLanguageMode && currentTargetLang !== targetLangs[targetLangs.length - 1]) {
          await delay(500);
        }
      } catch (error: unknown) {
        // 双语产物失败时正文换成双语提示;级联中止不算失败(reportLangFailure 返回 false)。
        if (reportLangFailure(error, currentTargetLang, needsBilingual ? `${describeError(error, t)} ${tSubtitle("bilingualError")}` : undefined)) hasFailedLang = true;
      }
    }

    if (hasFailedLang) noteFileFailure();

    // Show success message after all languages completed (for single file multi-language mode);
    // 有任何 lang 失败时跳过此消息(per-lang error toast 已显示,避免红+绿对冲)
    // isDisposed:中途导航离开时每个 lang 都按级联静默 continue,hasFailedLang
    // 仍是 false —— 不挡会在用户切去的页面上弹"已导出 N 个文件"的假成功。
    // 不设 length > 1 门槛:多语言模式必自动下载(哪怕只剩 1 个语言 —— 单语言
    // scoped 重试就是这个形态),没有 toast 的话用户只看到面板消失 + 一次静默
    // 下载,会误判重试没生效。
    if (multiLanguageMode && multipleFiles.length <= 1 && !hasFailedLang && !isDisposed() && !isCancelRequested()) {
      const fileCount = exportMode === "both" ? targetLangs.length * 2 : targetLangs.length;
      message.success(`${t("translationExported")} (${fileCount} ${t("exportedFile")})`);
    }
  };

  const handleExportFile = () => {
    const uploadFileName = multipleFiles[0]?.name || "subtitle";
    // ResultCard 只在 translatedText 非空时渲染,而 translatedText 写入必伴随 ext/lang
    // 的同帧 setState,所以 handleExportFile 触发时两者必非 null —— ?? 仅作类型收窄兜底
    const fileExt = translatedTextExt ?? "srt";
    const langLabel = translatedTextLang ?? targetLanguage;

    // Use custom filename if set, otherwise use default pattern
    let fileName = generateFileName(uploadFileName, langLabel, fileExt, multiLanguageMode);
    // both 模式下的 bilingual 预览要加 _bilingual 后缀,跟翻译时下载的 bilingual 文件名一致
    if (needsBilingualSuffix) {
      fileName = appendBilingualSuffix(fileName);
    }
    void exportFile(translatedText, fileName);
  };

  const handleExtractText = () => {
    if (!sourceText.trim()) {
      message.warning(tSubtitle("noSourceText"));
      return;
    }
    // 复用 sourceFileType useMemo,免重复 detect
    if (!sourceFileType || sourceFileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
      return;
    }
    // 裸秒 SRT 变体先归一时间码,否则 filterSubLines 找不到任何 cue 边界、预览为空
    const extractLines = normalizeSrtVariantTimecodes(splitTextIntoLines(sourceText), sourceFileType);
    const { contentLines } = filterSubLines(extractLines, sourceFileType);
    const extractedText = contentLines.join("\n").trim();

    if (!extractedText) {
      message.error(tSubtitle("noExtractedText"));
      return;
    }

    setExtractedText(extractedText);
    copyToClipboard(extractedText, tSubtitle("textExtracted"));
  };

  // 作废上一轮翻译产物:Clear All 与换/删上传文件时调用,使译文结果、导出元数据、
  // 失败面板回到"未翻译"初始态。extractedText 是源派生预览,由 prevSourceText
  // 随 sourceText 变化复位,不在此重复。resetProgress 不能漏:翻译按钮下方的
  // TranslationProgressStrip 完成后常驻成 DONE 凭据,只认自己的 ✕(onDismiss) ——
  // 不清进度,Clear All 后它还顶着「翻译完成」。
  const clearResults = () => {
    resetProgress();
    setTranslatedText("");
    setTranslatedTextExt(null);
    setNeedsBilingualSuffix(false);
    setTranslatedTextBilingual(false);
    setTranslatedTextLang(null);
    clearLiveLines();
    clearFailures();
  };

  return (
    <Spin spinning={isFileProcessing} description={t("pleaseWait")} size="large">
      <Row gutter={[24, 24]}>
        {/* Left Column: Upload and Main Actions */}
        <Col xs={24} lg={14} xl={15}>
          <UploadSourceCard upload={upload} stats={sourceStats} fileTypes={uploadFileTypes} multiFile textDirection="auto" locked={isTranslating} onClear={clearResults} onSourceChange={clearResults}>

            <Divider />

            <Flex gap="small" wrap className="mt-auto pt-4">
              <Button
                type="primary"
                size="large"
                icon={<GlobalOutlined spin={isTranslating} />}
                className="flex-1"
                onClick={() => (uploadMode === "single" ? runTranslation(performTranslation, sourceText, contextAware ? "subtitle" : undefined) : runBatchTranslation(performTranslation, multipleFiles, readFile, tSubtitle("noFileUploaded")))}
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

            <TranslationProgressStrip
              isTranslating={isTranslating}
              percent={progressPercent}
              onCancel={requestCancel}
              resumable={useCache}
              onDismiss={resetProgress}
              multiLanguageMode={multiLanguageMode}
              targetLanguageCount={targetLanguages.length}
              failed={failedCount > 0 || failedLangs.length > 0 || runHadFailures}
              lineFailures={failedCount > 0}
              currentCount={progressInfo.current}
              totalCount={progressInfo.total}
            />

            {/* 实时逐行结果 —— 与进度条并行:每定稿一行立即出现,不等整批。
                ⚠ 只在【跑动时】渲染。它的全部价值是"等待时看见正在发生什么";
                跑完之后正下方就是完整结果区,再顶着一个不再实时、内容还重复的
                320px 面板,只是把结果区往下推。进度条不同 —— 它跑完要留成续跑
                凭据(停在第几行、还能不能续),所以那条自己管自己的 ✕。
                失败行以琥珀「未译出」标记,细节归下方失败面板。 */}
            {isTranslating && <LiveTranslationResults store={liveLinesStore} processedCount={progressInfo.current} />}
          </UploadSourceCard>
        </Col>

        {/* Right Column: Settings and Configuration */}
        <Col xs={24} lg={10} xl={9}>
          <Card
            title={<Space><SettingOutlined /> {t("configuration")}</Space>}
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
                disabled={isTranslating}
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
                    <Section noGap style={{ display: "flex", flexDirection: "column", gap: token.marginXS }}>
                      {sourceText.trim() && sourceFileType === "error" && (
                        <Alert type="warning" showIcon title={tSubtitle("unsupportedSub")} />
                      )}
                      <Segmented
                        disabled={isTranslating}
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
                        disabled={isTranslating}
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
                        disabled={isTranslating}
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

                      {showNativeRebuildChoice && (
                        <Tooltip title={tSubtitle("assNativeModeTooltip")}>
                          <Segmented
                        disabled={isTranslating}
                            block
                            size="small"
                            value={assNativeRebuild ? "rebuild" : "source"}
                            onChange={(value) => setAssNativeRebuild(value === "rebuild")}
                            options={[
                              { label: tSubtitle("assNativeModeSource"), value: "source" },
                              { label: tSubtitle("assNativeModeRebuild"), value: "rebuild" },
                            ]}
                          />
                        </Tooltip>
                      )}

                      {showAssStyle && (
                        <Tooltip title={tSubtitle("assStyleTooltip")}>
                          <Button size="small" icon={<FormatPainterOutlined />} disabled={isTranslating} onClick={() => setAssStyleOpen(true)}>
                            {tSubtitle("assStyleButton")}
                          </Button>
                        </Tooltip>
                      )}
                    </Section>
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
                      disabled={isTranslating}
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
        reason={failedReason}
        disabled={isTranslating}
        onRetry={() => runRetry(() => (uploadMode === "single" ? runTranslation(performTranslation, sourceText, contextAware ? "subtitle" : undefined) : runBatchTranslation(performTranslation, multipleFiles, readFile, tSubtitle("noFileUploaded"))))}
      />

      {/* Results Section */}
      {uploadMode === "single" && (translatedText || extractedText) && (
        <div className="mt-6">
          <Row gutter={[24, 24]}>
            {translatedText && !(multiLanguageMode && targetLanguages.length > 1) && (
              <Col xs={24} lg={extractedText ? 12 : 24}>
                <ResultCard
                  textDirection="auto"
                  title={t("translationResult")}
                  content={translatedText}
                  stats={resultStats}
                  onCopy={() => copyToClipboard(translatedText)}
                  onExport={handleExportFile}
                />
              </Col>
            )}

            {extractedText && (
              <Col xs={24} lg={translatedText ? 12 : 24}>
                <ResultCard title={t("extractedText")} content={extractedText} textDirection="auto" showStats={false} onCopy={() => copyToClipboard(extractedText)} />
              </Col>
            )}
          </Row>
        </div>
      )}

      {/* 对照校对:源↔译逐行并排、可编辑译文,应用后写回下载(全部格式,含 lrc)。
          仅 translatedOnly 模式,且【产物本身】非双语(translatedTextBilingual)——
          只看当前 exportMode 不够:双语翻译后切回 translatedOnly,旧双语产物
          仍在 translatedText 里,含原文(ASS 双 Dialogue → 2N cue),与源配对会错位 */}
      {uploadMode === "single" && translatedText && exportMode === "translatedOnly" && !translatedTextBilingual && failedCount === 0 && (
        <BilingualReviewPanel sourceText={sourceText} sourceFormat={sourceFileType} translatedText={translatedText} translatedFormat={translatedTextExt} />
      )}

      <MultiLanguageSettingsModal
        open={multiLangModalOpen}
        onClose={() => setMultiLangModalOpen(false)}
        targetLanguages={targetLanguages}
        setTargetLanguages={setTargetLanguages}
        setMultiLanguageMode={setMultiLanguageMode}
      />

      <AssStyleDrawer
        open={assStyleOpen}
        onClose={() => setAssStyleOpen(false)}
        config={assStyle}
        preset={assPreset}
        customStyle={assCustomStyle}
        onChange={handleAssChange}
        isOriginalFirst={isOriginalFirst}
        sourceLang={sourceLanguage}
        targetLang={targetLanguage}
      />
    </Spin>
  );
};

export default SubtitleTranslator;
