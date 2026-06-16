"use client";
import { useEffect, useRef, useCallback } from "react";
import { App } from "antd";
import { checkForUpdates, UpdateCheckResult } from "@/app/utils/updater";
import { isTauri } from "@/app/utils/externalLink";

const SKIPPED_KEY = "subtitle_translator_skipped_version";

export const useAutoUpdate = ({ startupDelay = 3000, checkInterval = 24 * 60 * 60 * 1000 } = {}) => {
  const { modal, message } = App.useApp();
  const checkedStartup = useRef(false);
  const lastCheck = useRef(0);

  const confirm = useCallback(
    (r: UpdateCheckResult) => {
      modal.confirm({
        title: "Update Available",
        content: `Version ${r.version} downloaded. Install now and restart?`,
        okText: "Install Now",
        cancelText: "Skip This Version",
        // install() relaunches the app on success, so a resolved promise here
        // normally means we never return. Wrap it anyway: on the portable exe
        // (gotcha #8) and other install-layout failures it rejects, and without
        // this the rejection is swallowed silently with no user feedback.
        onOk: async () => {
          message.loading({ content: "Installing update…", key: "installing", duration: 0 });
          try {
            await r.install?.();
          } catch (e) {
            console.error("Install failed:", e);
            message.destroy("installing");
            message.error("Installation failed. Please download the latest version manually.");
          }
        },
        onCancel: () => {
          try {
            localStorage.setItem(SKIPPED_KEY, r.version!);
          } catch {}
        },
      });
    },
    [modal, message],
  );

  const run = useCallback(async () => {
    if (!(await isTauri())) return;
    const now = Date.now();
    if (now - lastCheck.current < 60 * 60 * 1000) return; // throttle 1h
    lastCheck.current = now;
    const r = await checkForUpdates();
    if (r.hasUpdate && r.downloaded && r.version) {
      let skipped = "";
      try {
        skipped = localStorage.getItem(SKIPPED_KEY) || "";
      } catch {}
      if (skipped === r.version) return;
      confirm(r);
    }
  }, [confirm]);

  useEffect(() => {
    if (checkedStartup.current) return;
    const t = setTimeout(() => {
      checkedStartup.current = true;
      run();
    }, startupDelay);
    return () => clearTimeout(t);
  }, [run, startupDelay]);

  useEffect(() => {
    const id = setInterval(run, checkInterval);
    return () => clearInterval(id);
  }, [run, checkInterval]);
};
