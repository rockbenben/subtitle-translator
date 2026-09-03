import { createStore, get, set, del } from "idb-keyval";

/**
 * 「导出目录」—— 让导出落进用户指定的文件夹，而不是浏览器的下载目录。
 *
 * 【能力边界】只有 Chromium 桌面（Chrome / Edge / Opera 86+）有 File System
 * Access API。Firefox、Safari、全部移动端 supportsExportDir() 为 false，
 * downloadFile 原样走 file-saver。桌面外壳（Tauri / Electron）不走这条路 ——
 * 它们注入自己的原生实现，见 setNativeExportDir。
 *
 * 【存储走 idb-keyval】目录句柄只能结构化克隆，存不进 localStorage，躲不开
 * IndexedDB；而这里要的只是一个库、一个 store、一个 key 的 get/set/del —— 正是
 * idb-keyval 的全部。它的 `set` 等的是 **事务提交**（`promisifyRequest(store.transaction)`）
 * 而不是请求成功，这条正是我们要的语义：回报「已保存」而事务随后 abort，等于弹了
 * 绿字却什么也没存。
 * ⚠ 它随 src/app/utils 整目录同步给【全部】子项目，所以那 8 个仓库的 package.json
 * 也必须有 idb-keyval（与翻译缓存用的 `idb` 是两个包），否则构建期 Module not found。
 *
 * 【只认已授权的目录】权限不跨浏览器会话：重启后 queryPermission 回 "prompt"。
 * 此时【显示名与落盘位置必须一起退回下载目录】—— 只退一边就是撒谎，而两个方向都
 * 伤人：说着目录却写进下载（用户按提示去目录里找不到），或说着下载却写进目录
 * （文件存下来了，用户在下载目录翻不到）。所以 requestPermission 只发生在
 * pickExportDir（那必然在用户手势里），读与写两条路径一律【只 query】。
 */

const DB_NAME = "tools-by-ai-export";
const STORE = "handles";

/**
 * 【按工具分别记】而不是全站一个。产物本来就分工具（字幕译文 / i18n JSON / 切分
 * 片段该落在不同地方），更重要的是它消掉了一个矛盾：全局设置 + 「用不上的工具不显示
 * 入口」＝「设了也看不见」的隐形全局状态，此前要靠一条「目录生效时自动出现」的补丁
 * 规则去圆。按工具存之后，每个工具只看得见也只受自己那个目录影响。
 * 代价：授权绑在句柄上，N 个目录就是 N 次授权。
 */
const keyFor = (toolKey: string) => `exportDir:${toolKey}`;

/**
 * 当前页面的工具键。写入路径（`downloadFile` → `writeToExportDir`）在 37 个调用点
 * 深处，逐个传 toolKey 不现实；而页面容器 `ToolPage` 本来就拿着它 —— 由它在挂载时
 * 告知一次即可。UI 那一侧走显式 prop（渲染期就要正确，子组件的 effect 早于父组件），
 * 两条路的值同源于 ToolPage 的 toolKey，不会分叉。
 */
let currentTool: string | null = null;
export const setExportDirTool = (toolKey: string | null) => {
  currentTool = toolKey;
};

/**
 * 【桌面外壳的原生实现注入口】Tauri / Electron 里没有 File System Access
 * （WKWebView、WebKitGTK 根本没有，WebView2 有没有不该由这里赌），但外壳本来就有
 * 原生目录选择器、也有自己的落盘钩子。注入之后本模块的四个出口全部改走原生实现，
 * 下面那套 File System Access + IndexedDB 一行都不会执行。
 *
 * 【为什么是运行时注入，而不是让桌面分支各自改这个文件】本文件与
 * components/ExportFolder.tsx、components/styled/ToolPage.tsx 都由
 * scripts/project_sync.py 铺给全部子项目（后者还是 overwrite 模式）。桌面分支直接改
 * 这三个文件的话，每次同步都被覆盖一遍 —— 那正是各子项目 src/app/desktop/ 这个目录
 * 存在的理由：分歧只许待在同步范围之外。所以这里只留一个口子，实现放在桌面分支
 * 自己的目录里，两边谁也不用改对方。
 *
 * 【没有 write：落盘归外壳】外壳拦的是浏览器下载本身（Tauri 挂 webview 的
 * on_download），saveAs() 触发的那一次就已经落进用户选的目录了。所以注入之后
 * writeToExportDir 一律返回 null，让 downloadFile 老实走 saveAs()。
 * 代价：那条路径拿不到落点，导出提示只报文件名、不报目录（Rust 侧改写路径这件事
 * JS 无从得知）。要改得让外壳把落点回传，等有人真的需要再说。
 */
export interface NativeExportDir {
  /** 打开原生目录选择器并记住选择，返回目录名；用户取消返回 null。 */
  pick: (toolKey: string) => Promise<string | null>;
  /** 该工具当前生效的目录（外壳可以给完整路径）。没设过返回 null。 */
  current: (toolKey: string) => Promise<string | null>;
  /** 忘掉该工具的目录，导出回到系统下载目录。 */
  clear: (toolKey: string) => Promise<void>;
}

let nativeExportDir: NativeExportDir | null = null;

/**
 * 外壳在【模块作用域】调一次（supportsExportDir() 在渲染期就被读，放进 effect 太晚，
 * 按钮会先闪一下）。传 null 摘掉，给测试用。
 */
export const setNativeExportDir = (impl: NativeExportDir | null): void => {
  nativeExportDir = impl;
};

// showDirectoryPicker 与 FileSystemHandle 的权限扩展都不在 TS 的 lib.dom 里，
// 就地声明最小面，省一个 @types 依赖。
type FsPermissionDescriptor = { mode?: "read" | "readwrite" };
type ExportDirHandle = FileSystemDirectoryHandle & {
  queryPermission?: (desc: FsPermissionDescriptor) => Promise<PermissionState>;
  requestPermission?: (desc: FsPermissionDescriptor) => Promise<PermissionState>;
  // 存在性探测用；lib.dom 没声明目录句柄的异步迭代器
  keys: () => AsyncIterableIterator<string>;
};
declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: "read" | "readwrite"; startIn?: string }) => Promise<FileSystemDirectoryHandle>;
  }
}

// createStore 只把库名/store 名记进闭包，indexedDB.open 推迟到首次真正读写 ——
// 所以模块级调用它在 Node 侧（本模块被 fileUtils 静态 import）也不会炸。
// 库名与 store 名沿用裸 IDB 版本：无版本 open 拿到的就是同一个 v1 + handles，
// 已经选过目录的用户不用重选（实测确认过）。
const exportStore = createStore(DB_NAME, STORE);

const readStoredHandle = (toolKey: string): Promise<ExportDirHandle | undefined> => get<ExportDirHandle>(keyFor(toolKey), exportStore);

/**
 * 当前跑在【外壳注入的原生实现】上吗。界面拿它分流提示文案：
 * File System Access 那条路有浏览器的目录黑名单（桌面 / 文档 / 下载 / 用户目录选不了），
 * 原生选择器没有 —— 在桌面外壳里说那句是彻头彻尾的假话。
 */
export const isNativeExportDir = (): boolean => nativeExportDir !== null;

/** 当前环境是否支持选导出目录。false 时 UI 不该出现「导出目录」入口。 */
export const supportsExportDir = (): boolean => nativeExportDir !== null || (typeof window !== "undefined" && typeof window.showDirectoryPicker === "function");

/**
 * 「这个句柄现在能不能写」——权限判据【只此一份】。queryPermission 是 Chromium 扩展、
 * 不在标准里，缺失时一律当作"不确定但可以试"（granted）：真不能写时下面的写入会失败并
 * 退回下载目录，不会丢东西。此前 readGrantedHandle 与 regrantStoredDir 对这个缺失情况
 * 采取了相反的默认，是同一判据两套实现。
 */
const isGranted = async (dir: ExportDirHandle): Promise<boolean> => !dir.queryPermission || (await dir.queryPermission({ mode: "readwrite" })) === "granted";

/**
 * 已授权【且目录还活着】的句柄。没设过 / 权限掉了 / 目录被改名删除或拔盘一律 null。
 *
 * ⚠ 存在性必须单独探：权限是按 origin+路径记的，与目录还在不在无关 —— 拔掉 U 盘后
 * queryPermission 照样回 granted。不探的话按钮会一直显示一个已经不存在的文件夹，而
 * 每次导出都在悄悄退回下载目录。一次 keys().next() 就够。
 */
const readGrantedHandle = async (toolKey: string): Promise<ExportDirHandle | null> => {
  if (!supportsExportDir()) return null;
  try {
    const dir = await readStoredHandle(toolKey);
    if (!dir) return null;
    if (!(await isGranted(dir))) return null;
    await dir.keys().next(); // 目录没了会抛 NotFoundError
    return dir;
  } catch {
    return null;
  }
};

/** 该工具当前生效的导出目录名（浏览器只给文件夹名，不给完整路径）。没有则 null。 */
export const getExportDirName = async (toolKey: string): Promise<string | null> => {
  // 【这条路不许抛】调用方是 ExportFolder 挂载时的 `void refreshDir().then()`，抛出去
  // 就是一条没人接的 unhandled rejection。下面 FSA 那条同样吞掉所有异常。
  if (nativeExportDir) return nativeExportDir.current(toolKey).catch(() => null);
  return (await readGrantedHandle(toolKey))?.name ?? null;
};

// 存过句柄但权限掉了（浏览器重启）：点击本身就是用户手势，直接补授权即可，
// 不必再让用户走一遍选择器。已授权时返回 null —— 那说明这次点击是想【换】目录。
const regrantStoredDir = async (toolKey: string): Promise<string | null> => {
  try {
    const dir = await readStoredHandle(toolKey);
    if (!dir?.requestPermission) return null;
    if (await isGranted(dir)) return null; // 已授权：这次点击是想【换】目录
    if ((await dir.requestPermission({ mode: "readwrite" })) === "granted") return dir.name;
    // 【被拒就忘掉它】否则会卡死：重启后 dir 为 null、重置按钮是隐藏的,而每次点击都
    // 在为旧目录弹权限窗;拒绝又会烧掉 transient activation,紧跟其后的选择器抛
    // SecurityError —— 用户既换不了目录也清不掉它。忘掉之后下一次点击直接开选择器。
    await del(keyFor(toolKey), exportStore);
    return null;
  } catch {
    return null;
  }
};

/**
 * 弹目录选择器并记住选择。必须在用户手势里调用；没选成返回 null。
 *
 * 【不设 startIn】Chromium 的 kBlockPaths 把「桌面 / 文档 / 下载 / 用户目录」这四个
 * 目录【自身】列为 kDontBlockChildren —— 选它们本身会被拒（弹「此文件夹含有系统
 * 文件」），只有里面的子文件夹能选。startIn:"downloads" 等于把对话框开在必拒的目录
 * 上，顺手一选就撞墙。留 id 就够了：Chrome 会记住上次真正选成的位置。
 *
 * 【返回 null 分不清「取消」还是「被拒」】两种情况 Chrome 都抛 AbortError，
 * 调用方只能给一句兼顾两者的提示 —— 而【已经设过目录】时那句提示文不对题，
 * 见 ExportFolder.tsx 的 choose()。
 */
export const pickExportDir = async (toolKey: string): Promise<string | null> => {
  if (nativeExportDir) return nativeExportDir.pick(toolKey);
  if (!supportsExportDir()) return null;
  const regranted = await regrantStoredDir(toolKey);
  if (regranted) return regranted;

  let handle: FileSystemDirectoryHandle;
  try {
    // id 按工具分：Chrome 会分别记住每个工具上次选的位置
    handle = await window.showDirectoryPicker!({ id: `tools-by-ai-export-${toolKey}`, mode: "readwrite" });
  } catch (error) {
    // AbortError = 用户取消 / 目录被 Chrome 拒；SecurityError = 手势失效（上面的
    // 补授权对话框停留超过 ~5s 就会烧掉 transient activation）。两者都不是故障，
    // 按「没选成」处理，别弹「无法设置导出目录」。
    const name = (error as DOMException)?.name;
    if (name === "AbortError" || name === "SecurityError") return null;
    throw error;
  }
  await set(keyFor(toolKey), handle, exportStore);
  return handle.name;
};

/**
 * 忘掉该工具的已选目录，它的导出回到浏览器下载目录。
 *
 * ⚠ 失败必须【如实抛出】。曾经这里吞掉异常，而调用方随即把界面改成"下载目录" ——
 * 但句柄还在、权限还在，之后每个文件照旧写进老目录，界面却一路说着下载目录。那正是
 * 文件头禁止的两种撒谎里的另一种。删不掉时让调用方重读真实状态。
 */
export const clearExportDir = async (toolKey: string): Promise<void> => {
  // 原生实现同样【如实抛出】失败，理由见上：界面说的目录必须等于字节去的地方。
  if (nativeExportDir) return nativeExportDir.clear(toolKey);
  await del(keyFor(toolKey), exportStore);
};

// 浏览器下载遇到同名会自动让路（`movie (1).srt`），写目录必须复刻这条。
// 【默认导出名就是源文件名】（`{name}.{ext}`，见 useExportFilename），而「把导出
// 目录指向源文件所在的文件夹」正是最自然的用法 —— 直接覆盖等于吃掉用户的原始
// 字幕 / 文档，那是浏览器下载永远不会做的事。同一批里的同名输出同理（SRT+VTT
// 双语被强制成同一扩展名，见 formats/subtitle.ts），后者不能截断前者。
// 代价是重跑会攒 `(1) (2)`，但那跟丢原文不是一个量级。
const MAX_UNIQUE_TRIES = 100;

const uniqueFileName = async (dir: ExportDirHandle, fileName: string): Promise<string | null> => {
  const dot = fileName.lastIndexOf(".");
  const base = dot > 0 ? fileName.slice(0, dot) : fileName;
  const ext = dot > 0 ? fileName.slice(dot) : "";
  for (let i = 0; i < MAX_UNIQUE_TRIES; i += 1) {
    const candidate = i === 0 ? fileName : `${base} (${i})${ext}`;
    try {
      await dir.getFileHandle(candidate);
    } catch (error) {
      // NotFoundError = 这个名字空着，用它。其他错误（名字对文件系统非法、权限
      // 刚被撤）说明探测本身不可靠 —— 交给调用方退回下载目录，别赌着写下去。
      if ((error as DOMException)?.name === "NotFoundError") return candidate;
      throw error;
    }
  }
  return null; // 100 个都占着：退回浏览器下载，也不悄悄盖掉第 100 个
};

/**
 * 把文件写进已授权的导出目录。成功时回传【实际写入的文件名与目录名】，没设过 /
 * 没权限 / 写失败一律 null，由调用方（downloadFile）退回浏览器下载。
 *
 * ⚠ 回传实际文件名不是锦上添花：同名让路会改名（`movie (1).srt`），而这条路径
 * 【没有下载栏】—— 浏览器下载改名时用户还能在下载气泡里看到真名，写目录时那句
 * toast 是唯一的反馈。报错名字等于让用户去找一个不存在的文件。
 */
export const writeToExportDir = async (blob: Blob, fileName: string): Promise<{ fileName: string; dir: string } | null> => {
  // 外壳自己在下载钩子里改路径（见 setNativeExportDir），这里让路给 saveAs()
  if (nativeExportDir) return null;
  // 落哪个目录由【当前页面的工具】决定，见 setExportDirTool
  if (!currentTool) return null;
  const dir = await readGrantedHandle(currentTool);
  if (!dir) return null;
  let created: string | null = null;
  try {
    const name = await uniqueFileName(dir, fileName);
    if (!name) return null;
    const file = await dir.getFileHandle(name, { create: true });
    created = name; // 文件此刻已经建出来了（0 字节），下面任何一步失败都要收拾
    const writable = await file.createWritable();
    await writable.write(blob);
    await writable.close();
    return { fileName: name, dir: dir.name };
  } catch (error) {
    console.error("Export folder write failed — falling back to the download folder:", error);
    // 半成品必须清掉：0 字节的文件既像一份译文（用户点开才发现是空的，而真件已经
    // 落在下载目录），又会把下次导出的让路顶到 (1)。这个名字是 uniqueFileName 刚
    // 验过【空着】的，删它碰不到用户原有的文件。
    if (created) await dir.removeEntry(created).catch(() => {});
    return null;
  }
};
