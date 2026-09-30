use tauri::{AppHandle, Emitter, LogicalPosition, LogicalSize, Manager, WebviewUrl};
use tauri::webview::{NewWindowResponse, WebviewBuilder};

const LABEL: &str = "xf-browser-surface";

fn parse_navigation(raw: &str) -> Result<url::Url, String> {
  let url = url::Url::parse(raw).map_err(|_| "Enter a valid http(s) URL.".to_string())?;
  if !matches!(url.scheme(), "http" | "https") {
    return Err("xBrowser navigation accepts only http(s) URLs.".into());
  }
  if !url.username().is_empty() || url.password().is_some() {
    return Err("Credential-bearing URLs are not accepted.".into());
  }
  Ok(url)
}

#[tauri::command]
pub async fn browser_surface_open(
  app: AppHandle,
  url: String,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  let url = parse_navigation(&url)?;
  let position = LogicalPosition::new(x.max(0.0), y.max(0.0));
  let size = LogicalSize::new(width.max(80.0), height.max(80.0));

  if let Some(webview) = app.get_webview(LABEL) {
    webview.set_position(position).map_err(|e| e.to_string())?;
    webview.set_size(size).map_err(|e| e.to_string())?;
    webview.show().map_err(|e| e.to_string())?;
    webview.navigate(url).map_err(|e| e.to_string())?;
    return Ok(());
  }

  let host = app.get_window("main").ok_or_else(|| "Main xFactor.OS window is unavailable.".to_string())?;
  let nav_app = app.clone();
  let popup_app = app.clone();
  let builder = WebviewBuilder::new(LABEL, WebviewUrl::External(url))
    .user_agent("xFactor.OS/0.7.0 xBrowser")
    .on_navigation(|url| matches!(url.scheme(), "http" | "https") && url.username().is_empty() && url.password().is_none())
    .on_page_load(move |_webview, payload| {
      let _ = nav_app.emit_to("main", "xfactor-browser:navigation", payload.url().to_string());
    })
    .on_new_window(move |url, _features| {
      if matches!(url.scheme(), "http" | "https") {
        let _ = popup_app.emit_to("main", "xfactor-browser:new-window", url.to_string());
      }
      NewWindowResponse::Deny
    });

  host.add_child(builder, position, size).map_err(|e| format!("Could not create native xBrowser surface: {e}"))?;
  Ok(())
}

#[tauri::command]
pub async fn browser_surface_navigate(app: AppHandle, url: String) -> Result<(), String> {
  let url = parse_navigation(&url)?;
  let webview = app.get_webview(LABEL).ok_or_else(|| "Native xBrowser surface is not open.".to_string())?;
  webview.navigate(url).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_surface_set_bounds(
  app: AppHandle,
  x: f64,
  y: f64,
  width: f64,
  height: f64,
) -> Result<(), String> {
  let webview = app.get_webview(LABEL).ok_or_else(|| "Native xBrowser surface is not open.".to_string())?;
  webview.set_position(LogicalPosition::new(x.max(0.0), y.max(0.0))).map_err(|e| e.to_string())?;
  webview.set_size(LogicalSize::new(width.max(80.0), height.max(80.0))).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_surface_reload(app: AppHandle) -> Result<(), String> {
  let webview = app.get_webview(LABEL).ok_or_else(|| "Native xBrowser surface is not open.".to_string())?;
  webview.reload().map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_surface_back(app: AppHandle) -> Result<(), String> {
  let webview = app.get_webview(LABEL).ok_or_else(|| "Native xBrowser surface is not open.".to_string())?;
  webview.eval("history.back()").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_surface_forward(app: AppHandle) -> Result<(), String> {
  let webview = app.get_webview(LABEL).ok_or_else(|| "Native xBrowser surface is not open.".to_string())?;
  webview.eval("history.forward()").map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn browser_surface_close(app: AppHandle) -> Result<(), String> {
  if let Some(webview) = app.get_webview(LABEL) {
    webview.close().map_err(|e| e.to_string())?;
  }
  Ok(())
}
