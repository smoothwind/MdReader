use serde::{Deserialize, Serialize};
use serde_json::json;
use std::fs;
use std::path::{Path, PathBuf};
use std::collections::HashMap;
use std::sync::{Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};
use tauri::{AppHandle, Emitter, Manager, State, Theme, WebviewWindow};
use tauri_plugin_dialog::DialogExt;
use tauri_plugin_opener::OpenerExt;
use base64::Engine;
use sysinfo::System;

const APP_NAME: &str = "MdReader";
const MD_EXTS: [&str; 4] = ["md", "markdown", "mdown", "mkd"];
const RECENT_MAX: usize = 12;
const FILE_POLL_MS: u64 = 2000;

static INITIAL_FILE: OnceLock<Option<String>> = OnceLock::new();

#[derive(Default)]
struct DocState {
    dirty: bool,
    any_dirty: bool,
    file_path: Option<String>,
    file_name: String,
}

#[derive(Default)]
struct Prefs {
    theme: String,
    show_file_tree: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase", default)]
struct PerfConfig {
    disable_hardware_acceleration: bool,
    in_process_gpu: bool,
    max_old_space_size: u32,
}

impl Default for PerfConfig {
    fn default() -> Self {
        Self {
            disable_hardware_acceleration: false,
            in_process_gpu: false,
            max_old_space_size: 0,
        }
    }
}

struct AppState {
    doc: Mutex<DocState>,
    prefs: Mutex<Prefs>,
    perf: Mutex<PerfConfig>,
    recent: Mutex<Vec<String>>,
    watch_paths: Mutex<Vec<String>>,
    exiting: Mutex<bool>,
    zoom: Mutex<f64>,
}

fn app_start() -> &'static Instant {
    static START: OnceLock<Instant> = OnceLock::new();
    START.get_or_init(Instant::now)
}

fn data_dir(app: &AppHandle) -> PathBuf {
    let dir = app.path().app_data_dir().unwrap_or_else(|_| PathBuf::from("."));
    let _ = fs::create_dir_all(&dir);
    dir
}

fn config_path(app: &AppHandle) -> PathBuf {
    data_dir(app).join("config.json")
}

fn recent_path(app: &AppHandle) -> PathBuf {
    data_dir(app).join("recent.json")
}

fn now_ms() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0)
}

fn is_md_file(p: &str) -> bool {
    Path::new(p)
        .extension()
        .map(|e| e.to_string_lossy().to_lowercase())
        .map(|e| MD_EXTS.contains(&e.as_str()))
        .unwrap_or(false)
}

fn percent_decode(s: &str) -> String {
    let bytes = s.as_bytes();
    let mut out: Vec<u8> = Vec::with_capacity(bytes.len());
    let mut i = 0;
    while i < bytes.len() {
        if bytes[i] == b'%' && i + 2 < bytes.len() {
            let hex = std::str::from_utf8(&bytes[i + 1..i + 3]).unwrap_or("");
            if let Ok(v) = u8::from_str_radix(hex, 16) {
                out.push(v);
                i += 3;
                continue;
            }
        }
        out.push(bytes[i]);
        i += 1;
    }
    String::from_utf8_lossy(&out).into_owned()
}

fn path_from_argv(argv: &[String]) -> Option<String> {
    argv.iter()
        .skip(1)
        .find(|a| is_md_file(a))
        .map(|p| fs::canonicalize(p).unwrap_or_else(|_| PathBuf::from(p)).to_string_lossy().into_owned())
}

// ---------- recent ----------

fn load_recent(app: &AppHandle) -> Vec<String> {
    fs::read_to_string(recent_path(app))
        .ok()
        .and_then(|s| serde_json::from_str::<Vec<String>>(&s).ok())
        .unwrap_or_default()
}

fn save_recent(app: &AppHandle, items: &[String]) {
    let _ = fs::write(recent_path(app), serde_json::to_string_pretty(items).unwrap_or_default());
}

fn push_recent(app: &AppHandle, path: &str) {
    let mut items = load_recent(app);
    if let Some(pos) = items.iter().position(|p| p.eq_ignore_ascii_case(path)) {
        items.remove(pos);
    }
    items.insert(0, path.to_string());
    items.truncate(RECENT_MAX);
    save_recent(app, &items);
}

// ---------- perf config ----------

fn load_perf_config(app: &AppHandle) -> PerfConfig {
    fs::read_to_string(config_path(app))
        .ok()
        .and_then(|s| serde_json::from_str::<PerfConfig>(&s).ok())
        .unwrap_or_default()
}

fn save_perf_config(app: &AppHandle, cfg: &PerfConfig) {
    let _ = fs::write(config_path(app), serde_json::to_string_pretty(cfg).unwrap_or_default());
}

// ---------- atomic write：同目录临时文件 + rename，避免写坏原文件 ----------

fn atomic_write(path: &Path, data: &[u8]) -> std::io::Result<()> {
    let ext_prefix = path
        .extension()
        .map(|e| format!("{}.", e.to_string_lossy()))
        .unwrap_or_default();
    let tmp = path.with_extension(format!("{ext_prefix}mdreader-{}.tmp", std::process::id()));
    match fs::write(&tmp, data).and_then(|_| fs::rename(&tmp, path)) {
        Ok(()) => Ok(()),
        Err(e) => {
            let _ = fs::remove_file(&tmp);
            Err(e)
        }
    }
}

// ---------- window helpers ----------

fn main_window(app: &AppHandle) -> Option<WebviewWindow> {
    app.get_webview_window("main")
}

fn show_main(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

fn toggle_main(app: &AppHandle) {
    if let Some(w) = main_window(app) {
        if w.is_visible().unwrap_or(false) && !w.is_minimized().unwrap_or(false) {
            let _ = w.hide();
        } else {
            show_main(app);
        }
    }
}

fn set_doc_title(app: &AppHandle, dirty: bool, file_name: &str) {
    if let Some(w) = main_window(app) {
        let _ = w.set_title(&format!(
            "{}{} - {}",
            if dirty { "● " } else { "" },
            if file_name.is_empty() { "未命名" } else { file_name },
            APP_NAME
        ));
    }
}

// ---------- menu ----------

fn build_menu(app: &AppHandle) -> tauri::Result<()> {
    let state = app.state::<AppState>();
    let theme = state.prefs.lock().unwrap().theme.clone();
    let has_file = state.doc.lock().unwrap().file_path.is_some();
    let recent = state.recent.lock().unwrap().clone();

    let file = tauri::menu::Submenu::with_id(app, "m-file", "文件", true)?;
    let recent_menu = tauri::menu::Submenu::with_id(app, "m-recent", "最近打开", true)?;
    if recent.is_empty() {
        recent_menu.append(&tauri::menu::MenuItem::with_id(app, "recent-empty", "（暂无记录）", false, None::<&str>)?)?;
    } else {
        for (i, p) in recent.iter().enumerate() {
            recent_menu.append(&tauri::menu::MenuItem::with_id(
                app,
                format!("recent-{i}"),
                p,
                true,
                None::<&str>,
            )?)?;
        }
    }

    file.append_items(&[
        &tauri::menu::MenuItem::with_id(app, "file-new", "新建", true, Some("CmdOrCtrl+N"))?,
        &tauri::menu::MenuItem::with_id(app, "file-open", "打开…", true, Some("CmdOrCtrl+O"))?,
        &recent_menu,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "file-save", "保存", true, Some("CmdOrCtrl+S"))?,
        &tauri::menu::MenuItem::with_id(app, "file-save-as", "另存为…", true, Some("CmdOrCtrl+Shift+S"))?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "file-export-html", "导出 HTML…", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(app, "file-export-word", "导出 Word 文档…", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(app, "file-export-image", "导出长图…", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(app, "file-export-pdf", "导出 PDF…", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(app, "file-print", "打印 / 导出 PDF", true, Some("CmdOrCtrl+P"))?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "file-reveal", "在资源管理器中显示", has_file, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "app-quit", "退出", true, Some("CmdOrCtrl+Q"))?,
    ])?;

    let edit = tauri::menu::Submenu::with_id(app, "m-edit", "编辑", true)?;
    edit.append_items(&[
        &tauri::menu::PredefinedMenuItem::undo(app, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::redo(app, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::PredefinedMenuItem::cut(app, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::copy(app, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::paste(app, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::select_all(app, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "edit-find", "查找…", true, Some("CmdOrCtrl+F"))?,
        &tauri::menu::MenuItem::with_id(app, "edit-replace", "替换…", true, Some("CmdOrCtrl+H"))?,
    ])?;

    let insert = tauri::menu::Submenu::with_id(app, "m-insert", "插入", true)?;
    insert.append_items(&[&tauri::menu::MenuItem::with_id(
        app,
        "insert-mindmap",
        "脑图…",
        true,
        Some("CmdOrCtrl+M"),
    )?])?;

    let fmt = tauri::menu::Submenu::with_id(app, "m-fmt", "格式", true)?;
    fmt.append_items(&[
        &tauri::menu::MenuItem::with_id(app, "fmt-bold", "加粗", true, Some("CmdOrCtrl+B"))?,
        &tauri::menu::MenuItem::with_id(app, "fmt-italic", "斜体", true, Some("CmdOrCtrl+I"))?,
        &tauri::menu::MenuItem::with_id(app, "fmt-underline", "下划线", true, Some("CmdOrCtrl+U"))?,
        &tauri::menu::MenuItem::with_id(app, "fmt-strike-through", "删除线", true, Some("CmdOrCtrl+Shift+X"))?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "fmt-superscript", "上标", true, Some("Ctrl+Shift+="))?,
        &tauri::menu::MenuItem::with_id(app, "fmt-subscript", "下标", true, Some("Ctrl+="))?,
        &tauri::menu::MenuItem::with_id(app, "fmt-highlight", "高亮", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(app, "fmt-wavy", "波浪线", true, None::<&str>)?,
        &tauri::menu::PredefinedMenuItem::separator(app)?,
        &tauri::menu::MenuItem::with_id(app, "fmt-remove-format", "清除格式", true, Some("CmdOrCtrl+\\"))?,
    ])?;

    let view = tauri::menu::Submenu::with_id(app, "m-view", "视图", true)?;
    let show_tree = state.prefs.lock().unwrap().show_file_tree;
    let doc_source = tauri::menu::MenuItem::with_id(app, "view-doc-source", "查看全文 Markdown", true, None::<&str>)?;
    let file_tree = tauri::menu::CheckMenuItem::with_id(app, "view-file-tree", "文件树", true, show_tree, None::<&str>)?;
    let sep1 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let theme_light = tauri::menu::CheckMenuItem::with_id(
        app,
        "theme-light",
        "浅色主题",
        true,
        theme == "light",
        None::<&str>,
    )?;
    let theme_dark = tauri::menu::CheckMenuItem::with_id(
        app,
        "theme-dark",
        "深色主题",
        true,
        theme == "dark",
        None::<&str>,
    )?;
    let sep2 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let zoom_in = tauri::menu::MenuItem::with_id(app, "zoom-in", "放大", true, Some("CmdOrCtrl+="))?;
    let zoom_out = tauri::menu::MenuItem::with_id(app, "zoom-out", "缩小", true, Some("CmdOrCtrl+-"))?;
    let zoom_reset = tauri::menu::MenuItem::with_id(app, "zoom-reset", "重置缩放", true, Some("CmdOrCtrl+0"))?;
    let sep3 = tauri::menu::PredefinedMenuItem::separator(app)?;
    let fullscreen = tauri::menu::MenuItem::with_id(app, "toggle-fullscreen", "全屏", true, Some("F11"))?;
    view.append_items(&[
        &doc_source,
        &file_tree,
        &sep1,
        &theme_light,
        &theme_dark,
        &sep2,
        &zoom_in,
        &zoom_out,
        &zoom_reset,
        &sep3,
        &fullscreen,
    ])?;
    // devtools 仅调试构建提供（release 不编译进 devtools 支持代码）
    #[cfg(debug_assertions)]
    {
        let sep4 = tauri::menu::PredefinedMenuItem::separator(app)?;
        let devtools = tauri::menu::MenuItem::with_id(app, "toggle-devtools", "开发者工具", true, Some("CmdOrCtrl+Alt+I"))?;
        view.append_items(&[&sep4, &devtools])?;
    }

    let help = tauri::menu::Submenu::with_id(app, "m-help", "帮助", true)?;
    help.append_items(&[
        &tauri::menu::MenuItem::with_id(app, "help-changelog", "更新日志", true, None::<&str>)?,
        &tauri::menu::MenuItem::with_id(app, "about", "关于 MdReader", true, None::<&str>)?,
    ])?;

    let menu = tauri::menu::Menu::with_items(app, &[&file, &edit, &insert, &fmt, &view, &help])?;
    app.set_menu(menu)?;
    Ok(())
}

fn handle_menu_event(app: &AppHandle, id: &str) {
    let state = app.state::<AppState>();
    if let Some(rest) = id.strip_prefix("recent-").filter(|r| !r.is_empty()) {
        let idx: usize = rest.parse().unwrap_or(usize::MAX);
        let path = state.recent.lock().unwrap().get(idx).cloned();
        if let Some(p) = path {
            let _ = app.emit("doc:open-recent", p);
        }
        return;
    }
    if id == "file-reveal" {
        let path = state.doc.lock().unwrap().file_path.clone();
        if let Some(p) = path {
            let _ = app.opener().reveal_item_in_dir(&p);
        }
        return;
    }
    if id == "app-quit" {
        let _ = app.emit("app:request-save-exit", ());
        return;
    }
    if id == "zoom-in" || id == "zoom-out" || id == "zoom-reset" {
        if let Some(w) = main_window(app) {
            let mut z = state.zoom.lock().unwrap();
            *z = match id.as_ref() {
                "zoom-in" => (*z + 0.1).min(3.0),
                "zoom-out" => (*z - 0.1).max(0.5),
                _ => 1.0,
            };
            let _ = w.set_zoom(*z);
        }
        return;
    }
    if id == "toggle-fullscreen" {
        if let Some(w) = main_window(app) {
            let fs = w.is_fullscreen().unwrap_or(false);
            let _ = w.set_fullscreen(!fs);
        }
        return;
    }
    #[cfg(debug_assertions)]
    if id == "toggle-devtools" {
        if let Some(w) = main_window(app) {
            w.open_devtools();
        }
        return;
    }
    if id == "about" {
        let _ = app.emit("menu:action", ("about", serde_json::Value::Null));
        return;
    }
    if id == "theme-light" || id == "theme-dark" {
        let t = if id == "theme-dark" { "dark" } else { "light" };
        state.prefs.lock().unwrap().theme = t.to_string();
        if let Some(w) = main_window(app) {
            let _ = w.set_theme(Some(if t == "dark" { Theme::Dark } else { Theme::Light }));
        }
        let _ = app.emit("menu:action", ("theme", t));
        return;
    }
    let name = match id {
        "file-new" => "file:new",
        "file-open" => "file:open",
        "file-save" => "file:save",
        "file-save-as" => "file:save-as",
        "help-changelog" => "help:changelog",
        "view-doc-source" => "view:doc-source",
        "view-file-tree" => "view:file-tree",
        "file-export-html" => "file:export-html",
        "file-export-word" => "file:export-word",
        "file-export-image" => "file:export-image",
        "file-export-pdf" => "file:export-pdf",
        "file-print" => "file:print",
        "insert-mindmap" => "insert:mindmap",
        "edit-find" => "edit:find",
        "edit-replace" => "edit:replace",
        "fmt-bold" => "fmt:bold",
        "fmt-italic" => "fmt:italic",
        "fmt-underline" => "fmt:underline",
        "fmt-strike-through" => "fmt:strikeThrough",
        "fmt-superscript" => "fmt:superscript",
        "fmt-subscript" => "fmt:subscript",
        "fmt-highlight" => "fmt:highlight",
        "fmt-wavy" => "fmt:wavy",
        "fmt-remove-format" => "fmt:removeFormat",
        _ => "",
    };
    if !name.is_empty() {
        let _ = app.emit("menu:action", (name, serde_json::Value::Null));
    }
}

// ---------- commands ----------

#[tauri::command]
fn open_file_dialog(app: AppHandle) -> Result<serde_json::Value, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Markdown 文件", &MD_EXTS)
        .add_filter("所有文件", &["*"])
        .blocking_pick_file();
    let Some(file) = picked else {
        return Ok(json!({ "canceled": true }));
    };
    let path = file.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    push_recent(&app, &path);
    build_menu(&app).map_err(|e| e.to_string())?;
    Ok(json!({
        "canceled": false,
        "path": path,
        "name": Path::new(&path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        "content": content
    }))
}

#[tauri::command]
fn read_file_cmd(
    app: AppHandle,
    path: String,
    skip_recent: Option<bool>,
) -> Result<serde_json::Value, String> {
    let content = fs::read_to_string(&path).map_err(|e| e.to_string())?;
    if !skip_recent.unwrap_or(false) {
        push_recent(&app, &path);
        build_menu(&app).map_err(|e| e.to_string())?;
    }
    Ok(json!({
        "path": path,
        "name": Path::new(&path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        "content": content
    }))
}

/// 外部修改检测：上报所有打开文档的路径集合（轮询遍历）
#[tauri::command]
fn set_watch_paths(state: State<AppState>, paths: Vec<String>) {
    let mut list: Vec<String> = paths.into_iter().filter(|p| !p.is_empty()).collect();
    list.sort();
    list.dedup();
    *state.watch_paths.lock().unwrap() = list;
}

/// 渲染层错误日志落盘（userData/logs/mdreader.log）
#[tauri::command]
fn append_log(app: AppHandle, level: String, message: String, stack: Option<String>) {
    use std::io::Write;
    let dir = data_dir(&app).join("logs");
    if fs::create_dir_all(&dir).is_err() {
        return;
    }
    let line = format!(
        "[{}] [{}] {}{}",
        now_ms(),
        level,
        message,
        stack.map(|s| format!("\n{s}")).unwrap_or_default()
    );
    if let Ok(mut f) = std::fs::OpenOptions::new()
        .create(true)
        .append(true)
        .open(dir.join("mdreader.log"))
    {
        let _ = writeln!(f, "{line}");
    }
}

#[tauri::command]
fn save_file(app: AppHandle, path: String, content: String) -> Result<serde_json::Value, String> {
    atomic_write(Path::new(&path), content.as_bytes()).map_err(|e| e.to_string())?;
    push_recent(&app, &path);
    build_menu(&app).map_err(|e| e.to_string())?;
    Ok(json!({ "path": path, "savedAt": now_ms() }))
}

#[tauri::command]
fn save_file_as(app: AppHandle, content: String, name: Option<String>) -> Result<serde_json::Value, String> {
    let picked = app
        .dialog()
        .file()
        .add_filter("Markdown 文件", &MD_EXTS)
        .add_filter("所有文件", &["*"])
        .set_file_name(name.as_deref().unwrap_or("未命名.md"))
        .blocking_save_file();
    let Some(file) = picked else {
        return Ok(json!({ "canceled": true }));
    };
    let path = file.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
    atomic_write(Path::new(&path), content.as_bytes()).map_err(|e| e.to_string())?;
    push_recent(&app, &path);
    build_menu(&app).map_err(|e| e.to_string())?;
    Ok(json!({
        "canceled": false,
        "path": path,
        "name": Path::new(&path).file_name().map(|n| n.to_string_lossy().into_owned()).unwrap_or_default(),
        "savedAt": now_ms()
    }))
}

#[tauri::command]
fn export_save(
    app: AppHandle,
    data: String,
    name: Option<String>,
    ext: Option<String>,
    ext_name: Option<String>,
) -> Result<serde_json::Value, String> {
    use base64::engine::general_purpose::STANDARD;
    let bytes = STANDARD.decode(data.as_bytes()).map_err(|e| e.to_string())?;
    let ext = ext.unwrap_or_else(|| "png".into());
    let filter_name = ext_name.clone().unwrap_or_else(|| ext.clone());
    let picked = app
        .dialog()
        .file()
        .add_filter(&filter_name, &[ext.as_str()])
        .set_file_name(name.as_deref().unwrap_or("export.png"))
        .blocking_save_file();
    let Some(file) = picked else {
        return Ok(json!({ "canceled": true }));
    };
    let path = file.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
    atomic_write(Path::new(&path), &bytes).map_err(|e| e.to_string())?;
    Ok(json!({ "canceled": false, "path": path }))
}

#[tauri::command]
fn report_state(
    app: AppHandle,
    state: State<AppState>,
    dirty: bool,
    any_dirty: bool,
    file_path: Option<String>,
    file_name: Option<String>,
) {
    let normalized = file_path.filter(|p| !p.is_empty());
    let prev_path = {
        let mut d = state.doc.lock().unwrap();
        let prev = d.file_path.clone();
        d.dirty = dirty;
        d.any_dirty = any_dirty;
        d.file_path = normalized.clone();
        d.file_name = file_name.unwrap_or_default();
        prev
    };
    let d = state.doc.lock().unwrap();
    set_doc_title(&app, d.dirty, &d.file_name);
    drop(d);
    // 菜单仅依赖 file_path（reveal 可用性），避免每次 dirty 翻转都重建
    if normalized != prev_path {
        let _ = build_menu(&app);
    }
}

#[tauri::command]
fn request_exit(app: AppHandle, state: State<AppState>) {
    *state.exiting.lock().unwrap() = true;
    if let Some(w) = main_window(&app) {
        let _ = w.close();
    } else {
        app.exit(0);
    }
}

#[tauri::command]
fn relaunch_app(app: AppHandle) {
    app.restart();
}

#[tauri::command]
fn set_theme_source(app: AppHandle, state: State<AppState>, theme: String) -> String {
    state.prefs.lock().unwrap().theme = theme.clone();
    if let Some(w) = main_window(&app) {
        let _ = w.set_theme(Some(if theme == "dark" { Theme::Dark } else { Theme::Light }));
    }
    let _ = build_menu(&app);
    if theme == "dark" { "dark".into() } else { "light".into() }
}

#[tauri::command]
fn report_theme(app: AppHandle, state: State<AppState>, theme: String) {
    state.prefs.lock().unwrap().theme = theme.clone();
    if let Some(w) = main_window(&app) {
        let _ = w.set_theme(Some(if theme == "dark" { Theme::Dark } else { Theme::Light }));
    }
    let _ = build_menu(&app);
}

#[tauri::command]
fn open_external(app: AppHandle, url: String) -> Result<(), String> {
    if url.starts_with("http://")
        || url.starts_with("https://")
        || url.starts_with("mailto:")
        || url.starts_with("tel:")
    {
        app.opener().open_url(url, None::<&str>).map_err(|e| e.to_string())
    } else {
        Ok(())
    }
}

#[tauri::command]
fn open_local_link(app: AppHandle, href: String, doc_path: Option<String>) -> serde_json::Value {
    let mut p = if let Some(rest) = href.strip_prefix("file://") {
        percent_decode(rest)
    } else {
        percent_decode(&href)
    };
    if !Path::new(&p).is_absolute() {
        let Some(base) = doc_path.as_deref().map(PathBuf::from).and_then(|b| b.parent().map(|d| d.to_path_buf())) else {
            return json!({ "ok": false, "message": "当前文档尚未保存到磁盘，无法解析相对链接" });
        };
        p = base.join(&p).to_string_lossy().into_owned();
    }
    if !Path::new(&p).exists() {
        return json!({ "ok": false, "message": format!("文件不存在：{p}") });
    }
    if is_md_file(&p) {
        show_main(&app);
        let _ = app.emit("doc:open-path", p);
        return json!({ "ok": true });
    }
    match app.opener().open_path(p, None::<&str>) {
        Ok(_) => json!({ "ok": true }),
        Err(e) => json!({ "ok": false, "message": e.to_string() }),
    }
}

#[tauri::command]
fn get_perf_config(app: AppHandle, state: State<AppState>) -> PerfConfig {
    let mut cfg = load_perf_config(&app);
    {
        let mut p = state.perf.lock().unwrap();
        *p = cfg.clone();
    }
    // WebView2 下进程级选项由系统 WebView 管理，此处仅持久化展示
    cfg.in_process_gpu = false;
    cfg
}

#[tauri::command]
fn set_perf_config(app: AppHandle, state: State<AppState>, cfg: PerfConfig) -> PerfConfig {
    let merged = PerfConfig {
        disable_hardware_acceleration: cfg.disable_hardware_acceleration,
        in_process_gpu: false,
        max_old_space_size: cfg.max_old_space_size,
    };
    save_perf_config(&app, &merged);
    *state.perf.lock().unwrap() = merged.clone();
    merged
}

#[tauri::command]
fn import_asset(src: String, doc_path: String) -> serde_json::Value {
    let doc = PathBuf::from(&doc_path);
    let Some(dir) = doc.parent().map(|d| d.to_path_buf()) else {
        return json!({ "ok": false, "message": "请先保存文档" });
    };
    let assets = dir.join("assets");
    if let Err(e) = fs::create_dir_all(&assets) {
        return json!({ "ok": false, "message": e.to_string() });
    }
    let ext = Path::new(&src)
        .extension()
        .map(|e| format!(".{}", e.to_string_lossy().to_lowercase()))
        .unwrap_or_else(|| ".png".into());
    let stem = Path::new(&src)
        .file_stem()
        .map(|s| {
            s.to_string_lossy()
                .replace(['\\', '/', ':', '*', '?', '"', '<', '>', '|'], "_")
        })
        .unwrap_or_else(|| "image".into());
    let mut name = format!("{stem}{ext}");
    let mut i = 1;
    while assets.join(&name).exists() {
        name = format!("{stem}-{i}{ext}");
        i += 1;
    }
    match fs::copy(&src, assets.join(&name)) {
        Ok(_) => json!({ "ok": true, "relative": format!("assets/{name}") }),
        Err(e) => json!({ "ok": false, "message": e.to_string() }),
    }
}

/// 保存二进制图片（编辑器内粘贴）到文档旁 assets/
#[tauri::command]
fn save_image_asset(
    doc_path: String,
    data: String,
    ext: String,
) -> serde_json::Value {
    use base64::engine::general_purpose::STANDARD;
    let doc = PathBuf::from(&doc_path);
    let Some(dir) = doc.parent().map(|d| d.to_path_buf()) else {
        return json!({ "ok": false, "message": "请先保存文档" });
    };
    let assets = dir.join("assets");
    if let Err(e) = fs::create_dir_all(&assets) {
        return json!({ "ok": false, "message": e.to_string() });
    }
    let bytes = match STANDARD.decode(data.as_bytes()) {
        Ok(b) => b,
        Err(e) => return json!({ "ok": false, "message": e.to_string() }),
    };
    let safe_ext: String = ext.chars().filter(|c| c.is_ascii_alphanumeric()).collect();
    let safe_ext = if safe_ext.is_empty() { "png".into() } else { safe_ext };
    let stem = "paste-".to_string()
        + &now_ms().to_string();
    let mut name = format!("{stem}.{safe_ext}");
    let mut i = 1;
    while assets.join(&name).exists() {
        name = format!("{stem}-{i}.{safe_ext}");
        i += 1;
    }
    match fs::write(assets.join(&name), bytes) {
        Ok(_) => json!({ "ok": true, "relative": format!("assets/{name}") }),
        Err(e) => json!({ "ok": false, "message": e.to_string() }),
    }
}

#[tauri::command]
fn open_folder_dialog(app: AppHandle) -> Result<serde_json::Value, String> {
    let picked = app.dialog().file().blocking_pick_folder();
    let Some(file) = picked else {
        return Ok(json!({ "canceled": true }));
    };
    let path = file.into_path().map_err(|e| e.to_string())?.to_string_lossy().into_owned();
    Ok(json!({ "canceled": false, "path": path }))
}

#[tauri::command]
fn list_dir(path: String) -> serde_json::Value {
    let mut entries: Vec<serde_json::Value> = Vec::new();
    let read = fs::read_dir(&path);
    match read {
        Err(e) => return json!({ "entries": [], "message": e.to_string() }),
        Ok(rd) => {
            for item in rd.flatten() {
                let Ok(ft) = item.file_type() else { continue };
                let name = item.file_name().to_string_lossy().into_owned();
                if name.starts_with('.') {
                    continue;
                }
                let full = item.path().to_string_lossy().into_owned();
                if ft.is_dir() {
                    entries.push(json!({ "name": name, "path": full, "isDir": true }));
                } else if is_md_file(&full) {
                    entries.push(json!({ "name": name, "path": full, "isDir": false }));
                }
            }
        }
    }
    entries.sort_by(|a, b| {
        let da = a["isDir"].as_bool().unwrap_or(false);
        let db = b["isDir"].as_bool().unwrap_or(false);
        if da != db {
            return if da { std::cmp::Ordering::Less } else { std::cmp::Ordering::Greater };
        }
        let na = a["name"].as_str().unwrap_or("");
        let nb = b["name"].as_str().unwrap_or("");
        na.cmp(nb)
    });
    json!({ "entries": entries })
}

/// 列出 assets/ 中未被文档引用的文件（引用集合由渲染层从文档内容提取）
#[tauri::command]
fn check_assets(doc_path: String, referenced: Vec<String>) -> serde_json::Value {
    let doc = PathBuf::from(&doc_path);
    let Some(dir) = doc.parent().map(|d| d.join("assets")) else {
        return json!({ "orphans": [] });
    };
    let refs: Vec<String> = referenced.iter().map(|r| percent_decode(r)).collect();
    let mut orphans: Vec<String> = Vec::new();
    if let Ok(rd) = fs::read_dir(&dir) {
        for item in rd.flatten() {
            let name = item.file_name().to_string_lossy().into_owned();
            if name.starts_with('.') {
                continue;
            }
            if !item.file_type().map(|t| t.is_file()).unwrap_or(false) {
                continue;
            }
            if !refs.iter().any(|r| *r == name) {
                orphans.push(name);
            }
        }
    }
    json!({ "orphans": orphans })
}

#[tauri::command]
fn delete_assets(doc_path: String, names: Vec<String>) -> serde_json::Value {
    let doc = PathBuf::from(&doc_path);
    let Some(dir) = doc.parent().map(|d| d.join("assets")) else {
        return json!({ "deleted": 0 });
    };
    let mut deleted: u32 = 0;
    for n in names {
        let name = Path::new(&n)
            .file_name()
            .map(|f| f.to_string_lossy().into_owned())
            .unwrap_or_default();
        if name.is_empty() || name.starts_with('.') {
            continue;
        }
        if fs::remove_file(dir.join(&name)).is_ok() {
            deleted += 1;
        }
    }
    json!({ "deleted": deleted })
}

/// WebView2 无静默导出 PDF 能力；返回 unsupported 由渲染层降级走打印
#[tauri::command]
fn export_pdf() -> serde_json::Value {
    json!({ "canceled": true, "unsupported": true })
}

/// 文件树开关同步到菜单勾选态
#[tauri::command]
fn report_file_tree(app: AppHandle, state: State<AppState>, on: bool) {
    state.prefs.lock().unwrap().show_file_tree = on;
    let _ = build_menu(&app);
}

// ---------- 外部修改轮询：活动文件 mtime 变化 → 通知渲染层（内容比对在渲染层做） ----------

fn poll_loop(app: AppHandle) {
    let mut last: HashMap<String, SystemTime> = HashMap::new();
    loop {
        std::thread::sleep(Duration::from_millis(FILE_POLL_MS));
        let paths = {
            let state = app.state::<AppState>();
            let watch = state.watch_paths.lock().unwrap();
            watch.clone()
        };
        for p in paths {
            let mtime = fs::metadata(&p).and_then(|m| m.modified()).ok();
            match (mtime, last.get(&p)) {
                (Some(mt), Some(prev)) if *prev != mt => {
                    let _ = app.emit("doc:file-changed", p.clone());
                }
                _ => {}
            }
            match mtime {
                Some(mt) => {
                    last.insert(p, mt);
                }
                None => {
                    last.remove(&p);
                }
            }
        }
    }
}

fn peaks() -> &'static Mutex<HashMap<u32, f32>> {
    static PEAKS: OnceLock<Mutex<HashMap<u32, f32>>> = OnceLock::new();
    PEAKS.get_or_init(|| Mutex::new(HashMap::new()))
}

#[tauri::command]
fn get_metrics() -> serde_json::Value {
    let mut sys = System::new();
    sys.refresh_processes(sysinfo::ProcessesToUpdate::All, true);
    let me = std::process::id();
    let r2 = |v: f32| (v * 100.0).round() / 100.0;
    let mut processes: Vec<serde_json::Value> = Vec::new();
    let mut peaks = peaks().lock().unwrap();
    for (pid, proc_) in sys.processes() {
        let pid_u32 = pid.as_u32();
        let is_self = pid_u32 == me;
        let is_child = proc_.parent().map(|p| p.as_u32()) == Some(me);
        if !(is_self || is_child) {
            continue;
        }
        let name = proc_.name().to_string_lossy().to_lowercase();
        let kind = if is_self {
            "Browser"
        } else if name.contains("webview") {
            "Renderer"
        } else {
            "Utility"
        };
        let mem = proc_.memory() as f32 / 1024.0 / 1024.0;
        let peak_entry = peaks.entry(pid_u32).or_insert(0.0);
        if mem > *peak_entry {
            *peak_entry = mem;
        }
        processes.push(json!({
            "type": kind,
            "pid": pid_u32,
            "memory": r2(mem),
            "peak": r2(*peak_entry),
            "cpu": r2(proc_.cpu_usage())
        }));
    }
    processes.sort_by_key(|p| match p["type"].as_str().unwrap_or("") {
        "Browser" => 0,
        "Renderer" => 1,
        _ => 2,
    });
    let total = r2(processes.iter().filter_map(|p| p["memory"].as_f64()).sum::<f64>() as f32);
    json!({
        "time": now_ms(),
        "uptime": app_start().elapsed().as_secs(),
        "processes": processes,
        "total": total
    })
}

// ---------- 运行时自愈：.md 关联图标指向随包的专用 ico ----------
// Tauri NSIS 的关联注册会把 ProgID DefaultIcon 指向主程序图标，且写入顺序不可控，
// 因此在应用启动时以最后一次写入为准覆盖（仅 Windows 且随包分发 md-file.ico 时执行）。

fn refresh_md_file_icon() {
    if std::env::consts::OS != "windows" {
        return;
    }
    let Ok(exe) = std::env::current_exe() else { return };
    let Some(dir) = exe.parent() else { return };
    let ico = dir.join("md-file.ico");
    if !ico.exists() {
        return;
    }
    let val = format!("{},0", ico.display());
    let _ = std::process::Command::new("reg")
        .args([
            "add",
            r"HKCU\SOFTWARE\Classes\Markdown 文档\DefaultIcon",
            "/ve",
            "/d",
            &val,
            "/f",
        ])
        .output();
    let _ = std::process::Command::new("ie4uinit.exe").arg("-show").output();
}

// ---------- run ----------

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            if let Some(p) = path_from_argv(&argv) {
                let _ = app.emit("doc:open-path", p);
            }
            show_main(app);
        }))
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .manage(AppState {
            doc: Mutex::new(DocState::default()),
            prefs: Mutex::new(Prefs { theme: "light".into(), show_file_tree: false }),
            perf: Mutex::new(PerfConfig::default()),
            recent: Mutex::new(Vec::new()),
            watch_paths: Mutex::new(Vec::new()),
            exiting: Mutex::new(false),
            zoom: Mutex::new(1.0),
        })
        .invoke_handler(tauri::generate_handler![
            open_file_dialog,
            read_file_cmd,
            save_file,
            save_file_as,
            export_save,
            import_asset,
            save_image_asset,
            check_assets,
            delete_assets,
            open_folder_dialog,
            list_dir,
            export_pdf,
            set_watch_paths,
            append_log,
            report_file_tree,
            report_state,
            request_exit,
            relaunch_app,
            set_theme_source,
            report_theme,
            open_external,
            open_local_link,
            get_perf_config,
            set_perf_config,
            get_metrics
        ])
        .on_page_load(|webview, _payload| {
            // 关键：必须 show 窗口本身（Webview::show 仅显示 webview 控件）
            let _ = webview.window().show();
            let _ = webview.window().set_focus();
            if let Some(Some(p)) = INITIAL_FILE.get() {
                let _ = webview.emit("doc:open-path", p.clone());
            }
        })
        .on_menu_event(|app, event| handle_menu_event(app, event.id().0.as_str()))
        .setup(move |app| {
            let handle = app.handle().clone();
            std::thread::spawn(move || refresh_md_file_icon());
            {
                let poll_handle = handle.clone();
                std::thread::spawn(move || poll_loop(poll_handle));
            }
            {
                let state = handle.state::<AppState>();
                *state.recent.lock().unwrap() = load_recent(&handle);
            }
            build_menu(&handle)?;

            // 托盘
            let tray_menu = tauri::menu::Menu::with_items(
                &handle,
                &[
                    &tauri::menu::MenuItem::with_id(&handle, "tray-toggle", "显示 / 隐藏窗口", true, None::<&str>)?,
                    &tauri::menu::MenuItem::with_id(&handle, "tray-new", "新建文件", true, None::<&str>)?,
                    &tauri::menu::PredefinedMenuItem::separator(&handle)?,
                    &tauri::menu::MenuItem::with_id(&handle, "tray-quit", "退出", true, None::<&str>)?,
                ],
            )?;
            let _tray = tauri::tray::TrayIconBuilder::with_id("main-tray")
                .icon(tauri::include_image!("icons/tray.png"))
                .tooltip("MdReader - Markdown 编辑器")
                .menu(&tray_menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id().0.as_str() {
                    "tray-toggle" => toggle_main(app),
                    "tray-new" => {
                        show_main(app);
                        let _ = app.emit("menu:action", ("file:new", serde_json::Value::Null));
                    }
                    "tray-quit" => {
                        let _ = app.emit("app:request-save-exit", ());
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click {
                        button: tauri::tray::MouseButton::Left,
                        button_state: tauri::tray::MouseButtonState::Up,
                        ..
                    } = event
                    {
                        toggle_main(tray.app_handle());
                    }
                })
                .build(&handle)?;
            // 保留托盘实例
            std::mem::forget(_tray);

            if let Some(p) = path_from_argv(&std::env::args().collect::<Vec<String>>()) {
                let _ = INITIAL_FILE.set(Some(p));
            }
            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::WindowEvent {
                event: tauri::WindowEvent::CloseRequested { api, .. },
                ..
            } = event
            {
                let state = app.state::<AppState>();
                let exiting = *state.exiting.lock().unwrap();
                if exiting {
                    return;
                }
                // 关闭按钮 → 隐藏到托盘
                api.prevent_close();
                if let Some(w) = main_window(app) {
                    let _ = w.hide();
                }
            }
        });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn percent_decode_basic() {
        assert_eq!(percent_decode("hello%20world"), "hello world");
        assert_eq!(percent_decode("%E4%B8%AD.md"), "中.md");
        assert_eq!(percent_decode("plain.md"), "plain.md");
        assert_eq!(percent_decode("bad%2"), "bad%2");
        assert_eq!(percent_decode("bad%zz"), "bad%zz");
    }

    #[test]
    fn md_extension_detection() {
        assert!(is_md_file("a.md"));
        assert!(is_md_file("b.MARKDOWN"));
        assert!(is_md_file("c.mdown"));
        assert!(is_md_file("d.mkd"));
        assert!(!is_md_file("e.txt"));
        assert!(!is_md_file("f"));
    }

    #[test]
    fn argv_path_extraction() {
        let argv = vec!["exe".to_string(), "--flag".to_string(), "doc.md".to_string()];
        let p = path_from_argv(&argv).expect("should find");
        assert!(p.ends_with("doc.md"));
        assert!(path_from_argv(&["exe".to_string()]).is_none());
        assert!(path_from_argv(&["exe".to_string(), "note.txt".to_string()]).is_none());
    }

    #[test]
    fn perf_config_defaults_via_serde() {
        let cfg: PerfConfig = serde_json::from_str("{}").unwrap();
        assert!(!cfg.disable_hardware_acceleration);
        assert!(!cfg.in_process_gpu);
        assert_eq!(cfg.max_old_space_size, 0);
    }
}
