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
 * 点击时才 import() 的 chunk(js-opencc 的 1.1MB 字典就是)在旧会话里按旧 hash
 * 名 404,而这类 reject 都被各自的 try/catch 吃掉了 —— 既到不了上面的 error
 * boundary,也不会变成 unhandledrejection,于是工具只会每次点击都报一句「失败」,
 * 刷新之前永远好不了。同样不去分辨错误类型(判据只有一堆不可靠的字符串),
 * 冷却窗内只重载一次:真 bug 也就多刷一次,之后照常显示原来的错误提示。
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
  window.location.reload();
  return true;
}

/**
 * 点击时才拉的 chunk 用这个包一层(compromise 350KB / jszip 172KB / jschardet…)。
 *
 * 与在 catch 里调 tryAutoReload() 的区别是**精确**:只有 import 本身失败才自愈,
 * 后续业务逻辑抛错(OOM、格式不对)照原样冒泡,不会白搭一次重载丢掉用户成果。
 * 凡是 import 语句在我们自己手里的地方都该用它;拿不到 import 的(js-opencc 在
 * createConverter 内部拉字典)才退回 catch 站点的整体重载。
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
