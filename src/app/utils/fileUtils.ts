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
