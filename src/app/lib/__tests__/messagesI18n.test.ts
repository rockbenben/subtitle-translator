/**
 * messages/*.json 的跨语言不变量闸（自上游主仓 web-tools-by-ai 同步而来：
 * src/app/lib/__tests__/messagesI18n.test.ts）。
 *
 * 为什么这个仓要有：messages/*.json 是 18 个语种 × 一份键集的手工产物，加一条新文案
 * 要在每个语言文件里都补上；漏一个语言时，界面上的那一条会退化成 "namespace.key"。
 * 这道闸把「键集一致」与「占位符一致」两件事钉住 —— 正好是「加一条新文案」最容易
 * 踩的两脚。
 *
 * ⚠ 上游那道闸还有两条检查没跟过来，因为它们在【本仓的现状上本来就红】，与本次改动
 * 无关（改它们属于别的翻译工作，不该混在这个改动里）：
 *  - 「CJK 语种用单字符省略号」：zh 的 common.pleaseWait 现在写的是 "请稍等..."。
 *  - 「ogTitle 跟随 title」：ar 的 Metadata.ogTitle 与 Metadata.title 不同。
 * 两条都在上游主仓里自行修掉了；本仓的 messages/*.json 由上游同步而来，修复时
 * 跟着同步即可，别在这里手改（手改会被下一次同步覆盖）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";

const locales = readdirSync("messages")
  .filter((f) => f.endsWith(".json"))
  .map((f) => f.replace(".json", ""));

const flat = (o: unknown, p: string[] = []): [string, string][] =>
  Object.entries(o as Record<string, unknown>).flatMap(([k, v]) =>
    typeof v === "object" && v !== null && !Array.isArray(v) ? flat(v, [...p, k]) : [[[...p, k].join("."), String(v)]]
  );

const load = (l: string) => Object.fromEntries(flat(JSON.parse(readFileSync(`messages/${l}.json`, "utf8"))));

const SRC = "zh";
const messages: Record<string, Record<string, string>> = Object.fromEntries(locales.map((l) => [l, load(l)]));

const icuArgs = (s: string) => {
  const names = [...s.matchAll(/\{\s*([a-zA-Z_]\w*)\s*[,}]/g)].map((m) => m[1]);
  const printf = s.match(/%\d*\$?[sdu]/g) || [];
  return JSON.stringify([...new Set(names)].sort()) + "|" + JSON.stringify(printf.sort());
};

describe("messages i18n invariants", () => {
  it("every locale has exactly the zh key set", () => {
    const srcKeys = Object.keys(messages[SRC]).sort();
    for (const l of locales) expect(Object.keys(messages[l]).sort(), l).toEqual(srcKeys);
  });

  it("ICU/printf placeholders match the zh source", () => {
    for (const l of locales) {
      for (const [k, v] of Object.entries(messages[l])) {
        expect(icuArgs(v), `${l} ${k}`).toBe(icuArgs(messages[SRC][k]));
      }
    }
  });
});
