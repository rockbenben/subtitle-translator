/**
 * 更新弹窗文案,桌面壳专属。
 *
 * 为什么不进 messages/{locale}.json:那些文件由 project_sync 按上游命名空间合并,
 * 桌面命名空间在上游不存在,加进去会在下次同步时变成越界键;而这个弹窗只有桌面端
 * 能看到。先覆盖简中 / 繁中 / 英文,其余 locale 回落英文(此弹窗历史上只有英文)。
 * 上游真做了桌面分发后再考虑并回 messages。
 */
export interface UpdaterStrings {
  title: string;
  content: (version: string) => string;
  remindLater: string;
  skipVersion: string;
  installNow: string;
  downloading: (downloaded: number, total: number | null) => string;
  installing: string;
  failed: string;
}

const MB = 1024 * 1024;
const fmtMb = (bytes: number) => `${(bytes / MB).toFixed(1)} MB`;
const percent = (done: number, total: number) => `${Math.round((done / total) * 100)}%`;

const en: UpdaterStrings = {
  title: "Update Available",
  content: (v) => `Version ${v} is available. Download and install now? The app will restart.`,
  remindLater: "Remind Me Later",
  skipVersion: "Skip This Version",
  installNow: "Install Now",
  downloading: (done, total) =>
    total ? `Downloading update… ${percent(done, total)}` : `Downloading update… ${fmtMb(done)}`,
  installing: "Installing update…",
  failed: "Installation failed. Please download the latest version manually.",
};

const zh: UpdaterStrings = {
  title: "发现新版本",
  content: (v) => `新版本 ${v} 已就绪。立即下载并安装吗?安装完成后应用将自动重启。`,
  remindLater: "以后再说",
  skipVersion: "跳过此版本",
  installNow: "立即安装",
  downloading: (done, total) =>
    total ? `正在下载更新… ${percent(done, total)}` : `正在下载更新… ${fmtMb(done)}`,
  installing: "正在安装更新…",
  failed: "安装失败,请手动下载最新版本。",
};

const zhHant: UpdaterStrings = {
  title: "發現新版本",
  content: (v) => `新版本 ${v} 已就緒。立即下載並安裝嗎?安裝完成後應用程式將自動重新啟動。`,
  remindLater: "稍後再說",
  skipVersion: "跳過此版本",
  installNow: "立即安裝",
  downloading: (done, total) =>
    total ? `正在下載更新… ${percent(done, total)}` : `正在下載更新… ${fmtMb(done)}`,
  installing: "正在安裝更新…",
  failed: "安裝失敗,請手動下載最新版本。",
};

export const getUpdaterStrings = (locale: string): UpdaterStrings => {
  if (locale === "zh") return zh;
  if (locale === "zh-hant") return zhHant;
  return en;
};
