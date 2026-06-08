"use client";
import { useState } from "react";
import { App } from "antd";
import { useTranslations } from "next-intl";
import { normalizeNewlines } from "@/app/utils";
import type { UploadFile, UploadProps } from "antd";

// Shared dedup predicate: match by name + size
const isDuplicateFile = (a: { name: string; size?: number }, b: { name: string; size?: number }): boolean => a.name === b.name && a.size === b.size;

const useFileUpload = () => {
  const { message } = App.useApp();
  const t = useTranslations("common");
  const [sourceText, setSourceText] = useState<string>("");
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<"single" | "multiple">("single");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [singleFileMode, setSingleFileMode] = useState(false);
  const [isFileProcessing, setIsFileProcessing] = useState<boolean>(false);

  // onError lets batch callers settle their per-file Promise when decode/read fails.
  // Without it the success `callback` (which usually calls resolve()) never runs, so a
  // single bad file hangs the whole batch loop forever.
  const readFile = (file: File, callback: (text: string) => void, onError?: () => void) => {
    setIsFileProcessing(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        const uint8Array = new Uint8Array(buffer);

        // 解码策略:先用 UTF-8 fatal 模式对【全文】试解 —— UTF-8 是自验证编码,
        // fatal 解码成功就几乎确定是 UTF-8。此前的"前 512KB 样本检测 + 全文按
        // 检测结果解码"对开头长段纯 ASCII 的大文件会误判(ascii/windows-1252),
        // 后部的 UTF-8 多字节字符整体 mojibake。真正的 legacy 编码(GBK/UTF-16
        // 等)会让 fatal 解码抛错,才落到 jschardet 检测路径。
        let text: string;
        try {
          text = new TextDecoder("utf-8", { fatal: true }).decode(uint8Array);
        } catch {
          // Sample first 512KB for encoding detection (avoids converting full file to string)
          const SAMPLE_SIZE = 512 * 1024;
          const sample = uint8Array.subarray(0, Math.min(SAMPLE_SIZE, uint8Array.length));
          // Build binary string where charCode === byte value (required by jschardet)
          // Cannot use TextDecoder("latin1") because browsers map it to Windows-1252,
          // which remaps bytes 0x80-0x9F to different code points and breaks detection
          let sampleString = "";
          for (let i = 0; i < sample.length; i += 8192) {
            sampleString += String.fromCharCode.apply(null, sample.subarray(i, i + 8192) as unknown as number[]);
          }

          // 检测编码（基于样本），后续仍对完整内容进行解码
          // Lazy load jschardet
          const jschardet = (await import("jschardet")).default;
          const detected = jschardet.detect(sampleString);

          // jschardet 可能返回 TextDecoder 不认的标签（或乱码标签），
          // new TextDecoder(label) 会抛 RangeError —— 回退到 utf-8 而不是让整个回调崩掉。
          let decoder: TextDecoder;
          try {
            decoder = new TextDecoder(detected.encoding || "utf-8");
          } catch {
            decoder = new TextDecoder("utf-8");
          }
          text = decoder.decode(uint8Array);
        }
        callback(normalizeNewlines(text));
      } catch (error) {
        // jschardet 加载失败 / 解码异常等：别让 onload 静默 reject（否则下方 finally 之外
        // 的 setIsFileProcessing(false) 永远不执行，处理中遮罩会一直转）。
        console.error("处理文件出错：", error);
        message.warning(t("fileProcessFailed"));
        onError?.();
      } finally {
        setIsFileProcessing(false);
      }
    };

    reader.onerror = (error) => {
      console.error("读取文件出错：", error);
      message.error(t("fileReadFailed"));
      onError?.();
      setIsFileProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const resetUpload = () => {
    setFileList([]);
    setMultipleFiles([]);
    setSourceText("");
    setUploadMode("single");
  };

  const handleUploadChange: UploadProps["onChange"] = ({ fileList }: { fileList: UploadFile[] }) => {
    const updatedFileList: UploadFile[] = fileList.map((f) => ({
      uid: f.uid,
      name: f.name,
      status: "done",
      size: f.size,
      originFileObj: f.originFileObj,
    }));

    const uniqueFileList = updatedFileList.filter((value, index, self) => index === self.findIndex((t) => isDuplicateFile(t, value)));
    setFileList(uniqueFileList);

    if (uniqueFileList.length > 1 && uploadMode === "single") {
      setSourceText("");
      setUploadMode("multiple");
    } else if (uniqueFileList.length === 0) {
      resetUpload();
    }
  };

  const handleFileUpload = (uploadedFile: File) => {
    if (uploadMode === "single") {
      setSourceText("");
      setMultipleFiles([uploadedFile]);
      readFile(uploadedFile, (text) => {
        setSourceText(text);
      });
    } else {
      setMultipleFiles((prevFiles) => {
        if (prevFiles.some((f) => isDuplicateFile(f, uploadedFile))) return prevFiles;
        return [...prevFiles, uploadedFile];
      });
    }

    // antd Upload uses `false` return to suppress its default XHR upload —
    // we just collect the file into state and process locally.
    return false;
  };

  const handleUploadRemove: UploadProps["onRemove"] = (file: UploadFile) => {
    const updatedFileList = fileList.filter((f) => f.uid !== file.uid);
    setFileList(updatedFileList);

    setMultipleFiles((prevFiles) => {
      const updatedMultipleFiles = prevFiles.filter((f) => !isDuplicateFile(f, file));

      // Down to one file → flip back to single mode + load its content.
      if (updatedMultipleFiles.length === 1 && uploadMode === "multiple") {
        setUploadMode("single");
        readFile(updatedMultipleFiles[0], (text) => {
          setSourceText(text);
        });
      }

      return updatedMultipleFiles;
    });
  };

  return {
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
  };
};

export default useFileUpload;
