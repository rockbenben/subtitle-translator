import type { MessageInstance } from "antd/es/message/interface";
import { lazyImport } from "@/app/lib/autoReload";
import { describeError, describeExport, downloadFile, splitFileName } from "@/app/utils";

/**
 * 未压缩产物的预估上限。超过它时退回逐文件下载 —— ZIP 要在标签页里同时装下
 * 全部译文和生成中的 blob，7.5MB 源 × 121 语种的双语产物已经上 GB。
 */
export const ZIP_MAX_ESTIMATED_BYTES = 256 * 1024 * 1024;

export type ZipEstimateProfile = "subtitle-translatedOnly" | "subtitle-bilingual" | "subtitle-both" | "markdown" | "json";

// 字幕产物 ≈ 时间码 + 原文 + 译文；Markdown / JSON 产物 ≈ 源结构 + 译文。
// 系数取保守值（拉丁→天城文/西里尔这类字节能涨到 2 倍以上），宁可少打包一次，
// 也别在生成 zip 时把标签页顶爆。
const ZIP_ESTIMATE_FACTOR: Record<ZipEstimateProfile, number> = {
  "subtitle-translatedOnly": 2.5,
  "subtitle-bilingual": 3.5,
  "subtitle-both": 4,
  markdown: 2.5,
  json: 2.5,
};

export interface ZipEntry {
  name: string;
  content: string;
}

/** 发请求前的体积预估（in bytes）。 */
export const estimateZipBytes = (sourceText: string, langCount: number, profile: ZipEstimateProfile): number => {
  const sourceBytes = new TextEncoder().encode(sourceText).length;
  return sourceBytes * langCount * ZIP_ESTIMATE_FACTOR[profile];
};

/**
 * 已有产物的真实字节（未压缩）。
 *
 * 与 estimateZipBytes 同一个单位 —— 最终产物的字节数：那条是发请求前的【保守
 * 代理】（那时还不知道译文多大，系数宁可取大，早点拒绝能省下一整轮等待），这条
 * 是产物已经成形后量到的真值。
 *
 * ⚠ 别把系数再乘一遍：那会把「源文 → 产物的膨胀」算两次，让已经成品的体积凭空
 * 涨 2.5 倍，Export All 于是拒掉 100~250MB 这种本来打得下的产物 —— 而那时的
 * 兜底是逐文件下载，正好撞上浏览器的多文件下载拦截。迟一点拒绝没有收益：
 * 产物已经在内存里了，早拒绝才有意义。
 *
 * 两条闸因此【故意】宽严不同（运行期那道按代理拒，现实收紧度约为它的 1/2.5；
 * Export All 那道按真值拒）。这不是漏了一处 —— 真值天然落在百兆以内：那一轮
 * 翻译先被运行期那道闸按「源文 × 语种 × 系数」拦过一轮了。
 */
export const zipEntriesBytes = (entries: readonly ZipEntry[]): number => entries.reduce((sum, entry) => sum + new TextEncoder().encode(entry.content).length, 0);

export const buildBatchZip = async (entries: readonly ZipEntry[]): Promise<Blob> => {
  const JSZip = (await lazyImport(() => import("jszip"))).default;
  const zip = new JSZip();
  for (const entry of entries) zip.file(entry.name, entry.content);
  return zip.generateAsync({ type: "blob" });
};

/**
 * ZIP 名与逐文件导出用同一套点分段：`movie.translations.zip`，
 * 重试包 `movie.translations.retry.zip`。
 *
 * ⚠ 别改回下划线：本仓的产物命名约定是「点分独立段」（`movie.zh.srt`、
 * `movie.zh.bilingual.srt`），下划线会把 `translations_retry` 粘成一整段。
 * `.translations` 不是标准 flag，只是「这一包是译文」的可读标签 —— 与
 * `.bilingual` 同一类，不参与语种识别，只负责防重名 + 可读。
 */
export const batchZipFileName = (sourceFileName: string, isRetry: boolean): string =>
  `${splitFileName(sourceFileName).nameWithoutExt}${isRetry ? ".translations.retry.zip" : ".translations.zip"}`;

/**
 * 收尾：打包 + 一次下载 + 提示。降级为 warning 而不是绿色成功，避免和同屏的
 * 失败面板对冲（取消 / 语言级失败 / 行级软失败都由调用方传进来）。
 *
 * 返回【产物是否真的落盘】——调用方要在这之后才敢记账（「已导出：xx、yy」不该在
 * 字节还没写出去时就先记上）。
 */
export const finalizeBatchZip = async ({
  entries,
  sourceFileName,
  isRetry,
  hasFailures,
  t,
  message,
}: {
  entries: readonly ZipEntry[];
  sourceFileName: string;
  isRetry: boolean;
  hasFailures: boolean;
  t: (key: string, values?: Record<string, string | number | Date>) => string;
  message: MessageInstance;
}): Promise<boolean> => {
  try {
    const zipBlob = await buildBatchZip(entries);
    const written = await downloadFile(zipBlob, batchZipFileName(sourceFileName, isRetry), "application/zip");
    // 落点照【实际去处】说话：写进导出目录就报目录名 + 让路后的真实文件名，
    // 落进下载栏就报文件名。判据（哪条分支）只在 describeExport 里判一次。
    const text = describeExport(t, written, {
      browser: t("zipExported", { fileName: written.fileName, count: entries.length }),
      folder: t("zipExportedToFolder", { dir: written.dir ?? "", fileName: written.fileName, count: entries.length }),
    });
    if (hasFailures) message.warning(text, 10);
    else message.success(text, 10);
    return true;
  } catch (error: unknown) {
    message.error(t("zipExportFailed", { error: describeError(error, t) }), 10);
    return false;
  }
};
