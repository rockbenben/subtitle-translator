declare global {
  interface Window {
    __TAURI__?: unknown;
    __TAURI_INTERNALS__?: unknown;
  }
}

// Detect via runtime globals/UA only — NEVER by importing @tauri-apps/api (it loads
// fine in a browser; invoke only throws at call time). Sync so click handlers can use it.
export const isTauriRuntime = (): boolean => {
  if (typeof window === "undefined") return false;
  if (window.__TAURI_INTERNALS__) return true; // v2
  if (window.__TAURI__) return true; // v1
  if (typeof navigator !== "undefined" && navigator.userAgent.includes("Tauri")) return true;
  return false;
};

export const isTauri = async (): Promise<boolean> => isTauriRuntime();

export const openExternalLink = async (url: string) => {
  if (isTauriRuntime()) {
    try {
      const { openUrl } = await import("@tauri-apps/plugin-opener");
      await openUrl(url);
      return;
    } catch (e) {
      console.error("opener failed:", e);
    }
  }
  window.open(url, "_blank", "noopener,noreferrer");
};
