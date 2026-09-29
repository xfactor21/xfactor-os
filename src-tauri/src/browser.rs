use serde::Serialize;
use std::net::{IpAddr, Ipv4Addr, Ipv6Addr};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};

const MAX_TEXT_BYTES: usize = 8 * 1024 * 1024;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserFetch {
  url: String,
  status: u16,
  content_type: String,
  text: String,
}

fn private_ip(ip: IpAddr) -> bool {
  match ip {
    IpAddr::V4(ip) => ip.is_private() || ip.is_loopback() || ip.is_link_local() || ip.is_broadcast() || ip.is_unspecified(),
    IpAddr::V6(ip) => ip.is_loopback() || ip.is_unspecified() || {
      let segments = ip.segments();
      (segments[0] & 0xfe00) == 0xfc00 || (segments[0] & 0xffc0) == 0xfe80
    },
  }
}

fn validate_public_url(raw: &str) -> Result<tauri::Url, String> {
  let url: tauri::Url = raw.parse().map_err(|_| "Enter a valid http(s) URL.".to_string())?;
  if url.scheme() != "http" && url.scheme() != "https" {
    return Err("xFactor Browser only opens http(s) pages.".into());
  }
  let host = url.host_str().ok_or_else(|| "The URL has no host.".to_string())?;
  let lower = host.to_ascii_lowercase();
  if lower == "localhost" || lower.ends_with(".localhost") || lower.ends_with(".local") {
    return Err("Local/internal hosts are blocked in Browser capture mode.".into());
  }
  if let Ok(ip) = host.parse::<IpAddr>() {
    if private_ip(ip) {
      return Err("Private, loopback, link-local and unspecified IP addresses are blocked.".into());
    }
  }
  Ok(url)
}

#[tauri::command]
pub async fn browser_open_window(app: AppHandle, url: String) -> Result<(), String> {
  let parsed = validate_public_url(&url)?;
  if let Some(window) = app.get_webview_window("xf-browser") {
    window.navigate(parsed).map_err(|error| error.to_string())?;
    window.show().map_err(|error| error.to_string())?;
    window.set_focus().map_err(|error| error.to_string())?;
    return Ok(());
  }

  WebviewWindowBuilder::new(&app, "xf-browser", WebviewUrl::External(parsed))
    .title("xFactor.OS // Browser")
    .inner_size(1180.0, 760.0)
    .min_inner_size(760.0, 520.0)
    .resizable(true)
    .on_navigation(|url| validate_public_url(url.as_str()).is_ok())
    .build()
    .map_err(|error| error.to_string())?;
  Ok(())
}

#[tauri::command]
pub async fn browser_fetch(url: String) -> Result<BrowserFetch, String> {
  let client = reqwest::Client::builder()
    .redirect(reqwest::redirect::Policy::none())
    .timeout(std::time::Duration::from_secs(18))
    .user_agent("xFactor.OS/0.6 browser-capture")
    .build()
    .map_err(|error| error.to_string())?;

  let mut current = validate_public_url(&url)?;
  for _ in 0..=5 {
    let response = client.get(current.clone()).send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    if status.is_redirection() {
      let location = response.headers().get(reqwest::header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Redirect response omitted Location.".to_string())?;
      current = validate_public_url(current.join(location).map_err(|_| "Invalid redirect target.".to_string())?.as_str())?;
      continue;
    }

    let content_type = response.headers().get(reqwest::header::CONTENT_TYPE)
      .and_then(|value| value.to_str().ok()).unwrap_or("").to_string();
    let allowed = content_type.is_empty()
      || content_type.starts_with("text/")
      || content_type.contains("json")
      || content_type.contains("xml")
      || content_type.contains("javascript")
      || content_type.contains("xhtml");
    if !allowed {
      return Err(format!("Capture only reads text/page resources. Server returned {}.", content_type));
    }
    if response.content_length().unwrap_or(0) > MAX_TEXT_BYTES as u64 {
      return Err("Page is larger than the 8 MB capture limit.".into());
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    if bytes.len() > MAX_TEXT_BYTES {
      return Err("Page exceeded the 8 MB capture limit.".into());
    }
    return Ok(BrowserFetch {
      url: current.to_string(),
      status: status.as_u16(),
      content_type,
      text: String::from_utf8_lossy(&bytes).into_owned(),
    });
  }
  Err("Too many redirects while capturing page.".into())
}
