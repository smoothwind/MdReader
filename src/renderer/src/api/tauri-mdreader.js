import { invoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { IMAGE_RE } from '../utils/file'

const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

function bytesToBase64(bytes) {
  const u8 = bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)
  let bin = ''
  const CHUNK = 0x8000
  for (let i = 0; i < u8.length; i += CHUNK) {
    bin += String.fromCharCode.apply(null, u8.subarray(i, i + CHUNK))
  }
  return btoa(bin)
}

if (isTauri && !window.mdreader) {
  const handlers = {}
  const listeners = {}
  const fire = (channel, payload) => {
    const cb = handlers[channel]
    if (!cb) return
    if (Array.isArray(payload)) cb(...payload)
    else cb(payload)
  }
  const on = (channel) => (cb) => {
    handlers[channel] = cb
    if (!listeners[channel]) {
      listeners[channel] = listen(channel, (e) => fire(channel, e.payload))
    }
    return () => {
      delete handlers[channel]
      const l = listeners[channel]
      if (l) {
        delete listeners[channel]
        l.then((un) => un()).catch(() => {})
      }
    }
  }

  // 拖拽文件 → 图片走插入流程，文档走打开流程（WebView2 拦截了原生 drop）
  listen('tauri://drag-drop', (e) => {
    const paths = e.payload?.paths || []
    paths.forEach((p) => fire(IMAGE_RE.test(p) ? 'doc:drop-image' : 'doc:open-path', p))
  })

  window.mdreader = {
    runtime: 'tauri',
    openDialog: () => invoke('open_file_dialog'),
    readPath: (path, opts) => invoke('read_file_cmd', { path, skipRecent: !!opts?.skipRecent }),
    openExternal: (url) => invoke('open_external', { url }),
    openLocalLink: (href, docPath) => invoke('open_local_link', { href, docPath: docPath || null }),
    save: (path, content) => invoke('save_file', { path, content }),
    saveAs: (content, name) => invoke('save_file_as', { content, name }),
    exportSave: (payload) =>
      invoke('export_save', {
        data: bytesToBase64(payload.data || []),
        name: payload.name || null,
        ext: payload.ext || null,
        extName: payload.extName || null
      }),
    // WebView2 无静默 PDF 能力，由渲染层降级走打印
    exportPdf: () => invoke('export_pdf'),
    saveImageAsset: (docPath, data, ext) =>
      invoke('save_image_asset', { docPath, data: bytesToBase64(data), ext }),
    importAsset: (src, docPath) => invoke('import_asset', { src, docPath }),
    openFolderDialog: () => invoke('open_folder_dialog'),
    listDir: (path) => invoke('list_dir', { path }),
    checkAssets: (docPath, referenced) => invoke('check_assets', { docPath, referenced: referenced || [] }),
    deleteAssets: (docPath, names) => invoke('delete_assets', { docPath, names: names || [] }),
    setWatchPaths: (paths) => invoke('set_watch_paths', { paths: Array.isArray(paths) ? paths : [] }),
    appendLog: (entry) =>
      invoke('append_log', {
        level: String(entry?.level || 'error'),
        message: String(entry?.message || ''),
        stack: entry?.stack ? String(entry.stack) : null
      }),
    pathForFile: () => undefined,
    reportState: (state) =>
      invoke('report_state', {
        dirty: !!state.dirty,
        anyDirty: !!state.anyDirty,
        filePath: state.filePath || null,
        fileName: state.fileName || ''
      }),
    requestExit: () => invoke('request_exit'),
    relaunchApp: () => invoke('relaunch_app'),
    setThemeSource: (theme) => invoke('set_theme_source', { theme }),
    reportTheme: (theme) => invoke('report_theme', { theme }),
    reportFileTree: (on) => invoke('report_file_tree', { on: !!on }),
    getPerfConfig: () => invoke('get_perf_config'),
    setPerfConfig: (partial) => invoke('set_perf_config', { cfg: { ...partial } }),
    getMetrics: () => invoke('get_metrics'),
    onMenuAction: on('menu:action'),
    onOpenPath: on('doc:open-path'),
    onOpenRecent: on('doc:open-recent'),
    onDropImage: on('doc:drop-image'),
    onFileChanged: on('doc:file-changed'),
    onRequestSaveExit: on('app:request-save-exit')
  }
}
