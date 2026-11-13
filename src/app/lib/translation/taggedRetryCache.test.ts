import { test, expect } from "vitest";
import { buildRuntimeConfig, translateLines, type PipelineCache } from "./pipeline";
import { generateCacheKey } from "./cache";
import { wrapTranslateTaggedLine } from "./contextTranslation";
import type { TranslateTextParams } from "./types";

// #68 review 回归:单行重试改走标记格式后,模型偶尔仍回对话体闲聊 —— 提取层丢弃
// 它(空串 → 缺口机制)还不够,【缓存必须一起清掉】。translateCore 在提取【之前】
// 就把服务原始输出写进了缓存(每个 200 对它都是成功),不清的话下一次重试同一句
// 会直接读回这条坏回复:零请求、同样丢弃、同样软填,这一行永远翻不出来,只能
// 手动清 IndexedDB / 删缓存文件。

const SOURCE = ["Hello there, commander", "Goodbye now, commander"];
const TAGLESS_PROSE = "I'm sorry, but I don't see any SRT file content in your message. Could you please share the subtitles?";

/** 内存缓存,形状与 web 的 translationCache 一致(PipelineCache)。 */
const makeCache = () => {
  const store = new Map<string, string>();
  const cache: PipelineCache & { store: Map<string, string> } = {
    store,
    get: async (k) => store.get(k) ?? null,
    getMany: async (ks) => ks.map((k) => store.get(k) ?? null),
    set: async (k, v) => void store.set(k, v),
    delete: async (k) => void store.delete(k),
  };
  return cache;
};

const runtimeConfig = (useCache = true) =>
  buildRuntimeConfig({
    translationMethod: "openai",
    targetLanguage: "Simplified Chinese",
    sourceLanguage: "English",
    useCache,
    config: { contextWindow: 20, contextBatchSize: 1, delayTime: 0 },
    globals: { systemPrompt: undefined, userPrompt: undefined, retryCount: 1, requestTimeoutSec: undefined, relayBase: undefined },
  });

/**
 * 模拟 web 壳的接线:deps.translate 就是 translateCore(params, 同一个 cache),
 * 也就是**先写缓存、后由调用方提取**的真实次序 —— 缓存里出现坏回复正是因为这一步。
 */
const makeTranslate = (cache: PipelineCache, scripted: (params: TranslateTextParams, call: number) => string) => {
  let call = 0;
  const translate = async (params: TranslateTextParams): Promise<string> => {
    call++;
    // 探针:本文件只关心单行标记重试写进缓存的那条键。批请求也写缓存(引擎自己的
    // 单行缓存回填会读),但这里不需要断言它们。
    const text = params.text ?? "";
    const reply = scripted(params, call);
    if (params.useCache !== false) {
      // 与 translateCore 一致:命中即返回,未命中才写。
      const key = generateCacheKey(text, params.cacheSuffix);
      const hit = await cache.get(key);
      if (hit) return hit;
      await cache.set(key, reply);
    }
    return reply;
  };
  return { translate, calls: () => call };
};

const isTaggedSingleLine = (text: string) => /^\[TRANSLATE_0\][\s\S]*\[\/TRANSLATE_0\]$/.test(text);

test("a discarded tagless retry reply is evicted from the cache, so the next attempt reaches the model", async () => {
  const cache = makeCache();
  let sawProseWritten = false;
  let modelCallsOnTagged = 0;

  const { translate } = makeTranslate(cache, (params) => {
    if (isTaggedSingleLine(params.text ?? "")) {
      modelCallsOnTagged++;
      // 第一次单行重试回对话体闲聊(必须被丢弃 + 清缓存),之后回合法标记译文。
      return modelCallsOnTagged === 1 ? TAGLESS_PROSE : "[TRANSLATE_0]遵命,指挥官[/TRANSLATE_0]";
    }
    // 批请求:两行源文完全不同,却回同一句译文 —— 触发「相邻同译」营救(唯一的
    // 单行标记重试入口之一),于是上面的单行分支被走到。
    return "[TRANSLATE_0]遵命,指挥官[/TRANSLATE_0][TRANSLATE_1]遵命,指挥官[/TRANSLATE_1]";
  });

  // 记录坏回复确实进过缓存(证明"提取前已写入"这个前提成立,否则本测试是空转)。
  const origSet = cache.set.bind(cache);
  cache.set = async (k, v) => {
    if (v === TAGLESS_PROSE) sawProseWritten = true;
    await origSet(k, v);
  };

  const outcome = await translateLines(SOURCE, runtimeConfig(), {
    cache,
    translate,
    getGlossaryTerms: () => [],
  }, "subtitle");

  // 前提:坏回复真的写进过缓存(否则下面的清缓存断言无意义)。
  expect(sawProseWritten).toBe(true);
  // 结论 1:它没留在缓存里。
  expect([...cache.store.values()]).not.toContain(TAGLESS_PROSE);
  // 结论 2:最终拿到的是有效译文,而不是被丢弃后的空/原文软填。
  expect(outcome.lines[0]).toBe("遵命,指挥官");
  expect(outcome.failures).toEqual([]);

  // 结论 3:第二次请求真的发出了(而不是从缓存重放坏回复) —— modelCallsOnTagged
  // 至少 2 次,且其中一次拿到了合法标记译文。
  expect(modelCallsOnTagged).toBeGreaterThanOrEqual(2);
});

test("with caching disabled the retry never touches the cache", async () => {
  const cache = makeCache();
  const { translate } = makeTranslate(cache, (params) =>
    isTaggedSingleLine(params.text ?? "")
      ? TAGLESS_PROSE
      : "[TRANSLATE_0]遵命,指挥官[/TRANSLATE_0][TRANSLATE_1]遵命,指挥官[/TRANSLATE_1]",
  );

  const deletes: string[] = [];
  cache.delete = async (k) => void deletes.push(k);

  await translateLines(SOURCE, runtimeConfig(false), { cache, translate, getGlossaryTerms: () => [] }, "subtitle");

  // useCache:false 的运行根本没写这条,别去误删上一轮带缓存运行留下的条目。
  expect(deletes).toEqual([]);
  expect([...cache.store.values()]).not.toContain(TAGLESS_PROSE);
});

// 单行标记重试写进缓存的那条键,必须正好是引擎在标签提取失败时删掉的那条。
// 两者错位(比如包装后的 request 文本与 generateCacheKey 的 text 不一致)会
// 让清理静默失效 —— 本条直接钉住键的形状。
test("the eviction key is the wrapped tagged request text", () => {
  const wrapped = wrapTranslateTaggedLine(SOURCE[0]);
  const key = generateCacheKey(wrapped, "suffix");
  expect(key).toBe(generateCacheKey(`[TRANSLATE_0]${SOURCE[0]}[/TRANSLATE_0]`, "suffix"));
});
