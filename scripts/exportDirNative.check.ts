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
 * 写盘，绕过 Rust，文件落到用户没选的地方。编译器看不见这种断裂。
 */
import assert from "node:assert/strict";

// installNativeExportDir 只在 isTauriRuntime() 为真时注入，而它读的是 window 上的
// 全局 —— 必须在 import 之前就位（模块作用域会立刻调用）。所以两个 import 都是动态的，
// 也因此整段包在 async 里：tsx 把 .ts 当 CJS 跑，顶层 await 用不了。
const main = async () => {
  // invoke 在 @tauri-apps/api/core 里就是 window.__TAURI_INTERNALS__.invoke
  // （core.js 原样透传 cmd/args/options）。stub 它就能在 node 里钉住 wire 形态:
  // Uint8Array 顶层参数 → octet-stream 原始 body（tauri process-ipc-message-fn），
  // 文件名 → encodeURIComponent 过的 ASCII 头。
  const calls: Array<{
    cmd: string;
    args: unknown;
    options?: { headers?: Record<string, string> };
  }> = [];
  let behavior: () => unknown = () => null;
  (globalThis as { window?: unknown }).window = {
    __TAURI_INTERNALS__: {
      invoke: async (
        cmd: string,
        args: unknown,
        options?: { headers?: Record<string, string> },
      ) => {
        calls.push({ cmd, args, options });
        return behavior();
      },
    },
  };

  const { supportsExportDir, writeToExportDir, setNativeExportDir } = await import(
    "../src/app/utils/exportDir"
  );
  const { installNativeExportDir } = await import("../src/app/desktop/exportDirNative");

  // 注入前：node 里没有 File System Access，判定必须是「不支持」——
  // 这条同时证明下面那个 true 是注入带来的，不是本来就真。
  assert.equal(
    supportsExportDir(),
    false,
    "基线不对：没注入就判定支持了，后面那条断言证明不了任何事",
  );

  installNativeExportDir();
  assert.equal(
    supportsExportDir(),
    true,
    "桌面端没接上上游的注入口：工具页标题行那个导出目录按钮不会出现",
  );

  // ① 直写命令:真实落点(同名让路后的名字)必须原样透传给 toast ——
  // 这条路径没有下载栏,toast 是唯一反馈,请求名绝不能盖住真名。
  behavior = () => ({ fileName: "字幕 (1).srt", dir: "D:\\Subs" });
  const landing = await writeToExportDir(new Blob(["x"]), "字幕.srt");
  assert.deepEqual(
    landing,
    { fileName: "字幕 (1).srt", dir: "D:\\Subs" },
    "Rust 回传的真实落点被改写或丢弃,toast 会报错文件名",
  );
  assert.equal(calls[0].cmd, "write_export_file", "直写命令名与 Rust 侧不一致");
  assert.ok(
    calls[0].args instanceof Uint8Array,
    "body 必须是顶层 Uint8Array —— 只有它走 application/octet-stream 原始 body",
  );
  assert.equal(
    calls[0].options?.headers?.["x-export-file-name"],
    encodeURIComponent("字幕.srt"),
    "文件名必须经 encodeURIComponent 放进 ASCII 头(Rust 侧百分号解码)",
  );

  // ② Rust 返回 null(没设目录)→ 回落 saveAs,不报错
  behavior = () => null;
  assert.equal(
    await writeToExportDir(new Blob(["x"]), "a.srt"),
    null,
    "外壳返回 null 时必须回落 saveAs,而不是把 null 当成功",
  );

  // ③ invoke 抛错(目录不可写等)→ 同样回落,rejection 不许漏给 downloadFile
  behavior = () => {
    throw new Error("disk full");
  };
  assert.equal(
    await writeToExportDir(new Blob(["x"]), "a.srt"),
    null,
    "外壳抛错必须被吞成 saveAs 回落,37 个 downloadFile 调用点都不该接到 reject",
  );

  setNativeExportDir(null);
  console.log("export-dir native wiring: 5 checks passed");
};

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
