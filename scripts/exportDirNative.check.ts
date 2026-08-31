/**
 * 桌面版「导出目录」接线的自检。本仓库没有测试框架，用 node 自带的 assert 跑
 * （同 languagePreference.check.ts）。
 *
 *   npx tsx scripts/exportDirNative.check.ts
 *
 * 【为什么值得一道检查】这是一条【跨仓库】的约定：口子开在
 * src/app/utils/exportDir.ts —— 那是上游 web-tools-by-ai 的镜像文件，随时被
 * project_sync.py 整份覆盖；接口的是 src/app/desktop/exportDirNative.ts。上游哪天
 * 把 setNativeExportDir 改名或改语义，这里【静默失效】：工具页上的导出目录按钮直接
 * 不出现（supportsExportDir 回 false），或者更糟 —— 前端自己拿 File System Access
 * 写盘，绕过 Rust 的 on_download，文件落到用户没选的地方。编译器看不见这种断裂。
 */
import assert from "node:assert/strict";

// installNativeExportDir 只在 isTauriRuntime() 为真时注入，而它读的是 window 上的
// 全局 —— 必须在 import 之前就位（模块作用域会立刻调用）。所以两个 import 都是动态的，
// 也因此整段包在 async 里：tsx 把 .ts 当 CJS 跑，顶层 await 用不了。
const main = async () => {
  (globalThis as { window?: unknown }).window = { __TAURI_INTERNALS__: {} };

  const { supportsExportDir, writeToExportDir, setNativeExportDir } = await import("../src/app/utils/exportDir");
  const { installNativeExportDir } = await import("../src/app/desktop/exportDirNative");

  // 注入前：node 里没有 File System Access，判定必须是「不支持」——
  // 这条同时证明下面那个 true 是注入带来的，不是本来就真。
  assert.equal(supportsExportDir(), false, "基线不对：没注入就判定支持了，后面那条断言证明不了任何事");

  installNativeExportDir();
  assert.equal(supportsExportDir(), true, "桌面端没接上上游的注入口：工具页标题行那个导出目录按钮不会出现");

  // 落盘归 Rust 的 on_download。这里但凡自己写一次，就是绕过用户在原生对话框里选的
  // 目录 —— 文件会落在前端 IndexedDB 里记的那个句柄上。
  assert.equal(await writeToExportDir(new Blob(["x"]), "a.srt"), null, "注入之后 writeToExportDir 还在自己写盘，会绕过 Rust 的 on_download");

  setNativeExportDir(null);
  console.log("export-dir native wiring: 3 checks passed");
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
