/**
 * 把文件字节解码为字符串(编码自适应)。
 *
 * 策略分三步(顺序不能换,理由见下面那段 ⚠):
 *   1. 扫 NUL 密度 —— 密集就【不是】UTF-8 文本,直接跳过第 2 步;
 *      能判出端序就按 UTF-16LE/BE 解,判不出交给第 3 步。
 *   2. 不密集:UTF-8 fatal 对全文试解。UTF-8 是自验证编码,在【NUL 不密集】
 *      这个前提下成功即几乎确定是 UTF-8。
 *   3. 前两步都不成(GBK/Big5/带 BOM 的 UTF-16 等):取样喂 jschardet 检测;
 *      检测不出就明确报错,不回退 UTF-8(那是唯一一个已知错误的解码器)。
 *
 * 从 useFileUpload.readFile 中提取成共享工具:词汇表 TSV / 保护规则词典的
 * 导入此前用 readAsText(只会按 UTF-8 解),中文 Windows 上 Excel 导出的
 * ANSI/GBK 文件被解成 U+FFFD 乱码后【静默持久化】进 localStorage,翻译/转换
 * 时规则永远匹配不上。
 *
 * 附带效果:TextDecoder 默认 ignoreBOM:false,会吃掉 UTF-8 BOM —— 这正是
 * 网页端能翻译带 BOM 的 json/md 而 Node 的 readFileSync(p,"utf8")(保留 BOM)
 * 不能的原因。CLI 走同一条路径,BOM 问题一并消失。
 *
 * 独立成模块(不放 fileUtils):fileUtils 顶部 import 了 file-saver,而本函数
 * 是 CLI(Node)读输入文件的入口 —— 同 lib/translation 的导入纪律,纯逻辑不
 * 得被浏览器专属模块绑架。
 */
/**
 * UTF-8 fatal 解码成功【不等于】就是 UTF-8 —— NUL 是完全合法的 UTF-8 字节,
 * 所以无 BOM 的 UTF-16/UTF-32 会顺利骗过它,返回一串 NUL 夹花的文本。
 * 后果不是报错而是【静默交付垃圾】:HAS_TRANSLATABLE_CONTENT 仍然匹配(字母都在),
 * 整份内容被送去翻译、按行计费、写出乱码产物、exit 0 —— 盯 exit code 的 CI 照发。
 * (PowerShell `Out-File -Encoding unicode` 与若干 Windows 编辑器就产出这种文件。)
 *
 * ⚠ 这里是【两个】判断,必须分开,合成一个两次都出过错:
 *   ① 这份字节【是不是】UTF-8 文本  → 看 NUL 密度
 *   ② 如果不是,该【怎么】解        → 看 NUL 落在哪个奇偶位(端序)
 * 拿"出现过任一 NUL"当 ① 会把带一个游离 NUL 的合法 UTF-8(某些字幕提取器/混流器
 * 会留下)整份拒掉,还提示"请另存为 UTF-8"—— 它本来就是 UTF-8,指引无从执行。
 * 反过来拿 ②(端序可判)当 ① 又会放过端序判不出的那些:UTF-32LE 的 NUL 奇偶比是
 * 2:1,永远够不到 8:1,于是密度 75% 的一份 UTF-32 被当成 UTF-8 通过 —— 实测解出
 * 13600 字符里含 10200 个 U+0000,字母还在,照样计费翻译并 exit 0。
 * 所以:密度决定"是不是",端序只决定"怎么解";密集但端序判不出的交给 jschardet,
 * 由它认(带 BOM 的 UTF-16 等),认不出就明说 —— 明确报错好过静默出货垃圾。
 */
import { lazyImport } from "@/app/lib/autoReload";

const NUL_SCAN_BYTES = 4096;
/** 密度阈值:UTF-16 的 ASCII 段约一半是 NUL、UTF-32 约四分之三,而正常文本里 NUL 极稀。 */
const NUL_DENSITY_DIVISOR = 4;
/** 端序判据:真 UTF-16 的 NUL 几乎【全部】落在同一奇偶位上。 */
const ENDIAN_PARITY_DOMINANCE = 8;

/** 前 NUL_SCAN_BYTES 里 NUL 按奇偶位的分布。 */
const scanNuls = (bytes: Uint8Array): { even: number; odd: number; scanned: number } => {
  const head = bytes.subarray(0, NUL_SCAN_BYTES);
  let even = 0;
  let odd = 0;
  for (let i = 0; i < head.length; i++) {
    if (head[i] !== 0) continue;
    if (i % 2 === 0) even++;
    else odd++;
  }
  return { even, odd, scanned: head.length };
};

/** ① NUL 密集 ⇒ 这不是 UTF-8 文本(UTF-16/UTF-32/二进制),别走 UTF-8 快路。 */
const isNulDense = (n: { even: number; odd: number; scanned: number }): boolean => (n.even + n.odd) * NUL_DENSITY_DIVISOR >= n.scanned && n.scanned > 0;

/**
 * ② 端序 —— UTF-16LE 的 ASCII 是 `H\0e\0`(NUL 在【奇】数位),BE 是 `\0H\0e`(偶数位)。
 * 判不准返回 undefined:交给 jschardet,别硬猜。UTF-32 落在这里(奇偶比 2:1)。
 */
const detectUtf16Endian = (n: { even: number; odd: number }): "utf-16le" | "utf-16be" | undefined => {
  if (n.odd > n.even * ENDIAN_PARITY_DOMINANCE) return "utf-16le";
  if (n.even > n.odd * ENDIAN_PARITY_DOMINANCE) return "utf-16be";
  return undefined;
};

export const decodeFileBytes = async (buffer: ArrayBuffer): Promise<string> => {
  const uint8Array = new Uint8Array(buffer);
  const nuls = scanNuls(uint8Array);
  const nulDense = isNulDense(nuls);
  const endian = nulDense ? detectUtf16Endian(nuls) : undefined;
  try {
    if (endian) return new TextDecoder(endian, { fatal: true }).decode(uint8Array);
    // NUL 密集但端序判不出(UTF-32、混合二进制):【不能】走 UTF-8 —— 它会"成功"
    // 并返回夹着 NUL 的垃圾。抛出去落进下面的 jschardet 分支。
    if (nulDense) throw new Error("NUL-dense bytes — not UTF-8 text");
    return new TextDecoder("utf-8", { fatal: true }).decode(uint8Array);
  } catch {
    // 采样【从第一个非 ASCII 字节开始】,不是从文件头。
    //
    // 走到这里通常意味着 UTF-8 fatal 已经失败,所以这样的字节必然存在。而定长取头
    // 512KB 在"前半段纯 ASCII、非 ASCII 在后"的文件上会取到一段纯 ASCII 样本
    // —— jschardet 于是返回 "ascii",那【是】TextDecoder 认识的标签(别名
    // windows-1252),下面的解码顺利成功,尾部的 GBK/Big5 正文被解成 Latin-1
    // 垃圾:没有 U+FFFD、不抛错、不警告,CLI 照样翻译并写出、exit 0。
    // 大段 ASCII 开头很常见:带长英文 frontmatter 的 md、键名全英文的 locale
    // json、前半段是英文台词的双语字幕。
    //
    // 往前多带 1KB 上下文:多字节编码的统计特征在片段边界上更容易被误判。
    //
    // ⚠ NUL 密集的字节例外,必须【从头取】:UTF-16/UTF-32 的 ASCII 段每个字节都
    // < 0x80(字母 + NUL),firstNonAscii 会一路扫到文件尾,取到的样本既是任意
    // 尾巴、又可能落在【奇数】偏移上把宽字符的字节组切错位 —— jschardet 拿到
    // 错位样本认不出编码,一个本可判别的文件被拒。偏移 0 天然对齐,而这类编码的
    // 统计特征从第一个字节就开始。
    // (判据用 nulDense 而不是 endian:端序判得出来的在上面已经解完返回了,
    // 能走到这里的恰恰是端序判不出的那些 —— UTF-32 就在其中。)
    const SAMPLE_SIZE = 512 * 1024;
    const CONTEXT_BEFORE = 1024;
    let firstNonAscii = 0;
    while (firstNonAscii < uint8Array.length && uint8Array[firstNonAscii]! < 0x80) firstNonAscii++;
    const sampleStart = nulDense ? 0 : Math.max(0, Math.min(firstNonAscii, uint8Array.length - 1) - CONTEXT_BEFORE);
    const sample = uint8Array.subarray(sampleStart, Math.min(sampleStart + SAMPLE_SIZE, uint8Array.length));
    // Build binary string where charCode === byte value (required by jschardet).
    // Cannot use TextDecoder("latin1") because browsers map it to Windows-1252,
    // which remaps bytes 0x80-0x9F to different code points and breaks detection.
    let sampleString = "";
    for (let i = 0; i < sample.length; i += 8192) {
      sampleString += String.fromCharCode.apply(null, sample.subarray(i, i + 8192) as unknown as number[]);
    }

    // 检测编码(基于样本),后续仍对完整内容进行解码。Lazy load jschardet。
    // lazyImport:旧会话拿旧 hash 名去取这个 chunk 会 404,否则用户看到的是
    // 「编码识别失败,请另存为 UTF-8」—— 文件没问题,指引无从执行。Node(CLI)下
    // lazyImport 不会重载,行为与直接 import 一致。
    const jschardet = (await lazyImport(() => import("jschardet"))).default;
    const detected = jschardet.detect(sampleString);

    // 走到这里意味着 UTF-8 fatal 已经失败 —— 这份字节【确定不是】UTF-8。
    // 所以检测不出编码时【不能】回退 TextDecoder("utf-8"):那是唯一一个已知
    // 错误的解码器,只会产出满屏 U+FFFD(数据全毁),而调用链看起来一切正常
    // ——CLI 会照常写出文件并 exit 0,因为 U+FFFD 不匹配任何"有可译内容"的
    // 判据,一行都不会被送出去,也就一条失败都不记。判不出来就明说。
    //
    // 试过按 gb18030→big5→shift_jis→euc-kr 顺序做 fatal 探测取第一个不报错的,
    // 实测【无法判别】:gb18030 会"干净"接受 Big5 / Shift_JIS / EUC-KR 的字节,
    // 解出似是而非的中文乱码。那比 U+FFFD 更坏 —— ��� 用户一眼看得见,
    // 像模像样的乱码会被当正文送去翻译、计费,再写进输出文件。
    //
    // 抛出前【必须确认每个调用方的失败通路真的通】—— 上一版这里写着
    // 「TextDiff 另有手动选编码的兜底」,是错的:那个选择器以 s.bytes 为渲染
    // 条件,而 bytes 是在 await 之后才写进 state 的,抛出后压根没被设置。同期
    // 设置导入的 createSettingsFileInput 只传了成功回调,Promise 永不 settle。
    // 两处都已修好(TextDiff 在 catch 里保留 bytes;settings 接上 onError)。
    // 现状:useFileUpload / 词汇表导入 / 保护规则导入 / TextDiff / CLI 五个
    // 调用方各自有 try-catch 与用户可见提示,CLI 还会 hardFailures++ → exit 1。
    // "ascii" 是【自相矛盾】的结论,当作判不出来处理:UTF-8 fatal 已经失败,
    // 这份字节里确定有非 ASCII 内容。检测器却说纯 ASCII,只能是样本没覆盖到
    // (上面的定位采样已尽量避免,这里是第二道网)。放行的话它会被当作
    // windows-1252 别名成功解码,把非 ASCII 正文变成 Latin-1 垃圾且全程无声。
    const label = detected.encoding?.toLowerCase();
    if (!label || label === "ascii") throw new Error("unrecognized text encoding — re-save the file as UTF-8");
    try {
      return new TextDecoder(detected.encoding).decode(uint8Array);
    } catch {
      // jschardet 给了 TextDecoder 不认的标签(或乱码标签)——同样是"判不出来"。
      throw new Error(`unsupported text encoding "${detected.encoding}" — re-save the file as UTF-8`);
    }
  }
};
