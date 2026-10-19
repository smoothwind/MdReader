/**
 * web-mdreader.js — 纯浏览器（GitHub Pages 演示版）的 window.mdreader 降级实现
 *
 * 仅在既非 Electron（preload 已注入）也非 Tauri（tauri-mdreader.js 已注入）时生效。
 * 文档读写走 localStorage 虚拟空间（web:<文件名>），导出/另存为通过浏览器下载落地，
 * 文件系统相关的原生能力（文件夹树、图片资产、进程监控）给出明确的不可用语义。
 * 与 preload / tauri 适配器保持同一接口契约（方法名、参数、返回结构、事件通道名）。
 */

const DOCS_KEY = 'mdreader:web:docs'

function loadDocs() {
  try {
    return JSON.parse(localStorage.getItem(DOCS_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

function saveDocs(docs) {
  try {
    localStorage.setItem(DOCS_KEY, JSON.stringify(docs))
  } catch {
    /* 配额不足时静默失败 */
  }
}

function download(bytes, name) {
  const blob = new Blob([bytes instanceof Uint8Array ? bytes : Uint8Array.from(bytes)], {
    type: 'application/octet-stream'
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 10_000)
}

const noop = () => {}
const noopDispose = () => noop
const UNSUPPORTED_IMAGE = { ok: false, message: 'Web 演示版暂不支持插入本地图片，请使用桌面版' }

if (typeof window !== 'undefined' && !window.mdreader) {
  window.mdreader = {
    runtime: 'web',

    openDialog: () =>
      new Promise((resolve) => {
        const input = document.createElement('input')
        input.type = 'file'
        input.accept = '.md,.markdown,.txt'
        input.style.display = 'none'
        input.addEventListener('change', async () => {
          const file = input.files?.[0]
          if (!file) {
            resolve({ canceled: true })
            return
          }
          const content = await file.text()
          resolve({ path: 'web:' + file.name, name: file.name, content })
        })
        window.addEventListener('focus', () => setTimeout(() => input.remove(), 500), { once: true })
        document.body.appendChild(input)
        input.click()
      }),

    readPath: (path) => {
      const docs = loadDocs()
      const name = String(path || '').replace(/^web:/, '')
      if (!(name in docs)) return Promise.reject(new Error('文档不存在：' + name))
      return Promise.resolve({ path: 'web:' + name, name, content: docs[name] })
    },

    openExternal: (url) => {
      window.open(url, '_blank', 'noopener,noreferrer')
      return Promise.resolve()
    },

    openLocalLink: (href) => {
      const name = String(href || '').replace(/^\.\//, '')
      if (!name.endsWith('.md')) {
        window.open(href, '_blank', 'noopener,noreferrer')
        return Promise.resolve()
      }
      const docs = loadDocs()
      if (name in docs) {
        // 交回渲染层的 onOpenPath 流程（读盘 → 开标签）
        window.dispatchEvent(new CustomEvent('mdreader:web-open', { detail: 'web:' + name }))
        return Promise.resolve()
      }
      window.alert('演示版没有该文档：' + name)
      return Promise.resolve()
    },

    save: (path, content) => {
      const docs = loadDocs()
      const name = String(path || '').replace(/^web:/, '')
      docs[name] = content
      saveDocs(docs)
      return Promise.resolve({ savedAt: Date.now() })
    },

    saveAs: (content, name) => {
      const fileName = String(name || '未命名.md')
      download(new TextEncoder().encode(content), fileName)
      const docs = loadDocs()
      docs[fileName] = content
      saveDocs(docs)
      return Promise.resolve({ path: 'web:' + fileName, name: fileName, savedAt: Date.now() })
    },

    exportSave: (payload) => {
      download(payload?.data || [], payload?.name || 'export.bin')
      return Promise.resolve({ canceled: false, savedAt: Date.now() })
    },

    // WebView 与桌面端不同：无静默 PDF 能力，渲染层会降级走 window.print()
    exportPdf: () => Promise.resolve({ unsupported: true }),

    importAsset: () => Promise.resolve(UNSUPPORTED_IMAGE),
    saveImageAsset: () => Promise.resolve(UNSUPPORTED_IMAGE),

    openFolderDialog: () => Promise.resolve({ canceled: true }),
    listDir: () => Promise.resolve({ entries: [] }),
    checkAssets: () => Promise.resolve({ orphans: [] }),
    deleteAssets: () => Promise.resolve({ deleted: 0 }),
    setWatchPaths: noop,

    appendLog: (entry) => {
      const level = String(entry?.level || 'error')
      const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log
      fn('[mdreader]', entry?.message, entry?.stack || '')
      return Promise.resolve()
    },

    pathForFile: () => undefined,

    reportState: noop,
    reportTheme: noop,
    reportFileTree: noop,
    setThemeSource: noop,
    requestExit: noop,
    relaunchApp: noop,

    getPerfConfig: () => Promise.resolve(null),
    setPerfConfig: () => Promise.resolve(),
    getMetrics: () => Promise.resolve({ processes: [], total: 0 }),

    onMenuAction: () => noopDispose,
    onOpenPath: (cb) => {
      const h = (e) => cb(e.detail)
      window.addEventListener('mdreader:web-open', h)
      return () => window.removeEventListener('mdreader:web-open', h)
    },
    onOpenRecent: () => noopDispose,
    onDropImage: () => noopDispose,
    onFileChanged: () => noopDispose,
    onRequestSaveExit: () => noopDispose
  }
}
