/**
 * i18n 的两道闸：上游派生的 messages/*.json，和桌面端自己的 updaterI18n。
 *
 * 【messages/*.json 是上游的派生产物，不是本仓的事实源】它们由上游主仓的
 * scripts/project_sync.py（FILTER_MESSAGES 模式）按命名空间合并而来：桌面端专属
 * 的命名空间在上游不存在，写进去就是越界键，下一次同步就被抹掉。所以桌面文案
 * 一律住在 src/app/desktop/updaterI18n.ts —— 那道闸在本文件的第二段。
 *
 * ⚠ 上游那道闸还有两条检查没跟过来，因为它们在【本仓的现状上本来就红】，与本改动
 * 无关（改它们属于别的翻译工作，不该混在这个改动里）：
 *  - 「CJK 语种用单字符省略号」：zh 的 common.pleaseWait 现在写的是 "请稍等..."。
 *  - 「ogTitle 跟随 title」：ar 的 Metadata.ogTitle 与 Metadata.title 不同。
 * 两条都在上游主仓里自行修掉了；本仓的 messages/*.json 由上游同步而来，修复时
 * 跟着同步即可，别在这里手改（手改会被下一次同步覆盖）。
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { getUpdaterStrings } from "@/app/desktop/updaterI18n";

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

/**
 * 桌面端文案（src/app/desktop/updaterI18n.ts）：它不进 messages/*.json，所以
 * 上面的键集/占位符闸罩不到它，得在这儿自己盯住。
 */
describe("desktop updater strings", () => {
  const en = getUpdaterStrings("en") as unknown as Record<string, unknown>;
  const tables: Array<[string, Record<string, unknown>]> = ["en", "zh", "zh-hant"].map((l) => [
    l,
    getUpdaterStrings(l) as unknown as Record<string, unknown>,
  ]);

  it("every desktop locale has exactly the en key set", () => {
    const enKeys = Object.keys(en).sort();
    for (const [locale, table] of tables) {
      expect(Object.keys(table).sort(), locale).toEqual(enKeys);
    }
  });

  it("the value shape and the argument count match the en source", () => {
    for (const [locale, table] of tables) {
      for (const key of Object.keys(en)) {
        const source = en[key];
        const value = table[key];
        if (typeof source === "function") {
          expect(typeof value, `${locale} ${key}`).toBe("function");
          expect((value as (...args: unknown[]) => unknown).length, `${locale} ${key}`).toBe(source.length);
        } else {
          expect(typeof value, `${locale} ${key}`).toBe("string");
        }
      }
    }
  });

  it("the argument is really interpolated in every locale", () => {
    // 一个语言把 {version} / {reason} 漏掉的话，那条文案会静默少掉版本号或原因 ——
    // 键集与参数个数都看不出来，只有把参数灌进去看它有没有出现在结果里才发现得了。
    const sentinel = "arg";
    for (const [locale, table] of tables) {
      for (const key of Object.keys(en)) {
        const source = en[key];
        if (typeof source !== "function" || source.length !== 1) continue;
        const out = (table[key] as (arg: string) => string)(sentinel);
        expect(out, `${locale} ${key}`).toContain(sentinel);
      }
    }
  });

  it("locales without their own table fall back to English", () => {
    // 其余 15 个语言回落英文是本仓刻意的行为（见 updaterI18n.ts 文件头），
    // 这条把它钉住：哪天有人改成回落简体中文，这条会红。
    expect(getUpdaterStrings("ja")).toBe(en);
    expect(getUpdaterStrings("fr")).toBe(en);
  });
});
