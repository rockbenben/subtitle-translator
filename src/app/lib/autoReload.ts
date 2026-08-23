/**
 * Deploy-skew recovery policy for the locale error boundary.
 *
 * Static-export deploys replace gh-pages wholesale: the previous build's
 * hashed chunks are deleted. A session opened before the deploy (or served
 * stale HTML by the CDN) lazy-loads tool chunks by old names on client-side
 * nav → 404 → module-eval TypeError → error boundary. One hard reload picks
 * up the new, self-consistent build.
 *
 * The error boundary can't reliably distinguish a skew failure from a real
 * render bug (the observed symptom is a plain TypeError), so it auto-reloads
 * on ANY first error and uses this cooldown as the loop guard: a persistent
 * bug reloads once, then shows the fallback UI.
 */
export const AUTO_RELOAD_COOLDOWN_MS = 60_000;

/** sessionStorage key holding the epoch-ms of the last auto-reload. */
export const RELOAD_STAMP_KEY = "app-error-reloadedAt";

export function shouldAutoReload(lastReloadMs: number | null, nowMs: number): boolean {
  if (lastReloadMs === null) return true;
  return nowMs - lastReloadMs > AUTO_RELOAD_COOLDOWN_MS;
}

/**
 * 同一套策略,给【事件处理器里的懒加载】用。
 *
 * 点击时才 import() 的 chunk 在旧会话里按旧 hash 名 404,而这类 reject 都被各自的
 * try/catch 吃掉了 —— 既到不了上面的 error boundary,也不会变成 unhandledrejection,
 * 于是工具只会每次点击都报一句「失败」,刷新之前永远好不了。同样不去分辨错误类型
 * (判据只有一堆不可靠的字符串),冷却窗内只重载一次:真 bug 也就多刷一次,之后照常
 * 显示原来的错误提示。
 *
 * ⚠ js-opencc 1.4.0 起字典是【按方向逐文件】拉的,不再是一次拉全的单个 chunk:每个
 * 转换方向按需取自己那几本词典(具体几个/多大随版本与方向变,别在这里记数字 —— 这行
 * 数字烂过三次了,要看就 `getDictFiles(from,to)` 现场量)。承重的结论只有一条:发版
 * 错位的窗口从「首次转换」扩大到【每次换转换方向】—— 会话里已经成功转过一次,换个
 * 方向照样可能撞 404。这条自愈路径因此比以前更常被用到,别把它当成只在冷启动才有
 * 意义的兜底删掉。
 *
 * 冷却窗拦下重载时(返回 false)用户会看到「失败」并可能再点一次。注意这一次多半
 * 【也好不了】:发版错位下旧 bundle 的运行时仍解析到同一个旧 hash 名的 URL,重试
 * 只是再撞一次 404。js-opencc 把构建失败的转换器逐出缓存(1.4.0 起如此)救的是
 * 【瞬时】故障(网络抖动),没有它连瞬时故障都会被缓存里那个失败一直重放。
 * 换句话说:重试兜住瞬时失败,重载兜住发版错位,两者不可互相替代。
 *
 * 返回 true 表示重载已在路上,调用方应当闭嘴(别再弹 message)。SSR/Node 下恒 false。
 */
export function tryAutoReload(): boolean {
  if (typeof window === "undefined") return false;
  let last: number | null = null;
  try {
    last = Number(sessionStorage.getItem(RELOAD_STAMP_KEY)) || null;
  } catch {
    // sessionStorage 不可用 → last 保持 null,照样重载(与 error boundary 一致):
    // 丢的是循环护栏,而循环还要求错误跨整页加载持续存在。
  }
  if (!shouldAutoReload(last, Date.now())) return false;
  try {
    sessionStorage.setItem(RELOAD_STAMP_KEY, String(Date.now()));
  } catch {}
  try {
    window.location.reload();
  } catch {
    // 沙箱 iframe 等敌意环境下 reload() 会抛 SecurityError。不接住的话它会穿过
    // 调用方的 catch 变成 unhandledrejection:按钮转完就没了,既不重载也不报错,
    // 用户什么都看不到。返回 false 让调用方照常弹错误提示。
    return false;
  }
  return true;
}

/**
 * 点击时才拉的 chunk 用这个包一层(compromise 350KB / jszip 172KB / jschardet…)。
 *
 * 与在 catch 里调 tryAutoReload() 的区别是**精确**:只有 import 本身失败才自愈,
 * 后续业务逻辑抛错(OOM、格式不对)照原样冒泡,不会白搭一次重载丢掉用户成果。
 * 凡是 import 语句在我们自己手里的地方都该用它;拿不到 import 的(js-opencc 在
 * createConverter 内部拉字典)才退回 catch 站点的重载 —— 它的 dictLoaders 现在被
 * exports map 挡在包外(`js-opencc/dist/dict/index.js` 报 ERR_PACKAGE_PATH_NOT_EXPORTED)。
 * 这是当前包的形状,不是物理定律:js-opencc 是自家维护的,真想把这条路径也做精确,
 * 上游开一个 `./dict` 子路径导出即可 —— 只是调用方得先自己预热该方向的字典再调
 * createConverter(让它命中模块缓存),不算白拿,值不值得另说。
 *
 * 重载后本行的 throw 已经没人看得见了,但仍要抛:重载可能被冷却窗拦下。
 */
export async function lazyImport<T>(load: () => Promise<T>): Promise<T> {
  try {
    return await load();
  } catch (err) {
    tryAutoReload();
    throw err;
  }
}
