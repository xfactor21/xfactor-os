use serde::Serialize;
use std::{path::{Path, PathBuf}, process::Command};
use tauri::AppHandle;
use tauri_plugin_fs::FsExt;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitFileStatus {
  pub path: String,
  pub index_status: String,
  pub worktree_status: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct GitStatus {
  pub branch: Option<String>,
  pub upstream: Option<String>,
  pub ahead: u32,
  pub behind: u32,
  pub detached: bool,
  pub files: Vec<GitFileStatus>,
}

fn approved_root(app: &AppHandle, root: &str) -> Result<PathBuf, String> {
  let path = PathBuf::from(root);
  if !path.is_absolute() || !path.is_dir() {
    return Err("Project root must be an existing absolute directory.".into());
  }
  if !app.fs_scope().is_allowed(&path) {
    return Err("Project root is outside the user-approved filesystem scope.".into());
  }
  Ok(path)
}

fn safe_relative_path(path: &str) -> Result<String, String> {
  let normalized = path.replace('\\', "/");
  if normalized.starts_with('/') || normalized.is_empty() {
    return Err("Git path must be project-relative.".into());
  }
  let parts: Vec<&str> = normalized.split('/').collect();
  if parts.iter().any(|part| part.is_empty() || *part == "." || *part == "..") {
    return Err("Unsafe project-relative Git path.".into());
  }
  Ok(parts.join("/"))
}

fn git_command(root: &Path, args: &[&str]) -> Result<String, String> {
  let mut command = Command::new("git");
  command.arg("-C").arg(root).args(args);
  #[cfg(windows)]
  {
    use std::os::windows::process::CommandExt;
    command.creation_flags(0x08000000);
  }
  let output = command.output().map_err(|error| format!("Unable to launch Git: {error}"))?;
  if !output.status.success() {
    let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
    let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
    return Err(if !stderr.is_empty() { stderr } else if !stdout.is_empty() { stdout } else { format!("Git exited with {}", output.status) });
  }
  Ok(String::from_utf8_lossy(&output.stdout).to_string())
}

fn parse_branch_header(header: &str) -> (Option<String>, Option<String>, u32, u32, bool) {
  let raw = header.strip_prefix("## ").unwrap_or(header).trim();
  if raw.starts_with("HEAD (no branch)") || raw.starts_with("HEAD (detached") {
    return (None, None, 0, 0, true);
  }
  let mut branch_part = raw;
  let mut tracking = "";
  if let Some((left, right)) = raw.split_once(' ') {
    branch_part = left;
    tracking = right;
  }
  let (branch, upstream) = if let Some((branch, upstream)) = branch_part.split_once("...") {
    (Some(branch.to_string()), Some(upstream.to_string()))
  } else {
    (Some(branch_part.to_string()), None)
  };
  let ahead = tracking.split(['[', ']', ',']).find_map(|piece| {
    piece.trim().strip_prefix("ahead ")?.parse::<u32>().ok()
  }).unwrap_or(0);
  let behind = tracking.split(['[', ']', ',']).find_map(|piece| {
    piece.trim().strip_prefix("behind ")?.parse::<u32>().ok()
  }).unwrap_or(0);
  (branch, upstream, ahead, behind, false)
}

#[tauri::command]
pub fn git_status(app: AppHandle, root: String) -> Result<GitStatus, String> {
  let root = approved_root(&app, &root)?;
  let output = git_command(&root, &["status", "--porcelain=v1", "-b"])?;
  let mut branch = None;
  let mut upstream = None;
  let mut ahead = 0;
  let mut behind = 0;
  let mut detached = false;
  let mut files = Vec::new();
  for line in output.lines() {
    if line.starts_with("## ") {
      (branch, upstream, ahead, behind, detached) = parse_branch_header(line);
      continue;
    }
    if line.len() < 3 { continue; }
    let index_status = line.chars().nth(0).unwrap_or(' ').to_string();
    let worktree_status = line.chars().nth(1).unwrap_or(' ').to_string();
    let mut path = line[3..].trim().to_string();
    if let Some((_, renamed_to)) = path.split_once(" -> ") {
      path = renamed_to.to_string();
    }
    files.push(GitFileStatus { path, index_status, worktree_status });
  }
  Ok(GitStatus { branch, upstream, ahead, behind, detached, files })
}

#[tauri::command]
pub fn git_diff(app: AppHandle, root: String, path: Option<String>, staged: bool) -> Result<String, String> {
  let root = approved_root(&app, &root)?;
  let clean_path = path.as_deref().map(safe_relative_path).transpose()?;
  let mut args = vec!["diff", "--no-ext-diff", "--no-color"];
  if staged { args.push("--cached"); }
  if let Some(path) = clean_path.as_deref() {
    args.push("--");
    args.push(path);
  }
  let output = git_command(&root, &args)?;
  const MAX_DIFF: usize = 1_500_000;
  if output.len() > MAX_DIFF {
    Ok(format!("{}\n\n[xFactor.OS truncated this diff at {} bytes]", &output[..MAX_DIFF], MAX_DIFF))
  } else {
    Ok(output)
  }
}

fn clean_paths(paths: Vec<String>) -> Result<Vec<String>, String> {
  if paths.is_empty() || paths.len() > 200 {
    return Err("Select between 1 and 200 project paths.".into());
  }
  paths.into_iter().map(|path| safe_relative_path(&path)).collect()
}

#[tauri::command]
pub fn git_stage(app: AppHandle, root: String, paths: Vec<String>) -> Result<(), String> {
  let root = approved_root(&app, &root)?;
  let clean = clean_paths(paths)?;
  let mut args = vec!["add", "--"];
  args.extend(clean.iter().map(String::as_str));
  git_command(&root, &args)?;
  Ok(())
}

#[tauri::command]
pub fn git_unstage(app: AppHandle, root: String, paths: Vec<String>) -> Result<(), String> {
  let root = approved_root(&app, &root)?;
  let clean = clean_paths(paths)?;
  let mut args = vec!["restore", "--staged", "--"];
  args.extend(clean.iter().map(String::as_str));
  git_command(&root, &args)?;
  Ok(())
}

#[tauri::command]
pub fn git_commit(app: AppHandle, root: String, message: String) -> Result<String, String> {
  let root = approved_root(&app, &root)?;
  let message = message.trim();
  if message.is_empty() || message.len() > 2000 {
    return Err("Commit message must be between 1 and 2000 characters.".into());
  }
  git_command(&root, &["commit", "-m", message])
}
