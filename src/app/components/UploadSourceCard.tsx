"use client";

import type { ComponentProps, ReactNode } from "react";
import { App, Button, Card, Space, Tooltip, Upload } from "antd";
import { ClearOutlined, InboxOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import SourceArea from "@/app/components/SourceArea";
import type useFileUpload from "@/app/hooks/useFileUpload";

type UploadState = Pick<ReturnType<typeof useFileUpload>, "sourceText" | "setSourceText" | "fileList" | "uploadMode" | "singleFileMode" | "handleFileUpload" | "handleUploadRemove" | "handleUploadChange" | "resetUpload">;

interface UploadSourceCardProps {
  /** `useFileUpload()` 的返回值整个传进来。 */
  upload: UploadState;
  /** `useTextStats(upload.sourceText)`。 */
  stats: ComponentProps<typeof SourceArea>["stats"];
  fileTypes: { accept: string; label: string };
  /** 提示里的格式列表,默认 `fileTypes.label`。 */
  formatsHint?: string;
  /** 允许一次拖多个文件;仍受 `upload.singleFileMode` 约束。 */
  multiFile?: boolean;
  /** 「清空」按钮在 resetUpload 之外还要清掉的东西(产物、键名…)。 */
  onClear?: () => void;
  /** 源被替换(拖入新文件 / 删文件)时连带清掉的产物。 */
  onSourceChange?: () => void;
  /** 运行中锁定上传、编辑与清空(CLAUDE.md「运行中的设置锁」)。 */
  locked?: boolean;
  rows?: number;
  textDirection?: ComponentProps<typeof SourceArea>["textDirection"];
  className?: string;
  /** 跟在源文本框后面的东西(翻译按钮、进度条…)。 */
  children?: ReactNode;
}

/**
 * 「输入区」卡片:拖拽上传 + 源文本框 + 清空按钮。曾经在 13 个工具页各手写一份
 * (约 50 行 × 13),文案一律取 common 命名空间。
 *
 * - `disabled={locked || undefined}`:与 CLAUDE.md 的 antd 陷阱 #2 一致,不锁时不发显式 false。
 * - `showUploadList` 传裸布尔:Upload 的 disabled 才会连带撤掉文件列表的删除 ✕(陷阱 #3)。
 * - 多文件模式下源文本框只在 `uploadMode === "single"` 时出现(单文件工具永远是 single)。
 */
const UploadSourceCard = ({ upload, stats, fileTypes, formatsHint, multiFile = false, onClear, onSourceChange, locked = false, rows, textDirection, className, children }: UploadSourceCardProps) => {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const single = !multiFile || upload.singleFileMode;
  return (
    <Card
      className={className}
      title={
        <Space>
          <InboxOutlined /> {t("sourceArea")}
        </Space>
      }
      extra={
        <Tooltip title={t("resetUploadTooltip")}>
          <Button
            type="text"
            danger
            disabled={locked || undefined}
            icon={<ClearOutlined />}
            aria-label={t("clearAll")}
            onClick={() => {
              upload.resetUpload();
              onClear?.();
              message.success(t("resetUploadSuccess"));
            }}>
            {t("clearAll")}
          </Button>
        </Tooltip>
      }>
      <Upload.Dragger
        disabled={locked || undefined}
        customRequest={({ file }) => {
          onSourceChange?.();
          upload.handleFileUpload(file as File);
        }}
        accept={fileTypes.accept}
        multiple={!single}
        showUploadList
        beforeUpload={single ? upload.resetUpload : undefined}
        onRemove={(file) => {
          onSourceChange?.();
          return upload.handleUploadRemove(file);
        }}
        onChange={upload.handleUploadChange}
        fileList={upload.fileList}
        className="mb-2">
        <p className="ant-upload-drag-icon">
          <InboxOutlined />
        </p>
        <p className="ant-upload-text">{t("dragAndDropText")}</p>
        <p className="ant-upload-hint">
          {t("supportedFormats")} {formatsHint ?? fileTypes.label}
        </p>
      </Upload.Dragger>
      {upload.uploadMode === "single" && (
        <SourceArea textDirection={textDirection} locked={locked} sourceText={upload.sourceText} setSourceText={upload.setSourceText} stats={stats} placeholder={t("pasteUploadContent")} ariaLabel={t("sourceArea")} rows={rows} />
      )}
      {children}
    </Card>
  );
};

export default UploadSourceCard;
