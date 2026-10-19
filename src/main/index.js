import { app, shell, BrowserWindow, Menu, Tray, nativeImage, ipcMain, dialog, nativeTheme } from 'electron'
import { join, basename, dirname, resolve, isAbsolute } from 'node:path'
import { readFile, writeFile, appendFile, access, mkdir, copyFile, rename, rm, readdir, stat } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { RecentFiles } from './recent.js'
import { loadPerfConfig, applyPerfConfig, savePerfConfig } from './perf.js'

const MD_FILTERS = [
  { name: 'Markdown 文件', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
  { name: '所有文件', extensions: ['*'] }
]

const MD_EXT_RE = /\.(md|markdown|mdown|mkd)$/i
const EXTERNAL_RE = /^(https?|mailto|tel):/i
const FILE_POLL_MS = 2000

if (!app.isPackaged) {
  // 仅开发构建暴露 CDP 调试端口；生产开启会让本机任意进程接管渲染层
  app.commandLine.appendSwitch('remote-debugging-port', '9223')
}
applyPerfConfig(loadPerfConfig())

const APP_ICON = join(__dirname, '../../resources/icon.png')
const TRAY_ICON = join(__dirname, '../../resources/tray.png')

let win = null
let recent = null
let tray = null
let exiting = false
let forceClose = false
const prefs = { theme: 'light', showFileTree: false }
const doc = { dirty: false, anyDirty: false, filePath: null, fileName: '' }

const send = (channel, ...args) => win?.webContents.send(channel, ...args)

function windowTitle() {
  return `${doc.dirty ? '● ' : ''}${doc.fileName || '未命名'} - MdReader`
}

function pathFromArgv(argv) {
  const args = argv.slice(app.isPackaged ? 1 : 2)
  const raw = args.find((a) => /\.(md|markdown|mdown|mkd)$/i.test(a))
  return raw ? resolve(raw) : null
}

/** Promise 超时保护：避免主进程向渲染层发出的请求永久 pending（如 printToPDF 卡死） */
function withTimeout(promise, ms, message) {
  let timer
  return Promise.race([
    Promise.resolve(promise).finally(() => clearTimeout(timer)),
    new Promise((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms)
    })
  ])
}

async function openLocalHref(href, docPath) {
  let p
  if (/^file:/i.test(href)) {
    p = fileURLToPath(href)
  } else {
    p = href
    try {
      p = decodeURIComponent(href)
    } catch {
      /* keep raw */
    }
    if (!isAbsolute(p)) {
      if (!docPath) return { ok: false, message: '当前文档尚未保存到磁盘，无法解析相对链接' }
      p = resolve(dirname(docPath), p)
    }
  }
  let exists = true
  try {
    await access(p)
  } catch {
    exists = false
  }
  if (!exists) return { ok: false, message: '文件不存在：' + p }
  if (MD_EXT_RE.test(p)) {
    send('doc:open-path', p)
    return { ok: true }
  }
  const err = await shell.openPath(p)
  if (err) return { ok: false, message: err }
  return { ok: true }
}

function handleIncomingUrl(url) {
  if (/^file:/i.test(url)) {
    openLocalHref(url, null)
    return
  }
  if (EXTERNAL_RE.test(url)) shell.openExternal(url).catch(() => {})
}

function releaseRendererMemory() {
  win?.webContents.session.clearCache().catch(() => {})
}

/** 原子写盘：同目录临时文件 + rename，避免写入中途崩溃留下半个文件 */
async function atomicWriteFile(p, data) {
  const tmp = `${p}.mdreader-${process.pid}-${Date.now()}.tmp`
  try {
    await writeFile(tmp, data)
    await rename(tmp, p)
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {})
    throw err
  }
}

// ---------- 外部修改轮询：所有打开文档的 mtime 变化 → 通知渲染层（内容比对在渲染层做） ----------

const watchSet = new Set()
const lastMtimes = new Map()

async function pollWatchedFiles() {
  for (const p of watchSet) {
    try {
      const st = await stat(p)
      const prev = lastMtimes.get(p)
      if (prev !== undefined && st.mtimeMs !== prev) {
        send('doc:file-changed', p)
      }
      lastMtimes.set(p, st.mtimeMs)
    } catch {
      lastMtimes.delete(p)
    }
  }
  if (lastMtimes.size > watchSet.size + 64) {
    for (const k of lastMtimes.keys()) {
      if (!watchSet.has(k)) lastMtimes.delete(k)
    }
  }
}

setInterval(() => pollWatchedFiles().catch(() => {}), FILE_POLL_MS)

// ---------- 错误日志：渲染层崩溃/未捕获 Promise 落盘到 userData/logs ----------

function logsDir() {
  return join(app.getPath('userData'), 'logs')
}

async function appendLog(entry) {
  const { level = 'error', message = '', stack = '' } = entry || {}
  const d = new Date()
  const name = `mdreader-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}.log`
  const line = `[${d.toISOString()}] [${level}] ${message}${stack ? '\n' + stack : ''}`
  await mkdir(logsDir(), { recursive: true })
  await appendFile(join(logsDir(), name), line + '\n', 'utf-8')
}

function createWindow(startPath) {
  win = new BrowserWindow({
    width: 1280,
    height: 840,
    minWidth: 760,
    minHeight: 540,
    show: false,
    icon: APP_ICON,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#1f2430' : '#ffffff',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false
    }
  })

  win.on('ready-to-show', () => win.show())
  win.on('closed', () => {
    win = null
  })

  win.webContents.setWindowOpenHandler(({ url }) => {
    handleIncomingUrl(url)
    return { action: 'deny' }
  })

  win.webContents.on('will-navigate', (e, url) => {
    if (url === win.webContents.getURL()) return
    e.preventDefault()
    handleIncomingUrl(url)
  })

  win.on('close', async (e) => {
    if (!exiting && !forceClose && tray) {
      e.preventDefault()
      releaseRendererMemory()
      win.hide()
      return
    }
    if (forceClose || !doc.anyDirty) return
    e.preventDefault()
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      title: 'MdReader',
      message: '有未保存的更改，是否保存后退出？',
      detail: '将保存所有修改过的文档。',
      buttons: ['保存全部', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    if (response === 1) {
      forceClose = true
      win.close()
    } else if (response === 0) {
      send('app:request-save-exit')
    }
  })

  win.webContents.once('did-finish-load', () => {
    if (startPath) send('doc:open-path', startPath)
  })

  if (process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

function rebuildMenu() {
  const action = (name, payload) => () => send('menu:action', name, payload)

  const recentSub = recent.items.length
    ? recent.items.map((p) => ({ label: p, click: () => send('doc:open-recent', p) }))
    : [{ label: '（暂无记录）', enabled: false }]

  const template = [
    {
      label: '文件',
      submenu: [
        { label: '新建', accelerator: 'CmdOrCtrl+N', click: action('file:new') },
        { label: '打开…', accelerator: 'CmdOrCtrl+O', click: action('file:open') },
        { label: '最近打开', submenu: recentSub },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: action('file:save') },
        { label: '另存为…', accelerator: 'CmdOrCtrl+Shift+S', click: action('file:save-as') },
        { type: 'separator' },
        { label: '导出 HTML…', click: action('file:export-html') },
        { label: '导出 Word 文档…', click: action('file:export-word') },
        { label: '导出长图…', click: action('file:export-image') },
        { label: '导出 PDF…', click: action('file:export-pdf') },
        { label: '打印 / 导出 PDF', accelerator: 'CmdOrCtrl+P', click: action('file:print') },
        { type: 'separator' },
        {
          label: '在资源管理器中显示',
          enabled: !!doc.filePath,
          click: () => doc.filePath && shell.showItemInFolder(doc.filePath)
        },
        { type: 'separator' },
        { role: 'quit', label: '退出' }
      ]
    },
    {
      label: '编辑',
      submenu: [
        { role: 'undo', label: '撤销' },
        { role: 'redo', label: '重做' },
        { type: 'separator' },
        { role: 'cut', label: '剪切' },
        { role: 'copy', label: '复制' },
        { role: 'paste', label: '粘贴' },
        { role: 'selectAll', label: '全选' },
        { type: 'separator' },
        { label: '查找…', accelerator: 'CmdOrCtrl+F', click: action('edit:find') },
        { label: '替换…', accelerator: 'CmdOrCtrl+H', click: action('edit:replace') }
      ]
    },
    {
      label: '插入',
      submenu: [
        { label: '脑图…', accelerator: 'CmdOrCtrl+M', click: action('insert:mindmap') }
      ]
    },
    {
      label: '格式',
      submenu: [
        { label: '加粗', accelerator: 'CmdOrCtrl+B', click: action('fmt:bold') },
        { label: '斜体', accelerator: 'CmdOrCtrl+I', click: action('fmt:italic') },
        { label: '下划线', accelerator: 'CmdOrCtrl+U', click: action('fmt:underline') },
        { label: '删除线', accelerator: 'CmdOrCtrl+Shift+X', click: action('fmt:strikeThrough') },
        { type: 'separator' },
        { label: '上标', accelerator: 'Ctrl+Shift+=', click: action('fmt:superscript') },
        { label: '下标', accelerator: 'Ctrl+=', click: action('fmt:subscript') },
        { label: '高亮', click: action('fmt:highlight') },
        { label: '波浪线', click: action('fmt:wavy') },
        { type: 'separator' },
        { label: '清除格式', accelerator: 'CmdOrCtrl+\\', click: action('fmt:removeFormat') }
      ]
    },
    {
      label: '视图',
          submenu: [
            { label: '查看全文 Markdown', click: action('view:doc-source') },
            { label: '文件树', type: 'checkbox', checked: prefs.showFileTree === true, click: action('view:file-tree') },
            { type: 'separator' },
            { label: '浅色主题', type: 'radio', checked: prefs.theme === 'light', click: action('theme', 'light') },
            { label: '深色主题', type: 'radio', checked: prefs.theme === 'dark', click: action('theme', 'dark') },
            { type: 'separator' },
        { role: 'zoomIn', label: '放大' },
        { role: 'zoomOut', label: '缩小' },
        { role: 'resetZoom', label: '重置缩放' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全屏' },
        { role: 'toggleDevTools', label: '开发者工具' }
      ]
    },
    {
      label: '帮助',
      submenu: [
        {
          label: '更新日志',
          click: action('help:changelog')
        },
        {
          label: '关于 MdReader',
          click: action('about')
        }
      ]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

function registerIpc() {
  ipcMain.handle('file:open-dialog', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '打开 Markdown 文件',
      properties: ['openFile'],
      filters: MD_FILTERS
    })
    if (r.canceled || !r.filePaths.length) return { canceled: true }
    const p = r.filePaths[0]
    const content = await readFile(p, 'utf-8')
    await recent.push(p)
    rebuildMenu()
    return { canceled: false, path: p, name: basename(p), content }
  })

  ipcMain.handle('file:read', async (_e, { path, skipRecent }) => {
    const content = await readFile(path, 'utf-8')
    if (!skipRecent) {
      await recent.push(path)
      rebuildMenu()
    }
    return { path, name: basename(path), content }
  })

  ipcMain.handle('file:watch-set', (_e, paths) => {
    watchSet.clear()
    for (const p of Array.isArray(paths) ? paths : []) {
      if (typeof p === 'string' && p) watchSet.add(p)
    }
    return true
  })

  ipcMain.handle('log:append', (_e, entry) => appendLog(entry))

  ipcMain.handle('file:save', async (_e, { path, content }) => {
    await atomicWriteFile(path, content)
    await recent.push(path)
    rebuildMenu()
    return { path, savedAt: Date.now() }
  })

  ipcMain.handle('asset:import', async (_e, { src, docPath }) => {
    try {
      if (!docPath) return { ok: false, message: '请先保存文档' }
      const ext = (src.match(/(\.[a-z0-9]+)$/i) || ['', 'png'])[1].toLowerCase()
      const dir = join(dirname(docPath), 'assets')
      await mkdir(dir, { recursive: true })
      const stem = basename(src, ext).replace(/[\\/:*?"<>|]/g, '_') || 'image'
      let name = stem + ext
      let i = 1
      while (existsSync(join(dir, name))) name = `${stem}-${i++}${ext}`
      await copyFile(src, join(dir, name))
      return { ok: true, relative: 'assets/' + name }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  })

  // 保存二进制图片（剪贴板粘贴）到文档旁 assets/，复用 importAsset 的命名规则
  ipcMain.handle('asset:save-bytes', async (_e, { docPath, data, ext }) => {
    try {
      if (!docPath) return { ok: false, message: '请先保存文档' }
      const safeExt = '.' + String(ext || 'png').replace(/[^a-z0-9]/gi, '').toLowerCase()
      const dir = join(dirname(docPath), 'assets')
      await mkdir(dir, { recursive: true })
      const stem = 'paste-' + new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
      let name = stem + safeExt
      let i = 1
      while (existsSync(join(dir, name))) name = `${stem}-${i++}${safeExt}`
      await writeFile(join(dir, name), Buffer.from(data))
      return { ok: true, relative: 'assets/' + name }
    } catch (err) {
      return { ok: false, message: String(err) }
    }
  })

  // 列出 assets/ 中未被文档引用的文件（引用集合由渲染层从文档内容提取）
  ipcMain.handle('assets:check', async (_e, { docPath, referenced }) => {
    try {
      if (!docPath) return { orphans: [], message: '请先保存文档' }
      const dir = join(dirname(docPath), 'assets')
      let names = []
      try {
        names = (await readdir(dir)).filter((n) => !n.startsWith('.'))
      } catch {
        return { orphans: [] }
      }
      const ref = new Set((referenced || []).map((r) => decodeURIComponent(String(r))))
      return { orphans: names.filter((n) => !ref.has(n)) }
    } catch (err) {
      return { orphans: [], message: String(err) }
    }
  })

  ipcMain.handle('assets:delete', async (_e, { docPath, names }) => {
    try {
      if (!docPath || !Array.isArray(names)) return { deleted: 0 }
      const dir = join(dirname(docPath), 'assets')
      let deleted = 0
      for (const n of names) {
        const safe = basename(String(n))
        if (!safe || safe.startsWith('.')) continue
        try {
          await rm(join(dir, safe))
          deleted++
        } catch {
          /* 单个删除失败跳过 */
        }
      }
      return { deleted }
    } catch (err) {
      return { deleted: 0, message: String(err) }
    }
  })

  ipcMain.handle('folder:open-dialog', async () => {
    const r = await dialog.showOpenDialog(win, {
      title: '打开文件夹',
      properties: ['openDirectory']
    })
    if (r.canceled || !r.filePaths.length) return { canceled: true }
    return { canceled: false, path: r.filePaths[0] }
  })

  ipcMain.handle('fs:list-dir', async (_e, p) => {
    try {
      const dirents = await readdir(p, { withFileTypes: true })
      const entries = []
      for (const d of dirents) {
        if (d.name.startsWith('.')) continue
        const full = join(p, d.name)
        if (d.isDirectory()) {
          entries.push({ name: d.name, path: full, isDir: true })
        } else if (MD_EXT_RE.test(d.name)) {
          entries.push({ name: d.name, path: full, isDir: false })
        }
      }
      entries.sort((a, b) =>
        a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name, 'zh-CN')
      )
      return { entries }
    } catch (err) {
      return { entries: [], message: String(err) }
    }
  })

  ipcMain.handle('link:open-external', async (_e, url) => {
    if (EXTERNAL_RE.test(url)) await shell.openExternal(url)
  })

  ipcMain.handle('link:open-local', async (_e, { href, docPath }) => openLocalHref(href, docPath))

  ipcMain.handle('file:save-as', async (_e, { content, name }) => {
    const r = await dialog.showSaveDialog(win, {
      title: '另存为',
      defaultPath: join(app.getPath('documents'), name || '未命名.md'),
      filters: MD_FILTERS
    })
    if (r.canceled || !r.filePath) return { canceled: true }
    await atomicWriteFile(r.filePath, content)
    await recent.push(r.filePath)
    rebuildMenu()
    return { canceled: false, path: r.filePath, name: basename(r.filePath), savedAt: Date.now() }
  })

  ipcMain.handle('export:save', async (_e, { data, name, ext, extName }) => {
    const r = await dialog.showSaveDialog(win, {
      title: '导出',
      defaultPath: join(app.getPath('documents'), name || 'export.' + (ext || 'png')),
      filters: [{ name: extName || ext || '文件', extensions: [ext || 'png'] }]
    })
    if (r.canceled || !r.filePath) return { canceled: true }
    await atomicWriteFile(r.filePath, Buffer.from(data))
    return { canceled: false, path: r.filePath }
  })

  // 静默导出 PDF：复用 @media print 样式（隐藏编辑器 chrome），不经打印对话框
  ipcMain.handle('pdf:export', async () => {
    if (!win) return { canceled: true }
    const r = await dialog.showSaveDialog(win, {
      title: '导出 PDF',
      defaultPath: join(app.getPath('documents'), (doc.fileName || '未命名').replace(MD_EXT_RE, '') + '.pdf'),
      filters: [{ name: 'PDF 文档', extensions: ['pdf'] }]
    })
    if (r.canceled || !r.filePath) return { canceled: true }
    const buf = await withTimeout(
      win.webContents.printToPDF({
        printBackground: true,
        pageSize: 'A4',
        // 0.625in = 60px（@96dpi），与渲染层打印版式 PAGE 常量一致，保证内容水平居中
        margins: { top: 0.625, bottom: 0.625, left: 0.625, right: 0.625 }
      }),
      30_000,
      '导出超时：渲染进程未响应，请重试'
    )
    await atomicWriteFile(r.filePath, buf)
    return { canceled: false, path: r.filePath }
  })

  ipcMain.on('doc:state', (_e, s) => {
    const prevPath = doc.filePath
    doc.dirty = !!s.dirty
    doc.anyDirty = !!s.anyDirty
    doc.filePath = s.filePath || null
    doc.fileName = s.fileName || ''
    if (win && !win.isDestroyed()) win.setTitle(windowTitle())
    // 菜单仅依赖 filePath（"在资源管理器中显示"可用性），避免每次 dirty 翻转都重建
    if ((s.filePath || null) !== prevPath) rebuildMenu()
  })

  ipcMain.handle('tab:confirm-close', async (_e, name) => {
    const { response } = await dialog.showMessageBox(win, {
      type: 'warning',
      title: '关闭标签',
      message: `是否保存对 "${name || '未命名'}" 的更改？`,
      buttons: ['保存', '不保存', '取消'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    return response
  })

  ipcMain.on('prefs:theme', (_e, t) => {
    prefs.theme = t
    rebuildMenu()
  })

  ipcMain.on('prefs:file-tree', (_e, on) => {
    prefs.showFileTree = !!on
    rebuildMenu()
  })

  ipcMain.handle('theme:source', (_e, t) => {
    nativeTheme.themeSource = t
    return nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
  })

  ipcMain.on('app:request-exit', () => {
    forceClose = true
    win?.close()
  })

  ipcMain.handle('perf:get', () => loadPerfConfig())
  ipcMain.handle('perf:set', async (_e, partial) => savePerfConfig(partial || {}))
  ipcMain.on('app:relaunch', () => {
    exiting = true
    forceClose = true
    app.relaunch()
    app.exit(0)
  })

  ipcMain.handle('metrics:get', () => {
    const r1 = (n) => Math.round(n * 10) / 10
    const processes = app.getAppMetrics().map((m) => ({
      type: m.type,
      pid: m.pid,
      memory: r1((m.memory?.workingSetSize || 0) / 1024),
      peak: r1((m.memory?.peakWorkingSetSize || 0) / 1024),
      cpu: r1(m.cpu?.percentCPUUsage || 0)
    }))
    return {
      time: Date.now(),
      uptime: Math.floor(process.uptime()),
      processes,
      total: r1(processes.reduce((s, p) => s + p.memory, 0))
    }
  })
}

function showMainWindow() {
  if (!win) {
    createWindow(null)
    return
  }
  if (win.isMinimized()) win.restore()
  win.show()
  win.focus()
}

function createTray() {
  const icon = nativeImage.createFromPath(TRAY_ICON)
  tray = new Tray(icon.isEmpty() ? nativeImage.createEmpty() : icon)
  tray.setToolTip('MdReader - Markdown 编辑器')
  const menu = Menu.buildFromTemplate([
    { label: '显示 / 隐藏窗口', click: () => toggleMainWindow() },
    { label: '新建文件', click: () => { showMainWindow(); send('menu:action', 'file:new') } },
    { type: 'separator' },
    {
      label: '退出',
      click: () => {
        exiting = true
        forceClose = false
        if (win) win.close()
        else app.quit()
      }
    }
  ])
  tray.setContextMenu(menu)
  tray.on('click', () => toggleMainWindow())
}

function toggleMainWindow() {
  if (!win) {
    createWindow(null)
    return
  }
  if (win.isVisible() && !win.isMinimized()) {
    releaseRendererMemory()
    win.hide()
  } else showMainWindow()
}

const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_e, argv) => {
    const p = pathFromArgv(argv)
    if (p) send('doc:open-path', p)
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })

  app.whenReady().then(async () => {
    app.setAppUserModelId('com.qiuyj.mdreader')
    recent = new RecentFiles()
    await recent.load()
    registerIpc()
    rebuildMenu()
    createWindow(pathFromArgv(process.argv))
    createTray()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow(null)
    })
  })

  app.on('before-quit', () => {
    exiting = true
    try {
      tray?.destroy()
    } catch {
      /* ignore */
    }
    tray = null
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
