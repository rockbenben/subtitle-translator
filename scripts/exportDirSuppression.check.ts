/**
 * 「桌面版关掉 Web 的导出目录」这件事的自检。本仓库没有测试框架，用 node 自带的
 * assert 跑（同 languagePreference.check.ts）。
 *
 *   npx tsx scripts/exportDirSuppression.check.ts
 *
 * 【为什么值得一道检查】这是一条【跨文件、跨仓库】的约定：判据写在
 * src/app/utils/exportDir.ts —— 那是上游 web-tools-by-ai 的镜像文件，随时会被
 * project_sync.py 整份覆盖；而关掉它的那行在 src/app/desktop/TauriIntegration.tsx。
 * 上游哪天把能力判据换成别的（比如改探 showSaveFilePicker），删除就【静默失效】：
 * 桌面上冒出第二个导出目录入口，且 File System Access 会绕过 Rust 的 on_download，
 * 文件落到用户没选的地方。编译器看不见这种断裂，所以在这里钉住。
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { supportsExportDir } from "../src/app/utils/exportDir";

// 1) 上游那条判据仍然【只】看 window.showDirectoryPicker：有它就是 true，
//    抹掉就是 false —— 后者正是桌面端所依赖的。
const g = globalThis as { window?: { showDirectoryPicker?: () => void } };
g.window = { showDirectoryPicker: () => {} };
assert.equal(supportsExportDir(), true, "supportsExportDir 不再认 window.showDirectoryPicker——上游换判据了");
delete g.window.showDirectoryPicker;
assert.equal(supportsExportDir(), false, "抹掉 window.showDirectoryPicker 已经关不掉 Web 版导出目录了——上游换判据了，TauriIntegration 那行要跟着改");
delete g.window;

// 2) 桌面侧确实在抹，且在【模块作用域】—— supportsExportDir() 在渲染期就被读，
//    放进 effect 就晚了（按钮会先闪一下）。
const src = readFileSync(fileURLToPath(new URL("../src/app/desktop/TauriIntegration.tsx", import.meta.url)), "utf8");
assert.match(
  src,
  /^if \(typeof window !== "undefined" && isTauriRuntime\(\)\) delete window\.showDirectoryPicker;$/m,
  "TauriIntegration.tsx 里那行模块作用域的 delete window.showDirectoryPicker 不见了或被挪进了函数里",
);

console.log("export-dir suppression: 3 checks passed");
