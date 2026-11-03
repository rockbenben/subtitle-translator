"use client";

import { useCallback } from "react";
import { App } from "antd";
import { useTranslations } from "next-intl";
import { downloadFile, describeExport } from "@/app/utils";

/**
 * 「导出一个文件并如实汇报」—— 一次导出的完整动作，所有工具页共用一份。
 *
 * 【为什么必须有它】此前各处都是这两行：
 *
 *     void downloadFile(result, fileName);
 *     message.success(t("fileExported", { fileName }));
 *
 * 不 await 就报成功 —— `downloadFile` 真会 reject（超大文本上 `new Blob()` 抛
 * Invalid string length），那时用户看到绿字、控制台里是一条没人接的 unhandled
 * rejection、文件根本不存在。`TextSplitter` 早就把这件事写在注释里并单独修过，
 * 但只修了它自己那一处。判据统一收进这里，调用点不用再各自记得 await。
 *
 * ⚠ 分流本身在 downloadFile 里（见 utils/exportDir.ts），这里只负责【如实转述】
 * 它回传的落点：落进导出目录就报目录名与让路后的真实文件名，落进浏览器下载目录
 * 就维持原来那句 —— 那条路径有下载栏兜底，浏览器改的名用户看得见。
 *
 * 措辞与判据的拆分见 utils/fileUtils.ts 的 describeExport（纯模块，不带
 * "use client" —— 批量路径那边要 import 它）。
 */
export const useFileExport = () => {
  const t = useTranslations("common");
  const { message } = App.useApp();

  return useCallback(
    /**
     * @param successText 覆盖默认的「已导出 {fileName}」提示（个别工具有自己的说法）
     */
    async (content: string | Blob | ArrayBuffer, fileName: string, mimeType?: string, successText?: string): Promise<void> => {
      try {
        // 照【实际落点】说话，不是复述请求的名字:写进导出目录时同名会让路改名，
        // 而那条路径没有下载栏，这句提示是唯一的反馈。
        const result = await downloadFile(content, fileName, mimeType);
        message.success(successText ?? describeExport(t, result));
      } catch (error) {
        console.error("Export failed: ", error);
        message.error(t("exportFailed", { fileName }));
      }
    },
    [message, t],
  );
};
