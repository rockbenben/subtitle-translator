use std::path::{Path, PathBuf};
use tauri::Manager;

// ============================================================================
// 自定义导出目录（issue #52）
//
// 【为什么整块逻辑都在 Rust 里】前端 src/** 有 92% 的文件与上游仓库
// web-tools-by-ai 逐字节一致（downloadFile 所在的 utils/fileUtils.ts 正是其中
// 之一），改一行就等于给每次上游同步埋一个永久冲突点。而 saveAs() 在 webview 里
// 触发的是一次真实下载，on_download 能直接改写落盘路径 —— 于是这个功能可以做到
// 前端零改动，并且顺带覆盖所有导出口（字幕、术语表 TSV、设置 JSON）。
//
// 代价：设置入口只能放在托盘菜单里（页面设置区 TranslationSettings.tsx 同属
// 上游镜像文件，碰不得）。
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

/// 当前导出目录，给导航栏按钮显示用。None = 系统默认下载目录。
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
        .invoke_handler(tauri::generate_handler![get_export_dir, choose_export_dir])
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
                // WebviewWindowBuilder，所以必须自己建。from_config 原样继承 title /
                // 尺寸 / url / dragDrop 等全部配置，且晚于 window-state 插件注册，
                // 位置恢复照常生效。
                let window_config = app
                    .config()
                    .app
                    .windows
                    .iter()
                    .find(|w| w.label == "main")
                    .cloned()
                    .expect("tauri.conf.json must define the \"main\" window");

                tauri::webview::WebviewWindowBuilder::from_config(app.handle(), &window_config)?
                    .on_download(|webview, event| {
                        if let tauri::webview::DownloadEvent::Requested { destination, .. } = event {
                            // 每次下载现读配置文件：下载本就不频繁，省掉一份托管状态
                            // 和它的同步问题。目录不存在时 load_export_dir 返回 None，
                            // destination 保持 webview 给的系统默认路径。
                            if let Some(dir) = load_export_dir(webview.app_handle()) {
                                if let Some(name) = destination.file_name() {
                                    *destination = dir.join(name);
                                }
                            }
                        }
                        true
                    })
                    .build()?;

                // 标签保持静态：当前目录由导航栏按钮的 tooltip 显示。若两处都显示，
                // 从导航栏改完还得回头刷托盘文字，等于两份状态要对齐 —— 不值当。
                let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
                let export = MenuItemBuilder::with_id("export-dir", "Export folder\u{2026}").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
                let menu = MenuBuilder::new(app).items(&[&show, &export, &quit]).build()?;

                TrayIconBuilder::with_id("main-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Subtitle Translator")
                    .menu(&menu)
                    .show_menu_on_left_click(false)
                    .on_menu_event(|app, event| match event.id().as_ref() {
                        "show" => focus_main_window(app),
                        "export-dir" => {
                            // 菜单事件在主线程；choose_export_dir 里的 blocking 对话框
                            // 在主线程会死锁，所以转到异步运行时上跑。
                            let app = app.clone();
                            tauri::async_runtime::spawn(async move {
                                choose_export_dir(app).await;
                            });
                        }
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
