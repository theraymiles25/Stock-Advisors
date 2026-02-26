use serde::Serialize;
use tauri::{Emitter, Manager};

// ---------------------------------------------------------------------------
// Tauri commands
// ---------------------------------------------------------------------------

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Stock Advisors.", name)
}

#[tauri::command]
fn get_app_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

#[tauri::command]
fn show_main_window(app: tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.set_focus();
    }
}

// ---------------------------------------------------------------------------
// Tray event payload
// ---------------------------------------------------------------------------

#[derive(Clone, Serialize)]
struct TrayEventPayload {
    action: String,
    value: Option<bool>,
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // ---------------------------------------------------------------
            // Window vibrancy (macOS only)
            // ---------------------------------------------------------------
            #[cfg(target_os = "macos")]
            {
                use window_vibrancy::{apply_vibrancy, NSVisualEffectMaterial};

                if let Some(window) = app.get_webview_window("main") {
                    let _ = apply_vibrancy(
                        &window,
                        NSVisualEffectMaterial::Sidebar,
                        None,
                        None,
                    );
                }
            }

            // ---------------------------------------------------------------
            // System tray
            // ---------------------------------------------------------------
            let show_window =
                tauri::menu::MenuItemBuilder::with_id("show_window", "Show Window")
                    .build(app)?;

            let run_analysis =
                tauri::menu::MenuItemBuilder::with_id("run_analysis", "Run Analysis...")
                    .build(app)?;

            let position_monitor =
                tauri::menu::MenuItemBuilder::with_id("position_monitor", "Position Monitor: ON")
                    .build(app)?;

            let news_monitor =
                tauri::menu::MenuItemBuilder::with_id("news_monitor", "News Monitor: ON")
                    .build(app)?;

            let quit =
                tauri::menu::MenuItemBuilder::with_id("quit", "Quit")
                    .build(app)?;

            let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
            let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;

            let menu = tauri::menu::MenuBuilder::new(app)
                .item(&show_window)
                .item(&run_analysis)
                .item(&sep1)
                .item(&position_monitor)
                .item(&news_monitor)
                .item(&sep2)
                .item(&quit)
                .build()?;

            let _tray = tauri::tray::TrayIconBuilder::new()
                .tooltip("Stock Advisors")
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(move |app_handle, event| {
                    let id = event.id().as_ref();
                    match id {
                        "show_window" => {
                            if let Some(w) = app_handle.get_webview_window("main") {
                                let _ = w.show();
                                let _ = w.set_focus();
                            }
                        }
                        "run_analysis" => {
                            let _ = app_handle.emit(
                                "tray-event",
                                TrayEventPayload {
                                    action: "run_analysis".into(),
                                    value: None,
                                },
                            );
                        }
                        "position_monitor" => {
                            // Toggle label between ON / OFF and notify the frontend
                            let current_text = position_monitor.text().unwrap_or_default();
                            let turning_on = current_text.contains("OFF");
                            let new_label = if turning_on {
                                "Position Monitor: ON"
                            } else {
                                "Position Monitor: OFF"
                            };
                            let _ = position_monitor.set_text(new_label);
                            let _ = app_handle.emit(
                                "tray-event",
                                TrayEventPayload {
                                    action: "position_monitor".into(),
                                    value: Some(turning_on),
                                },
                            );
                        }
                        "news_monitor" => {
                            let current_text = news_monitor.text().unwrap_or_default();
                            let turning_on = current_text.contains("OFF");
                            let new_label = if turning_on {
                                "News Monitor: ON"
                            } else {
                                "News Monitor: OFF"
                            };
                            let _ = news_monitor.set_text(new_label);
                            let _ = app_handle.emit(
                                "tray-event",
                                TrayEventPayload {
                                    action: "news_monitor".into(),
                                    value: Some(turning_on),
                                },
                            );
                        }
                        "quit" => {
                            app_handle.exit(0);
                        }
                        _ => {}
                    }
                })
                .build(app)?;

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            get_app_version,
            show_main_window,
        ])
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                let _ = window.hide();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Stock Advisors");
}
