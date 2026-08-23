"use client";
import { isTauri } from "./externalLink";

export interface UpdateCheckResult {
  hasUpdate: boolean;
  version?: string;
  downloaded?: boolean;
  install?: () => Promise<void>;
  error?: string;
}

export const checkForUpdates = async (): Promise<UpdateCheckResult> => {
  if (!(await isTauri())) return { hasUpdate: false, error: "Not in Tauri" };
  try {
    const { check } = await import("@tauri-apps/plugin-updater");
    const update = await check();
    if (!update) return { hasUpdate: false };
    await update.download(); // auto-download, install on confirm
    return { hasUpdate: true, version: update.version, downloaded: true, install: () => update.install() };
  } catch (error) {
    return { hasUpdate: false, error: String(error) };
  }
};
