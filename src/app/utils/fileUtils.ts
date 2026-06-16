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
 * 把文件字节解码为字符串(编码自适应)。
 * 策略:先用 UTF-8 fatal 模式对全文试解 —— UTF-8 是自验证编码,成功即几乎
 * 确定是 UTF-8;失败(GBK/Big5/UTF-16 等 legacy 编码)才取样喂 jschardet 检测。
 * 从 useFileUpload.readFile 中提取成共享工具:词汇表 TSV / 保护规则词典的
 * 导入此前用 readAsText(只会按 UTF-8 解),中文 Windows 上 Excel 导出的
 * ANSI/GBK 文件被解成 U+FFFD 乱码后【静默持久化】进 localStorage,翻译/转换
 * 时规则永远匹配不上。
 */
export const decodeFileBytes = async (buffer: ArrayBuffer): Promise<string> => {
  const uint8Array = new Uint8Array(buffer);
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(uint8Array);
  } catch {
    // Sample first 512KB for encoding detection (avoids converting full file to string)
    const SAMPLE_SIZE = 512 * 1024;
    const sample = uint8Array.subarray(0, Math.min(SAMPLE_SIZE, uint8Array.length));
    // Build binary string where charCode === byte value (required by jschardet).
    // Cannot use TextDecoder("latin1") because browsers map it to Windows-1252,
    // which remaps bytes 0x80-0x9F to different code points and breaks detection.
    let sampleString = "";
    for (let i = 0; i < sample.length; i += 8192) {
      sampleString += String.fromCharCode.apply(null, sample.subarray(i, i + 8192) as unknown as number[]);
    }

    // 检测编码(基于样本),后续仍对完整内容进行解码。Lazy load jschardet。
    const jschardet = (await import("jschardet")).default;
    const detected = jschardet.detect(sampleString);

    // jschardet 可能返回 TextDecoder 不认的标签(或乱码标签),
    // new TextDecoder(label) 会抛 RangeError —— 回退到 utf-8 而不是让调用方崩掉。
    let decoder: TextDecoder;
    try {
      decoder = new TextDecoder(detected.encoding || "utf-8");
    } catch {
      decoder = new TextDecoder("utf-8");
    }
    return decoder.decode(uint8Array);
  }
};
