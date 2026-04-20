"use client";
import { useState } from "react";
import { normalizeNewlines } from "@/app/utils";
import type { UploadFile, UploadProps } from "antd";

// Shared dedup predicate: match by name + size
const isDuplicateFile = (a: { name: string; size?: number }, b: { name: string; size?: number }): boolean => a.name === b.name && a.size === b.size;

const useFileUpload = () => {
  const [sourceText, setSourceText] = useState<string>("");
  const [multipleFiles, setMultipleFiles] = useState<File[]>([]);
  const [uploadMode, setUploadMode] = useState<"single" | "multiple">("single");
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [singleFileMode, setSingleFileMode] = useState(false);
  const [isFileProcessing, setIsFileProcessing] = useState<boolean>(false);

  const readFile = (file: File, callback: (text: string) => void) => {
    setIsFileProcessing(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(buffer);

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

      // 解码文件内容
      const decoder = new TextDecoder(detected.encoding || "utf-8");
      const text = decoder.decode(uint8Array);
      const normalized = normalizeNewlines(text);
      callback(normalized);
      setIsFileProcessing(false);
    };

    reader.onerror = (error) => {
      console.error("读取文件出错：", error);
      setIsFileProcessing(false);
    };
    reader.readAsArrayBuffer(file);
  };

  const resetUpload = () => {
    //setFile(null);
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

    // Return false to prevent default upload behavior
    return false;
  };

  const handleUploadRemove: UploadProps["onRemove"] = (file: UploadFile) => {
    // 从 fileList 中移除
    const updatedFileList = fileList.filter((f) => f.uid !== file.uid);
    setFileList(updatedFileList);

    // 从 multipleFiles 中移除
    setMultipleFiles((prevFiles) => {
      const updatedMultipleFiles = prevFiles.filter((f) => !isDuplicateFile(f, file));

      // 如果只剩下一个文件，则切换到单文件模式，且读取文件内容
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
