/**
 * decideLanguage 的自检。本仓库没有测试框架（上游 web-tools-by-ai 有 vitest，
 * 拆分时没带过来），为一个桌面端专用 hook 引一个不值当，所以用 node 自带的
 * assert 跑。
 *
 *   npx tsx scripts/languagePreference.check.ts
 */
import assert from "node:assert/strict";
import { decideLanguage } from "../src/app/desktop/useLanguagePreference";

const valid = ["en", "zh", "zh-hant", "ja"];
const d = (o: Partial<Parameters<typeof decideLanguage>[0]>) => decideLanguage({ current: "en", stored: null, system: "en", valid, redirectDone: false, ...o });

// 启动时存着 zh，入口是配置写死的 /en/ —— 必须跳走，且【本轮不写盘】。
// 写了就把偏好覆盖成 en，下次启动再也跳不回 zh（gotcha #11 的原始事故）。
assert.deepEqual(d({ stored: "zh" }), { redirectTo: "zh", persist: undefined });

// 重定向落地后的第二轮：写回的正是 pref 自己，偏好不变。
assert.deepEqual(d({ current: "zh", stored: "zh", redirectDone: true }), { persist: "zh" });

// 首次启动、无偏好：跟随系统语言，跳转 + 落盘同时发生。
assert.deepEqual(d({ stored: null, system: "ja" }), { redirectTo: "ja", persist: "ja" });

// 首次启动、系统语言不在支持列表里：不跳，把入口 locale 记成偏好。
assert.deepEqual(d({ stored: null, system: "sw" }), { persist: "en" });

// 偏好与入口一致：不跳，正常落盘。
assert.deepEqual(d({ stored: "en" }), { persist: "en" });

// 用户在切换器里选了日语（重定向早已完成）：记下新选择，不许再跳。
assert.deepEqual(d({ current: "ja", stored: "zh", redirectDone: true }), { persist: "ja" });

// stored 是已下线/被手改的语言：不跳到一个不存在的 locale，修复成当前值。
assert.deepEqual(d({ stored: "xx" }), { persist: "en" });

console.log("decideLanguage: 7 checks passed");
