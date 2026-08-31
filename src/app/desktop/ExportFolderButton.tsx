"use client";
import React, { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import { App, Button, Tooltip } from "antd";
import { FolderOpenOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { isTauriRuntime } from "./externalLink";

/**
 * 桌面版「导出目录」入口。Web 构建里渲染成 null。
 *
 * 【文案复用上游的 common.exportFolder*】messages/*.json 由上游 project_sync.py
 * 以 filter_messages 模式全量托管，本地新增的 key 每次同步都会被抹掉 —— 但这几个
 * key 是上游自己在维护的（Web 版同名功能在用），同步只会把它们再送一遍。桌面
 * 【专属】的新文案仍然加不了，所以托盘菜单还是硬编码英文。
 *
 * 落盘与目录选择都在 Rust 侧（见 src-tauri/src/lib.rs）：真正改写下载路径的是
 * webview 的 on_download 钩子，这里只负责让用户看得见、点得到。
 */
export default function ExportFolderButton({ iconStyle }: { iconStyle?: React.CSSProperties }) {
  const t = useTranslations("common");
  const { message } = App.useApp();
  const [dir, setDir] = useState<string | null>(null);

  // 【不能直接用 isTauriRuntime() 决定首屏】静态导出时首屏在 Node 里预渲染，
  // 那里必然是 false；客户端首次渲染必须与 HTML 一致，否则 hydration 不匹配。
  // 用 useSyncExternalStore 而不是「effect 里 setState」拿挂载态：后者会被
  // react-hooks/set-state-in-effect 拦下（级联渲染），Navigation.tsx 的主题
  // 图标用的也是这一套。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const isDesktop = mounted && isTauriRuntime();

  useEffect(() => {
    if (!isDesktop) return;
    void (async () => {
      try {
        const { invoke } = await import("@tauri-apps/api/core");
        setDir(await invoke<string | null>("get_export_dir"));
      } catch (e) {
        console.error("get_export_dir failed:", e);
      }
    })();
  }, [isDesktop]);

  const handleClick = useCallback(async () => {
    try {
      const { invoke } = await import("@tauri-apps/api/core");
      const picked = await invoke<string | null>("choose_export_dir");
      if (!picked) return; // 用户取消 —— 什么都不改，也不打扰
      setDir(picked);
      message.success(t("exportFolderCurrent", { dir: picked }));
    } catch (e) {
      console.error("choose_export_dir failed:", e);
      message.error(t("exportFolderFailed"));
    }
  }, [message, t]);

  if (!isDesktop) return null;

  return (
    // 未设目录时【只显示按钮名】，不复用 exportFolderDefault —— 那句写的是
    // Chrome 的目录黑名单（桌面 / 文档 / 下载选不了），原生对话框没有这条限制。
    <Tooltip title={dir ? t("exportFolderCurrent", { dir }) : t("exportFolder")}>
      <Button type="text" icon={<FolderOpenOutlined style={iconStyle} />} onClick={handleClick} aria-label={t("exportFolder")} />
    </Tooltip>
  );
}
