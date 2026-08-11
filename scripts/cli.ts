// Translate CLI — headless batch translation over the same engine
// (lib/translation/pipeline) and the same per-format parsing/assembly the web
// tools use. Configure in the web UI, export settings, point this at files:
//
//   yarn cli -i movie.srt -t zh -s my-settings.json
//   yarn cli -i README.md -t ja -t ko -o out/
//   yarn cli -i locale.json -t zh -m llm --url http://localhost:11434/v1 --model qwen3
//
// Formats (subtitle / markdown / json) are built in — the handlers live in
// lib/translation/cliFormat.ts (statically imported; every checkout, including
// single-tool sub-projects, ships all three). Format is inferred from the
// extension; override with --format.
//
// Exit codes: 0 = every item translated; 1 = finished with soft-failed items
// (kept as source text in the output) or a failed file; 2 = bad invocation;
// 130 = cancelled.

import { parseArgs } from "node:util";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { homedir } from "node:os";

import { buildRuntimeConfig, translateLines, type PipelineCache, type PipelineRuntimeConfig, type PipelineOutcome, type TranslateBatchMeta } from "../src/app/lib/translation/pipeline";
import { CliFileFormatError, CLI_FORMAT_HANDLERS, triState, type CliFormatContext } from "../src/app/lib/translation/cliFormat";
import { appendBilingualSuffix } from "../src/app/lib/translation/formats/subtitle";
import { getDefaultConfig, defaultConfigs, LLM_MODELS } from "../src/app/lib/translation/registry";
import { isValidLanguageValue } from "../src/app/lib/translation/utils";
import { REQUIRES_EXPLICIT_SOURCE, isMethodSupportedForLanguage } from "../src/app/lib/translation/languages-data";
import { isDefiniteAuthFailure } from "../src/app/lib/translation/retry";
import { migrateConfig } from "../src/app/lib/translation/config";
import { sanitizeSettings, isTranslationSettings, pickRuntimeGlobals, type TranslationSettings } from "../src/app/lib/translation/settingsSchema";
import { validateTranslationInputs } from "../src/app/hooks/translation/validation";
import type { TranslationConfig } from "../src/app/lib/translation/types";
import { deriveGlossaryHelpers } from "../src/app/lib/translation/glossary";
import { applyRemoveCharsToLines } from "../src/app/utils/textUtils";
import { decodeFileBytes } from "../src/app/utils/encoding";
import { formatErrorWithCause, isCascadedAbort } from "../src/app/utils/errorUtils";

const HELP = `translate CLI

Usage: yarn cli -i <file> [-i <file>...] [options]

Options:
  -i, --input <file>        Input file. Repeatable.
  -t, --to <lang>           Target language code. Repeatable. Default: settings file, else zh.
  -f, --from <lang>         Source language. Default: settings file, else auto.
  -m, --method <method>     Translation service. Default: settings file, else gtxFreeAPI.
  -s, --settings <file>     Settings JSON exported from the web UI (API keys, prompts, glossary, retry...).
  -o, --out-dir <dir>       Output directory. Default: next to each input file.
      --format <fmt>        Force a format instead of inferring from the extension.
      --api-key <key>       Override API key for the chosen method.
      --url <url>           Override endpoint URL (e.g. local Ollama/LM Studio).
      --model <model>       Override model.
      --no-cache            Disable the translation cache.
      --relay               Route requests through the shared API relay (browser-CORS
                            workaround; OFF by default here since Node has no CORS).
      --no-relay            Force direct requests even if the settings file enables relay.
      --cache-file <file>   Cache path. Default: ~/.translate-cli-cache.json
      --list-formats        Print the supported formats and exit.
      --list-methods        Print available translation methods and exit.
  -h, --help                Show this help.

Subtitle files:
      --bilingual           Bilingual output (default: translated only).
      --original-first      Original above/before the translation in bilingual output.
      --bilingual-format <ass|srt>  Bilingual format for srt/vtt sources. Default: ass.
      --no-context          Disable context-aware LLM batching (default: on, like the web tool).

Markdown files:
      --md-raw              Translate raw lines instead of protecting code/links/LaTeX.
      --context             Enable context-aware LLM batching (default: off, like the web
                            tool). Implies --md-raw — context mode and placeholder
                            protection are mutually exclusive.
      --no-context          Also honored here: explicitly disables context batching, beats --context.
      --md-translate-frontmatter / --md-translate-code / --md-translate-latex
                            Translate those parts (default: protected).
      --md-no-link-text     Keep [link text](url) labels untranslated (default: translated).
`;

const parseCliArgs = () =>
  parseArgs({
    options: {
      input: { type: "string", short: "i", multiple: true },
      to: { type: "string", short: "t", multiple: true },
      from: { type: "string", short: "f" },
      method: { type: "string", short: "m" },
      settings: { type: "string", short: "s" },
      "out-dir": { type: "string", short: "o" },
      format: { type: "string" },
      bilingual: { type: "boolean" },
      "original-first": { type: "boolean" },
      "bilingual-format": { type: "string" },
      "md-raw": { type: "boolean" },
      // 每项只注册【非默认那一侧】的 flag —— 反向 flag 在当前默认下是空操作
      // (--md-no-code 关掉的是本来就关着的东西),加了只是给用户 4 个按了没反应
      // 的选项。等哪天真要翻转某个默认,在【翻转它的那个 commit 里】补上对应的
      // 反向 flag。
      "md-translate-frontmatter": { type: "boolean" },
      "md-translate-code": { type: "boolean" },
      "md-translate-latex": { type: "boolean" },
      "md-no-link-text": { type: "boolean" },
      "api-key": { type: "string" },
      url: { type: "string" },
      model: { type: "string" },
      context: { type: "boolean" },
      "no-context": { type: "boolean" },
      "no-cache": { type: "boolean" },
      relay: { type: "boolean" },
      "no-relay": { type: "boolean" },
      "cache-file": { type: "string" },
      "list-formats": { type: "boolean" },
      "list-methods": { type: "boolean" },
      help: { type: "boolean", short: "h" },
    },
  }).values;

type CliArgs = ReturnType<typeof parseCliArgs>;

// File-backed cache, same key space as the web's IndexedDB cache.
// ponytail: one flat JSON file, loaded whole — fine at document scale; move to
// SQLite if someone feeds it a million lines.
const makeFileCache = (file: string): PipelineCache & { flush: (force?: boolean) => void } => {
  // 读盘上的存档。「文件不存在」是正常的冷启动;「存在但读不动/解析不了」不是 ——
  // 此前两者都被同一个裸 catch 吞成"还没有缓存",于是一次 Ctrl-C 写坏的文件会让
  // 下一次运行把整份存档当空的,重新掏钱翻一遍,再用本轮的条目把剩下的覆盖掉。
  // 写路径失败会大声警告(见 flush),读路径不该更沉默。
  // ok=false 表示【读不出来】(权限/IO/解析失败),区别于「文件还不存在」。
  // 启动时两者都当空缓存用;但 flush 的合并基底【只认 ok=true】——
  // 拿一个读失败的空 Map 当基底,等于把整份存档替换成本轮这几条,
  // 正是 merge-instead-of-overwrite 要防的那个失败。writeFileSync 不是原子的,
  // 并发的另一个进程正写到一半时,这里读到的就是截断的 JSON 前缀。
  const readStore = (): { entries: Map<string, string>; ok: boolean } => {
    let raw: string;
    try {
      raw = readFileSync(file, "utf8");
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === "ENOENT") return { entries: new Map(), ok: true }; // 冷启动,不是故障
      console.error(`warning: cannot read cache file ${file} (${(e as Error).message}) — starting with an empty cache.`);
      return { entries: new Map(), ok: false };
    }
    try {
      return { entries: new Map(Object.entries(JSON.parse(raw) as Record<string, string>)), ok: true };
    } catch (e) {
      console.error(`warning: cache file ${file} is corrupt or being written by another process (${(e as Error).message}).`);
      return { entries: new Map(), ok: false };
    }
  };

  // store 是【读视图】:启动快照 + 本轮写入,只服务 get/getMany。
  const store = readStore().entries;
  // written/deleted 是【本轮自己的改动日志】,flush 只回写它们。
  // 别拿 store 去回写:它含启动那一刻的快照,整个重放等于用旧值逐键盖掉另一个
  // 进程在这期间写的新值 —— 那是把「整份覆盖」降级成「逐键覆盖」,危害一样
  // (对方 purge 掉的坏批次响应会被我的旧值复活,它刚付费重译的结果被丢弃)。
  const written = new Map<string, string>();
  const deleted = new Set<string>();
  let lastFlushMs = 0;
  const FLUSH_MIN_INTERVAL_MS = 2000;
  // 自适应节流窗口。缓存小的时候恒等于下限(flush 只要几毫秒,10× 远不到 2s),
  // 行为与固定 2s 完全一致;只有当整份缓存大到 flush 本身变慢时才会拉开。
  // 起因:flush 是 read+parse+merge+stringify+write 整份文件,36MB 时实测 573ms,
  // 而暖跑(全命中缓存、每个输出远快于 2s)会稳定顶在节流下限上 —— 于是墙钟的
  // 两三成花在序列化缓存上,恰恰是在「全命中、本该秒回」的那种运行里。
  // 10× 把序列化摊到约 10% 墙钟,且随缓存大小自校准,不用猜一个固定值。
  let flushIntervalMs = FLUSH_MIN_INTERVAL_MS;
  return {
    get: async (k) => store.get(k) ?? null,
    getMany: async (ks) => ks.map((k) => store.get(k) ?? null),
    set: async (k, v) => {
      store.set(k, v);
      written.set(k, v);
      deleted.delete(k);
    },
    delete: async (k) => {
      store.delete(k);
      deleted.add(k);
      written.delete(k);
    },
    // 缓存写失败【绝不能】升级成运行失败:它曾把「父目录不存在」变成一个
    // 已经译好的文件被记成 ✖,并且 finally 里的抛出会顶掉 main 的返回值 ——
    // 连 Ctrl-C 的 130 都变成 fatal 1。父目录先建,写失败只警告。
    // 每写出一个产物就 flush 一次是为了崩溃安全(Ctrl-C / 断电不丢已付费的译文),
    // 但每次 flush 都要把整份缓存 read+parse+stringify+write 一遍。批量翻 locale 树
    // (200 文件 × 3 语言 = 600 次)时缓存能涨到几十 MB,一次几乎全缓存命中的重跑
    // ——恰恰是缓存存在的意义——大部分时间花在反复序列化上,可能慢过冷跑。
    // 节流到 2 秒一次;收尾与取消路径传 force 强制落盘。
    // ponytail: 硬杀(kill -9)最多丢节流窗口内的译文;要一条不丢得改追加式日志。
    // 「有没有待落盘的东西」以【日志是否为空】为准,不看 dirty 标志。上一版写
    // 失败时置 dirty=false 却特意留着日志说「等下次 set 再试」—— 但最后那次
    // force flush 开头就是 `if (!dirty) return`,直接被自己挡在门外:文件锁一
    // 解除本可以写成功,结果整批已付费的译文还是没落盘。
    flush: (force = false) => {
      if (written.size === 0 && deleted.size === 0) return;
      const now = Date.now();
      if (!force && now - lastFlushMs < flushIntervalMs) return;
      try {
        mkdirSync(dirname(file), { recursive: true });
        // 落盘前【重读合并】,不是整份覆盖。两个终端同跑、共用默认缓存路径是
        // 常规用法(`cli -i a.srt` / `cli -i b.srt`),整份覆盖等于后 flush 的
        // 进程把对方刚付费译出的条目全删了 —— 下次运行发现键不在,再掏一次钱,
        // 而 README 承诺的「从断点续」变成从头再来。
        // ponytail: 读-合并-写不是原子的,仍有窄 TOCTOU 窗口(两个 flush 撞在
        // 同一瞬间)。真要并发安全得上文件锁或 SQLite;本条修的是「整份存档被
        // 覆盖」,不是「同一毫秒的两次写」。
        const base = readStore();
        if (!base.ok) {
          // 基底读不出来 —— 可能是另一个进程正写到一半。此刻整份写出去会把
          // 它(和之前所有运行)付费译出的条目全抹掉。跳过这次,日志留着,
          // 下次 flush(或收尾的 force)再试;真是文件损坏,也留给用户处置。
          console.error(`warning: skipping this cache write — ${file} could not be read, and overwriting it would discard entries other runs paid for. If it stays unreadable, delete it to start a fresh cache.`);
          // 时间戳照常推进:节流的目的是别把整份缓存反复 read+parse,而这条
          // 分支【已经读过一次】了。不推进的话 600 次 flush 全都做全量重读,
          // 还会把这段长警告打 600 遍(日志被淹没,真正的失败反而看不见)。
          lastFlushMs = now;
          return;
        }
        const merged = base.entries;
        for (const k of deleted) merged.delete(k);
        for (const [k, v] of written) merged.set(k, v);
        writeFileSync(file, JSON.stringify(Object.fromEntries(merged)));
        // 合并结果回灌读视图:别的进程刚写进来的键,本轮后续的 get/getMany
        // 应该能命中,否则同一批文案会被两个进程各付一次费。
        for (const [k, v] of merged) if (!store.has(k)) store.set(k, v);
        // 日志已落盘,清空。留着的话下一次 flush 会把这些【旧操作】再应用一遍:
        // 两次 flush 之间另一个进程重新译出并写回的键会被我的旧墓碑再删一次,
        // 它写的新值会被我的旧值再盖一次。一次 flush 只该提交自那次之后的改动。
        written.clear();
        deleted.clear();
        lastFlushMs = now;
      } catch (e) {
        console.error(`warning: cannot write cache file ${file} (${(e as Error).message}) — continuing without persistence.`);
        // 日志【不清】:这批改动还没落盘,留给下一次 flush(含收尾那次 force)
        // 重试 —— 文件锁/临时故障解除后仍有机会写成功。
        //
        // 时间戳【必须】推进,理由同上面 !base.ok 那条分支:节流的目的是别把
        // 整份缓存反复 read+parse。不推进的话,一次写失败就等于永久关掉节流 ——
        // 之后每个输出文件都触发一次全量重读 + 一次注定失败的写,200 文件 ×
        // 3 语言 = 600 次,同一行警告刷 600 遍把真正的 ✖ 淹掉,整批的墙钟时间
        // 大半花在重复解析多 MB 的缓存 JSON 上。(重试机会不受影响:节流窗口
        // 到点后照常再试。)
        lastFlushMs = now;
      } finally {
        // 三条路径(成功 / 基底读不出 / 写失败)都已经付过全量读或写的代价,
        // 都据此校准下一个窗口。节流命中的那次在 try 之前就 return 了,不进这里。
        flushIntervalMs = Math.max(FLUSH_MIN_INTERVAL_MS, 10 * (Date.now() - now));
      }
    },
  };
};

/**
 * 文件系统等价键 —— 两个字符串在【本平台】上会不会指向同一个文件。
 * win32 与 darwin 的默认卷大小写不敏感,所以折叠大小写。
 *
 * 凡是【会决定读写哪个磁盘文件】的比较都走它(grep `pathKey(` 可见全部消费点):
 * 输入去重、同名 basename 检查、输出是否覆盖本轮输入、输出之间是否互撞,
 * 以及目标语言去重。最后一个不是路径,但语言代码【会进输出文件名】
 * (stem.<lang>.ext),所以在文件系统层面适用同一条等价关系 ——
 * `-t zh-hant -t zh-Hant` 是两个不同字符串、两次计费、一个磁盘文件。
 * (不写死消费点个数:这里曾写"三个",而实际已经长到五类。)
 *
 * 折叠范围为何含 darwin(取舍详见 main 里输入去重处的长注释):敏感卷上误合并
 * 会被那里的显式检查响亮拦下,而不敏感卷上漏检是静默覆盖 —— 选前者。
 */
const pathKey = (p: string) => (process.platform === "win32" || process.platform === "darwin" ? p.toLowerCase() : p);

/**
 * 读文本文件,编码自适应(decodeFileBytes:UTF-8 fatal 试解 → jschardet 检测)。
 * 输入文件与 -s 设置文件都走这条 —— readFileSync(p,"utf8") 会把 GBK 变成
 * U+FFFD、保留 BOM(BOM 的 json 直接解析失败),而网页端两类文件都自适应。
 */
const readTextFile = async (path: string): Promise<string> => {
  const buf = readFileSync(path);
  return decodeFileBytes(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer);
};

// 凭据类校验失败的 errorKey → CLI 措辞(网页端同键走 i18n toast)。
const CRED_ERROR_TEXT: Record<string, string> = {
  enterApiKey: "requires an API key — configure it in the web UI and export settings (-s), or pass --api-key",
  enterApiUrl: "requires an endpoint URL — pass --url, or configure it in the web UI and export settings (-s)",
};

const main = async (): Promise<number> => {
  // 参数解析与设置文件读取都在 main 的错误处理之内:拼错 flag、路径不存在、
  // JSON 损坏,得到的是一行 `error: …` + exit 2,而不是七层 Node 堆栈。
  let args: CliArgs;
  try {
    args = parseCliArgs();
  } catch (e) {
    console.error(`error: ${(e as Error).message}`);
    console.error("See --help for usage.");
    return 2;
  }

  if (args.help) {
    console.log(HELP);
    return 0;
  }
  if (args["list-methods"]) {
    console.log(Object.keys(defaultConfigs).join("\n"));
    return 0;
  }
  if (args["list-formats"]) {
    for (const h of CLI_FORMAT_HANDLERS) console.log(`${h.id}\t${h.extensions.join(" ")}`);
    return 0;
  }
  if (!args.input?.length) {
    console.error("error: no input files (-i). See --help.");
    return 2;
  }

  // 设置文件:结构检查 + 消毒与网页端导入【同一份】(settingsSchema)——
  // 越界的 retryCount/requestTimeoutSec、坏形状的术语表词条在这里就被丢掉,
  // 不会流进 pipeline(requestTimeoutSec: 0 会让每个请求下个宏任务即中止,
  // 且中止不可重试 —— 整份输出静默保持原文)。
  let settings: Partial<TranslationSettings> = {};
  if (args.settings) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(await readTextFile(resolve(args.settings)));
    } catch (e) {
      console.error(`error: cannot load settings file: ${(e as Error).message}`);
      return 2;
    }
    if (!isTranslationSettings(parsed)) {
      console.error("error: not a translation settings file (expected the JSON exported by the web UI).");
      return 2;
    }
    settings = sanitizeSettings(parsed);
  }

  const method = args.method ?? settings.translationMethod ?? "gtxFreeAPI";
  // 去重与输入路径同理:`-t zh -t zh` 会把整条链跑两遍(双倍计费、双倍
  // softFailures 计数),而写出防线拦不住 —— 同文件同语言,firstWriter 就是
  // 自己,第二次静默覆盖第一次。
  //
  // 【按 pathKey 去重,不是裸字符串】:语言代码进输出文件名(stem.<lang>.ext),
  // 所以在大小写不敏感的卷上 `-t zh-hant -t zh-Hant` 产出的是同一个磁盘文件。
  // 裸 Set 留下两个条目,`/^[A-Za-z0-9_-]+$/` 都放行,isValidLanguageValue 是
  // 精确匹配所以 "zh-Hant" 只换来一句「不在语言表里,放行」的警告 —— 然后两次
  // 完整翻译都计费、两行 ✔、exit 0,而磁盘上只剩后写的那份(firstWriter 就是
  // 自己,覆盖检查被跳过)。这正是上面那句注释要防的事,只差一次 case-fold。
  const rawTargets = args.to?.length ? args.to : settings.multiLanguageMode && settings.targetLanguages?.length ? settings.targetLanguages : [settings.targetLanguage ?? "zh"];
  // 保留【先出现】的那个拼法,不是后出现的。Map 的默认行为是后写覆盖,于是
  // `-t zh -t ZH` 留下 "ZH":输出变成 root.ZH.json,而且因为 isValidLanguageValue
  // 是精确匹配,那个能通过语言表校验的规范拼法反倒被丢掉,换来一句
  // 「not in the language table — skipping pre-flight support check」。
  // 先到先得同时也更符合直觉:用户写在前面的那个才是他想要的。
  const targetSeen = new Map<string, string>();
  for (const t of rawTargets) if (!targetSeen.has(pathKey(t))) targetSeen.set(pathKey(t), t);
  let targets = [...targetSeen.values()];
  const sourceLanguage = args.from ?? settings.sourceLanguage ?? "auto";
  const removeChars = (settings.removeChars ?? "").trim();

  if (!getDefaultConfig(method)) {
    console.error(`error: unknown method "${method}". Use --list-methods.`);
    return 2;
  }
  if (args.format && !CLI_FORMAT_HANDLERS.some((h) => h.id === args.format)) {
    console.error(`error: --format must be one of: ${CLI_FORMAT_HANDLERS.map((h) => h.id).join(" | ")}`);
    return 2;
  }
  if (args["bilingual-format"] !== undefined && args["bilingual-format"] !== "ass" && args["bilingual-format"] !== "srt") {
    console.error(`error: --bilingual-format must be "ass" or "srt" (got "${args["bilingual-format"]}").`);
    return 2;
  }

  const baseConfig: TranslationConfig = {
    ...migrateConfig(settings.translationConfigs?.[method], getDefaultConfig(method)),
    ...(args["api-key"] !== undefined && { apiKey: args["api-key"] }),
    ...(args.url !== undefined && { url: args.url }),
    ...(args.model !== undefined && { model: args.model }),
  };

  // API 中转是【浏览器专属的补丁】:defaultUseRelay 只为绕开某些 provider 的
  // CORS 预检(hunyuan / yandex),Node 里根本没有 CORS。原样继承那个默认值
  // 等于把用户的 API key 默默送去第三方 Cloudflare Worker —— 用户从没导出过
  // 网页设置、命令行也没有对应开关,想关都关不掉;中转一挂,直连本来能通的
  // 请求也跟着全灭。
  //
  // 所以:环境事实(Node 无 CORS)只用来定【默认值】,开关仍留给用户 ——
  // --relay 显式打开(自建/受限网络里仍可能需要),--no-relay 显式关闭,
  // 都不传则按设置文件里用户自己存的值,没有就关。
  // 用 triState 而不是再手写一遍极性:【显式关 > 显式开 > 默认】的契约只该有
  // 一份(cliFormat.ts)。两个都给时关赢 —— 这个 flag 决定用户的 API key 会不会
  // 离开本机发往第三方中转,保守的那一侧必须赢。
  //
  // ⚠ 默认值读 settings.translationConfigs[method],【不能】读 baseConfig:
  // baseConfig 已经过 migrateConfig,它会把 registry 的 defaultUseRelay 回填
  // 进来(实测 hunyuan → true)。拿它当默认等于给 hunyuan/opencode 静默开启
  // 中转,而 Node 没有 CORS、这里本该默认直连 —— 正是这一条要防的事。
  baseConfig.useRelay = triState(args.relay, args["no-relay"], settings.translationConfigs?.[method]?.useRelay ?? false);

  // 翻译前校验。不校验就开跑的失败模式都是【静默错文件】:缺 key 烧完全部
  // 重试预算后整份保持原文、translategemma 收到 auto 源必然报错、源=目标被
  // translateCore 原文短路后照样写文件报成功。分三段,各自独立必查:
  //
  // ① 目标代码形状。目标码会进输出文件名(stem.<lang>.ext),"zh/tw"、
  //    ""(shell 变量展开为空)这类值不设门槛就是译完才 ENOENT / 写出
  //    stem..ext —— 钱花完才失败。形状错是配置错,整轮拒绝。
  for (const lang of targets) {
    if (!/^[A-Za-z0-9_-]+$/.test(lang)) {
      console.error(`error: "${lang}" is not a valid target language code.`);
      return 2;
    }
  }

  //    源=目标【跳过这一个语言】,不是整轮中止。网页端对它毫无意见
  //    (checkLanguageSupport 根本不查,translateCore 直接原文短路),所以
  //    `sourceLanguage:"en"` + `targetLanguages:["en","zh","ja"]` 这种导出的
  //    设置在浏览器里跑得好好的,拿给 CLI 却是一行 error + exit 2、zh/ja 一个
  //    文件都不出。留住原意(别静默写一份没翻的文件当成功),只把粒度改对。
  //    比较【大小写不敏感】,与紧邻上方按 pathKey 折叠目标语言的那段同一判据:
  //    `-f en -t EN` 裸串比不相等 → EN 活下来 → 语言表校验只打一句听着无害的
  //    warning → translateCore 的同语言短路(也是裸串比)同样不触发 → 每一行都
  //    真的发出 en→EN 请求,计费、写出 movie.EN.srt、exit 0。正是本段注释说它要
  //    防的那件事。localeCompare 的 sensitivity:"accent" 只忽略大小写,不会把
  //    zh-hans/zh-hant 这类真不同的标签折到一起。
  // toLowerCase 而非 localeCompare:后者不传 locale 时用【宿主默认排序规则】——
  // 土耳其语环境把 i/I 视为不同字母,`it` vs `IT` 判不相等,这条守卫在那台机器上
  // 静默失效(照常计费翻一遍 it→IT)。toLowerCase 是 Unicode 默认映射、与环境无关,
  // 也正是紧邻上方 pathKey 折叠输入路径用的同一种比较。
  const sameLang = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();
  const selfTargets = targets.filter((lang) => sameLang(sourceLanguage, lang));
  if (selfTargets.length > 0) {
    targets = targets.filter((lang) => !sameLang(sourceLanguage, lang));
    if (targets.length === 0) {
      console.error(`error: source and target language are both "${selfTargets[0]}" — nothing to translate.`);
      return 2;
    }
    console.error(`warning: skipping ${selfTargets.map((l) => `"${l}"`).join(", ")} — same as the source language.`);
  }

  // ② 凭据(与语言无关)。multiLanguageMode:true + targetLanguages:[] 只走
  //    凭据分支;sourceLanguage/targetLanguage 在该形态下不会被读。
  const cred = validateTranslationInputs({ config: baseConfig, method, sourceLanguage: "auto", targetLanguage: "zh", multiLanguageMode: true, targetLanguages: [] });
  if (!cred.ok) {
    console.error(`error: ${"errorKey" in cred ? `method "${method}" ${CRED_ERROR_TEXT[cred.errorKey]}` : cred.errorMessage}`);
    return 2;
  }

  // ③ 语言支持性 —— 只对【语言表内】的代码做:CLI 没有选择器约束,gtx/google
  //    等服务接受表外代码(pt、zh-TW…直接透传 wire),对它们报错是误杀,警告
  //    放行交服务端判定。源侧检查【不依赖目标是否在表内】—— 上一版把它挂在
  //    目标循环里,目标全在表外时 REQUIRES_EXPLICIT_SOURCE/源支持性被整体
  //    跳过,-t pt -m translategemma 又静默烧完预算写原文文件。
  const sourceKnown = isValidLanguageValue(sourceLanguage);
  if (!sourceKnown) console.error(`warning: source "${sourceLanguage}" is not in the language table — skipping pre-flight support check, passing it through to the service.`);
  if (sourceKnown && sourceLanguage === "auto" && REQUIRES_EXPLICIT_SOURCE.has(method)) {
    console.error(`error: method "${method}" requires an explicit source language (no auto-detect) — pass -f <lang>.`);
    return 2;
  }
  if (sourceKnown && sourceLanguage !== "auto" && !isMethodSupportedForLanguage(method, sourceLanguage)) {
    console.error(`error: method "${method}" doesn't support source language "${sourceLanguage}".`);
    return 2;
  }
  for (const lang of targets) {
    if (!isValidLanguageValue(lang)) {
      console.error(`warning: target "${lang}" is not in the language table — skipping pre-flight support check, passing it through to the service.`);
    } else if (!isMethodSupportedForLanguage(method, lang)) {
      console.error(`error: method "${method}" doesn't support target language "${lang}".`);
      return 2;
    }
  }

  // --context 只对 LLM 生效(cliFormat 的 markdown handler 有同一道门)——
  // MT 方法下静默无效会侵蚀用户对其它 flag 的信任,明说。
  if (args.context && !LLM_MODELS.includes(method)) {
    console.error(`warning: --context has no effect with MT method "${method}" — context batching is LLM-only; placeholder protection stays on.`);
  }

  // 缓存在所有快速出口之后才加载(--help/--list-* 不必付整份 JSON 的解析成本)。
  const cache = args["no-cache"] ? undefined : makeFileCache(args["cache-file"] ?? join(homedir(), ".translate-cli-cache.json"));

  // Ctrl-C → abort the run (in-flight requests die, pipeline throws "Translation
  // aborted"), flush what the cache already holds — a re-run resumes from there.
  const controller = new AbortController();
  process.on("SIGINT", () => {
    process.stderr.write("\ncancelling…\n");
    controller.abort();
    // 取消是「缓存即断点」这条承诺最要紧的时刻 —— 强制落盘,别让节流窗口
    // 吞掉刚刚付费译出的那几行。
    cache?.flush(true);
  });

  // 刻意【不做】网页端那样的可达性预检:加过一版,一次审查暴露四个坑 ——
  // 探测自己会撞 429(默认的 gtxFreeAPI 是限流共享端点,一次瞬时 429 就
  // exit 2 杀掉本可正常翻完的一轮)、没有超时(黑洞端点无限期挂住)、强制
  // 联网(全缓存的离线重跑被打死)、auth 失败被误报成「不可达」。修对它
  // 需要把网页 validate() 的瞬时容忍/超时/缓存感知/auth 分类整套搬来,
  // 大于它挡住的问题 —— 死端点本就有 exit 1 + 每行 ⚠ 的明确信号。
  // Glossary:与网页 hook 共用同一份纯函数(deriveGlossaryHelpers,lib/
  // translation/glossary)——同一个过滤谓词、同一套按语言 memo(compileGlossary
  // 的 WeakMap 以数组【身份】为键,每次新数组会让它每行都重编译整套正则)。
  const activeGlossary = settings.glossaryPresets?.find((p) => p.id === settings.activeGlossaryPresetId);
  const { getGlossaryTerms } = deriveGlossaryHelpers(settings.glossaryEnabled === true, activeGlossary);

  // 组装线与网页壳共用 buildRuntimeConfig(pipeline.ts);顶层全局旋钮经
  // pickRuntimeGlobals 拾取(单一清单在 settingsSchema)—— 新增旋钮时
  // RuntimeGlobals 类型让两个壳同时编译失败,不再逐字段手抄
  // (relayBase 曾在这里漏接)。中转没有命令行 flag:单 provider 指别处走
  // --url(优先级本就更高),想全局换中转宿主的用户必然已有设置文件。
  const buildConfig = (lang: string, independent: boolean): PipelineRuntimeConfig =>
    buildRuntimeConfig({
      translationMethod: method,
      targetLanguage: lang,
      sourceLanguage,
      useCache: !args["no-cache"],
      config: baseConfig,
      globals: pickRuntimeGlobals(settings),
      // independent 单元(JSON 值)强制逐条路径 —— chunkSize 由组装线剥掉,
      // 网页壳(translateBatch 第 8 参)同一开关,剥离规则见 buildRuntimeConfig。
      independent,
    });

  const applyRemoveChars = (lines: string[]): string[] => applyRemoveCharsToLines(lines, removeChars);

  let softFailures = 0;
  let hardFailures = 0;
  // 跨文件/跨语言的 429 记忆(网页端 rateLimitedThisRunRef 的 CLI 对应物):
  // 文件 a 撞过限流,b/c 的收尾自动重试用 10s 喘息而不是 1.5s —— 否则后续
  // 文件在服务仍限流时提前烧完预算,整批带着原文行退出。
  let rateLimitedEarlier = false;

  // independent=true 时失败位置是「第 N 个值」(深度优先序数),不是文件行号
  // —— 标错会让用户翻到 locale.json 第 4 行看到一条译好的字符串。
  const report = (outcome: PipelineOutcome, independent: boolean) => {
    if (outcome.failures.length === 0) return;
    softFailures += outcome.failures.length;
    // independent 下 f.line 是空的(引擎不为独立单元编行号,见 failureLine),
    // 位置信息在 f.index —— 它一直是【槽位下标】,0 基,这里转 1 基显示。
    const where = outcome.failures
      .map((f) => (independent ? (f.index === undefined ? undefined : f.index + 1) : f.line))
      .filter(Boolean)
      .join(", ");
    const label = independent ? "items #" : "lines ";
    console.error(`⚠ ${outcome.failures.length} item(s) kept as source after retries${where ? ` (${label}${where})` : ""}`);
    if (outcome.lastError) console.error(`  last error: ${formatErrorWithCause(outcome.lastError)}`);
  };

  const makeContext = (lang: string, fileName: string, sourceExt: string | undefined, firstLangForFile: boolean): CliFormatContext => ({
    translate: async (texts: string[], documentType: "subtitle" | "markdown" | undefined, meta: TranslateBatchMeta, opts?: { independent?: boolean }) => {
      const outcome = await translateLines(
        texts,
        buildConfig(lang, opts?.independent === true),
        {
          cache,
          signal: controller.signal,
          onProgress: (cur, total) => process.stderr.write(`\r  ${Math.min(Math.floor(cur), total)}/${total} `),
          onRateLimit: () => process.stderr.write("\n  rate-limited — cooling down…"),
          getGlossaryTerms,
          rateLimitedEarlier,
        },
        documentType,
        meta,
      );
      rateLimitedEarlier ||= outcome.rateLimited;
      process.stderr.write("\n");
      report(outcome, opts?.independent === true);
      return outcome;
    },
    applyRemoveChars,
    removeChars,
    flags: args as Record<string, string | boolean | undefined>,
    isLlmMethod: LLM_MODELS.includes(method),
    sourceLanguage,
    targetLanguage: lang,
    fileName,
    firstLangForFile,
    sourceExt,
  });

  const byExt = new Map<string, (typeof CLI_FORMAT_HANDLERS)[number]>();
  for (const h of CLI_FORMAT_HANDLERS) for (const ext of h.extensions) byExt.set(ext, h);

  // 输出冲突,两道防线:
  // ① 同一路径列两次(glob 与显式路径重叠、循环变量重复)是【无害】的 ——
  //    输出字节相同,去重即可,不该 exit 2 拖死整批。
  // ② 不同文件、同 basename、配 -o:任何 handler 下输出名必然相同 —— 花钱
  //    前拦住(翻译 locale 树 `-i */messages.json -o out/` 的自然形态)。
  //    扩展名【不同】的输入(movie.srt + movie.vtt --bilingual 都归一成
  //    .ass)在这里预测不了 —— 真实扩展名由 handler 按内容决定,交给写出
  //    防线(下面循环里的 writtenOutputs)精确兜底。
  // Windows 的文件系统大小写不敏感:`-i Clip.SRT -i clip.srt` 是【同一个文件】,
  // 但 resolve 出两个不同字符串,裸 Set 去不掉 —— 翻两遍、计两次费,而写出防线
  // 同样拦不住(输出 stem 也只差大小写,firstWriter 取不到),第二次静默覆盖。
  // 路径比较一律走 pathKey。
  // 折叠范围:win32 与 darwin。
  //
  // 起初只折 win32,理由是「macOS 可以建大小写敏感卷,折叠会把两个真的不同的
  // 文件当成一个、少翻一份」。那条推理只对【输入去重】成立,对【输出覆盖检查】
  // 正好相反:macOS 默认卷是不敏感的,`-i en/Menu.json -i fr/menu.json -o out/`
  // 两个守卫都放行(basename 不等、outPath 是不同的 Map 键),然后 writeFileSync
  // 把两份产物写进【同一个】磁盘文件 —— 第二份静默覆盖第一份,CLI 打两个 ✔
  // 并 exit 0,用户为一份已经不存在的译文付了钱。那正是「would overwrite」这条
  // 错误要拦的事。
  //
  // 两害相权:敏感卷上误合并 → 少翻一份,但会命中 basename 冲突检查并 exit 2
  // (响亮);不敏感卷上漏检 → 静默覆盖(无声)。选前者。
  // pathKey 现在是模块级 helper(目标语言去重也要用它,而那段代码在这之前)。
  // 精确重复(`-i a.srt -i a.srt`)静默去掉 —— 那是用户的笔误,合并没有信息损失。
  const exactUniqueInputs = [...new Set(args.input.map((p) => resolve(p)))];
  const inputs = [...new Map(exactUniqueInputs.map((p) => [pathKey(p), p] as const)).values()];
  // 【仅大小写不同】的输入被折叠掉时说一声 —— warning,不是 error。
  //
  // 为什么不报错:Windows 的卷必然大小写不敏感,`-i Case.srt -i case.srt` 就是
  // 同一个文件的两种拼法,静默合并是【正确】行为(scripts/__tests__/cli.test.ts
  // 有专门的 Windows 用例钉着)。报错会把一个合法的笔误变成硬失败。
  //
  // 为什么也不能完全不说:上面那段注释承诺「敏感卷上误合并 → 会命中 basename
  // 冲突检查并 exit 2(响亮)」,但那道检查的前置条件是折叠【之后】
  // inputs.length > 1 —— 同目录下的 Notes.md + notes.md 折完只剩 1 个,守卫整个
  // 被跳过。于是在 macOS 的大小写敏感卷上(那里两者是真的两个文件),CLI 打一个
  // ✔ 就 exit 0,少翻的那份既没产出也没提示。
  //
  // 平台无法在此可靠区分(stat 的 ino 在 Windows 上不可靠,而敏感卷是运行期
  // 属性),所以取中间值:合并照做,但把被合并的拼法列出来 —— 敏感卷上的用户
  // 一眼能看出少翻了什么,不敏感卷上的用户读到的只是一句无害的确认。
  if (inputs.length < exactUniqueInputs.length) {
    const kept = new Set(inputs);
    const folded = exactUniqueInputs.filter((p) => !kept.has(p));
    console.error(`warning: merged inputs that differ only in letter case: ${folded.join(", ")} — on a case-sensitive volume these are distinct files and were NOT translated. Pass them in separate runs if you need both.`);
  }
  if (args["out-dir"] && inputs.length > 1) {
    const seen = new Map<string, string>();
    for (const inputPath of inputs) {
      const base = basename(inputPath);
      const prev = seen.get(pathKey(base));
      if (prev) {
        console.error(`error: "${prev}" and "${inputPath}" share the basename "${base}" — with -o they would write to the same output file. Translate them separately or into different -o directories.`);
        return 2;
      }
      seen.set(pathKey(base), inputPath);
    }
  }
  // 写出防线:本轮已写路径 → 首个来源文件。第二个写者报错而不是静默覆盖 ——
  // 预扫防不住的扩展名归一化碰撞(srt+vtt 双语都出 .ass)在这里被精确拦下。
  const writtenOutputs = new Map<string, string>();

  // try/finally 保住 flush:任何异常逃出文件循环(mkdir 失败、handler 抛错…)
  // 时,已入缓存的付费翻译都要落盘 —— 重跑从缓存续,不重复打 API。
  try {
  for (const inputPath of inputs) {
    if (controller.signal.aborted) break;
    const fileName = basename(inputPath);
    const handler = args.format ? CLI_FORMAT_HANDLERS.find((h) => h.id === args.format) : byExt.get(extname(fileName).toLowerCase());
    if (!handler) {
      console.error(`✖ ${fileName}: cannot infer format from the extension — pass --format (${CLI_FORMAT_HANDLERS.map((h) => h.id).join(" | ")})`);
      hardFailures++;
      continue;
    }

    let text: string;
    try {
      text = await readTextFile(inputPath);
    } catch (e) {
      console.error(`✖ ${fileName}: cannot read (${(e as Error).message})`);
      hardFailures++;
      continue;
    }

    // 文件级警告只打一次(见 CliFormatContext.firstLangForFile)。按【真正跑起来的
    // 第一个语言】算,不是 targets[0]:输出冲突守卫会 continue 掉某些语言。
    let fileWarned = false;
    const dotIdx = fileName.lastIndexOf(".");
    const stem = dotIdx > 0 ? fileName.slice(0, dotIdx) : fileName;
    const sourceExt = dotIdx > 0 ? fileName.slice(dotIdx + 1).toLowerCase() : undefined;
    const outDir = args["out-dir"] ? resolve(args["out-dir"]) : dirname(inputPath);
    // 预算一次:输入集在整轮里是冻结的,dirname/basename/pathKey 都是纯函数,
    // 放在 lang 循环的 find 回调里等于把 N×L×N 次路径解析算给同一份数据。
    const outDirKey = pathKey(outDir);
    const inputsInOutDir = inputs.filter((p) => pathKey(dirname(p)) === outDirKey).map((p) => ({ base: pathKey(basename(p)), path: p }));
    // 与本循环里其它每一处 I/O 同一个错误契约:报 ✖ <file>、计入 hardFailures、
    // 继续下一个。裸 mkdirSync 会穿透整个文件循环直达顶层 catch —— `-o` 指到
    // 一个已存在的普通文件(或只读目录)时,用户只看到一行 `fatal: ENOTDIR`,
    // 既不知道是哪个文件、也不知道后面几个根本没被尝试过。
    try {
      mkdirSync(outDir, { recursive: true });
    } catch (e) {
      console.error(`✖ ${fileName}: cannot create output directory ${outDir} (${(e as Error).message})`);
      hardFailures++;
      continue;
    }

    for (const lang of targets) {
      if (controller.signal.aborted) break;
      // 【翻译前】拦住"输出会覆盖本轮某个输入"。精确文件名要等 handler 跑完才
      // 知道(扩展名由内容决定),但输出形状只有两种,都以 `${stem}.${lang}` 打头:
      //   普通  stem.lang.ext
      //   双语  stem.lang_bilingual.ext   (appendBilingualSuffix 插在最后一个点前)
      // 所以判到分隔符为止即可 —— 只比 `stem.lang` 会误伤 clip.zhh.srt。
      // 放在翻译后的话,整份文件已经翻完(--no-cache / 换 provider 时是真实计费)
      // 才被丢弃,用户还要等一轮翻译才看到这条错误。
      // 前缀在回调【外】算一次:它对每个候选都一样,放进回调就是每扫一个元素
      // 重做两次模板拼接 + 两次 toLowerCase(N=1000 时实测 2.8s → 0.9s)。
      // 先折叠再拼接是安全的:`.` 与 `_` 无大小写,不会被 toLowerCase 移位。
      const prefix = pathKey(`${stem}.${lang}`);
      const collidingInput = inputsInOutDir.find(({ base }) => base.startsWith(`${prefix}.`) || base.startsWith(`${prefix}_`))?.path;
      if (collidingInput) {
        console.error(`✖ ${fileName} → ${lang}: would write over ${basename(collidingInput)}, which is one of this run's inputs — refusing. Use -o to write elsewhere, or narrow the input glob (e.g. exclude *.${lang}.*).`);
        hardFailures++;
        continue;
      }
      process.stderr.write(`${fileName} → ${lang} (${handler.id}, ${method})\n`);
      try {
        // 「本文件第一个【真正跑起来】的语言」,不是 targets[0] —— 上面的
        // collidingInput 守卫会 continue 掉某些语言,拿 targets[0] 比会让那个文件
        // 的文件级警告(精度损失/整数键重排)一次都不出。
        const result = await handler.run(text, makeContext(lang, fileName, sourceExt, !fileWarned));
        fileWarned = true;
        if (!result) {
          // 文件级判定(内容里没有可译文本),与目标语言无关 —— continue 会让
          // 一个空文件在 `-t ja -t ko -t zh` 下报三次 ✖、hardFailures 记成 3,
          // 读 ✖ 数量的人(或 CI)会以为挂了三个。报一次就跳到下一个文件。
          console.error(`✖ ${fileName}: no translatable content`);
          hardFailures++;
          break;
        }
        const base = `${stem}.${lang}.${result.ext}`;
        const outName = result.bilingualSuffix ? appendBilingualSuffix(base) : base;
        const outPath = join(outDir, outName);
        const firstWriter = writtenOutputs.get(pathKey(outPath));
        if (firstWriter && firstWriter !== fileName) {
          console.error(`✖ ${fileName} → ${lang}: would overwrite ${outName}, already written from "${firstWriter}" this run — outputs collide after extension normalization. Use separate -o directories.`);
          hardFailures++;
          continue;
        }
        // 【写成功之后】才登记。写失败(磁盘满 / 文件被编辑器锁 / 只读目标)时
        // 提前登记会让这个守卫拿一个根本不存在的产物去拒绝后面的输入:
        // 「would overwrite X, already written from "Y"」—— 用户去找 X 找不到,
        // 还会为一个幻影冲突去重排 -o 目录。守卫说"已写过",就得真写过。
        writeFileSync(outPath, result.content);
        writtenOutputs.set(pathKey(outPath), fileName);
        cache?.flush();
        console.error(`✔ ${outName}`);
      } catch (e) {
        process.stderr.write("\n");
        // 用户取消:交给循环外的 aborted → 130 出口。
        if (controller.signal.aborted) break;
        // 文件级解析失败与目标语言无关 —— 报一次就换下一个文件,别每个语言
        // 各记一次硬失败(与上面「没有可译内容」用 break 同一道理)。
        if (e instanceof CliFileFormatError) {
          console.error(`✖ ${fileName}: ${e.message}`);
          hardFailures++;
          break;
        }
        console.error(`✖ ${fileName} → ${lang}: ${formatErrorWithCause(e)}`);
        hardFailures++;
        // 凭据失败快停:同一把坏 key 会让【每一个】后续 file×lang 以同样方式
        // 死掉 —— 10 文件 × 5 语言 = 50 轮注定失败的请求,还可能触发服务端
        // 滥用限制。auth 错误(或它级联出的 "Translation aborted" 标记)直接
        // 终止整批。仍是 exit 1(硬失败),不是 130(那是用户取消)。
        // 用共享的 isCascadedAbort,不要手写字符串比较:级联标记由 pipeline 多处
        // 抛出(grep `Translation aborted`)、别处一律经这个断言消费。哪天措辞改了(或换成带类型的
        // 错误),网页端全都跟着走,只有这行会【静默】失配 —— 坏 key 不再触发
        // 凭据快停,整批 file×lang 全跑一遍注定失败的请求。
        // ⚠ 判据是 isDefiniteAuthFailure(只认数值 401/403),与网页壳【同一个】。
        // 用宽判据 isAuthError 的话,一段含 "Forbidden" 的上游/代理响应体
        // (`[502] upstream returned 403 Forbidden`)就会掐掉整批 —— 而多文件批量
        // 恰恰主要发生在 CLI 这一侧。两个壳判据不一致比判据宽更糟:同一个引擎、
        // 同一份错误,一边停一边不停。
        if (isDefiniteAuthFailure(e) || isCascadedAbort(e)) {
          console.error("fatal: credential failure — aborting the remaining files/languages.");
          return 1;
        }
      }
    }
  }
  } finally {
    // finally 而非循环后直落:异常/快停/取消哪条路径出去都先落盘。
    // force:这是最后一次机会,节流窗口不能吞掉本轮最后几行。
    cache?.flush(true);
  }

  // 取消落在文件之间(上一个已写完、下一个未开始)时循环正常退出 —— 但用户
  // 取消了就是取消了:130,不能让 `yarn cli … && upload` 的下一步照常放行。
  if (controller.signal.aborted) return 130;
  return hardFailures > 0 || softFailures > 0 ? 1 : 0;
};

// process.exitCode + natural exit, NOT process.exit(): on Windows, exit() mid
// esbuild/tsx child teardown trips a libuv assertion (UV_HANDLE_CLOSING crash).
main()
  .catch((e: unknown) => {
    // 走到这里只剩意外异常:管线的 abort/auth 已在文件循环内消化(用户取消 →
    // main 内的 aborted 检查 → 130;auth → 快停 → 1),没有再映射 130 的路径。
    console.error(`fatal: ${(e as Error)?.message ?? e}`);
    return 1;
  })
  .then((code) => {
    process.exitCode = code;
  });
