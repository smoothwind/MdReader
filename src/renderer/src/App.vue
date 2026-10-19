<script setup>
import { onBeforeUnmount, onMounted, nextTick, reactive, ref, watch } from 'vue'
import { store, getActive, createTab, welcomeDoc } from './store'
import { setupTheme } from './composables/useTheme'
import TabBar from './components/TabBar.vue'
import SettingsDialog from './components/SettingsDialog.vue'
import { UxButton, UxContextMenuHost } from '@ux/components'
import { TourGuide } from '@ux/patterns'
import { TOUR_STEPS } from './tour'
import StatusBar from './components/StatusBar.vue'
import EditorPane from './components/EditorPane.vue'
import TocPanel from './components/TocPanel.vue'
import FileTreePanel from './components/FileTreePanel.vue'
import { IMAGE_RE, stripMdExt } from './utils/file'
import { idbGet, idbSet } from './utils/idb'
import { useUpdateCheck } from './composables/useUpdateCheck'

setupTheme()

// 会话恢复为异步（IndexedDB）；编辑器初始化完成后还原标签
restoreSession()

const AUTOSAVE_INTERVAL_MS = 30_000
const SESSION_INTERVAL_MS = 5_000
const UNNAMED = '未命名'
const LEGACY_SESSION_KEY = 'mdreader:session'

/** 恢复会话：优先 IndexedDB（无配额上限），兼容读取旧 localStorage 快照并迁移 */
async function restoreSession() {
  let data = null
  try {
    data = await idbGet('session')
  } catch {
    /* IDB 不可用时忽略 */
  }
  if (!data) {
    try {
      const raw = localStorage.getItem(LEGACY_SESSION_KEY)
      if (raw) data = JSON.parse(raw)
    } catch {
      /* ignore */
    }
  }
  if (!data || (!data.tabs?.length && typeof data.activeIndex !== 'number')) return
  for (const t of data.tabs || []) {
    const tab = createTab(t.filePath || null, t.fileName || '', t.content || '')
    tab.scrollTop = t.scrollTop || 0
    tab.dirty = !!t.dirty
  }
  const idx = data.activeIndex
  if (Number.isInteger(idx) && store.tabs[idx]) store.activeId = store.tabs[idx].id
  localStorage.removeItem(LEGACY_SESSION_KEY)
}

const editorRef = ref(null)
const settingsOpen = ref(false)
const tourOpen = ref(false)
const aboutOpen = ref(false)
const confirmBox = reactive({
  visible: false,
  title: '',
  message: '',
  buttons: [],
  resolve: null
})
const disposers = []

/**
 * 通用确认框：buttons 为 [{ label, value, primary, cancel }]
 * Esc / 点击遮罩触发 cancel 标记的按钮（未标记时取最后一个）
 */
function confirmDialog(title, message, buttons) {
  return new Promise((resolve) => {
    confirmBox.title = title
    confirmBox.message = message
    confirmBox.buttons = buttons
    confirmBox.visible = true
    confirmBox.resolve = resolve
    nextTick(() => {
      confirmLayerEl.value?.focus()
    })
  })
}

function cancelValue() {
  return (
    confirmBox.buttons.find((b) => b.cancel)?.value ??
    confirmBox.buttons[confirmBox.buttons.length - 1]?.value
  )
}

function confirmClose(message) {
  return confirmDialog('关闭标签', message, [
    { label: '取消', value: 2, cancel: true },
    { label: '不保存', value: 1 },
    { label: '保存', value: 0, primary: true }
  ])
}

const confirmLayerEl = ref(null)
const aboutLayerEl = ref(null)

const appVersion = String(__APP_VERSION__)
const {
  latest: updateLatest,
  checking: updateChecking,
  upToDate: updateUpToDate,
  lastError: updateLastError,
  check: checkUpdate,
  dismiss: dismissUpdate,
  openReleases: openReleasePage
} = useUpdateCheck()

watch(aboutOpen, (v) => {
  if (v) nextTick(() => aboutLayerEl.value?.focus())
})

function onConfirmKeydown(e) {
  if (!confirmBox.visible) return
  if (e.key === 'Escape') {
    e.preventDefault()
    resolveConfirm(cancelValue())
  } else if (e.key === 'Enter') {
    e.preventDefault()
    resolveConfirm(confirmBox.buttons.find((b) => b.primary)?.value ?? confirmBox.buttons[0]?.value)
  }
}

function resolveConfirm(v) {
  confirmBox.visible = false
  const r = confirmBox.resolve
  confirmBox.resolve = null
  r?.(v)
}

function finishTour() {
  localStorage.setItem('mdreader:tour-done', '1')
  tourOpen.value = false
}

function cycleTheme() {
  store.theme = store.theme === 'dark' ? 'light' : 'dark'
}

function notify(msg) {
  editorRef.value?.notify(msg)
}

function openTabFromFile(f) {
  const existing = store.tabs.find((t) => t.filePath === f.path)
  if (existing) {
    switchTab(existing.id)
    return
  }
  createTab(f.path, f.name, f.content)
}

function switchTab(id) {
  if (id === store.activeId) return
  const prev = getActive()
  if (prev) prev.scrollTop = editorRef.value?.getScrollTop() ?? 0
  store.activeId = id
}

function newFile() {
  createTab(null, '', '')
}

async function openFile() {
  let r
  try {
    r = await window.mdreader.openDialog()
  } catch (err) {
    notify('打开文件失败：' + (err?.message || err))
    return
  }
  if (!r.canceled) openTabFromFile(r)
}

async function readPath(p) {
  try {
    openTabFromFile(await window.mdreader.readPath(p))
  } catch (err) {
    console.error('读取文件失败:', p, err)
    notify('打开文件失败：' + (err?.message || err))
  }
}

/** 保存单个标签，失败抛错（错误已提示），成功返回 true */
async function saveTab(tab) {
  try {
    if (!tab.filePath) {
      const r = await window.mdreader.saveAs(tab.content, tab.fileName || UNNAMED + '.md')
      if (r.canceled) return false
      tab.filePath = r.path
      tab.fileName = r.name
      tab.savedAt = r.savedAt
    } else {
      const r = await window.mdreader.save(tab.filePath, tab.content)
      tab.savedAt = r.savedAt
    }
    tab.dirty = false
    return true
  } catch (err) {
    notify(`保存 “${tab.fileName || UNNAMED}” 失败：${err?.message || err}`)
    return false
  }
}

async function closeTab(id) {
  const tab = store.tabs.find((t) => t.id === id)
  if (!tab) return
  if (tab.dirty) {
    const response = await confirmClose(`是否保存对 “${tab.fileName || UNNAMED}” 的更改？`)
    if (response === 2) return
    if (response === 0) {
      if (!(await saveTab(tab))) return
    }
  }
  const idx = store.tabs.findIndex((t) => t.id === id)
  store.tabs.splice(idx, 1)
  if (store.activeId === id) {
    const next = store.tabs[Math.min(idx, store.tabs.length - 1)]
    store.activeId = next ? next.id : null
  }
}

/** 批量关闭：逐个走 closeTab，保留脏文档保存/取消守卫（顺序执行，避免并发弹窗） */
async function closeMany(ids) {
  for (const id of ids) {
    if (!store.tabs.some((t) => t.id === id)) continue
    await closeTab(id)
  }
}
function closeOtherTabs(id) {
  closeMany(store.tabs.filter((t) => t.id !== id).map((t) => t.id))
}
function closeTabsRight(id) {
  const i = store.tabs.findIndex((t) => t.id === id)
  if (i >= 0) closeMany(store.tabs.slice(i + 1).map((t) => t.id))
}
function closeTabsLeft(id) {
  const i = store.tabs.findIndex((t) => t.id === id)
  if (i >= 0) closeMany(store.tabs.slice(0, i).map((t) => t.id))
}
function closeAllTabs() {
  closeMany(store.tabs.map((t) => t.id))
}

async function saveFile() {
  const tab = getActive()
  if (!tab) return
  await saveTab(tab)
}

async function saveFileAs() {
  const tab = getActive()
  if (!tab) return
  if (!tab.filePath) return saveTab(tab)
  try {
    const r = await window.mdreader.saveAs(tab.content, tab.fileName || UNNAMED + '.md')
    if (r.canceled) return
    tab.filePath = r.path
    tab.fileName = r.name
    tab.dirty = false
    tab.savedAt = r.savedAt
  } catch (err) {
    notify('另存为失败：' + (err?.message || err))
  }
}

/** 保存全部脏标签后退出；任一保存失败（含用户取消）则停留，不丢数据 */
async function saveAllAndExit() {
  persistSession()
  for (const tab of store.tabs.filter((t) => t.dirty)) {
    if (!(await saveTab(tab))) return
  }
  window.mdreader.requestExit()
}

function escapeHtmlText(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

function docHtmlBody() {
  const tab = getActive()
  const body = editorRef.value?.getHtml() || ''
  const title = tab?.fileName || UNNAMED
  return { tab, body, title }
}

const DOC_CSS = [
  'body{max-width:860px;margin:32px auto;padding:0 20px;font-family:"Segoe UI","Microsoft YaHei",sans-serif;color:#24292f;line-height:1.7;}',
  'pre{background:#f6f8fa;padding:12px;border-radius:8px;overflow:auto;}',
  'code{font-family:Consolas,monospace;}',
  'table{border-collapse:collapse;}th,td{border:1px solid #d0d7de;padding:6px 12px;}',
  'img{max-width:100%;}',
  'blockquote{border-left:4px solid #d0d7de;margin:0;padding:0 16px;color:#57606a;}',
  'h1,h2,h3,h4{border-bottom:1px solid #eaeef2;padding-bottom:6px;}'
].join('\n')

async function exportHtml() {
  const { title, body } = docHtmlBody()
  const html = [
    '<!DOCTYPE html>',
    '<html lang="zh-CN">',
    '<head>',
    '<meta charset="UTF-8">',
    '<title>' + escapeHtmlText(title) + '</title>',
    '<style>',
    DOC_CSS,
    '</style>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>'
  ].join('\n')
  await exportBytes(new TextEncoder().encode(html), stripMdExt(title) + '.html', 'html', 'HTML 页面', '已导出 HTML')
}

/** 导出 Word：HTML 包装为 Word 可直接打开的 .doc（MHTML 兼容头） */
async function exportWord() {
  const { title, body } = docHtmlBody()
  const html = [
    '<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word">',
    '<head>',
    '<meta charset="UTF-8">',
    '<!--[if gte mso 9]><xml><w:WordDocument><w:View>Print</w:View></w:WordDocument></xml><![endif]-->',
    '<style>',
    DOC_CSS,
    '@page{size:A4;margin:2cm;}',
    '</style>',
    '</head>',
    '<body>',
    body,
    '</body>',
    '</html>'
  ].join('\n')
  await exportBytes(new TextEncoder().encode(html), stripMdExt(title) + '.doc', 'doc', 'Word 文档', '已导出 Word 文档')
}

/** 导出整篇长图（渲染内容整体截图，超长文档受 Canvas 高度限制） */
async function exportImage() {
  const { title } = docHtmlBody()
  const ok = await editorRef.value?.exportDocImage(stripMdExt(title))
  if (ok) notify('已导出长图')
}

async function exportBytes(data, name, ext, extName, okMsg) {
  try {
    const r = await window.mdreader.exportSave({ data, name, ext, extName })
    if (!r.canceled) notify(okMsg)
  } catch (err) {
    notify('导出失败：' + (err?.message || err))
  }
}

/** 静默导出 PDF；运行时不支持时降级为系统打印（可另存 PDF） */
async function exportPdf() {
  try {
    const r = await window.mdreader.exportPdf?.()
    if (r?.unsupported) {
      notify('当前运行时不支持静默导出，已打开打印（可另存为 PDF）')
      window.print()
      return
    }
    if (!r.canceled) notify('已导出 PDF')
  } catch (err) {
    notify('导出失败：' + (err?.message || err))
  }
}

const menuActions = {
  'file:new': newFile,
  'file:open': openFile,
  'file:save': saveFile,
  'file:save-as': saveFileAs,
  'file:export-image': () => exportImage(),
  'file:export-word': () => exportWord(),
  'insert:mindmap': () => editorRef.value?.insertMindmap(),
  'edit:find': () => editorRef.value?.openSearch(false),
  'edit:replace': () => editorRef.value?.openSearch(true),
  'fmt:bold': () => editorRef.value?.execFormat('bold'),
  'fmt:italic': () => editorRef.value?.execFormat('italic'),
  'fmt:underline': () => editorRef.value?.execFormat('underline'),
  'fmt:strikeThrough': () => editorRef.value?.execFormat('strikeThrough'),
  'fmt:superscript': () => editorRef.value?.execFormat('superscript'),
  'fmt:subscript': () => editorRef.value?.execFormat('subscript'),
  'fmt:highlight': () => editorRef.value?.execHighlight(),
  'fmt:wavy': () => editorRef.value?.execWavy(),
  'fmt:removeFormat': () => editorRef.value?.execFormat('removeFormat'),
  'file:export-html': () => exportHtml(),
  'file:export-pdf': () => exportPdf(),
  'file:print': () => window.print(),
  'view:doc-source': () => editorRef.value?.showDocSource(),
  'view:file-tree': () => (store.showFileTree = !store.showFileTree),
  'help:changelog': () => editorRef.value?.showChangelog(),
  about: () => (aboutOpen.value = true)
}

function openChangelog() {
  aboutOpen.value = false
  editorRef.value?.showChangelog()
}

let lastSessionJson = ''
let persistInFlight = false

/** 会话快照写入 IndexedDB（无 4MB 限制）；内容未变化时跳过 */
async function persistSession() {
  if (persistInFlight) return
  try {
    const activeIndex = store.tabs.findIndex((t) => t.id === store.activeId)
    const data = {
      activeIndex,
      tabs: store.tabs.map((t) => ({
        filePath: t.filePath,
        fileName: t.fileName,
        content: t.content,
        scrollTop: t.scrollTop,
        dirty: t.dirty
      }))
    }
    const json = JSON.stringify(data)
    if (json === lastSessionJson) return
    persistInFlight = true
    try {
      await idbSet('session', json)
      lastSessionJson = json
    } finally {
      persistInFlight = false
    }
  } catch {
    /* 写入失败静默跳过，下个周期重试 */
  }
}

function autosaveEnabled() {
  return localStorage.getItem('mdreader:autosave') !== '0'
}

async function autosaveTick() {
  if (!autosaveEnabled()) return
  for (const t of [...store.tabs]) {
    if (t.dirty && t.filePath) {
      try {
        const r = await window.mdreader.save(t.filePath, t.content)
        t.dirty = false
        t.savedAt = r.savedAt
        t.autosaveFailed = false
      } catch {
        /* 失败提示一次，避免每 30 秒刷屏；成功后复位 */
        if (!t.autosaveFailed) {
          t.autosaveFailed = true
          notify(`自动保存 “${t.fileName || UNNAMED}” 失败，将在下个周期重试`)
        }
      }
    }
  }
}

async function importDroppedImage(src) {
  const tab = getActive()
  if (!tab) return
  if (!tab.filePath) {
    editorRef.value?.notify('请先保存文档，再插入图片')
    return
  }
  let r
  try {
    r = await window.mdreader.importAsset?.(src, tab.filePath)
  } catch (err) {
    r = { ok: false, message: err?.message || String(err) }
  }
  if (r?.ok) editorRef.value?.insertImage(r.relative)
  else editorRef.value?.notify(r?.message || '图片导入失败')
}

/** 编辑器内粘贴图片：保存到文档旁 assets/ 并插入相对引用 */
async function pasteImageBytes(data, ext) {
  const tab = getActive()
  if (!tab) return
  if (!tab.filePath) {
    notify('请先保存文档，再粘贴图片')
    return
  }
  try {
    const r = await window.mdreader.saveImageAsset(tab.filePath, data, ext)
    if (r?.ok) editorRef.value?.insertImage(r.relative)
    else notify(r?.message || '图片保存失败')
  } catch (err) {
    notify('图片保存失败：' + (err?.message || err))
  }
}

/** 外部修改检测：文件被其他程序改动后提示/自动重载 */
async function onExternalFileChanged(p) {
  const tab = store.tabs.find((t) => t.filePath === p)
  if (!tab) return
  let disk
  try {
    disk = await window.mdreader.readPath(p, { skipRecent: true })
  } catch {
    return
  }
  if (disk.content === tab.content) return
  if (!tab.dirty) {
    applyExternalContent(tab, disk.content)
    notify(`“${tab.fileName}” 已被外部程序修改，已重新加载`)
    return
  }
  const v = await confirmDialog(
    '文件已在外部修改',
    `“${tab.fileName}” 在磁盘上已被其他程序修改，当前有未保存更改。是否用磁盘版本覆盖当前内容？`,
    [
      { label: '忽略', value: 0, cancel: true },
      { label: '重新加载', value: 1, primary: true }
    ]
  )
  if (v === 1) applyExternalContent(tab, disk.content)
}

function applyExternalContent(tab, content) {
  tab.content = content
  tab.dirty = false
  tab.savedAt = Date.now()
  if (tab.id === store.activeId) {
    const st = editorRef.value?.getScrollTop() ?? 0
    editorRef.value?.setContent(content, st)
  }
}

/** 错误日志：崩溃与未捕获 Promise 落盘到 userData/logs，便于排查 */
function setupErrorLogging() {
  const report = (level, message, stack) => {
    try {
      window.mdreader.appendLog?.({ level, message, stack })?.catch?.(() => {})
    } catch {
      /* ignore */
    }
  }
  window.addEventListener('error', (e) => report('error', e.message || 'Script error', e.error?.stack || ''))
  window.addEventListener('unhandledrejection', (e) => {
    const r = e.reason
    report('error', String(r?.message || r), r?.stack || '')
  })
}

onMounted(() => {
  setupErrorLogging()
  if (!localStorage.getItem('mdreader:tour-done')) {
    setTimeout(() => (tourOpen.value = true), 500)
  }
  // 启动静默检查更新（网络失败无痕），4 秒延迟避开首屏
  const updateTimer = setTimeout(() => checkUpdate({ silent: true }), 4000)
  const dragPrevent = (e) => {
    e.preventDefault()
    e.stopPropagation()
  }
  const onDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    const file = e.dataTransfer?.files?.[0]
    if (!file) return
    const p = window.mdreader.pathForFile(file)
    if (!p) return
    if (IMAGE_RE.test(p)) importDroppedImage(p)
    else readPath(p)
  }
  window.addEventListener('dragover', dragPrevent, true)
  window.addEventListener('drop', onDrop, true)
  window.addEventListener('beforeunload', persistSession)
  window.addEventListener('contextmenu', (e) => e.preventDefault())

  const sessionTimer = setInterval(persistSession, SESSION_INTERVAL_MS)
  const autosaveTimer = setInterval(autosaveTick, AUTOSAVE_INTERVAL_MS)

  disposers.push(
    () => window.removeEventListener('dragover', dragPrevent, true),
    () => window.removeEventListener('drop', onDrop, true),
    () => window.removeEventListener('beforeunload', persistSession),
    () => clearTimeout(updateTimer),
    () => clearInterval(sessionTimer),
    () => clearInterval(autosaveTimer),
    window.mdreader.onMenuAction((name, payload) => {
      if (name === 'theme') store.theme = payload === 'dark' ? 'dark' : 'light'
      else menuActions[name]?.()
    }),
    window.mdreader.onOpenPath(readPath),
    window.mdreader.onOpenRecent(readPath),
    window.mdreader.onDropImage?.(importDroppedImage),
    window.mdreader.onFileChanged?.(onExternalFileChanged),
    window.mdreader.onRequestSaveExit(saveAllAndExit)
  )
})

onBeforeUnmount(() => {
  disposers.forEach((d) => d())
})

watch(
  () => [store.tabs.map((t) => t.id + ':' + (t.dirty ? 1 : 0)).join(','), store.activeId],
  () => {
    const tab = getActive()
    window.mdreader.reportState({
      dirty: !!tab?.dirty,
      anyDirty: store.tabs.some((t) => t.dirty),
      filePath: tab?.filePath || null,
      fileName: tab?.fileName || ''
    })
  },
  { immediate: true }
)

watch(
  () => store.showFileTree,
  (v) => window.mdreader.reportFileTree?.(v),
  { immediate: true }
)

// 所有打开文档的路径集合 → 主进程外部修改轮询（不限于活动标签）
watch(
  () =>
    store.tabs
      .filter((t) => t.filePath)
      .map((t) => t.filePath)
      .join('\n'),
  (v) => window.mdreader.setWatchPaths?.(v ? v.split('\n') : []),
  { immediate: true }
)

watch(
  () => store.activeId,
  () => {
    const tab = getActive()
    editorRef.value?.setContent(tab ? tab.content : welcomeDoc, tab ? tab.scrollTop : 0)
  }
)
</script>

<template>
  <div class="app">
    <TabBar
      @select="switchTab"
      @close="closeTab"
      @close-others="closeOtherTabs"
      @close-right="closeTabsRight"
      @close-left="closeTabsLeft"
      @close-all="closeAllTabs"
      @new="newFile"
      @open="openFile"
      @save="saveFile"
      @insert-mindmap="editorRef?.insertMindmap()"
      @cycle-theme="cycleTheme"
      @open-settings="settingsOpen = true"
      @open-tour="tourOpen = true"
      @toggle-file-tree="store.showFileTree = !store.showFileTree"
    />
    <main class="editor-wrap">
      <FileTreePanel
        v-if="store.showFileTree"
        @open="readPath"
        @close="store.showFileTree = false"
      />
      <EditorPane ref="editorRef" :theme="store.theme" @paste-image="pasteImageBytes" />
    </main>
    <TocPanel @jump="(id) => editorRef?.scrollToHeading(id)" />
    <StatusBar />
    <SettingsDialog v-if="settingsOpen" @close="settingsOpen = false" />
    <TourGuide
      v-if="tourOpen"
      :steps="TOUR_STEPS"
      label="MdReader 使用引导"
      @done="finishTour"
    />
    <div
      v-if="confirmBox.visible"
      ref="confirmLayerEl"
      class="md-source-layer"
      style="z-index: 2400"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="confirmBox.title"
      @mousedown.self="resolveConfirm(cancelValue())"
      @keydown="onConfirmKeydown"
    >
      <div class="md-source-box confirm-box">
        <div class="md-source-head"><span>{{ confirmBox.title || '确认' }}</span></div>
        <div class="confirm-msg">{{ confirmBox.message }}</div>
        <div class="md-source-foot">
          <UxButton
            v-for="(b, i) in confirmBox.buttons"
            :key="i"
            size="sm"
            :variant="b.primary ? 'primary' : 'secondary'"
            @click="resolveConfirm(b.value)"
          >
            {{ b.label }}
          </UxButton>
        </div>
      </div>
    </div>
    <div
      v-if="updateLatest && !settingsOpen && !aboutOpen"
      class="update-banner"
      style="z-index: 2300"
      role="status"
      aria-live="polite"
    >
      <span class="update-banner-text">
        发现新版本 <b>{{ updateLatest.tag }}</b>（当前 {{ appVersion }}）
      </span>
      <button class="update-banner-go" title="打开 GitHub 下载页" @click="openReleasePage">去下载</button>
      <button class="update-banner-x" title="本次会话不再提示" @click="dismissUpdate">✕</button>
    </div>
    <div
      v-if="aboutOpen"
      ref="aboutLayerEl"
      class="md-source-layer"
      style="z-index: 2400"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      aria-label="关于 MdReader"
      @mousedown.self="aboutOpen = false"
      @keydown.esc="aboutOpen = false"
    >
      <div class="md-source-box about-box">
        <div class="md-source-head"><span>关于 MdReader</span></div>
        <div class="confirm-msg">
          <div class="about-brand">MdReader</div>
          <p class="about-line">所见即所得的 Markdown 桌面编辑器。</p>
          <p class="about-line">支持实时渲染、Mermaid 图表、脑图画布、主题切换与全类型源码视图。</p>
          <p class="about-line">基于 Vue 3 + Vditor，提供 Electron 与 Tauri 2 两种运行方案。</p>
          <p class="about-line about-version">当前版本 {{ appVersion }}</p>
          <div class="about-update">
            <button class="update-banner-go" :disabled="updateChecking" @click="checkUpdate()">
              {{ updateChecking ? '检查中…' : '检查更新' }}
            </button>
            <button v-if="updateLatest" class="update-banner-go" @click="openReleasePage">
              去下载 {{ updateLatest.tag }}
            </button>
            <span v-if="updateLatest" class="about-note">发现新版本 {{ updateLatest.tag }}</span>
            <span v-else-if="updateUpToDate" class="about-note">已是最新版本</span>
            <span v-else-if="updateLastError" class="about-note about-note-err">检查失败，请确认网络可访问 GitHub</span>
          </div>
        </div>
        <div class="md-source-foot">
          <UxButton size="sm" variant="secondary" @click="openChangelog">查看更新日志</UxButton>
          <UxButton size="sm" variant="primary" @click="aboutOpen = false">关闭</UxButton>
        </div>
      </div>
    </div>
    <UxContextMenuHost />
  </div>
</template>
