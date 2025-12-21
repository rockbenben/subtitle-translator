"use client";
import { useState } from "react";
import { normalizeNewlines } from "@/app/utils";
import type { UploadFile, UploadProps } from "antd";
import jschardet from "jschardet";

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

    reader.onload = (e) => {
      const buffer = e.target?.result as ArrayBuffer;
      const uint8Array = new Uint8Array(buffer);

      // 大文件性能优化：仅抽样前 512KB 用于编码检测，避免将整文件转为字符串
      const SAMPLE_SIZE = 512 * 1024;
      const sample = uint8Array.subarray(0, Math.min(SAMPLE_SIZE, uint8Array.length));
      const sampleString = Array.from(sample)
        .map((byte) => String.fromCharCode(byte))
        .join("");

      // 检测编码（基于样本），后续仍对完整内容进行解码
      const detected = jschardet.detect(sampleString);
      console.log("Detected encoding", detected);

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

    // Deduplicate files based on name and size
    const uniqueFileList = updatedFileList.filter((value, index, self) => index === self.findIndex((t) => t.name === value.name && t.size === value.size));
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
        // Prevent adding duplicate files
        const isFileAlreadyAdded = prevFiles.some((existingFile) => existingFile.name === uploadedFile.name && existingFile.size === uploadedFile.size);

        // 如果文件未添加，则添加
        if (!isFileAlreadyAdded) {
          const newFiles = [...prevFiles, uploadedFile];
          console.log("New multiple files", newFiles);
          return newFiles;
        }

        return prevFiles;
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
      // 使用文件名和大小作为唯一标识
      const updatedMultipleFiles = prevFiles.filter((f) => !(f.name === file.name && f.size === file.size));

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
