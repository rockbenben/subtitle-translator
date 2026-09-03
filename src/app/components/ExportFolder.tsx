"use client";
import React, { useCallback, useEffect, useSyncExternalStore } from "react";
import { App, Button, Space, Tooltip } from "antd";
import { FolderOpenOutlined, UndoOutlined } from "@ant-design/icons";
import { useTranslations } from "next-intl";
import { supportsExportDir, isNativeExportDir, getExportDirName, pickExportDir, clearExportDir } from "@/app/utils";

/**
 * 「导出目录」—— 让导出落进用户指定的文件夹。后端见 utils/exportDir.ts；
 * 只有 Chromium 桌面有 File System Access API，其余浏览器整个控件不出现。
 *
 * 【一个工具一个目录，控件住在 ToolPage 的标题行】目录按 toolKey 分开存（见
 * utils/exportDir.ts），所以这个控件天然是页面级的：它只显示、也只影响当前工具。
 * 它曾经挂在 `ResultCard` 上（每页可以有 N 个，JSON 多语言按语言各一张卡），又曾经
 * 是全站一个目录（于是"不显示"就等于"设了也看不见"，要靠一条自动出现的补丁规则去圆）
 * —— 两个毛病在"按工具存 ＋ 放进每页只渲染一次的容器"之后一起消失。
 *
 * 【为什么不放导航栏】那是全站级容器，而 `Navigation.tsx` 被 sync 排除、各子项目
 * 自维护，挂在那里每次 merge 都要救一遍（见 #52 / #65）。ToolPage 是同步件。
 */
let currentDir: string | null = null;
const dirListeners = new Set<() => void>();

const publishDir = (dir: string | null) => {
  // 同值不通知：一页里设置控件与（未来可能的）其它读取方各读一次，读回来的是同一个值
  if (dir === currentDir) return;
  currentDir = dir;
  dirListeners.forEach((notify) => notify());
};
const subscribeDir = (notify: () => void) => {
  dirListeners.add(notify);
  return () => void dirListeners.delete(notify);
};

// 同一帧里多个实例挂载 = 多次完全相同的 IndexedDB 读，合并成一次。
// 读本身仍保留（不是纯缓存）：权限可能在别处被撤，每次挂载重新确认一遍。
let inFlightRead: { toolKey: string; promise: Promise<string | null> } | null = null;
const refreshDir = (toolKey: string): Promise<string | null> => {
  if (inFlightRead?.toolKey !== toolKey) {
    inFlightRead = {
      toolKey,
      promise: getExportDirName(toolKey).finally(() => {
        inFlightRead = null;
      }),
    };
  }
  return inFlightRead.promise;
};

let runLocked = false;
const lockListeners = new Set<() => void>();
const setRunLocked = (locked: boolean) => {
  if (locked === runLocked) return;
  runLocked = locked;
  lockListeners.forEach((notify) => notify());
};
const subscribeLock = (notify: () => void) => {
  lockListeners.add(notify);
  return () => void lockListeners.delete(notify);
};

/**
 * 「本页有长任务在跑」——锁住导出目录入口。翻译类工具在组件里调
 * `useLockExportFolder(isTranslating)` 即可。
 *
 * 【为什么是环境状态而不是 prop】控件在 `ToolPage` 里，而 `isTranslating` 在它的
 * children 内部，prop 传不上去；读 `TranslationContext` 也不行 —— 那个文件不同步给
 * 非翻译子项目，`ToolPage` import 它会让那边构建失败。
 *
 * 【为什么必须锁】写入是【每个文件现读句柄】，不是闭包快照：跑到一半改目录，会把
 * 同一批产物劈进两个文件夹。这个锁删过一次（当时判断"图标不会出现在翻译工具上"），
 * 随即被一条新的可见性规则带回漏洞 —— **「现在不显示」不等于「永远不显示」**。
 */
export const useLockExportFolder = (locked: boolean) => {
  useEffect(() => {
    setRunLocked(locked);
    return () => setRunLocked(false);
  }, [locked]);
};

/**
 * 「导出目录」入口，放在 `ToolPage` 标题行右端、与「使用说明」并列。
 *
 * 显示与否由 `ToolPage` 的 `showExportFolder` 决定（判据：这个工具一次点击会不会落
 * 多个文件）。不显示的工具**也没有自己的目录**，导出照常走浏览器下载 —— 按工具存
 * 之后不再有"设了却看不见"这回事，所以这里不需要任何自动出现的规则。
 */
export const ExportFolderButton = ({ toolKey }: { toolKey: string }) => {
  const t = useTranslations("common");
  const { message } = App.useApp();

  // 【首屏必须与 SSR 一致】静态导出的 HTML 在 Node 里预渲染，那里没有 window，直接
  // 判定就会 hydration 不匹配。用 useSyncExternalStore 而不是「effect 里 setState」
  // 拿挂载态 —— 后者会被 react-hooks/set-state-in-effect 拦下（级联渲染）。
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
  const dir = useSyncExternalStore(
    subscribeDir,
    () => currentDir,
    () => null,
  );
  const locked = useSyncExternalStore(
    subscribeLock,
    () => runLocked,
    () => false,
  );
  const available = mounted && supportsExportDir();

  // 权限不跨浏览器会话：重启后这里读回 null，界面与落盘位置一起退回下载目录，
  // 点一下即可原地补授权（不会再弹选择器）。见 exportDir.ts 文件头。
  useEffect(() => {
    if (available) void refreshDir(toolKey).then(publishDir);
  }, [available, toolKey]);

  const choose = useCallback(async () => {
    try {
      const picked = await pickExportDir(toolKey);
      if (!picked) {
        // 「没选成」既可能是取消，也可能撞上 Chrome 的目录黑名单（桌面 / 文档 / 下载 /
        // 用户目录【本身】选不了）。两者都抛 AbortError，分不开，只能给一句兼顾的提示；
        // 已经设过目录时这次点击只是想换个地方，取消什么也没改变，那句提示反而添乱。
        // 黑名单这句（exportFolderBlocked）只活在这条 toast 里 —— 它是【失败之后】才有用的
        // 补救说明；放进每次 hover 的 tooltip 就是提前上课，tooltip 只回答一件事：现在导出落在哪。
        // 而那个黑名单是 File System Access 这条路独有的：外壳注入原生选择器后根本没这回事，
        // 那里「没选成」只可能是取消 —— 再提一句就是在桌面版里说假话。
        if (currentDir === null) message.info(isNativeExportDir() ? t("exportFolderDefault") : `${t("exportFolderDefault")} ${t("exportFolderBlocked")}`);
        return;
      }
      publishDir(picked);
      message.success(t("exportFolderCurrent", { dir: picked }));
    } catch (error) {
      console.error("Choosing the export folder failed:", error);
      message.error(t("exportFolderFailed"));
    }
  }, [message, t, toolKey]);

  // Chrome 不允许选「下载」目录本身，所以设过之后没法靠再选一次选回去 ——
  // 不给重置就真的出不来了。
  const reset = useCallback(async () => {
    try {
      await clearExportDir(toolKey);
    } catch (error) {
      console.error("Clearing the export folder failed:", error);
      message.error(t("exportFolderFailed"));
    }
    // 【重读真实状态】而不是径直 publishDir(null):删除失败时句柄还在、权限还在，
    // 之后每个文件照旧写进老目录 —— 界面这时说"下载目录"就是反方向的撒谎。
    publishDir(await getExportDirName(toolKey));
  }, [message, t, toolKey]);

  if (!available) return null;

  return (
    <Space size={0}>
      <Tooltip title={dir ? t("exportFolderCurrent", { dir }) : t("exportFolderDefault")}>
        {/* || undefined:显式 false 会顶掉外层 ConfigProvider 的锁 */}
        <Button type="text" size="small" icon={<FolderOpenOutlined />} onClick={choose} disabled={locked || undefined} aria-label={t("exportFolder")}>
          {/* 目录直接写在按钮上：这个设置决定几十个文件落在哪，藏进 tooltip 太轻。
              浏览器只给文件夹名，桌面壳给的是完整路径（`C:\Users\…\subs`）—— 后者可以很长，
              而标题行是 flex：实测一条 100 字符的路径在 640px 可用宽（桌面窗口最小 720）下
              会直接溢出整行。所以给个上限 + 省略号 —— 截断无损，tooltip（exportFolderCurrent）
              拿的是同一个 `dir`，完整路径在那里。
              ⚠ 不能写成 `min(100%, 34ch)`：百分比会让按钮仍按 max-content 定宽（实测 span 被
              截到 297px，按钮还是 718px，照样溢出）。就写字符宽。 */}
          <span style={{ display: "inline-block", maxWidth: "34ch", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", verticalAlign: "bottom" }}>
            {dir ?? t("exportFolder")}
          </span>
        </Button>
      </Tooltip>
      {dir !== null && (
        <Tooltip title={t("exportFolderReset")}>
          <Button type="text" size="small" icon={<UndoOutlined />} onClick={reset} disabled={locked || undefined} aria-label={t("exportFolderReset")} />
        </Tooltip>
      )}
    </Space>
  );
};

export default ExportFolderButton;
