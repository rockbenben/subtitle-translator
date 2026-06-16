"use client";
import { useState, useRef } from "react";
import { App } from "antd";
import { useTranslations } from "next-intl";
import { normalizeNewlines, decodeFileBytes } from "@/app/utils";
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
  // 读取序号守卫:FileReader.onload / decodeFileBytes 都是异步,一次读取尚未完成时
  // 又发起新读取(连续换文件)或清空(resetUpload),旧读的回调若晚到会用旧内容
  // 覆盖新状态 —— 用户看到的正文与文件列表不符,或清空后内容又冒回来。每次读取/
  // 清空自增序号,过期(seq 不再是最新)的 onload 结果直接丢弃(同 text-diff loadSeq)。
  const loadSeq = useRef(0);

  // readFile 不做序号守卫:批量消费者(chinese-conversion 用 Promise.all 并发读多文件、
  // 各自独立回调)需要【每个】回调都触发,守卫会把先发起的读丢弃 → 其 resolve 永不
  // 调用 → Promise.all 永久挂起。序号守卫只加在写【共享】sourceText 的那条路径上
  // (单文件上传 / 删到只剩一个),见 latestSourceWriter 包装。
  // onError lets batch callers settle their per-file Promise when decode/read fails.
  // Without it the success `callback` (which usually calls resolve()) never runs, so a
  // single bad file hangs the whole batch loop forever.
  const readFile = (file: File, callback: (text: string) => void, onError?: () => void) => {
    setIsFileProcessing(true);
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const buffer = e.target?.result as ArrayBuffer;
        // 编码自适应解码(UTF-8 fatal 试解 → jschardet 检测)抽到共享的
        // decodeFileBytes —— 词汇表/保护规则导入同此管线,策略说明见 fileUtils。
        const text = await decodeFileBytes(buffer);
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

  // 把「写入共享 sourceText」的回调用当前读取序号封一层:换文件 / 清空会自增序号,
  // 较早读取的过期 onload 写回时序号已变 → 丢弃,不覆盖新文件内容或清空后的空态。
  // 批量读取各自独立,不经此路径,故不受影响。
  const latestSourceWriter = () => {
    const seq = ++loadSeq.current;
    return (text: string) => {
      if (seq === loadSeq.current) setSourceText(text);
    };
  };

  const resetUpload = () => {
    loadSeq.current++; // 取消所有在途读取:清空后过期 onload 不得把内容写回来
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
      readFile(uploadedFile, latestSourceWriter());
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
        readFile(updatedMultipleFiles[0], latestSourceWriter());
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
