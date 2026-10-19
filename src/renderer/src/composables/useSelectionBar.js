import { nextTick, reactive, ref } from 'vue'

const SELBAR_DELAY_MS = 120

/**
 * 选区浮动格式条：选区监听/定位 + 富文本命令（加粗、颜色、字号、波浪线等）+
 * 选区转 Markdown。由 EditorPane 注入 rootEl/notify/copyText。
 */
export function useSelectionBar({ getRootEl, notify, copyText }) {
  const selbar = reactive({ visible: false, x: 0, y: 0, colorOpen: false })
  const selbarRef = ref(null)
  let selRange = null
  let selTimer = null

  function selectRange(r) {
    const sel = window.getSelection()
    sel.removeAllRanges()
    sel.addRange(r)
  }

  function onSelectionChange() {
    clearTimeout(selTimer)
    selTimer = setTimeout(() => {
      const sel = window.getSelection()
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        if (selbar.visible) {
          selbar.visible = false
          selbar.colorOpen = false
        }
        selRange = null
        return
      }
      const range = sel.getRangeAt(0)
      const root = getRootEl()
      if (!root || !root.contains(range.commonAncestorContainer)) {
        selbar.visible = false
        return
      }
      const anchor =
        range.startContainer.nodeType === 3
          ? range.startContainer.parentElement
          : range.startContainer
      if (anchor?.closest('[data-type="code-block"], .vditor-wysiwyg__preview')) {
        selbar.visible = false
        return
      }
      selRange = range.cloneRange()
      const rect = range.getBoundingClientRect()
      if (rect.width === 0 && rect.height === 0) {
        selbar.visible = false
        return
      }
      selbar.visible = true
      selbar.colorOpen = false
      nextTick(() => {
        const el = selbarRef.value
        const w = el ? el.offsetWidth : 330
        let x = rect.left + rect.width / 2 - w / 2
        x = Math.max(8, Math.min(x, window.innerWidth - w - 8))
        let y = rect.top - (el ? el.offsetHeight : 40) - 8
        if (y < 88) y = rect.bottom + 8
        selbar.x = x
        selbar.y = y
      })
    }, SELBAR_DELAY_MS)
  }

  function execFormat(cmd, val) {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    if (selRange) selectRange(selRange)
    try {
      document.execCommand(cmd, false, val)
    } catch {
      /* ignore */
    }
  }

  function applyInlineStyle(style) {
    const sel = window.getSelection()
    let range = null
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed && sel.getRangeAt(0).toString()) {
      range = sel.getRangeAt(0)
    } else if (selRange && selRange.toString()) {
      range = selRange
    }
    if (!range) return
    document.querySelector('.editor [contenteditable="true"]')?.focus()
    selectRange(range)
    const text = range.toString()
    try {
      document.execCommand(
        'insertHTML',
        false,
        `<u style="text-decoration: underline;text-decoration-color: transparent;${style}">` +
          text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;') +
          '</u>'
      )
    } catch {
      /* ignore */
    }
    try {
      const sn = window.getSelection().getRangeAt(0).startContainer
      const uEl = sn.nodeType === 3 ? sn.parentElement : sn
      if (uEl && uEl.tagName === 'U') {
        const r2 = document.createRange()
        r2.selectNodeContents(uEl)
        selectRange(r2)
      }
    } catch {
      /* ignore */
    }
  }

  function onSelbarMousedown(e) {
    if (e.target.closest('select, input, label')) return
    e.preventDefault()
  }

  function execWavy() {
    const sel = window.getSelection()
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return
    const range = sel.getRangeAt(0)
    const text = range.toString()
    if (!text) return
    const esc = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    selectRange(range)
    try {
      document.execCommand('insertHTML', false, '<u style="text-decoration: underline wavy #f08c00">' + esc + '</u>')
    } catch {
      /* ignore */
    }
  }

  function execHighlight() {
    applyInlineStyle('background:#fff59d')
  }

  function applyColor(c) {
    applyInlineStyle('color:' + c)
    selbar.colorOpen = false
  }

  function applySize(v) {
    if (!v) return
    applyInlineStyle('font-size:' + v)
  }

  function applyFont(v) {
    if (!v) return
    applyInlineStyle('font-family:' + v)
  }

  async function selectionToMd() {
    const sel = window.getSelection()
    if (!sel || sel.isCollapsed) return
    const holder = document.createElement('div')
    for (let i = 0; i < sel.rangeCount; i++) holder.appendChild(sel.getRangeAt(i).cloneContents())
    const lute = window.Lute?.New?.()
    if (!lute) return notify('转换引擎未就绪，请稍后重试')
    let md
    try {
      md = (lute.HTML2Md(holder.innerHTML) || '').trim()
    } catch {
      return notify('转换失败')
    }
    notify((await copyText(md)) ? 'Markdown 已复制' : '复制失败')
  }

  function dispose() {
    clearTimeout(selTimer)
  }

  function setBarEl(el) {
    selbarRef.value = el
  }

  return {
    selbar,
    selbarRef,
    setBarEl,
    onSelectionChange,
    selectRange,
    execFormat,
    onSelbarMousedown,
    execWavy,
    execHighlight,
    applyColor,
    applySize,
    applyFont,
    selectionToMd,
    dispose
  }
}
