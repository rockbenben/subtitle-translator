/**
 * 启动 locale 引导脚本(locale_boot_script in src-tauri/src/lib.rs)的跨语言
 * 契约自检。它必须与 src/app/desktop/useLanguagePreference.ts 的 decideLanguage
 * 保持同一份事实:
 *
 *   1. Rust 里的 BOOT_LOCALES 与本次构建的 routing.locales 完全一致
 *      (新增语言时同步两处,否则引导脚本可能把用户送去一个不存在的 locale 页);
 *   2. 引导脚本只【读】偏好并 location.replace,绝不写 localStorage
 *      (跳转前写盘会把偏好覆盖成入口 /en/,gotcha #11);
 *   3. 与 hook 用同一个 localStorage 键。
 *
 * Rust 侧的形状自检在 cargo test(locale_boot_script_well_formed)。
 *
 *   npx tsx scripts/localeBoot.check.ts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { routing } from "../src/i18n/routing";

const here = dirname(fileURLToPath(import.meta.url));
const rs = readFileSync(join(here, "../src-tauri/src/lib.rs"), "utf8");

// 1. 列表一致
// 跳过类型标注 `: &[&str]`,锚到 `= &[` 那个才是值
const block = rs.match(/const BOOT_LOCALES[\s\S]*?=\s*&\[\s*([^\]]*)\]/);
assert(block, "BOOT_LOCALES const not found in lib.rs");
const rustLocales = [...block![1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
assert.deepEqual(
  rustLocales,
  [...routing.locales],
  "BOOT_LOCALES must equal routing.locales (add new locales in both places)",
);

// 引导脚本的 JS 本体(TEMPLATE 原始串),不变量只在它内部检查 ——
// 文件别处的注释/测试断言里也会出现 setItem 这些字样。
const tpl = rs.match(/const TEMPLATE:\s*&str\s*=\s*r#"([\s\S]*?)"#;/);
assert(tpl, "locale boot TEMPLATE not found in lib.rs");
const body = tpl![1];

// 2/3. 引导脚本机制不变量(检查的是机制,不是逐行枚举 JS 行为 ——
// decideLanguage 的判定分支由 languagePreference.check.ts 钉着)。
assert(
  body.includes("subtitle_translator_preferred_language"),
  "boot script must share the hook's localStorage key",
);
assert(body.includes("location.replace"), "boot script must redirect via location.replace");
assert(body.includes("navigator.language"), "boot script must handle first launch via system locale");
assert(
  !body.includes("setItem"),
  "boot script must never write storage before landing (persistence belongs to the hook, post-redirect)",
);
assert(
  rs.includes(".initialization_script(locale_boot_script())"),
  "boot script must actually be registered on the webview builder",
);

console.log(`locale boot contract: 5 checks passed (${rustLocales.length} locales)`);
