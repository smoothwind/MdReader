import { contextBridge, ipcRenderer, webUtils } from 'electron'

const subscribe = (channel) => (callback) => {
  const listener = (_event, ...args) => callback(...args)
  ipcRenderer.on(channel, listener)
  return () => ipcRenderer.removeListener(channel, listener)
}

contextBridge.exposeInMainWorld('mdreader', {
  runtime: 'electron',
  setLocale: (locale) => ipcRenderer.invoke('app:set-locale', locale),
  openDialog: () => ipcRenderer.invoke('file:open-dialog'),
  readPath: (path, opts) => ipcRenderer.invoke('file:read', { path, skipRecent: !!opts?.skipRecent }),
  openExternal: (url) => ipcRenderer.invoke('link:open-external', url),
  openLocalLink: (href, docPath) => ipcRenderer.invoke('link:open-local', { href, docPath }),
  save: (path, content) => ipcRenderer.invoke('file:save', { path, content }),
  saveAs: (content, name) => ipcRenderer.invoke('file:save-as', { content, name }),
  exportSave: (payload) => ipcRenderer.invoke('export:save', payload),
  exportPdf: () => ipcRenderer.invoke('pdf:export'),
  importAsset: (src, docPath) => ipcRenderer.invoke('asset:import', { src, docPath }),
  saveImageAsset: (docPath, data, ext) => ipcRenderer.invoke('asset:save-bytes', { docPath, data, ext }),
  openFolderDialog: () => ipcRenderer.invoke('folder:open-dialog'),
  listDir: (path) => ipcRenderer.invoke('fs:list-dir', path),
  checkAssets: (docPath, referenced) => ipcRenderer.invoke('assets:check', { docPath, referenced }),
  deleteAssets: (docPath, names) => ipcRenderer.invoke('assets:delete', { docPath, names }),
  setWatchPaths: (paths) => ipcRenderer.invoke('file:watch-set', paths),
  appendLog: (entry) => ipcRenderer.invoke('log:append', entry || {}),
  pathForFile: (file) => webUtils.getPathForFile(file),
  reportState: (state) => ipcRenderer.send('doc:state', state),
  requestExit: () => ipcRenderer.send('app:request-exit'),
  setThemeSource: (theme) => ipcRenderer.invoke('theme:source', theme),
  reportTheme: (theme) => ipcRenderer.send('prefs:theme', theme),
  reportFileTree: (on) => ipcRenderer.send('prefs:file-tree', on),
  onMenuAction: subscribe('menu:action'),
  onOpenPath: subscribe('doc:open-path'),
  onOpenRecent: subscribe('doc:open-recent'),
  onDropImage: subscribe('doc:drop-image'),
  onFileChanged: subscribe('doc:file-changed'),
  onRequestSaveExit: subscribe('app:request-save-exit'),
  getPerfConfig: () => ipcRenderer.invoke('perf:get'),
  setPerfConfig: (partial) => ipcRenderer.invoke('perf:set', partial),
  getMetrics: () => ipcRenderer.invoke('metrics:get'),
  relaunchApp: () => ipcRenderer.send('app:relaunch')
})
