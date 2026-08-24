"use client";

import React, { useState, useMemo, useRef } from "react";
import { Flex, Card, Button, Typography, Input, Upload, Form, Space, App, Tooltip, Segmented, Spin, Row, Col, Divider, Collapse, Alert, theme } from "antd";
import { SettingOutlined, CopyOutlined, InboxOutlined, FileTextOutlined, ClearOutlined, FormatPainterOutlined, GlobalOutlined, ImportOutlined, SaveOutlined, ControlOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { useCopyToClipboard } from "@/app/hooks/useCopyToClipboard";
import useFileUpload from "@/app/hooks/useFileUpload";
import { useResetOnSourceChange } from "@/app/hooks/useResetOnSourceChange";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { useTextStats } from "@/app/hooks/useTextStats";
import { useExportFilename } from "@/app/hooks/useExportFilename";

import { splitTextIntoLines, downloadFile, applyRemoveCharsToLines, describeError, isAbortError, isCascadedAbort, isNetworkError, getFileTypePresetConfig } from "@/app/utils";
import {
  detectSubtitleFormat,
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
import { useLanguageOptions } from "@/app/components/languages";
import LanguageSelector from "@/app/components/LanguageSelector";
import ApiStatusBlock from "@/app/components/ApiStatusBlock";
import ContextTranslationBlock from "@/app/components/ContextTranslationBlock";
import TranslationProgressStrip from "@/app/components/TranslationProgressStrip";
import LiveTranslationResults from "./LiveTranslationResults";
import { useTranslationContext } from "@/app/components/TranslationContext";
import ResultCard from "@/app/components/ResultCard";
import BilingualReviewPanel from "./BilingualReviewPanel";
import AdvancedTranslationSettings from "@/app/components/AdvancedTranslationSettings";
import TranslateFailurePanel from "@/app/components/TranslateFailurePanel";

import MultiLanguageSettingsModal from "@/app/components/MultiLanguageSettingsModal";
import SourceArea from "@/app/components/SourceArea";

import dynamic from "next/dynamic";
const AssStyleDrawer = dynamic(() => import("./AssStyleDrawer"), { ssr: false });

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
    failedReason,
    clearFailures,
    markRunHadFailures,
    hadRunFailures,
    runHadFailures,
    runRetry,
    isScopedRetry,
    getActiveTargetLangs,
    isDisposed,
    isTranslating,
    setIsTranslating,
    resetProgress,
    liveLinesStore,
    clearLiveLines,
    recordLiveLine,
    progressPercent,
    setProgressPercent,
    progressInfo,
    handleLanguageChange,
    handleSwapLanguages,
    validate,
    requestCancel,
    isCancelRequested,
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
  // 批量翻译时统计失败文件数;handleMultipleTranslate 开始时重置,结束时读取以决定汇总消息。
  // 单文件模式(runTranslation 路径)下也会被写,但不会被读,无副作用。
  const failedFilesRef = useRef(0);
  // 【记一次文件级失败,只走这一个入口】。此前是两套并行记账:failedFilesRef
  // 只喂末尾的汇总 toast,markRunHadFailures 才是进度条能看见的信号 —— 结果
  // 批量里第一个文件格式不支持时只 bump 了 ref,进度条照样打绿色「翻译完成
  // 100%」,正压在「已导出 (4/5)」上面。合成一个函数,漏不掉。
  const noteFileFailure = () => {
    failedFilesRef.current++;
    markRunHadFailures();
  };
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
    const lines = splitTextIntoLines(sourceText);
    const fileType = detectSubtitleFormat(lines);
    if (fileType === "error") {
      message.error(tSubtitle("unsupportedSub"));
      noteFileFailure();
      return;
    }

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

          await downloadFile(translatedOnlySubtitle, translatedOnlyFileName);
          await downloadFile(bilingualSubtitle, bilingualFileName);

          // Show success message for single file mode — 行级软失败时降级,
          // 不跟失败面板唱反调
          if (!multiLanguageMode && multipleFiles.length <= 1 && !hadRunFailures()) {
            message.success(t("fileExported", { fileName: `${translatedOnlyFileName}, ${bilingualFileName}` }));
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
            ? `${describeError(error, t)} ${tSubtitle("bilingualError")}`
            : `${describeError(error, t)} ${langLabel} ${t("translationError")}`;

        // Shared key: failed languages roll into one toast instead of stacking N high
        // — the TranslateFailurePanel keeps the full per-lang list.
        message.error({ content, key: "translate-lang-fail", duration: 10 });
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

  const handleMultipleTranslate = async () => {
    if (multipleFiles.length === 0) {
      message.error(tSubtitle("noFileUploaded"));
      return;
    }

    // validate 不再自管 isTranslating, 这里用 try/finally 兜底,
    // 让 progress modal 在 test ping → 文件循环之间保持连续可见。
    setIsTranslating(true);
    // resetProgress 而非裸 setProgressPercent(0):progressInfo 的
    // {current,total,latest} 不清,投影弹窗会在新一轮首行返回前(LLM 批次
    // 可达 20-60s)一直放映【上一轮】的最终计数和最后一句译文。
    resetProgress();
    // 批量路径:整批文件开跑前清掉实时行(单文件路径由 runTranslation →
    // performTranslation 的 clearLiveLines 清)。
    clearLiveLines();
    failedFilesRef.current = 0;
    // Batch path doesn't go through the hook's runTranslation — reset ALL failure
    // state (not just langs) so counts don't accumulate across runs and the failure
    // warning re-fires on a fresh batch.
    clearFailures();

    try {
      const isValid = await validate();
      if (!isValid) return;

      for (let i = 0; i < multipleFiles.length; i++) {
        const currentFile = multipleFiles[i];
        await new Promise<void>((resolve) => {
          readFile(
            currentFile,
            async (text) => {
              await performTranslation(text, currentFile.name, i, multipleFiles.length);
              await delay(1500);
              resolve();
            },
            // Decode/read failure: mark this file failed (so succeeded=total-failed is
            // accurate) and unblock the loop.
            () => {
              noteFileFailure();
              resolve();
            }
          );
        });
        // 中途导航离开:后续文件只会逐个快速级联失败,汇总 toast 也会弹在
        // 用户切去的页面上 —— 直接收工。取消同理:requestCancel 已弹过提示,
        // 「已导出 (n/m)」的汇总只会把一次主动喊停说成一次半失败。
        if (isDisposed() || isCancelRequested()) return;
      }

      // 非取消结束时把进度钉到 100%,与 JSONTranslator 一致。
      // 不钉的话:批量里有文件被跳过(格式不支持 / 解码失败)时,makeUpdateProgress
      // 只走到 (成功文件数/总数)*100 —— 进度条据 percent<100 判为 stopped,对着一次
      // 用户【没有】取消的运行打「已停止」,并且把 failed / lineFailures 两个信号
      // 整个丢掉(doneWithFailures 以 done 为前提)。那正是 noteFileFailure 与
      // translateDoneIncomplete 要覆盖的场景。
      // 取消的 run 不钉:钉上去等于替一次主动喊停亮绿灯(DONE 态派生自 percent>=100)。
      // `p > 0 ? 100 : p` 与 runTranslation 的单文件钉【同一条规则】:批量里
      // 每个文件都在发请求前就失败时(格式不支持 / 解码失败),makeUpdateProgress
      // 从未跑过、percent 恒为 0,无条件钉会显示 100% 的琥珀色「INCOMPLETE」——
      // 声称有行保留了原文,而失败面板是空的。进度动过才钉。
      if (!isCancelRequested()) setProgressPercent((p) => (p > 0 ? 100 : p));
      // 部分/全失败时不报"已导出"(per-file error toast 已经告知细节),只在有成功时显示汇总。
      // hadRunFailures() 覆盖行级软失败:provider 整体故障时文件"导出成功"但内容
      // 是原文副本 —— 绿色成功 toast 会跟失败面板自相矛盾,降级为 warning。
      const total = multipleFiles.length;
      const failed = failedFilesRef.current;
      const succeeded = total - failed;
      if (failed === 0 && !hadRunFailures()) {
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
    let fileName = generateFileName(uploadFileName, langLabel, fileExt, multiLanguageMode);
    // both 模式下的 bilingual 预览要加 _bilingual 后缀,跟翻译时下载的 bilingual 文件名一致
    if (needsBilingualSuffix) {
      fileName = appendBilingualSuffix(fileName);
    }
    void downloadFile(translatedText, fileName);
    message.success(t("fileExported", { fileName }));
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
    const { contentLines } = filterSubLines(splitTextIntoLines(sourceText), sourceFileType);
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
  // 随 sourceText 变化复位,不在此重复。
  const clearResults = () => {
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
                    clearResults();
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
              disabled={isTranslating}
              customRequest={({ file }) => {
                clearResults();
                handleFileUpload(file as File);
              }}
              accept={uploadFileTypes.accept}
              multiple={!singleFileMode}
              showUploadList
              beforeUpload={singleFileMode ? resetUpload : undefined}
              onRemove={(file) => {
                clearResults();
                return handleUploadRemove(file);
              }}
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
                textDirection="auto"
                locked={isTranslating}
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
          </Card>
        </Col>

        {/* Right Column: Settings and Configuration */}
        <Col xs={24} lg={10} xl={9}>
          <Card
            title={<Space><SettingOutlined /> {t("configuration")}</Space>}
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
        onRetry={() => runRetry(() => (uploadMode === "single" ? runTranslation(performTranslation, sourceText, contextAware ? "subtitle" : undefined) : handleMultipleTranslate()))}
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
                  content={resultStats.displayText}
                  charCount={resultStats.charCount}
                  lineCount={resultStats.lineCount}
                  onCopy={() => copyToClipboard(translatedText)}
                  onExport={handleExportFile}
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
                  <TextArea value={extractedText} rows={10} readOnly dir="auto" aria-label={t("extractedText")} />
                </Card>
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
