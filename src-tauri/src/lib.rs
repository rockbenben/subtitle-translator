use std::fs::File;
use std::path::{Path, PathBuf};
use tauri::Manager;

// ============================================================================
// 自定义导出目录（issue #52）
//
// 【为什么整块逻辑都在 Rust 里】前端 src/** 有 92% 的文件与上游仓库
// web-tools-by-ai 逐字节一致（downloadFile 所在的 utils/fileUtils.ts 正是其中
// 之一），改一行就等于给每次上游同步埋一个永久冲突点。落盘有两条路:
//   ① write_export_file 命令:前端把字节直接发过来,真实落点(同名让路后的名字)
//      回传给 toast —— 主路径;
//   ② on_download:① 失败回落 saveAs 时改写落盘路径 —— 兜底,顺带覆盖所有走
//      浏览器下载的出口（字幕、术语表 TSV、设置 JSON）。
// 两条路共用 create_unique_file 的同名让路契约。
//
// 入口在工具页标题行那个按工具的导出目录按钮上（上游 components/ExportFolder.tsx），
// 桌面端通过 src/app/desktop/exportDirNative.ts 把下面三个 command 注入上游留的口子 ——
// 于是 Web 与桌面共用同一套 UI，而那些镜像文件一个字都不用改。
// ============================================================================

fn export_dir_file(app: &tauri::AppHandle) -> Option<PathBuf> {
    Some(app.path().app_config_dir().ok()?.join("export-dir.txt"))
}

/// 用户设定的导出目录；未设置、或目录已被删除/改名时返回 None —— 调用方据此
/// 保持系统默认下载目录，而不是把文件写进一个不存在的路径后静默失败。
fn load_export_dir(app: &tauri::AppHandle) -> Option<PathBuf> {
    let raw = std::fs::read_to_string(export_dir_file(app)?).ok()?;
    let dir = PathBuf::from(raw.trim());
    dir.is_dir().then_some(dir)
}

fn save_export_dir(app: &tauri::AppHandle, dir: &Path) {
    let Some(file) = export_dir_file(app) else {
        return;
    };
    if let Some(parent) = file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    let _ = std::fs::write(file, dir.to_string_lossy().as_ref());
}

/// 当前导出目录，给工具页那个按钮显示用。None = 系统默认下载目录。
#[tauri::command]
fn get_export_dir(app: tauri::AppHandle) -> Option<String> {
    load_export_dir(&app).map(|dir| dir.display().to_string())
}

/// 打开原生目录选择器并记住选择，返回新目录；用户取消返回 None（什么都不改）。
///
/// 【必须是 async】rfd 的 blocking_* 系列在主线程调用会死锁，而 async command
/// 跑在 tauri 的异步运行时线程池上，不是主线程 —— 这正是 tauri 文档给 blocking
/// 对话框 API 推荐的形态。托盘菜单事件在主线程，所以那边用 spawn 转过来调它。
#[tauri::command]
async fn choose_export_dir(app: tauri::AppHandle) -> Option<String> {
    use tauri_plugin_dialog::DialogExt;

    let mut dialog = app.dialog().file();
    // 从当前目录起步 —— 顺带让用户看见「现在导到哪」。
    if let Some(start) = load_export_dir(&app).or_else(|| app.path().download_dir().ok()) {
        dialog = dialog.set_directory(start);
    }
    let dir = dialog.blocking_pick_folder()?.into_path().ok()?;
    save_export_dir(&app, &dir);
    Some(dir.display().to_string())
}

/// 忘掉已选目录，导出回到系统下载目录（工具页那个 ↺ 按钮）。
///
/// 【失败要如实报错】上游 clearExportDir 的注释写得明白：吞掉异常而界面改说
/// 「下载目录」，之后每个文件照旧落进老目录，就是反方向的撒谎。文件本来就不在
/// （NotFound）不算失败 —— 那正是「已经没有目录了」。
#[tauri::command]
fn clear_export_dir(app: tauri::AppHandle) -> Result<(), String> {
    let Some(file) = export_dir_file(&app) else {
        return Err("no app config dir".into());
    };
    match std::fs::remove_file(&file) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

// ============================================================================
// 同名让路 + 字节直写
//
// 3.1.0 的 on_download 只做 `*destination = dir.join(name)` —— 默认导出名就是
// 源文件名、用户又最爱把导出目录指向源文件所在文件夹，于是 Export 无声覆盖原
// 字幕（issue #52）。浏览器下载从来不会这么干:它一律同名让路成 `movie (1).srt`。
// 两条落盘路径都必须复刻这条契约:
//   ① write_export_file:前端把字节直接发过来写(主路径,真实落点回传给 toast);
//   ② on_download:① 失败回落 saveAs 时的兜底改写,让路逻辑同一份。
// ============================================================================

/// 与上游 web uniqueFileName / MAX_UNIQUE_TRIES 同一上限:原名空着用原名,
/// 否则 `base (i).ext`,试满 100 个就放弃 —— 宁可报错回落,也不悄悄盖掉第 100 个。
const MAX_UNIQUE_TRIES: usize = 100;

/// 第 i 个候选路径(纯拼接,不探盘)。i==0 用原名;i>0 复刻 web 的
/// `lastIndexOf(".") > 0`:在最后一个点前插 " (i)",首字符的点(`.bashrc`)
/// 不算扩展名分隔。
fn candidate_path(dir: &Path, file_name: &str, i: usize) -> PathBuf {
  if i == 0 {
    return dir.join(file_name);
  }
  let insert = match file_name.rfind('.') {
    Some(dot) if dot > 0 => dot,
    _ => file_name.len(),
  };
  let (base, ext) = file_name.split_at(insert);
  dir.join(format!("{base} ({i}){ext}"))
}

/// 用 `create_new`(POSIX O_EXCL / Windows CREATE_NEW)原子占住下一个空名字 ——
/// 两个并发导出不可能抢到同一个文件,不需要额外的进程锁。
/// 返回 (完整路径, 刚建出的 0 字节文件句柄);100 个名字全占着返回 Ok(None),
/// 其他 IO 错误(目录不可写、盘掉了)如实抛出,由调用方决定回落。
fn create_unique_file(dir: &Path, file_name: &str) -> std::io::Result<Option<(PathBuf, File)>> {
  for i in 0..MAX_UNIQUE_TRIES {
    let candidate = candidate_path(dir, file_name, i);
    match std::fs::OpenOptions::new()
      .write(true)
      .create_new(true)
      .open(&candidate)
    {
      Ok(file) => return Ok(Some((candidate, file))),
      Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => continue,
      Err(e) => return Err(e),
    }
  }
  Ok(None)
}

/// 解 JS `encodeURIComponent` 产出的 %XX 序列,再按 UTF-8 还原文件名。
/// 不引新 crate(percent-encoding 只是间接依赖);HTTP 头值必须是 ASCII,
/// 未转义字节一律按原样收进缓冲。
fn percent_decode(input: &str) -> Result<String, String> {
  let bytes = input.as_bytes();
  let mut out = Vec::with_capacity(bytes.len());
  let mut i = 0;
  while i < bytes.len() {
    if bytes[i] == b'%' && i + 2 < bytes.len() {
      let hex = std::str::from_utf8(&bytes[i + 1..i + 3])
        .map_err(|_| "bad percent-encoding in file name".to_string())?;
      let byte = u8::from_str_radix(hex, 16)
        .map_err(|_| "bad percent-encoding in file name".to_string())?;
      out.push(byte);
      i += 3;
    } else {
      out.push(bytes[i]);
      i += 1;
    }
  }
  String::from_utf8(out).map_err(|_| "file name is not valid UTF-8".to_string())
}

/// Windows 保留设备名(CON / PRN / AUX / NUL / COM1-9 / LPT1-9,带任意后缀
/// 也算 —— `CON.txt` 照样打开到设备)与结尾点/空格(Win32 会悄悄剥掉,
/// Rust 报出来的名字和磁盘上的名字会对不上)。本应用就是 Windows 桌面端,
/// 在所有平台统一拒掉,这些名字本来也不该出现在导出里。
fn is_windows_reserved_name(name: &str) -> bool {
  const RESERVED: &[&str] = &[
    "CON", "PRN", "AUX", "NUL", "COM1", "COM2", "COM3", "COM4", "COM5", "COM6", "COM7", "COM8",
    "COM9", "LPT1", "LPT2", "LPT3", "LPT4", "LPT5", "LPT6", "LPT7", "LPT8", "LPT9",
  ];
  let stem = name.split('.').next().unwrap_or("");
  let upper: String = stem.chars().map(|c| c.to_ascii_uppercase()).collect();
  RESERVED.contains(&upper.as_str()) || name.ends_with(['.', ' '])
}

/// 文件名必须是【单一相对路径段】:不含分隔符 / 盘符冒号 / NUL 等控制字符,
/// 也不是 "." / ".." / Windows 保留名 / 带结尾点空格。浏览器下载会自己剥掉
/// 这些,但 write_export_file 是直达文件系统的新 IPC 面 —— 不能让一个穿越名
/// (`..\\..\\x`)逃出用户选的目录。
fn is_plain_file_name(name: &str) -> bool {
  !name.is_empty()
    && name != "."
    && name != ".."
    && Path::new(name).file_name() == Some(std::ffi::OsStr::new(name))
    && !name
      .chars()
      .any(|c| c == '/' || c == '\\' || c == ':' || c.is_control())
    && !is_windows_reserved_name(name)
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
struct WrittenFile {
  file_name: String,
  dir: String,
}

/// 把一次导出的字节直接写进用户选定的导出目录(上游 exportDir.ts 的
/// `NativeExportDir.write`)。
///
/// 载荷形态(见 tauri 的 scripts/process-ipc-message-fn.js):JS 侧 invoke 直接
/// 传 Uint8Array → body 是 `InvokeBody::Raw`(application/octet-stream);文件名
/// 里的非 ASCII 字符不能进 HTTP 头,走 `x-export-file-name: encodeURIComponent(name)`。
///
/// - Ok(None):没设导出目录 / 目录已删除改名 —— JS 回落 saveAs 走系统下载;
/// - Ok(Some):已写入,回传【真实落点】(同名让路可能改名),toast 只能照它说话;
/// - Err:任何一步失败 —— JS 同样回落 saveAs;半成品在返回前已删。
#[tauri::command]
fn write_export_file(
  app: tauri::AppHandle,
  request: tauri::ipc::Request,
) -> Result<Option<WrittenFile>, String> {
  use std::io::Write;

  // 没设目录是最平常的路径(默认就没设),不是错误:让 JS 走它的下载回落。
  let Some(dir) = load_export_dir(&app) else {
    return Ok(None);
  };

  let encoded = request
    .headers()
    .get("x-export-file-name")
    .ok_or("missing x-export-file-name header")?
    .to_str()
    .map_err(|_| "x-export-file-name is not ASCII".to_string())?;
  let file_name = percent_decode(encoded)?;
  if !is_plain_file_name(&file_name) {
    return Err(format!("refusing to write an invalid file name: {file_name:?}"));
  }

  let tauri::ipc::InvokeBody::Raw(bytes) = request.body() else {
    return Err("write_export_file expects a raw octet-stream body".into());
  };

  let Some((path, mut file)) = create_unique_file(&dir, &file_name).map_err(|e| e.to_string())?
  else {
    return Err(format!(
      "all {MAX_UNIQUE_TRIES} candidate names are taken: {file_name}"
    ));
  };
  let write_result = file.write_all(bytes).and_then(|_| {
    // 写完即落盘 —— 回报成功后这份译文不该只活在系统写缓存的承诺里。
    file.sync_all()
  });
  if let Err(e) = write_result {
    drop(file);
    // 半成品必须删:0 字节文件既像一份译文(用户点开才发现是空的,真件其实在
    // 下载目录),又会把下次导出的让路顶到 (1)。这个名字是 create_new 刚占的
    // 空名,删它碰不到用户的旧文件 —— 与上游 FSA 分支同一契约。
    let _ = std::fs::remove_file(&path);
    return Err(e.to_string());
  }

  let written_name = path
    .file_name()
    .map(|s| s.to_string_lossy().into_owned())
    .unwrap_or(file_name);
  Ok(Some(WrittenFile {
    file_name: written_name,
    dir: dir.display().to_string(),
  }))
}

#[cfg(desktop)]
fn focus_main_window(app: &tauri::AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

// AppImage 把自带的 libwayland-*.so prepend 到 LD_LIBRARY_PATH。在滚动发行版
// （Manjaro/Arch/CachyOS 等）上，系统加载的是新版 Mesa/libEGL，却被迫配上包内
// 旧版 libwayland 的符号——而 libwayland 的协议/ABI 必须和 libEGL/Mesa 匹配，
// 不匹配就会在 EGL display 初始化阶段以 EGL_BAD_ALLOC 崩溃。这一步发生在 WebKit
// 之下，任何 WEBKIT_* 变量都救不了。
//
// 修法：检测到运行于 AppImage 时，用系统的 libwayland-client 做 LD_PRELOAD 并
// re-exec 自身一次，让加载器优先用系统库覆盖包内的旧库（yaak / tolaria 同款）。
// .deb/.rpm 原生安装本就用系统库，无需处理。
#[cfg(target_os = "linux")]
fn ensure_system_libwayland() {
    use std::os::unix::process::CommandExt;
    use std::path::Path;

    // 只在 AppImage 里才有这个冲突；APPIMAGE 由 AppImage 运行时注入。
    if std::env::var_os("APPIMAGE").is_none() {
        return;
    }

    // 防止 re-exec 死循环。
    if std::env::var_os("SUBTRANS_LIBWAYLAND_REEXEC").is_some() {
        return;
    }

    // 覆盖常见多架构布局，找到宿主系统的 libwayland-client。
    const CANDIDATES: &[&str] = &[
        "/usr/lib/x86_64-linux-gnu/libwayland-client.so.0",
        "/usr/lib64/libwayland-client.so.0",
        "/usr/lib/libwayland-client.so.0",
        "/lib/x86_64-linux-gnu/libwayland-client.so.0",
    ];
    let Some(sys_lib) = CANDIDATES.iter().copied().find(|p| Path::new(p).exists()) else {
        // 系统里没有 libwayland（少见），无可 preload，照常运行。
        return;
    };

    // 前置到现有 LD_PRELOAD，而不是覆盖它。
    let preload = match std::env::var_os("LD_PRELOAD") {
        Some(existing) if !existing.is_empty() => {
            format!("{}:{}", sys_lib, existing.to_string_lossy())
        }
        _ => sys_lib.to_string(),
    };

    let exe = match std::env::current_exe() {
        Ok(p) => p,
        Err(_) => return,
    };

    // exec() 成功即替换当前进程；只有失败才返回。
    let err = std::process::Command::new(exe)
        .args(std::env::args_os().skip(1))
        .env("LD_PRELOAD", preload)
        .env("SUBTRANS_LIBWAYLAND_REEXEC", "1")
        .exec();
    eprintln!("subtitle-translator: libwayland re-exec failed: {err}");
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    // 必须先于任何 GTK / WebView 初始化，确保 re-exec 后 LD_PRELOAD 就位。
    #[cfg(target_os = "linux")]
    ensure_system_libwayland();

    // WebKitGTK 的 DMABUF 渲染器在许多 Linux GPU/驱动组合下（虚拟机、混合显卡、
    // NVIDIA）会以 EGL_BAD_ALLOC 崩溃。在任何窗口/GTK 初始化之前回退到非 DMABUF
    // 渲染器。这只关闭 GPU 缓冲“共享”，仍是硬件加速、几乎无视觉代价。仅在用户
    // 未自行设置时注入，以尊重用户/发行版偏好（生态通行做法）。
    #[cfg(target_os = "linux")]
    if std::env::var_os("WEBKIT_DISABLE_DMABUF_RENDERER").is_none() {
        std::env::set_var("WEBKIT_DISABLE_DMABUF_RENDERER", "1");
    }

    let mut builder = tauri::Builder::default();

    // Single-instance MUST be registered first (gotcha #5) so a second launch
    // routes to the already-running window instead of spawning a new process.
    #[cfg(desktop)]
    {
        builder = builder.plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            focus_main_window(app);
        }));
    }

    builder
        .plugin(tauri_plugin_window_state::Builder::default().build())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            get_export_dir,
            choose_export_dir,
            clear_export_dir,
            write_export_file
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            #[cfg(desktop)]
            {
                use tauri::menu::{MenuBuilder, MenuItemBuilder};
                use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};

                // 窗口在 tauri.conf.json 里是 "create": false —— on_download 只挂得上
                // WebviewWindowBuilder，所以必须自己建。from_config 原样继承
                // 尺寸 / url / dragDrop 等全部配置（title 在下面覆盖），且晚于 window-state 插件注册，
                // 位置恢复照常生效。
                let window_config = app
                    .config()
                    .app
                    .windows
                    .iter()
                    .find(|w| w.label == "main")
                    .cloned()
                    .expect("tauri.conf.json must define the \"main\" window");

                // 【带版本号的标识】桌面版此前没有任何地方显示版本，用户只能去「设置 → 应用」
                // 或右键 exe 看属性 —— 报 bug 时说不清自己装的是哪一版（#52 的回帖就因此
                // 对不上）。版本取 package_info()，它来自 tauri.conf.json 的 version
                // （由 update-version.js 从 package.json 同步），不是 Cargo.toml 那个 0.1.0。
                //
                // 标题栏和托盘 tooltip 共用这一个串。两处都是用户报 bug 时会看到、会截进图里
                // 的地方，各写各的迟早漂成两个值；而托盘那行原本是硬编码的应用名，改标题时
                // 漏掉过一次。
                let titled = format!("{} {}", window_config.title, app.package_info().version);

                // 覆盖 from_config 继承来的 title，其余配置照旧。
                tauri::webview::WebviewWindowBuilder::from_config(app.handle(), &window_config)?
                    .title(titled.as_str())
                    .on_download(|webview, event| {
                        match event {
                            tauri::webview::DownloadEvent::Requested { destination, .. } => {
                                // 每次下载现读配置文件：下载本就不频繁，省掉一份托管状态
                                // 和它的同步问题。目录没了 load_export_dir 返回 None，
                                // destination 保持 webview 给的系统默认路径。
                                if let Some(dir) = load_export_dir(webview.app_handle()) {
                                    if let Some(name) =
                                        destination.file_name().and_then(|n| n.to_str())
                                    {
                                        // 主路径 write_export_file 直写;这里只接住它失败后
                                        // 回落 saveAs 的下载。create_new 先占位:WebView2
                                        // 随后以截断方式打开该路径(3.1.0 直接 join 覆盖
                                        // 源文件就是这条性质,issue #52),而原子占位让两个
                                        // 并发下载抢不到同一个名字。
                                        match create_unique_file(&dir, name) {
                                            Ok(Some((path, _placeholder))) => {
                                                *destination = path;
                                            }
                                            Ok(None) => log::warn!(
                                                "export dir: 100 candidate names are taken, keeping the download folder"
                                            ),
                                            Err(e) => {
                                                log::error!(
                                                    "export dir: cannot reserve file, keeping the download folder: {e}"
                                                )
                                            }
                                        }
                                    }
                                }
                            }
                            // 下载取消 / 失败:删掉我们 create_new 出来的 0 字节占位。
                            // 只删 0 字节的 —— 半途留下的非空残文件不替用户做删除决定。
                            tauri::webview::DownloadEvent::Finished {
                                path: Some(path),
                                success: false,
                                ..
                            } => {
                                if let Ok(meta) = std::fs::metadata(&path) {
                                    if meta.is_file() && meta.len() == 0 {
                                        let _ = std::fs::remove_file(&path);
                                    }
                                }
                            }
                            _ => {}
                        }
                        true
                    })
                    .build()?;

                // 【托盘里不再有「Export folder…」】入口已经在工具页标题行上，而页面
                // 那个按钮的目录名是自己缓存的（上游 ExportFolder 的模块级 store）——
                // 从托盘改完页面不会跟着刷，等于同一个设置两份状态各说各话。
                let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
                let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

                TrayIconBuilder::with_id("main-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip(&titled)
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show" => focus_main_window(app),
                        "quit" => app.exit(0),
                        _ => {}
                    })
                    .on_tray_icon_event(|tray, event| {
                        if let TrayIconEvent::Click {
                            button: MouseButton::Left,
                            button_state: MouseButtonState::Up,
                            ..
                        } = event
                        {
                            focus_main_window(tray.app_handle());
                        }
                    })
                    .build(app)?;
            }

            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn candidate_paths_match_web_unique_file_name() {
    let d = Path::new("/tmp/d");
    assert_eq!(candidate_path(d, "movie.srt", 0), d.join("movie.srt"));
    assert_eq!(candidate_path(d, "movie.srt", 1), d.join("movie (1).srt"));
    assert_eq!(
      candidate_path(d, "movie.srt", 17),
      d.join("movie (17).srt")
    );
    // 首字符的点不算扩展名(web: lastIndexOf(".") > 0)
    assert_eq!(candidate_path(d, ".bashrc", 2), d.join(".bashrc (2)"));
    assert_eq!(candidate_path(d, "noext", 2), d.join("noext (2)"));
    assert_eq!(candidate_path(d, "a.b.c.vtt", 3), d.join("a.b.c (3).vtt"));
  }

  #[test]
  fn percent_decode_roundtrips() {
    assert_eq!(percent_decode("movie.srt").unwrap(), "movie.srt");
    // encodeURIComponent("字幕.srt")
    assert_eq!(
      percent_decode("%E5%AD%97%E5%B9%95.srt").unwrap(),
      "字幕.srt"
    );
    assert_eq!(percent_decode("a%20b%281%29.srt").unwrap(), "a b(1).srt");
    assert!(percent_decode("%ZZ").is_err());
    assert!(percent_decode("%E5").is_err()); // 截断的 UTF-8
  }

  #[test]
  fn plain_file_name_rejects_traversal_and_controls() {
    assert!(is_plain_file_name("movie.srt"));
    assert!(is_plain_file_name("字幕 (1).srt"));
    // 普通词以 con/lpt 开头不受影响
    assert!(is_plain_file_name("concert.srt"));
    assert!(is_plain_file_name(".bashrc"));
    for bad in [
      "",
      ".",
      "..",
      "../x.srt",
      "a/b",
      "a\\b",
      "C:x",
      "a\0b",
      "a\nb",
      // Windows 保留设备名,带不带后缀都拒
      "CON",
      "nul.txt",
      "com1",
      "LPT9.srt",
      // Win32 会剥掉的结尾点 / 空格
      "movie.",
      "movie ",
    ] {
      assert!(!is_plain_file_name(bad), "should reject {bad:?}");
    }
  }

  /// 每次用进程内唯一目录,测完尽力删掉,不碰系统临时区里的别的东西。
  fn unique_temp_dir() -> PathBuf {
    let nanos = std::time::SystemTime::now()
      .duration_since(std::time::UNIX_EPOCH)
      .unwrap()
      .as_nanos();
    let dir =
      std::env::temp_dir().join(format!("subtrans-test-{}-{nanos}", std::process::id()));
    std::fs::create_dir_all(&dir).unwrap();
    dir
  }

  #[test]
  fn unique_file_yields_without_touching_existing() {
    let dir = unique_temp_dir();
    std::fs::write(dir.join("movie.srt"), b"original").unwrap();

    let (p1, f1) = create_unique_file(&dir, "movie.srt").unwrap().unwrap();
    assert_eq!(p1, dir.join("movie (1).srt"));
    drop(f1);
    // 刚占位的名字下一轮必须立刻被看到 —— 并发导出靠 create_new 互斥
    let (p2, _f2) = create_unique_file(&dir, "movie.srt").unwrap().unwrap();
    assert_eq!(p2, dir.join("movie (2).srt"));
    // 旧文件(= 用户的原始字幕)一个字节都不许动
    assert_eq!(std::fs::read(dir.join("movie.srt")).unwrap(), b"original");

    std::fs::remove_dir_all(&dir).ok();
  }
}
