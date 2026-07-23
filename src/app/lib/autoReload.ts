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
