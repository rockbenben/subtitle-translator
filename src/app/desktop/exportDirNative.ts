import { setNativeExportDir } from "@/app/utils";
import { isTauriRuntime } from "./externalLink";

/**
 * 桌面版「导出目录」的原生实现。注入上游 utils/exportDir.ts 的口子（见那边的
 * setNativeExportDir），于是 ToolPage 标题行里那个按工具的导出目录按钮
 * （components/ExportFolder.tsx）在桌面上原样可用：位置、↺ 重置、i18n 文案、
 * 翻译期间上锁全都不用再造一遍，而那三个文件一个字都不用改 —— 它们都在
 * project_sync 的同步范围内，改了每次同步都会被覆盖。
 *
 * 目录选择与落盘都在 Rust 侧（src-tauri/src/lib.rs）：选目录走原生对话框并记进
 * 配置文件，落盘走 webview 的 on_download 钩子改写下载路径。所以这里没有 write
 * —— 上游注入后 writeToExportDir 一律返回 null，导出老实走 saveAs()，由那个钩子
 * 接住。
 */

// 【不要静态 import @tauri-apps/api】它在浏览器里 import 得进来（invoke 要到调用
// 时才炸），但会把整包塞进 web 构建的 bundle。用到时再动态取。
const invokeCmd = async <T>(cmd: string): Promise<T> => {
  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<T>(cmd);
};

/**
 * 【直接给完整路径】Rust 手里有 `C:\Users\…\subs`，就把它原样交给 UI。
 *
 * 曾经只取最后一段（跟 Web 版对齐，浏览器本来也只给文件夹名），理由是怕长路径把
 * 工具页标题行撑变形。两个问题：一是桌面壳本来就知道完整路径，丢掉是白丢；
 * 二是两个同名文件夹（`…\a\out` 与 `…\b\out`）在界面上根本分不出来，
 * 而这个按钮决定的是几十个文件落在哪。
 *
 * “撑变形”那个顾虑已经在上游 components/ExportFolder.tsx 里解决（按钮文字加了
 * 宽度上限 + 省略号，tooltip 拿完整路径）—— 实测只有「最小窗口 + 百字符路径」
 * 那一格会溢出，不值得为它把信息全扇掉。
 *
 * ⚠ 旧实现里的 `path.split(/[\/]/)` 还是错的：那个字符类只把斜杠转义了一遍，
 * 里面根本没有反斜杠 —— Windows 路径一段都切不开，3.1.1 上实际显示的本来就是
 * 整条路径（只是没人发现）。现在这是明确行为，不再是巧合。
 */
const asDir = (path: string | null): string | null => path || null;

/**
 * 【必须在模块作用域调用】supportsExportDir() 在渲染期就被读，放进 effect 就晚了
 * （按钮会先按「不支持」渲染一轮）。调用点在 TauriIntegration.tsx 顶部。
 */
export const installNativeExportDir = (): void => {
  if (!isTauriRuntime()) return; // web 构建：什么都不注入，上游照走 File System Access
  setNativeExportDir({
    // 【toolKey 一律忽略：桌面端一个目录管全站】on_download 在 Rust 侧，拿不到是
    // 哪个工具触发的这次下载，要按工具分还得让前端把「当前工具」同步给 Rust。
    // 本仓只有字幕翻译一个工具会显示这个入口，先不付那份复杂度。
    pick: async () => asDir(await invokeCmd<string | null>("choose_export_dir")),
    current: async () => asDir(await invokeCmd<string | null>("get_export_dir")),
    clear: () => invokeCmd<void>("clear_export_dir"),
  });
};
