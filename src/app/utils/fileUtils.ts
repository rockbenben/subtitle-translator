import { saveAs } from "file-saver";
/**
 * 下载文件工具函数
 * @param {string|Blob|ArrayBuffer} content - 要下载的文件内容
 * @param {string} fileName - 下载文件的名称
 * @param {string} mimeType - 文件 MIME 类型，默认为"text/plain;charset=utf-8"
 * @returns {void}
 */
export const downloadFile = (content: string | Blob | ArrayBuffer, fileName: string, mimeType = "text/plain;charset=utf-8"): Promise<string> => {
  return new Promise((resolve, reject) => {
    try {
      // 创建 Blob（如果内容不是 Blob）
      const fileBlob = content instanceof Blob ? content : new Blob([content], { type: mimeType });
      saveAs(fileBlob, fileName);
      // 添加一个小延迟以确保浏览器有时间处理下载
      setTimeout(() => resolve(fileName), 100);
    } catch (error) {
      // 抛出干净的 Error,避免把 saveAs 内部错误泄露给调用方
      console.error("File download failed: ", error);
      reject(new Error(`Failed to download file "${fileName}"`));
    }
  });
};

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

