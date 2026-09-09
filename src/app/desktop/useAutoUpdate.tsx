"use client";
import { useEffect, useRef, useCallback } from "react";
import { App, Button, Flex } from "antd";
import { checkForUpdates, UpdateCheckResult } from "./updater";
import { isTauri } from "./externalLink";

const SKIPPED_KEY = "subtitle_translator_skipped_version";

export const useAutoUpdate = ({ startupDelay = 3000, checkInterval = 24 * 60 * 60 * 1000 } = {}) => {
  const { modal, message } = App.useApp();
  const checkedStartup = useRef(false);
  const lastCheck = useRef(0);

  const confirm = useCallback(
    (r: UpdateCheckResult) => {
      const skipVersion = () => {
        try {
          localStorage.setItem(SKIPPED_KEY, r.version!);
        } catch {}
      };
      const instance = modal.confirm({
        title: "Update Available",
        content: `Version ${r.version} downloaded. Install now and restart?`,
        // Esc / 遮罩 / 右上 X 只【本次关掉】,不许顺手把版本标成跳过 ——
        // antd 把这三条路和取消按钮全走 onCancel,旧实现因此让一次误按 Esc
        // 永久静音这个版本。跳过只可能来自那个明确命名的按钮。
        // (1h 节流 + 24h 复查保证稍后还会再问。)
        onCancel: () => {},
        // 三按钮:稍后提醒 / 跳过此版本 / 立即安装(仍是 antd 的 okBtn,
        // 自带 onOk 的 loading 态)
        footer: (okBtn) => (
          <Flex gap={8} justify="flex-end">
            <Button onClick={() => instance.destroy()}>Remind me later</Button>
            <Button
              danger
              onClick={() => {
                skipVersion();
                instance.destroy();
              }}
            >
              Skip This Version
            </Button>
            {okBtn}
          </Flex>
        ),
        okText: "Install Now",
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
