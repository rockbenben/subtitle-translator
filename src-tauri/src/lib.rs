use tauri::Manager;

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

                let show = MenuItemBuilder::with_id("show", "Show").build(app)?;
                let quit = MenuItemBuilder::with_id("quit", "Quit").build(app)?;
                let menu = MenuBuilder::new(app).items(&[&show, &quit]).build()?;

                TrayIconBuilder::with_id("main-tray")
                    .icon(app.default_window_icon().unwrap().clone())
                    .tooltip("Subtitle Translator")
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
