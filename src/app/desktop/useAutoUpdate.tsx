"use client";
import { useEffect, useRef, useCallback } from "react";
import { useLocale } from "next-intl";
import { App, Button, Flex } from "antd";
import { useLocalStorage } from "@/app/hooks/useLocalStorage";
import { checkForUpdates, PendingUpdate, AUTO_UPDATE_ENABLED_KEY } from "./updater";
import { getUpdaterStrings } from "./updaterI18n";
import { isTauri } from "./externalLink";

const SKIPPED_KEY = "subtitle_translator_skipped_version";
const TOAST_KEY = "updater-install";

/**
 * 「发现新版本」弹窗 —— 自动检查与手动检查共用同一条路径：同一个弹窗、同一套
 * 「稍后再说 / 跳过此版本 / 立即安装」按钮，下载同样只在用户确认之后才开始。
 *
 * 为什么抽成 hook：弹窗要用 antd <App> 的 modal / message，而这两条路径在组件
 * 树上是两处 —— 自动检查住在 layout 里的副作用组件，手动检查住在工具页的设置面板。
 * 各自建一套弹窗等于两处真相（文案、按钮语义、下载时机迟早会分叉）。
 */
export const useUpdatePrompt = () => {
  const { modal, message } = App.useApp();
  const locale = useLocale();

  return useCallback(
    (update: PendingUpdate) => {
      const t = getUpdaterStrings(locale);
      const skipVersion = () => {
        try {
          localStorage.setItem(SKIPPED_KEY, update.version);
        } catch {}
      };
      const instance = modal.confirm({
        title: t.title,
        content: t.content(update.version),
        // Esc / 遮罩 / 右上 X 只【本次关掉】,不许顺手把版本标成跳过 ——
        // antd 把这三条路和取消按钮全走 onCancel,旧实现因此让一次误按 Esc
        // 永久静音这个版本。跳过只可能来自那个明确命名的按钮。
        // (1h 节流 + 24h 复查保证稍后还会再问。)
        onCancel: () => {},
        // 三按钮:稍后提醒 / 跳过此版本 / 立即安装(仍是 antd 的 okBtn,
        // 自带 onOk 的 loading 态)
        footer: (okBtn) => (
          <Flex gap={8} justify="flex-end">
            <Button onClick={() => instance.destroy()}>{t.remindLater}</Button>
            <Button
              danger
              onClick={() => {
                skipVersion();
                instance.destroy();
              }}
            >
              {t.skipVersion}
            </Button>
            {okBtn}
          </Flex>
        ),
        okText: t.installNow,
        // 下载发生在用户确认之后(检查阶段不再偷跑),随后 install() 正常会直接
        // 重启应用。包一层是给 portable exe(gotcha #8)等安装形态的失败留反馈。
        onOk: async () => {
          try {
            message.loading({ content: t.downloading(0, null), key: TOAST_KEY, duration: 0 });
            await update.downloadAndInstall((downloaded, total) => {
              message.loading({ content: t.downloading(downloaded, total), key: TOAST_KEY, duration: 0 });
            });
            // install() 成功会重启,正常走不到这;没重启(安装布局不支持)时关掉
            // 「安装中」提示,别挂一条永远转圈的消息。
            message.destroy(TOAST_KEY);
          } catch (e) {
            console.error("Update install failed:", e);
            message.destroy(TOAST_KEY);
            message.error(t.failed);
          }
        },
      });
    },
    [modal, message, locale],
  );
};

/**
 * 自动检查更新 —— 【默认关着,用户开了才检查】。
 *
 * 开关存在 localStorage（与设置面板写的是同一个键），关着的时候两个 effect 都
 * 干脆不挂定时器：不是「照常检查、拿到结果再丢掉」—— 那样「关掉」只是不再弹窗，
 * 流量照走，等于没关。
 *
 * 开着时：启动后延迟一会儿查一次（每个会话只查这一次），之后每 24h 查一次；
 * 查到什么只在【有新版可报】时才出声，检查失败保持安静（手动检查那条路才会报告）。
 */
export const useAutoUpdate = ({ startupDelay = 3000, checkInterval = 24 * 60 * 60 * 1000 } = {}) => {
  const [enabled] = useLocalStorage<boolean>(AUTO_UPDATE_ENABLED_KEY, false);
  const confirm = useUpdatePrompt();
  const checkedStartup = useRef(false);
  const lastCheck = useRef(0);

  const run = useCallback(async () => {
    if (!(await isTauri())) return;
    const now = Date.now();
    if (now - lastCheck.current < 60 * 60 * 1000) return; // throttle 1h
    lastCheck.current = now;
    // 只做检查;安装包等用户在弹窗里确认后才开始下载
    const r = await checkForUpdates();
    if (r.hasUpdate && r.update?.version) {
      let skipped = "";
      try {
        skipped = localStorage.getItem(SKIPPED_KEY) || "";
      } catch {}
      if (skipped === r.update.version) return;
      confirm(r.update);
    }
  }, [confirm]);

  // 开关中途打开也能生效:enabled 进了依赖,开的那一刻重新排一次启动检查。
  // checkedStartup 保证「每个会话只查一次」—— 关着时不消费它,留给打开后那次。
  useEffect(() => {
    if (!enabled) return;
    if (checkedStartup.current) return;
    const t = setTimeout(() => {
      checkedStartup.current = true;
      run();
    }, startupDelay);
    return () => clearTimeout(t);
  }, [run, startupDelay, enabled]);

  useEffect(() => {
    if (!enabled) return;
    const id = setInterval(run, checkInterval);
    return () => clearInterval(id);
  }, [run, checkInterval, enabled]);
};
