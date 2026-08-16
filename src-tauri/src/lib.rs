use tauri::Manager;

#[cfg(desktop)]
use tauri::{
  menu::{Menu, MenuItem, PredefinedMenuItem},
  tray::TrayIconBuilder,
  WebviewUrl, WebviewWindowBuilder, WindowEvent,
};

#[cfg(desktop)]
fn open_or_focus_capture_widget(app: &tauri::AppHandle) {
  if let Some(window) = app.get_webview_window("capture-widget") {
    let _ = window.show();
    let _ = window.set_focus();
    return;
  }

  let _ = WebviewWindowBuilder::new(app, "capture-widget", WebviewUrl::App("widget.html".into()))
    .title("xFactor.OS // Hotwire")
    .inner_size(360.0, 220.0)
    .min_inner_size(320.0, 180.0)
    .resizable(true)
    .always_on_top(true)
    .decorations(true)
    .skip_taskbar(false)
    .build();
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_sql::Builder::default().build())
    .plugin(tauri_plugin_dialog::init())
    .plugin(tauri_plugin_fs::init())
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
        let show_item = MenuItem::with_id(app, "show", "Show xFactor.OS", true, None::<&str>)?;
        let capture_item = MenuItem::with_id(app, "capture", "Hotwire Capture", true, None::<&str>)?;
        let quit_item = MenuItem::with_id(app, "quit", "Quit xFactor.OS", true, None::<&str>)?;
        let menu = Menu::with_items(
          app,
          &[&show_item, &capture_item, &PredefinedMenuItem::separator(app)?, &quit_item],
        )?;

        let _tray = TrayIconBuilder::with_id("main-tray")
          .icon(app.default_window_icon().expect("bundle must include a tray icon").clone())
          .menu(&menu)
          .show_menu_on_left_click(true)
          .tooltip("xFactor.OS // Controlled Chaos")
          .on_menu_event(|app, event| match event.id.as_ref() {
            "show" => {
              if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
              }
            }
            "capture" => open_or_focus_capture_widget(app),
            "quit" => app.exit(0),
            _ => {}
          })
          .build(app)?;

        if let Some(main) = app.get_webview_window("main") {
          let main_handle = main.clone();
          main.on_window_event(move |event| {
            if let WindowEvent::CloseRequested { api, .. } = event {
              api.prevent_close();
              let _ = main_handle.hide();
            }
          });
        }
      }

      Ok(())
    })
    .run(tauri::generate_context!())
    .expect("error while running xFactor.OS");
}
