use tauri::Manager;

#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to Stock Advisors.", name)
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_sql::Builder::new().build())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_store::Builder::new().build())
        .setup(|app| {
            // Get the main window for macOS-specific setup
            let _window = app.get_webview_window("main").unwrap();

            // Future: apply window vibrancy here
            // window_vibrancy::apply_vibrancy(&window, ...);

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .on_window_event(|window, event| {
            // Minimize to tray instead of closing
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                window.hide().unwrap();
                api.prevent_close();
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running Stock Advisors");
}
