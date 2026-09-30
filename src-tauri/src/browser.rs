use reqwest::{header, Client, Response, Url};
use serde::Serialize;
use std::net::{IpAddr, ToSocketAddrs};

const MAX_REDIRECTS: usize = 6;
const MAX_HTML_BYTES: usize = 4_000_000;
const MAX_ASSET_BYTES: usize = 12_000_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserHtml {
  text: String,
  final_url: String,
  content_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserAsset {
  bytes: Vec<u8>,
  final_url: String,
  content_type: String,
}

fn blocked_ip(ip: IpAddr) -> bool {
  match ip {
    IpAddr::V4(ip) => {
      let o = ip.octets();
      ip.is_private()
        || ip.is_loopback()
        || ip.is_link_local()
        || ip.is_broadcast()
        || ip.is_unspecified()
        || ip.is_multicast()
        || o[0] == 0
        || (o[0] == 100 && (64..=127).contains(&o[1]))
    }
    IpAddr::V6(ip) => {
      let first = ip.segments()[0];
      ip.is_loopback()
        || ip.is_unspecified()
        || ip.is_multicast()
        || ip.is_unicast_link_local()
        || (first & 0xfe00) == 0xfc00
    }
  }
}

fn validate_url(raw: &str) -> Result<Url, String> {
  let url = Url::parse(raw).map_err(|_| "Enter a valid http(s) URL.".to_string())?;
  if !matches!(url.scheme(), "http" | "https") {
    return Err("xBrowser capture accepts only http(s) URLs.".into());
  }
  if !url.username().is_empty() || url.password().is_some() {
    return Err("Credential-bearing URLs are not accepted.".into());
  }
  let host = url.host_str().ok_or_else(|| "URL has no host.".to_string())?;
  let lower = host.trim_end_matches('.').to_ascii_lowercase();
  if lower == "localhost" || lower.ends_with(".localhost") || lower.ends_with(".local") {
    return Err("Local/private network targets are blocked.".into());
  }
  Ok(url)
}

fn validate_public_destination(url: &Url) -> Result<(), String> {
  let host = url.host_str().ok_or_else(|| "URL has no host.".to_string())?;
  if let Ok(ip) = host.parse::<IpAddr>() {
    if blocked_ip(ip) { return Err("Local/private network targets are blocked.".into()); }
    return Ok(());
  }
  let port = url.port_or_known_default().ok_or_else(|| "URL has no usable port.".to_string())?;
  let resolved = (host, port).to_socket_addrs().map_err(|_| "Host lookup failed.".to_string())?;
  let mut found = false;
  for socket in resolved {
    found = true;
    if blocked_ip(socket.ip()) {
      return Err("Host resolves to a local/private network address; capture blocked.".into());
    }
  }
  if !found { return Err("Host did not resolve to a public address.".into()); }
  Ok(())
}

fn client() -> Result<Client, String> {
  Client::builder()
    .user_agent("xFactor.OS/0.6.1 xBrowser authorized-public-capture")
    .redirect(reqwest::redirect::Policy::none())
    .build()
    .map_err(|e| format!("Could not initialize browser fetcher: {e}"))
}

async fn request_public(client: &Client, raw: &str) -> Result<Response, String> {
  let mut current = validate_url(raw)?;
  for _ in 0..=MAX_REDIRECTS {
    validate_public_destination(&current)?;
    let response = client.get(current.clone())
      .header(header::ACCEPT, "text/html,application/xhtml+xml,image/*,audio/*,video/*,*/*;q=0.5")
      .send().await.map_err(|e| format!("Request failed: {e}"))?;

    if response.status().is_redirection() {
      let location = response.headers().get(header::LOCATION)
        .and_then(|value| value.to_str().ok())
        .ok_or_else(|| "Redirect did not provide a valid Location.".to_string())?;
      current = validate_url(current.join(location).map_err(|_| "Redirect target is invalid.".to_string())?.as_str())?;
      continue;
    }

    if !response.status().is_success() {
      return Err(format!("HTTP {}", response.status()));
    }
    return Ok(response);
  }
  Err("Too many redirects.".into())
}

async fn read_bounded(mut response: Response, max_bytes: usize) -> Result<(Vec<u8>, String, String), String> {
  if response.content_length().is_some_and(|size| size > max_bytes as u64) {
    return Err(format!("Response exceeds the {} MB capture cap.", max_bytes / 1_000_000));
  }
  let final_url = response.url().to_string();
  let content_type = response.headers().get(header::CONTENT_TYPE)
    .and_then(|value| value.to_str().ok())
    .unwrap_or("application/octet-stream")
    .split(';').next().unwrap_or("application/octet-stream")
    .trim().to_ascii_lowercase();

  let mut bytes = Vec::new();
  while let Some(chunk) = response.chunk().await.map_err(|e| format!("Read failed: {e}"))? {
    if bytes.len() + chunk.len() > max_bytes {
      return Err(format!("Response exceeds the {} MB capture cap.", max_bytes / 1_000_000));
    }
    bytes.extend_from_slice(&chunk);
  }
  Ok((bytes, final_url, content_type))
}

#[tauri::command]
pub async fn browser_fetch_html(url: String) -> Result<BrowserHtml, String> {
  let client = client()?;
  let response = request_public(&client, &url).await?;
  let (bytes, final_url, content_type) = read_bounded(response, MAX_HTML_BYTES).await?;
  if content_type != "text/html" && content_type != "application/xhtml+xml" {
    return Err(format!("Target is not HTML ({content_type})."));
  }
  let text = String::from_utf8(bytes).map_err(|_| "Page is not valid UTF-8 HTML.".to_string())?;
  Ok(BrowserHtml { text, final_url, content_type })
}

#[tauri::command]
pub async fn browser_fetch_asset(url: String) -> Result<BrowserAsset, String> {
  let client = client()?;
  let response = request_public(&client, &url).await?;
  let (bytes, final_url, content_type) = read_bounded(response, MAX_ASSET_BYTES).await?;
  if content_type == "text/html" || content_type == "application/xhtml+xml" {
    return Err("Use page capture for HTML resources.".into());
  }
  Ok(BrowserAsset { bytes, final_url, content_type })
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn rejects_non_http_and_credentials() {
    assert!(validate_url("file:///etc/passwd").is_err());
    assert!(validate_url("https://user:secret@example.com/").is_err());
  }

  #[test]
  fn rejects_private_ip_literals() {
    for raw in [
      "http://127.0.0.1/",
      "http://10.0.0.1/",
      "http://172.16.0.1/",
      "http://192.168.1.1/",
      "http://169.254.169.254/",
      "http://100.64.0.1/",
      "http://[::1]/",
      "http://[fc00::1]/",
    ] {
      let url = validate_url(raw).expect("URL syntax should parse before network validation");
      assert!(validate_public_destination(&url).is_err(), "{raw} should be blocked");
    }
  }
}
