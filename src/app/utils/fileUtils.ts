/**
 * 下载文件工具函数
 * @param {string|Blob|ArrayBuffer} downloadFileData - 要下载的文件内容
 * @param {string} downloadFileName - 下载文件的名称
 * @param {string} mimeType - 文件 MIME 类型，默认为"text/plain;charset=utf-8"
 * @returns {void}
 */
export const downloadFile = (downloadFileData, downloadFileName, mimeType = "text/plain;charset=utf-8") => {
  return new Promise((resolve, reject) => {
    try {
      // 如果下载数据不是 Blob 类型，则创建 Blob
      const fileBlob = downloadFileData instanceof Blob ? downloadFileData : new Blob([downloadFileData], { type: mimeType });

      // 创建下载链接
      const link = document.createElement("a");
      link.href = URL.createObjectURL(fileBlob);
      link.download = downloadFileName;

      // 模拟点击下载
      document.body.appendChild(link); // 在某些浏览器中需要将链接添加到 DOM
      // 添加一个小延迟以确保浏览器有时间处理下载
      setTimeout(() => {
        link.click();

        // 清理
        setTimeout(() => {
          document.body.removeChild(link);
          URL.revokeObjectURL(link.href);
          resolve(downloadFileName);
        }, 100); // 额外延迟以确保浏览器有足够时间处理下载
      }, 100);
    } catch (error) {
      console.error("File download failed: ", error);
      reject(error);
    }
  });
};
