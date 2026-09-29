use scraper::{Html, Selector};
use serde::Serialize;
use std::{
  collections::{HashMap, HashSet, VecDeque},
  fs,
  path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager, WebviewUrl, WebviewWindowBuilder};
use url::Url;

const MAX_HTML_BYTES: usize = 2_500_000;
const MAX_ASSET_BYTES: usize = 12_000_000;
const MAX_TOTAL_ASSET_BYTES: usize = 120_000_000;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserInspection {
  url: String,
  title: String,
  description: String,
  links: Vec<String>,
  images: Vec<String>,
  scripts: Vec<String>,
  styles: Vec<String>,
  media: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BrowserCaptureResult {
  root: String,
  pages: usize,
  assets: usize,
  bytes: usize,
  manifest: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ComponentAudit {
  selector: String,
  matches: usize,
  html: Vec<String>,
}

fn public_url(raw: &str) -> Result<Url, String> {
  let url = Url::parse(raw).map_err(|_| "Enter a valid http(s) URL.".to_string())?;
  if url.scheme() != "http" && url.scheme() != "https" {
    return Err("xBrowser only opens http(s) pages.".into());
  }
  if url.username() != "" || url.password().is_some() {
    return Err("Credential-bearing URLs are not accepted.".into());
  }
  Ok(url)
}

fn selected_text(document: &Html, selector: &str) -> String {
  Selector::parse(selector).ok()
    .and_then(|sel| document.select(&sel).next())
    .map(|node| node.text().collect::<Vec<_>>().join(" ").split_whitespace().collect::<Vec<_>>().join(" "))
    .unwrap_or_default()
}

fn absolute_urls(document: &Html, selector: &str, attr: &str, base: &Url) -> Vec<String> {
  let Ok(sel) = Selector::parse(selector) else { return vec![] };
  let mut out = Vec::new();
  let mut seen = HashSet::new();
  for node in document.select(&sel) {
    let Some(raw) = node.value().attr(attr) else { continue };
    let Ok(url) = base.join(raw) else { continue };
    if (url.scheme() != "http" && url.scheme() != "https") || !seen.insert(url.as_str().to_string()) { continue }
    out.push(url.to_string());
    if out.len() >= 250 { break; }
  }
  out
}

async fn fetch_html(client: &reqwest::Client, url: &Url) -> Result<String, String> {
  let response = client.get(url.clone()).send().await.map_err(|e| format!("Request failed: {e}"))?;
  if !response.status().is_success() { return Err(format!("HTTP {}", response.status())); }
  let content_type = response.headers().get(reqwest::header::CONTENT_TYPE).and_then(|v| v.to_str().ok()).unwrap_or("");
  if !content_type.contains("text/html") && !content_type.contains("application/xhtml") {
    return Err("The target is not an HTML page.".into());
  }
  let bytes = response.bytes().await.map_err(|e| format!("Read failed: {e}"))?;
  if bytes.len() > MAX_HTML_BYTES { return Err("Page is larger than the xBrowser inspection limit.".into()); }
  Ok(String::from_utf8_lossy(&bytes).into_owned())
}

#[tauri::command]
pub fn browser_open(app: AppHandle, url: String) -> Result<(), String> {
  let parsed = public_url(&url)?;
  if let Some(existing) = app.get_webview_window("xbrowser") {
    let _ = existing.close();
  }
  let external = tauri::Url::parse(parsed.as_str()).map_err(|e| e.to_string())?;
  WebviewWindowBuilder::new(&app, "xbrowser", WebviewUrl::External(external))
    .title("xFactor.OS // xBrowser")
    .inner_size(1260.0, 820.0)
    .min_inner_size(760.0, 520.0)
    .resizable(true)
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;
  Ok(())
}

#[tauri::command]
pub async fn browser_inspect(url: String) -> Result<BrowserInspection, String> {
  let base = public_url(&url)?;
  let client = reqwest::Client::builder()
    .user_agent("xFactor.OS/0.8 xBrowser public-inspection")
    .redirect(reqwest::redirect::Policy::limited(8))
    .build().map_err(|e| e.to_string())?;
  let html = fetch_html(&client, &base).await?;
  let document = Html::parse_document(&html);
  let title = selected_text(&document, "title");
  let description = Selector::parse("meta[name='description']").ok()
    .and_then(|sel| document.select(&sel).next())
    .and_then(|node| node.value().attr("content"))
    .unwrap_or("").to_string();
  let mut media = absolute_urls(&document, "video[src],audio[src],source[src]", "src", &base);
  media.truncate(100);
  Ok(BrowserInspection {
    url: base.to_string(),
    title,
    description,
    links: absolute_urls(&document, "a[href]", "href", &base),
    images: absolute_urls(&document, "img[src]", "src", &base),
    scripts: absolute_urls(&document, "script[src]", "src", &base),
    styles: absolute_urls(&document, "link[rel='stylesheet'][href]", "href", &base),
    media,
  })
}

#[tauri::command]
pub async fn browser_audit_component(url: String, selector: String) -> Result<ComponentAudit, String> {
  let base = public_url(&url)?;
  if selector.trim().is_empty() || selector.len() > 240 { return Err("Enter a bounded CSS selector.".into()); }
  let parsed_selector = Selector::parse(&selector).map_err(|_| "That CSS selector is invalid.".to_string())?;
  let client = reqwest::Client::builder().user_agent("xFactor.OS/0.8 xBrowser component-audit").build().map_err(|e| e.to_string())?;
  let html = fetch_html(&client, &base).await?;
  let document = Html::parse_document(&html);
  let mut snippets = Vec::new();
  for node in document.select(&parsed_selector).take(20) {
    let chunk = node.html();
    snippets.push(if chunk.len() > 80_000 { chunk[..80_000].to_string() } else { chunk });
  }
  Ok(ComponentAudit { selector, matches: snippets.len(), html: snippets })
}

fn safe_name(value: &str) -> String {
  let mut out = String::new();
  for ch in value.chars() {
    if ch.is_ascii_alphanumeric() || ch == '-' || ch == '_' || ch == '.' { out.push(ch); }
    else { out.push('_'); }
  }
  let trimmed = out.trim_matches('_');
  if trimmed.is_empty() { "item".into() } else { trimmed.chars().take(120).collect() }
}

fn page_file(index: usize, url: &Url) -> String {
  let tail = url.path_segments().and_then(|mut p| p.next_back()).filter(|s| !s.is_empty()).unwrap_or("index");
  format!("pages/{index:03}-{}.html", safe_name(tail.trim_end_matches(".html")))
}

#[tauri::command]
pub async fn browser_capture_site(url: String, destination: String, depth: u8) -> Result<BrowserCaptureResult, String> {
  let start = public_url(&url)?;
  let destination = PathBuf::from(destination);
  if !destination.is_absolute() || !destination.exists() || !destination.is_dir() {
    return Err("Choose an existing destination folder.".into());
  }
  let host = start.host_str().ok_or("URL has no host.")?.to_string();
  let stamp = chrono::Utc::now().format("%Y%m%d-%H%M%S").to_string();
  let root = destination.join(format!("xfactor-capture-{}-{}", safe_name(&host), stamp));
  fs::create_dir_all(root.join("pages")).map_err(|e| e.to_string())?;
  fs::create_dir_all(root.join("assets")).map_err(|e| e.to_string())?;

  let client = reqwest::Client::builder()
    .user_agent("xFactor.OS/0.8 xBrowser authorized-capture")
    .redirect(reqwest::redirect::Policy::limited(8))
    .build().map_err(|e| e.to_string())?;

  let max_depth = depth.min(3);
  let page_limit = match max_depth { 0 => 1, 1 => 12, 2 => 32, _ => 60 };
  let mut queue = VecDeque::from([(start.clone(),0u8)]);
  let mut seen = HashSet::new();
  let mut pages: Vec<(Url,String,String)> = Vec::new();
  let mut asset_urls = Vec::new();

  while let Some((page_url,level)) = queue.pop_front() {
    if pages.len() >= page_limit || !seen.insert(page_url.to_string()) { continue; }
    if page_url.host_str() != Some(host.as_str()) { continue; }
    let Ok(html) = fetch_html(&client,&page_url).await else { continue };
    let document = Html::parse_document(&html);
    let filename = page_file(pages.len(),&page_url);
    if level < max_depth {
      for link in absolute_urls(&document,"a[href]","href",&page_url) {
        if let Ok(next)=Url::parse(&link) {
          if next.host_str()==Some(host.as_str()) && matches!(next.scheme(),"http"|"https") { queue.push_back((next,level+1)); }
        }
      }
    }
    for candidate in [
      absolute_urls(&document,"img[src]","src",&page_url),
      absolute_urls(&document,"script[src]","src",&page_url),
      absolute_urls(&document,"link[rel='stylesheet'][href]","href",&page_url),
      absolute_urls(&document,"video[src],audio[src],source[src]","src",&page_url),
    ].into_iter().flatten() {
      if let Ok(asset)=Url::parse(&candidate) {
        if asset.host_str()==Some(host.as_str()) && !asset_urls.contains(&candidate) { asset_urls.push(candidate); }
      }
    }
    pages.push((page_url,html,filename));
  }

  let page_map: HashMap<String,String> = pages.iter().map(|(u,_,f)|(u.to_string(),f.clone())).collect();
  let mut asset_map:HashMap<String,String>=HashMap::new();
  let mut total_asset_bytes=0usize;
  for (index,raw) in asset_urls.into_iter().take(220).enumerate() {
    if total_asset_bytes>=MAX_TOTAL_ASSET_BYTES { break; }
    let Ok(asset_url)=Url::parse(&raw) else { continue };
    let Ok(response)=client.get(asset_url.clone()).send().await else { continue };
    if !response.status().is_success() { continue; }
    let Ok(bytes)=response.bytes().await else { continue };
    if bytes.len()>MAX_ASSET_BYTES || total_asset_bytes+bytes.len()>MAX_TOTAL_ASSET_BYTES { continue; }
    let tail=asset_url.path_segments().and_then(|mut p|p.next_back()).filter(|s|!s.is_empty()).unwrap_or("asset");
    let filename=format!("assets/{index:03}-{}",safe_name(tail));
    if fs::write(root.join(&filename),&bytes).is_ok() {
      total_asset_bytes+=bytes.len();
      asset_map.insert(raw,filename);
    }
  }

  for (page_url,mut html,filename) in pages.iter().cloned() {
    let document=Html::parse_document(&html);
    for (selector,attr) in [("a[href]","href"),("img[src]","src"),("script[src]","src"),("link[href]","href"),("video[src],audio[src],source[src]","src")] {
      let Ok(sel)=Selector::parse(selector) else { continue };
      for node in document.select(&sel) {
        let Some(raw)=node.value().attr(attr) else { continue };
        let Ok(abs)=page_url.join(raw) else { continue };
        let replacement=asset_map.get(abs.as_str()).or_else(||page_map.get(abs.as_str()));
        if let Some(local)=replacement { html=html.replace(raw,local); }
      }
    }
    fs::write(root.join(filename),html.as_bytes()).map_err(|e|e.to_string())?;
  }

  let manifest=serde_json::json!({
    "product":"xFactor.OS xBrowser",
    "source":start.as_str(),
    "capturedAt":chrono::Utc::now().to_rfc3339(),
    "depth":max_depth,
    "pages":page_map,
    "assets":asset_map,
    "limitations":"Public/authorized same-origin capture only. No login, DRM, or access-control bypass."
  });
  let manifest_path=root.join("xfactor-capture.json");
  fs::write(&manifest_path,serde_json::to_vec_pretty(&manifest).map_err(|e|e.to_string())?).map_err(|e|e.to_string())?;

  Ok(BrowserCaptureResult {
    root:root.to_string_lossy().to_string(),
    pages:pages.len(),
    assets:asset_map.len(),
    bytes:total_asset_bytes,
    manifest:manifest_path.to_string_lossy().to_string(),
  })
}
