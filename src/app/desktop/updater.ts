"use client";
import { isTauri } from "./externalLink";

export type DownloadProgress = (downloaded: number, total: number | null) => void;

export interface PendingUpdate {
  version: string;
  currentVersion: string;
  /// 用户确认后才下载 —— 检查阶段不再预先把安装包拉下来(旧实现在后台静默下载,
  /// 用户点了 Skip 流量照花,且 capabilities 也被迫开 download-and-install)。
  /// JS 插件的 Progress 事件只给 chunkLength,总量在 Started 事件里,这里累加。
  downloadAndInstall: (onProgress?: DownloadProgress) => Promise<void>;
}

export interface UpdateCheckResult {
  hasUpdate: boolean;
  update?: PendingUpdate;
  error?: string;
}

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  if (!(await isTauri())) return { hasUpdate: false, error: "Not in Tauri" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { hasUpdate: false };
    return {
      hasUpdate: true,
      update: {
        version: update.version,
        currentVersion: update.currentVersion,
        downloadAndInstall: async (onProgress) => {
          let downloaded = 0;
          let total: number | null = null;
          await update.download((event) => {
            if (event.event === "Started") {
              total = event.data.contentLength ?? null;
            } else if (event.event === "Progress") {
              downloaded += event.data.chunkLength;
              onProgress?.(downloaded, total);
            }
          });
          await update.install();
        },
      },
    };
  } catch (error) {
    return { hasUpdate: false, error: String(error) };
  }
};
