<script setup>
import { defineAsyncComponent, nextTick, onBeforeUnmount, onMounted, reactive, ref, watch } from 'vue'
import Vditor from 'vditor'
import {
  Copy, Pencil, Image, FileSpreadsheet,
  Paintbrush, Sparkles, Minimize2, ImageDown, X,
  CircleCheck, CircleX, FileCode,
  ExternalLink, Link2, RotateCcw
} from 'lucide-vue-next'
import 'vditor/dist/index.css'
import { store, getActive, welcomeDoc } from '../store'
import SearchPanel from './SearchPanel.vue'
import { UxButton, openContextMenuAt } from '@ux/components'
import SelectionBar from './SelectionBar.vue'
import { useSearch } from '../composables/useSearch'
import { useSelectionBar } from '../composables/useSelectionBar'
import { useToc } from '../composables/useToc'
import { useLinkEdit } from '../composables/useLinkEdit'
import { useBlockSourceEdit } from '../composables/useBlockSourceEdit'
import { useMarkmapZoom } from '../composables/useMarkmapZoom'
import { useTableStyles } from '../composables/useTableStyles'
import { useCodeBadge } from '../composables/useCodeBadge'
import { useBlockExports } from '../composables/useBlockExports'
import { computeStats, tableToMarkdown, replaceCodeBlockInMd } from '../utils/markdown-utils'
import { formatCode } from '../utils/code-format'
import { stripMdExt } from '../utils/file'
import {
  MERMAID_PANEL_SEL,
  recoverDiagramSource,
  recoverCodeSource,
  codeBlockText,
  genericBlockFrom,
  langOfBlock,
  findHit
} from '../utils/dom-blocks'
import { publicPath } from '../utils/assets'
const MindMapEditor = defineAsyncComponent(() => import('./MindMapEditor.vue'))

const props = defineProps({
  theme: { type: String, default: 'light' }
})

const emit = defineEmits(['paste-image'])

// ---------- 常量（此前散落的魔法值） ----------
const BAR_HIDE_MS = 200
const HIT_PAD_PX = 14
const LINK_HOVER_MS = 120
const TOC_DEBOUNCE_MS = 150
const SCROLL_SETTLE_MS = 150
const BIG_DOC_CHARS = 200000
const BIG_DOC_HINT_COOLDOWN_MS = 60000

const host = ref(null)
const barRef = ref(null)
const mmEditorRef = ref(null)
const mmEditorVisible = ref(false)
let vditor = null
let ready = false
let pendingValue = null
let styleObserver = null
let styleDirty = false
let hideTimer = null
let linkHoverTimer = null
let tocTimer = null
let scrollTimer = null
let scrollRaf = 0
const lastMouse = { x: 0, y: 0, seen: false }
let pendingScroll = 0

let scrollerCache = null

function getScroller() {
  const hostEl = host.value
  if (!hostEl) return null
  if (scrollerCache && scrollerCache.isConnected) return scrollerCache
  scrollerCache =
    [...hostEl.querySelectorAll('*')].find(
      (el) => el.scrollHeight > el.clientHeight + 5 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
    ) || null
  return scrollerCache
}

function getScrollTop() {
  const sc = getScroller()
  return sc ? sc.scrollTop : 0
}

const codeStyle = (t) => (t === 'dark' ? 'vs2015' : 'github')

const bar = reactive({ visible: false, x: 0, y: 0, type: null, language: null, index: -1, blockIndex: -1, url: '', anchorOk: null, md: '', text: '', el: null })
const styleMenu = reactive({ visible: false, x: 0, y: 0 })

function rootEl() {
  return ready ? host.value : null
}

// ---------- composable 实例（依赖见各 composable 注释） ----------

const tocApi = useToc({ getRootEl: rootEl })
const linkEditApi = useLinkEdit({ notify, syncDoc: syncDocAfterDomEdit })
const blockSrcApi = useBlockSourceEdit({ notify, syncDoc: syncDocAfterDomEdit })
const {
  DEFAULT_TABLE_STYLE,
  TABLE_STYLES,
  applyRememberedStyles,
  applyStyle
} = useTableStyles({ getRootEl: rootEl, getActiveDoc: getActive })

const activeStyle = ref(DEFAULT_TABLE_STYLE)

const { codeBadge, updateCodeBadge } = useCodeBadge({ getBar: () => bar })
const {
  mmCtl,
  mmUpdate,
  mmZoom,
  mmReset,
  dispose: disposeMarkmapZoom
} = useMarkmapZoom({ getBar: () => bar })
const {
  exportCodeImage,
  exportTableImage,
  exportTableExcel,
  exportMermaidPng,
  exportMarkmapPng,
  exportDocImage
} = useBlockExports({
  resolveTable,
  resolveMermaidPanel,
  resolveCodeBlock,
  getBar: () => bar,
  getRootEl: rootEl,
  baseName,
  themeBg,
  notify
})

function refreshStats(text) {
  store.stats = computeStats(text)
}

function themeBg() {
  // 导出背景取主题令牌（tokens.css --bg），运行时随主题自动切换；回退保留旧值
  const v = getComputedStyle(document.documentElement).getPropertyValue('--bg').trim()
  return v || (props.theme === 'dark' ? '#1f2430' : '#ffffff') // tokens-exempt: var 读取失败回退
}

function baseName() {
  return stripMdExt(getActive()?.fileName || '未命名')
}

function notify(msg) {
  if (vditor) vditor.tip(msg)
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    let ok = false
    try {
      ok = document.execCommand('copy')
    } catch {
      /* ignore */
    }
    ta.remove()
    return ok
  }
}

function rerenderMermaid(theme) {
  const root = rootEl()
  if (!root) return
  root.querySelectorAll(MERMAID_PANEL_SEL).forEach((panel) => {
    const block = panel.closest('[data-type="code-block"]')
    if (block && isSourceMode(block)) return
    const mermaidCode = panel.querySelector('.language-mermaid')
    const markmapCode = panel.querySelector('.language-markmap')
    if (!mermaidCode && !markmapCode) return
    const lang = markmapCode ? 'markmap' : 'mermaid'
    const code = markmapCode || mermaidCode
    const source = recoverDiagramSource(panel, lang)
    if (!source) return
    code.removeAttribute('data-processed')
    code.innerHTML = ''
    code.textContent = source
    if (lang === 'markmap') {
      Vditor.markmapRender(panel, './vditor')
    } else {
      Vditor.mermaidRender(panel, './vditor', theme)
    }
  })
}

// ---------- 块级 源码/渲染 原地切换（对齐 Vditor 原生 showCode 语义） ----------

const SOURCE_DEBOUNCE = 300
const renderTimers = new WeakMap()

function previewOf(block) {
  return block.querySelector('.vditor-wysiwyg__preview')
}

function sourcePreOf(block) {
  return [...block.querySelectorAll('pre')].find((p) => !p.classList.contains('vditor-wysiwyg__preview')) || null
}

function isSourceMode(block) {
  const pre = sourcePreOf(block)
  return !!pre && pre.style.display === 'block'
}

function enterSourceMode(block) {
  if (!block) return
  const pre = sourcePreOf(block)
  if (!pre) return
  pre.style.display = 'block'
  scheduleHide()
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(pre)
  range.collapse(false)
  sel.removeAllRanges()
  sel.addRange(range)
}

function exitAndRender(block) {
  const pre = sourcePreOf(block)
  if (!pre || pre.style.display !== 'block') return
  pre.style.display = 'none'
  clearTimeout(renderTimers.get(block))
  const t = setTimeout(() => {
    renderTimers.delete(block)
    renderBlock(block)
  }, SOURCE_DEBOUNCE)
  renderTimers.set(block, t)
}

function renderBlock(block) {
  if (isSourceMode(block)) return
  const panel = previewOf(block)
  if (!panel) return
  const lang = langOfBlock(block)
  if (lang === 'mermaid' || lang === 'markmap') renderDiagramPanel(panel)
  // 数学/HTML：由 Vditor 内建管线在失焦后自行重渲染
}

function renderDiagramPanel(panel) {
  const lang = panel.querySelector('.language-markmap')
    ? 'markmap'
    : panel.querySelector('.language-mermaid')
      ? 'mermaid'
      : null
  if (!lang) return
  const source = recoverDiagramSource(panel, lang)
  if (!source) return
  const code = panel.querySelector('.language-' + lang)
  if (!code) return
  code.removeAttribute('data-processed')
  code.innerHTML = ''
  code.textContent = source
  if (lang === 'markmap') Vditor.markmapRender(panel, './vditor')
  else Vditor.mermaidRender(panel, './vditor', props.theme)
}

function onPanelClick(e) {
  const panel = e.target.closest?.('.vditor-wysiwyg__preview')
  if (!panel || !rootEl()?.contains(panel)) return
  if (e.target.closest('a')) return
  const block = panel.closest('[data-type="code-block"]') || panel.parentElement
  if (!block) return
  enterSourceMode(block)
}

function onBlockDblClick(e) {
  if (e.detail > 2) return
  if (e.target.closest('.md-inline-src, .vditor-wysiwyg__preview, [data-type="code-block"], a')) return
  const table = e.target.closest('table')
  if (table && rootEl()?.contains(table)) {
    blockSrcApi.blockSrcApi.enterBlockSourceEdit(table, tableToMarkdown(table))
    return
  }
  const block = genericBlockFrom(e.target)
  if (!block || !rootEl()?.contains(block)) return
  blockSrcApi.enterBlockSourceEdit(block)
}

// 渲染抑制：光标位于块内（输入/聚焦）期间隐藏预览面板，失焦后恢复并渲染
function suppressPanel(block) {
  const panel = previewOf(block)
  if (panel) panel.style.display = 'none'
}

function restorePanel(block) {
  const panel = previewOf(block)
  if (panel && !isSourceMode(block)) panel.style.display = ''
}

/** 当前光标锚点元素（选区起始容器对应的元素） */
function anchorEl() {
  const sel = window.getSelection()
  if (!sel || sel.rangeCount === 0) return null
  const n = sel.getRangeAt(0).startContainer
  return n.nodeType === 3 ? n.parentElement : n
}

function onBlockFocusIn() {
  const block = anchorEl()?.closest('[data-type="code-block"]')
  if (block) suppressPanel(block)
}

function onBlockFocusOut(e) {
  const block = e.target.closest?.('[data-type="code-block"]')
  if (!block) return
  setTimeout(() => {
    if (block.contains(document.activeElement)) return
    if (isSourceMode(block)) {
      exitAndRender(block)
      return
    }
    restorePanel(block)
    renderBlock(block)
  }, 0)
}

function onBlockInput() {
  const block = anchorEl()?.closest('[data-type="code-block"]')
  if (block) suppressPanel(block)
}

async function applyCodeFormat(mode) {
  if (bar.language !== 'sql' && bar.language !== 'json') return notify('格式化仅支持 SQL / JSON')
  const block = resolveCodeBlock()
  const source = recoverCodeSource(block, bar.language)
  if (!source) return notify('未找到代码内容')
  const formatted = await formatCode(bar.language, source, mode)
  if (formatted === null) return notify(bar.language.toUpperCase() + ' 解析失败')
  if (formatted === source) return notify('内容已是目标格式')
  const md = vditor.getValue()
  const updated = replaceCodeBlockInMd(md, bar.language, bar.index, formatted)
  if (updated === md) return notify('未找到代码块')
  vditor.setValue(updated)
  const tab = getActive()
  if (tab) {
    tab.content = updated
    tab.dirty = true
  }
  notify(mode === 'pretty' ? '已美化' : '已压缩')
}

function scheduleHide() {
  clearTimeout(hideTimer)
  hideTimer = setTimeout(() => {
    // 光标位于工具条 / 目标元素的保持区内时，延迟隐藏（移动路径不中断）
    if (bar.visible && isPointerNearBar()) {
      scheduleHide()
      return
    }
    bar.visible = false
    styleMenu.visible = false
  }, BAR_HIDE_MS)
}

function isPointerNearBar() {
  const barEl = barRef.value
  if (!barEl) return false
  const br = barEl.getBoundingClientRect()
  const pad = HIT_PAD_PX
  const m = lastMouse
  if (m.x >= br.left - pad && m.x <= br.right + pad && m.y >= br.top - pad && m.y <= br.bottom + pad) {
    return true
  }
  const el = bar.el
  if (el?.isConnected) {
    const r = el.getBoundingClientRect()
    const l = Math.min(r.left, br.left) - pad
    const t = Math.min(r.top, br.top) - pad
    const rr = Math.max(r.right, br.right) + pad
    const b = Math.max(r.bottom, br.bottom) + pad
    if (m.x >= l && m.x <= rr && m.y >= t && m.y <= b) return true
  }
  return false
}

function keepBar() {
  clearTimeout(hideTimer)
}

function placeBar(rect, align) {
  nextTick(() => {
    const el = barRef.value
    const bw = el ? el.offsetWidth : 240
    const bh = el ? el.offsetHeight : 30
    bar.x =
      align === 'left'
        ? Math.max(8, Math.min(rect.left, window.innerWidth - bw - 8))
        : Math.max(8, rect.right - bw)
    bar.y = rect.top - bh - 6
    if (bar.y < 8) bar.y = rect.bottom + 6
  })
}

function safeDecode(s) {
  try {
    return decodeURIComponent(s)
  } catch {
    return s
  }
}

function showLinkBar(a) {
  if (a.dataset.linkEdit === '1') return
  const href = a.getAttribute('href') || ''
  if (!href) return
  keepBar()
  const anchor = href.startsWith('#') ? safeDecode(href.slice(1)) : null
  const anchorOk = anchor === null ? null : !!tocApi.anchorTarget(anchor)
  const text = (a.textContent || '').replace(/\u200b/g, '').trim()
  const md = `[${text}](${href})`
  if (bar.visible && bar.type === 'link' && bar.url === href && bar.anchorOk === anchorOk) {
    placeBar(a.getBoundingClientRect(), 'left')
    return
  }
  bar.type = 'link'
  bar.language = null
  bar.index = -1
  bar.blockIndex = -1
  bar.url = href
  bar.md = md
  bar.text = text
  bar.el = a
  bar.anchorOk = anchorOk
  bar.visible = true
  styleMenu.visible = false
  placeBar(a.getBoundingClientRect(), 'left')
}

async function copyLinkMd() {
  if (!bar.md) return
  notify((await copyText(bar.md)) ? 'Markdown 已复制' : '复制失败')
}

function enterLinkEditFromBar() {
  const a = bar.el
  bar.visible = false
  if (a?.isConnected) linkEditApi.enterLinkEdit(a)
}

function openLink() {
  const u = bar.url
  bar.visible = false
  if (u) followLink(u)
}

function selectUrlText(e) {
  const sel = window.getSelection()
  const range = document.createRange()
  range.selectNodeContents(e.currentTarget)
  sel.removeAllRanges()
  sel.addRange(range)
}

async function copyLinkUrl() {
  if (!bar.url) return
  notify((await copyText(bar.url)) ? '链接地址已复制' : '复制失败')
}

function onOver(e) {
  if (!ready) return
  const target = e.target instanceof Element ? e.target : null
  if (!target) return
  const link = target.closest('a[href]')
  if (link && host.value.contains(link)) {
    // hover intent：停留 120ms 才显示，快速扫过多链接不闪烁
    if (!(bar.visible && bar.type === 'link' && bar.el === link)) {
      clearTimeout(linkHoverTimer)
      linkHoverTimer = setTimeout(() => showLinkBar(link), LINK_HOVER_MS)
    }
    return
  }
  clearTimeout(linkHoverTimer)
  // 保持区优先：工具条可见且光标在其走廊内时，不被其他块命中抢占（如链接所在的段落）
  if (bar.visible && isPointerNearBar()) {
    keepBar()
    return
  }
  const hit = findHit(target, rootEl)
  if (!hit) {
    scheduleHide()
    return
  }
  keepBar()
  if (
    bar.visible &&
    bar.type === hit.type &&
    bar.language === hit.language &&
    bar.index === hit.index
  )
    return
  bar.type = hit.type
  bar.language = hit.language
  bar.index = hit.index
  bar.blockIndex = hit.blockIndex ?? -1
  bar.el = hit.el
  bar.visible = true
  styleMenu.visible = false
  updateCodeBadge()
  placeBar(hit.el.getBoundingClientRect(), 'right')
}

function reevaluateBar() {
  if (!ready) return
  if (!lastMouse.seen) return
  const el = document.elementFromPoint(lastMouse.x, lastMouse.y)
  const hit = el ? findHit(el, rootEl) : null
  if (!hit) {
    bar.visible = false
    styleMenu.visible = false
    return
  }
  if (bar.visible && bar.type === hit.type && bar.index === hit.index) return
  onOver({ target: el, clientX: lastMouse.x, clientY: lastMouse.y })
}

function resolveTable() {
  return ready ? rootEl()?.querySelectorAll('table')[bar.index] || null : null
}

function resolveMermaidPanel() {
  return ready ? rootEl()?.querySelectorAll(MERMAID_PANEL_SEL)[bar.index] || null : null
}

function resolveCodeBlock() {
  const root = rootEl()
  if (!root) return null
  const siblings = [...root.querySelectorAll('[data-type="code-block"]')].filter(
    (b) => langOfBlock(b) === bar.language
  )
  return siblings[bar.index] || null
}

async function copySource() {
  let text
  if (bar.type === 'mermaid') text = recoverDiagramSource(resolveMermaidPanel(), 'mermaid')
  else if (bar.type === 'markmap') text = recoverDiagramSource(resolveMermaidPanel(), 'markmap')
  else if (bar.type === 'code')
    text = recoverCodeSource(resolveCodeBlock(), bar.language) || codeBlockText(resolveCodeBlock())
  else text = tableToMarkdown(resolveTable())
  if (!text) return notify('未找到可复制的内容')
  notify((await copyText(text)) ? '源码已复制' : '复制失败')
}

async function editMarkmap() {
  const panel = resolveMermaidPanel()
  const block = panel?.closest('[data-type="code-block"]') || null
  const source = recoverCodeSource(block, 'markmap')
  if (source === null) return notify('未找到脑图内容')
  mmEditorVisible.value = true
  await nextTick()
  const result = await mmEditorRef.value?.open(source)
  if (result === null || result === undefined) return
  const root = rootEl()
  const md = vditor.getValue()
  const blocks = root
    ? [...root.querySelectorAll('[data-type="code-block"]')].filter((b) => langOfBlock(b) === 'markmap')
    : []
  const idx = block ? blocks.indexOf(block) : -1
  const updated = replaceCodeBlockInMd(md, 'markmap', idx, result)
  if (updated === md) return notify('未找到代码块')
  vditor.setValue(updated)
  const tab = getActive()
  if (tab) {
    tab.content = updated
    tab.dirty = true
  }
  notify('脑图已更新')
}

function pickStyle(name) {
  const table = resolveTable()
  if (!table) return
  applyStyle(table, bar.index, name)
  styleMenu.visible = false
}

async function openLocalLink(href) {
  const r = await window.mdreader.openLocalLink(href, getActive()?.filePath || null)
  if (!r?.ok) notify(r?.message || '无法打开链接')
}

async function followLink(href) {
  if (href.startsWith('#')) {
    const el = tocApi.anchorTarget(safeDecode(href.slice(1)))
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    else notify('未找到锚点：' + href.slice(1))
    return
  }
  const m = /^([a-zA-Z][a-zA-Z0-9+.-]*):/.exec(href)
  if (m) {
    const s = m[1].toLowerCase()
    if (s === 'http' || s === 'https' || s === 'mailto' || s === 'tel') {
      await window.mdreader.openExternal(href)
    } else if (s === 'file') {
      await openLocalLink(href)
    }
    return
  }
  await openLocalLink(href)
}

function onEditorLinkClick(e) {
  if (e.target.closest?.('.md-link-edit')) {
    e.preventDefault()
    return
  }
  if (e.type === 'auxclick' && e.button !== 1) return
  const a = e.target instanceof Element ? e.target.closest('a[href]') : null
  if (!a) return
  const href = a.getAttribute('href') || ''
  if (!href || /^javascript:/i.test(href)) return
  e.preventDefault()
  e.stopPropagation()
  bar.visible = false
  followLink(href)
}

function toggleStyleMenu() {
  if (styleMenu.visible) {
    styleMenu.visible = false
    return
  }
  const table = resolveTable()
  if (!table) return
  const name = [...table.classList].find((c) => c.startsWith('md-tbl-'))
  activeStyle.value = name || DEFAULT_TABLE_STYLE
  styleMenu.x = bar.x
  styleMenu.y = bar.y + 32
  styleMenu.visible = true
}

function onMouseMove(e) {
  lastMouse.x = e.clientX
  lastMouse.y = e.clientY
  lastMouse.seen = true
}

// ---------- 选区格式条（useSelectionBar） ----------

const selectionBarApi = useSelectionBar({
  getRootEl: rootEl,
  notify,
  copyText
})

// ---------- 查找/替换（useSearch） ----------

const searchApi = useSearch({
  getRootEl: rootEl,
  getScroller,
  notify,
  selectRange: selectionBarApi.selectRange
})

function openSearch(withReplace) {
  searchApi.openSearch(withReplace)
  nextTick(() => {
    const input = document.querySelector('.search-panel input')
    input?.focus()
    input?.select()
  })
}

function onDocScroll() {
  // 滚动高频：合帧执行重绘相关逻辑，避免每个 scroll 事件都触发布局读取
  if (!scrollRaf) {
    scrollRaf = requestAnimationFrame(() => {
      scrollRaf = 0
      updateCodeBadge()
      mmUpdate()
    })
  }
  clearTimeout(scrollTimer)
  scrollTimer = setTimeout(() => {
    tocApi.updateActiveHeading()
    reevaluateBar()
  }, SCROLL_SETTLE_MS)
}

// ---------- 脑图缩放（useMarkmapZoom） ----------

function onGlobalKeydown(e) {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !e.shiftKey) {
    e.preventDefault()
    openSearch(false)
  } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
    e.preventDefault()
    openSearch(true)
  } else if (e.key === 'F3') {
    e.preventDefault()
    if (searchApi.search.open) searchApi.gotoMatch(searchApi.search.index + (e.shiftKey ? -1 : 1))
  }
}

function onMountedBind() {
  host.value.addEventListener('mouseover', onOver)
  host.value.addEventListener('paste', onEditorPaste, true)
  window.addEventListener('mousemove', onMouseMove)
  host.value.addEventListener('mouseleave', scheduleHide)
  host.value.addEventListener('click', onEditorLinkClick, true)
  host.value.addEventListener('auxclick', onEditorLinkClick, true)
  host.value.addEventListener('scroll', onDocScroll, true)
  window.addEventListener('scroll', onDocScroll, true)
  window.addEventListener('keydown', onGlobalKeydown, true)
  host.value.addEventListener('contextmenu', onEditorContextMenu)
  host.value.addEventListener('click', onPanelClick)
  host.value.addEventListener('dblclick', onBlockDblClick)
  host.value.addEventListener('focusout', onBlockFocusOut)
  host.value.addEventListener('focusin', onBlockFocusIn)
  host.value.addEventListener('input', onBlockInput, true)
  document.addEventListener('selectionchange', selectionBarApi.onSelectionChange)
  styleObserver = new MutationObserver(() => {
    // 每次键入都会触发：合帧去重，仅样式映射与 TOC 降频执行
    if (!styleDirty) {
      styleDirty = true
      requestAnimationFrame(() => {
        styleDirty = false
        applyRememberedStyles()
      })
    }
    clearTimeout(tocTimer)
    tocTimer = setTimeout(tocApi.extractToc, TOC_DEBOUNCE_MS)
  })
  styleObserver.observe(host.value, { childList: true, subtree: true })
}

function ctxExec(cmd) {
  if (cmd === 'paste') {
    navigator.clipboard
      ?.readText()
      .then((t) => t && document.execCommand('insertText', false, t))
      .catch(() => notify('粘贴失败：无法读取剪贴板'))
  } else {
    document.execCommand(cmd)
  }
}

function onEditorContextMenu(e) {
  e.preventDefault()
  e.stopPropagation()
  const sel = window.getSelection()
  const hasSel = !!(sel && !sel.isCollapsed)
  openContextMenuAt(e.clientX, e.clientY, [
    { id: 'cut', label: '剪切', disabled: !hasSel, run: () => ctxExec('cut') },
    { id: 'copy', label: '复制', disabled: !hasSel, run: () => ctxExec('copy') },
    { id: 'paste', label: '粘贴', run: () => ctxExec('paste') },
    { type: 'separator' },
    { id: 'selectAll', label: '全选', run: () => ctxExec('selectAll') }
  ])
}

onMounted(() => {
  vditor = new Vditor(host.value, {
    mode: 'wysiwyg',
    cdn: publicPath('./vditor'),
    lang: 'zh_CN',
    height: '100%',
    value: getActive()?.content ?? welcomeDoc,
    cache: { enable: false },
    toolbar: [],
    undoDelay: 200,
    placeholder: '开始书写 Markdown …',
    preview: {
      delay: 100,
      theme: {
        current: props.theme,
        path: publicPath('./vditor/dist/css/content-theme')
      },
      hljs: {
        style: codeStyle(props.theme),
        lineNumber: false
      }
    },
    input: (value) => {
      const tab = getActive()
      if (tab) {
        tab.content = value
        tab.dirty = true
      }
      refreshStats(value)
      searchApi.touchCollect()
    },
    after: () => {
      ready = true
      onMountedBind()

      if (pendingValue !== null) {
        vditor.setValue(pendingValue)
        pendingValue = null
      }
      applyRememberedStyles()
      tocApi.extractToc()
      if (pendingScroll) {
        const sc = getScroller()
        if (sc) sc.scrollTop = pendingScroll
        pendingScroll = 0
      }
      refreshStats(getActive()?.content ?? welcomeDoc)
    }
  })
})

let lastBigHintAt = 0

function setContent(value, scrollTop = 0) {
  if (ready && vditor) {
    vditor.setValue(value)
    applyRememberedStyles()
    tocApi.extractToc()
    refreshStats(value)
    if (value && value.length > BIG_DOC_CHARS && Date.now() - lastBigHintAt > BIG_DOC_HINT_COOLDOWN_MS) {
      lastBigHintAt = Date.now()
      notify('文档较大，编辑可能卡顿，建议拆分或使用源码模式')
    }
    nextTick(() => {
      const sc = getScroller()
      if (sc) sc.scrollTop = scrollTop || 0
    })
  } else {
    pendingValue = value
    pendingScroll = scrollTop || 0
  }
}

function insertImage(rel) {
  if (!ready || !vditor) return
  vditor.insertValue('\n![](' + encodeURI(rel) + ')\n')
  notify('已插入图片引用')
}

// ---------- 编辑器内粘贴图片：保存到 assets/ 并插入相对引用 ----------

const PASTE_IMAGE_EXT = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp', 'image/svg+xml': 'svg', 'image/bmp': 'bmp' }

async function onEditorPaste(e) {
  // Ctrl+Shift+V：强制纯文本粘贴（丢弃富文本标记）
  if ((e.ctrlKey || e.metaKey) && e.shiftKey) {
    const plain = e.clipboardData?.getData('text/plain')
    if (plain != null && plain !== '') {
      e.preventDefault()
      e.stopPropagation()
      try {
        document.execCommand('insertText', false, plain)
      } catch {
        /* ignore */
      }
    }
    return
  }
  const items = e.clipboardData?.items
  if (!items) return
  for (const item of items) {
    if (item.kind !== 'file') continue
    const ext = PASTE_IMAGE_EXT[item.type]
    if (!ext) continue
    const file = item.getAsFile()
    if (!file) continue
    e.preventDefault()
    e.stopPropagation()
    const data = new Uint8Array(await file.arrayBuffer())
    emit('paste-image', { data, ext })
    return
  }
}

function getHtml() {
  return ready && vditor ? vditor.getHTML() : ''
}

const srcLayer = reactive({ visible: false, title: '', text: '' })
const srcLayerEl = ref(null)

function openSourceLayer(title, text) {
  if (!text) return notify('未获取到源码')
  srcLayer.title = title
  srcLayer.text = text
  srcLayer.visible = true
  nextTick(() => srcLayerEl.value?.focus())
}

function toggleBlockSource(block) {
  if (!block || !block.isConnected) return notify('元素已失效，请重新悬浮')
  if (block.dataset.srcEdit === '1') blockSrcApi.finishBlockSourceEdit(block, true)
  else blockSrcApi.enterBlockSourceEdit(block)
}

function toggleTableSource() {
  const table = resolveTable()
  if (!table) return
  if (table.dataset.srcEdit === '1') blockSrcApi.finishBlockSourceEdit(table, true)
  else blockSrcApi.blockSrcApi.enterBlockSourceEdit(table, tableToMarkdown(table))
}

function showDocSource() {
  if (!ready || !vditor) return
  openSourceLayer('全文 Markdown 源码（只读）', vditor.getValue())
}

async function showChangelog() {
  // 按需加载：更新日志不应进入主包（首屏体积）
  // @ts-ignore
  const { default: changelogMd } = await import('../../../../CHANGELOG.md?raw')
  openSourceLayer('更新日志', (changelogMd || '').trim())
}

async function copyLayerSource() {
  notify((await copyText(srcLayer.text)) ? '源码已复制' : '复制失败')
}

function syncDocAfterDomEdit() {
  if (!ready || !vditor) return
  const v = vditor.getValue()
  const tab = getActive()
  if (tab) {
    tab.content = v
    tab.dirty = true
  }
  refreshStats(v)
}

function applyBarLang(v) {
  const lang = (v || '').trim().toLowerCase().replace(/[^a-z0-9+#.-]/g, '')
  let block = null
  if (bar.type === 'code') block = resolveCodeBlock()
  else if (bar.type === 'mermaid' || bar.type === 'markmap') {
    block = resolveMermaidPanel()?.closest('[data-type="code-block"]') || resolveMermaidPanel()?.parentElement
  }
  if (!block) return notify('未找到代码块')
  const srcPre = sourcePreOf(block)
  ;[...block.querySelectorAll('pre > code')].forEach((c) => {
    if (c.closest('.vditor-wysiwyg__preview')) return
    c.className = lang ? 'language-' + lang : ''
  })
  const panel = previewOf(block)
  if (panel) {
    const pc = panel.querySelector('[class*="language-"]')
    if (pc) pc.className = lang ? 'language-' + lang : ''
    panel.dataset.srcDirty = '1'
  }
  bar.language = lang
  notify(lang ? '语言已设为 ' + lang : '已清除语言')
  if (!isSourceMode(block) && srcPre) exitAndRender(block)
}

watch(
  () => props.theme,
  (t) => {
    if (!ready || !vditor) return
    vditor.setTheme(t, t, codeStyle(t))
    rerenderMermaid(t)
  }
)

watch(
  () => getActive()?.filePath,
  () => applyRememberedStyles()
)

function insertMindmap() {
  if (!ready || !vditor) return
  const tab = getActive()
  if (!tab) return notify('请先新建或打开文件')
  const sel = window.getSelection()
  const anchor =
    sel && sel.rangeCount
      ? sel.getRangeAt(0).startContainer.nodeType === 3
        ? sel.getRangeAt(0).startContainer.parentElement
        : sel.getRangeAt(0).startContainer
      : null
  if (anchor && anchor.closest('[data-type="code-block"]')) {
    return notify('光标位于代码块内，无法插入')
  }
  // 走 Vditor 输入管线：光标处插入，保留撤销栈与滚动位置
  vditor.insertValue('\n\n```markmap\n- 新脑图\n  - 分支一\n  - 分支二\n```\n')
  nextTick(() => {
    const root = rootEl()
    const blocks = root ? [...root.querySelectorAll('[data-type="code-block"]')] : []
    if (blocks.length) enterSourceMode(blocks[blocks.length - 1])
  })
  notify('已在光标处插入脑图（源码态），失焦后自动渲染')
}

onBeforeUnmount(() => {
  if (styleObserver) styleObserver.disconnect()
  disposeMarkmapZoom()
  host.value?.removeEventListener?.('paste', onEditorPaste, true)
  window.removeEventListener('scroll', onDocScroll, true)
  window.removeEventListener('keydown', onGlobalKeydown, true)
  window.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('selectionchange', selectionBarApi.onSelectionChange)
  clearTimeout(hideTimer)
  clearTimeout(tocTimer)
  clearTimeout(scrollTimer)
  if (scrollRaf) cancelAnimationFrame(scrollRaf)
  searchApi.dispose()
  selectionBarApi.dispose()
  if (vditor) vditor.destroy()
})

defineExpose({
  setContent,
  scrollToHeading: (id) => tocApi.scrollToHeading(id),
  insertMindmap,
  insertImage,
  notify,
  getHtml,
  showDocSource,
  showChangelog,
  getScrollTop,
  openSearch,
  execFormat: (cmd, val) => selectionBarApi.execFormat(cmd, val),
  execWavy: () => selectionBarApi.execWavy(),
  execHighlight: () => selectionBarApi.execHighlight(),
  applyColor: (c) => selectionBarApi.applyColor(c),
  applySize: (v) => selectionBarApi.applySize(v),
  applyFont: (v) => selectionBarApi.applyFont(v),
  exportDocImage
})
</script>

<template>
  <div class="editor-host">
    <div ref="host" class="editor"></div>
  </div>
  <teleport to="body">
        <div
          v-if="codeBadge.visible"
          class="md-code-badge"
          :style="{ top: codeBadge.top + 'px', right: codeBadge.right + 'px' }"
        >
          <svg
            v-if="codeBadge.icon"
            v-html="codeBadge.icon.inner"
            class="md-code-badge-ic"
            :style="{ color: `var(${codeBadge.icon.var})` }"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
            aria-hidden="true"
          ></svg>
          <span>{{ codeBadge.lang }}</span>
        </div>
    <div
      v-if="srcLayer.visible"
      ref="srcLayerEl"
      class="md-source-layer"
      tabindex="-1"
      role="dialog"
      aria-modal="true"
      :aria-label="srcLayer.title"
      @mousedown.self="srcLayer.visible = false"
      @keydown.esc="srcLayer.visible = false"
    >
      <div class="md-source-box">
        <div class="md-source-head">
          <span>{{ srcLayer.title }}</span>
          <UxButton size="sm" variant="ghost" label="关闭" @click="srcLayer.visible = false">
            <template #icon><X :size="14" /></template>
          </UxButton>
        </div>
        <pre class="md-source-pre">{{ srcLayer.text }}</pre>
        <div class="md-source-foot">
          <UxButton size="sm" variant="secondary" @click="srcLayer.visible = false">关闭</UxButton>
          <UxButton size="sm" variant="primary" @click="copyLayerSource">复制</UxButton>
        </div>
      </div>
    </div>
    <div
      v-if="bar.visible"
      ref="barRef"
      class="md-block-bar hover-pop"
      :style="{ left: bar.x + 'px', top: bar.y + 'px' }"
      @mousedown.prevent
      @mouseenter="keepBar"
      @mouseleave="scheduleHide"
    >
      <template v-if="bar.type === 'table'">
        <UxButton size="sm" variant="ghost" label="复制表格 Markdown 源码" @click="copySource">
          <template #icon><Copy :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="导出为图片" @click="exportTableImage">
          <template #icon><Image :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="导出为 Excel" @click="exportTableExcel">
          <template #icon><FileSpreadsheet :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="表格样式" @click="toggleStyleMenu">
          <template #icon><Paintbrush :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="编辑 Markdown 源码（双击表格同样生效）" @click="toggleTableSource">
          <template #icon><FileCode :size="13" /></template>
        </UxButton>
      </template>
      <template v-else-if="bar.type === 'code'">
        <input
          class="md-lang-input"
          :value="bar.language"
          placeholder="语言"
          title="指定 / 修改代码块语言，回车应用"
          @mousedown.stop
          @click.stop
          @keydown.enter.prevent="applyBarLang($event.target.value)"
        />
        <UxButton
          v-if="bar.language === 'sql' || bar.language === 'json'"
          size="sm"
          variant="ghost"
          label="格式化（美化 + 缩进）"
          @click="applyCodeFormat('pretty')"
        >
          <template #icon><Sparkles :size="13" /></template>
        </UxButton>
        <UxButton
          v-if="bar.language === 'sql' || bar.language === 'json'"
          size="sm"
          variant="ghost"
          label="压缩"
          @click="applyCodeFormat('minify')"
        >
          <template #icon><Minimize2 :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="复制源码" @click="copySource">
          <template #icon><Copy :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="导出为图片" @click="exportCodeImage">
          <template #icon><ImageDown :size="13" /></template>
        </UxButton>
      </template>
      <template v-else-if="bar.type === 'markmap'">
        <UxButton size="sm" variant="ghost" label="复制脑图源码" @click="copySource">
          <template #icon><Copy :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="打开脑图画布编辑" @click="editMarkmap">
          <template #icon><Pencil :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="导出为 PNG" @click="exportMarkmapPng">
          <template #icon><ImageDown :size="13" /></template>
        </UxButton>
        <span class="md-bar-sep"></span>
        <UxButton size="sm" variant="ghost" label="缩小" @click="mmZoom(-1)">−</UxButton>
        <span class="mm-ctl-pct" title="当前缩放比例">{{ mmCtl.pct }}%</span>
        <UxButton size="sm" variant="ghost" label="放大" @click="mmZoom(1)">＋</UxButton>
        <UxButton size="sm" variant="ghost" label="还原视图" @click="mmReset">
          <template #icon><RotateCcw :size="13" /></template>
        </UxButton>
      </template>
      <template v-else-if="bar.type === 'link'">
        <span
          v-if="bar.anchorOk !== null"
          class="md-bar-anchor"
          :class="bar.anchorOk ? 'ok' : 'bad'"
          :title="bar.anchorOk ? '锚点有效' : '锚点无效'"
        >
          <CircleCheck v-if="bar.anchorOk" :size="14" />
          <CircleX v-else :size="14" />
        </span>
        <span
          class="link-bar-url"
          :title="`文本：${bar.text || bar.url}\n源码：${bar.md}`"
          @click="selectUrlText"
        >{{ bar.url }}</span>
        <UxButton size="sm" variant="ghost" label="打开链接" @click="openLink">
          <template #icon><ExternalLink :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="复制链接地址" @click="copyLinkUrl">
          <template #icon><Link2 :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="编辑链接" @click="enterLinkEditFromBar">
          <template #icon><Pencil :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="复制 Markdown 源码" @click="copyLinkMd">
          <template #icon><FileCode :size="13" /></template>
        </UxButton>
      </template>
      <template v-else-if="bar.type === 'generic'">
        <UxButton size="sm" variant="ghost" label="编辑 Markdown 源码（双击段落/标题同样生效）" @click="toggleBlockSource(bar.el)">
          <template #icon><FileCode :size="13" /></template>
        </UxButton>
      </template>
      <template v-else>
        <UxButton size="sm" variant="ghost" label="复制图表源码" @click="copySource">
          <template #icon><Copy :size="13" /></template>
        </UxButton>
        <UxButton size="sm" variant="ghost" label="导出为 PNG" @click="exportMermaidPng">
          <template #icon><ImageDown :size="13" /></template>
        </UxButton>
      </template>
    </div>
    <div
      v-if="styleMenu.visible"
      class="md-style-menu"
      :style="{ left: styleMenu.x + 'px', top: styleMenu.y + 'px' }"
      @mousedown.prevent
      @mouseenter="keepBar"
      @mouseleave="scheduleHide"
    >
      <button
        v-for="s in TABLE_STYLES"
        :key="s.name"
        class="md-style-item"
        :class="{ active: s.name === activeStyle }"
        @click="pickStyle(s.name)"
      >
        {{ s.label }}
      </button>
    </div>
    <SearchPanel v-if="searchApi.search.open" :state="searchApi.search" :api="searchApi" />
    <SelectionBar :bar="selectionBarApi.selbar" :api="selectionBarApi" />
  </teleport>
  <MindMapEditor v-if="mmEditorVisible" ref="mmEditorRef" />
</template>
