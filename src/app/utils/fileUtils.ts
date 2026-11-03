import { saveAs } from "file-saver";
import { writeToExportDir } from "./exportDir";
/** 一次导出的落点。`dir` 有值 = 写进了用户选的导出目录（那时 `fileName` 是让路后
 *  的【实际】文件名）；`dir` 为 null = 交给了浏览器下载。 */
export interface DownloadResult {
  fileName: string;
  dir: string | null;
}

/**
 * 下载文件工具函数
 * @param {string|Blob|ArrayBuffer} content - 要下载的文件内容
 * @param {string} fileName - 下载文件的名称
 * @param {string} mimeType - 文件 MIME 类型，默认为"text/plain;charset=utf-8"
 * @returns 实际落点（见 DownloadResult）—— 提示文案要照它说话，别复述请求的名字
 */
export const downloadFile = async (content: string | Blob | ArrayBuffer, fileName: string, mimeType = "text/plain;charset=utf-8"): Promise<DownloadResult> => {
  // ⚠ Blob 构造【必须】在 try 里:超大文本(TextSplitter 合并全文)会抛 Invalid
  // string length,而只要存在不 await / 漏接 reject 的调用路径，构造落在 try 外就是一条
  // 既无日志、又无干净 Error 的 unhandled rejection。
  try {
    // 创建 Blob（如果内容不是 Blob）
    const fileBlob = content instanceof Blob ? content : new Blob([content], { type: mimeType });

    // 用户设过导出目录（且仍有权限）就直接写进去，仅 Chromium 桌面。其余情况一律
    // 返回 false，落回浏览器下载目录 —— 见 exportDir.ts 的权限说明。它自己吞掉所有
    // 异常，所以走到 saveAs 就是真该走；Node 侧没有 window，同样走 false。
    const written = await writeToExportDir(fileBlob, fileName);
    if (written) return written;
    saveAs(fileBlob, fileName);
  } catch (error) {
    // 抛出干净的 Error,避免把内部错误泄露给调用方
    console.error("File download failed: ", error);
    throw new Error(`Failed to download file "${fileName}"`);
  }
  // 保留这个小延迟：批量导出靠它给浏览器留出处理下载的时间
  await new Promise((resolve) => setTimeout(resolve, 100));
  // 浏览器下载:落点由浏览器决定,同名它自己会改成 `x (1).srt`,JS 侧看不到 ——
  // 但下载栏会显示真名,所以这里回传请求的名字不会误导用户。
  return { fileName, dir: null };
};

/**
 * 把一次导出的【实际落点】翻成一句话。落进导出目录就报目录名与让路后的真实文件名，
 * 落进浏览器下载目录就报文件名 —— 那条路径有下载栏兜底。
 *
 * 单独导出是因为批量路径（字幕 / JSON 的逐语言循环、ZIP）不走 useFileExport 这个 hook，
 * 而「界面说的目录必须等于字节去的地方」这条判据不能在每个调用点各写一遍。`t` 传
 * common 命名空间。
 *
 * `overrides` 让调用方换掉【措辞】而不必重写【判据】：分流（落目录 / 落下载栏）
 * 仍然只在这里判一次，否则调用点各写一遍 `result.dir ? … : …` 就会漂。
 * 两句要一起给 —— 只换一句会造出一句没人用得上的半截话（判据只在一个地方，
 * 措辞却是配套的一对）。
 *
 * ⚠ 住在这个纯模块里而不是 hooks/useFileExport.ts：那边带 "use client"，
 * 普通模块（batchZip.ts）从那里 import 会把 antd / next-intl 一起拖进来，
 * 服务端组件一旦 import 就是 client reference —— 纯函数没有理由背这个依赖。
 */
export const describeExport = (
  t: (key: string, values?: Record<string, string>) => string,
  result: DownloadResult,
  overrides?: { browser: string; folder: string },
): string =>
  result.dir
    ? (overrides?.folder ?? t("exportedToFolder", { dir: result.dir, fileName: result.fileName }))
    : (overrides?.browser ?? t("fileExported", { fileName: result.fileName }));

/**
 * 拆分「文件名 → 主名 + 后缀」的唯一规则。首字符的点不算后缀（`.backup` 是
 * 无后缀的文件名，不是扩展名），无后缀时回落到 `.txt`。
 *
 * 同一份文件名在同一个工具的不同导出按钮下必须得到相同后缀，所以规则只留一处。
 * 注：useExportFilename / subtitleUtils 里还有各自的历史实现（返回值形状不同、
 * 回落值不同），归并它们要动翻译系列工具，未一并处理。
 */
export const splitFileName = (fileName: string, defaultExt = ".txt"): { nameWithoutExt: string; ext: string } => {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex > 0) return { nameWithoutExt: fileName.slice(0, dotIndex), ext: fileName.slice(dotIndex) };
  return { nameWithoutExt: fileName, ext: defaultExt };
};

