import { store } from '../store'

/**
 * 目录提取与标题跳转：扫描编辑器标题生成 TOC、滚动跟随高亮、锚点解析。
 * 由 EditorPane 注入 rootEl。
 */
export function useToc({ getRootEl }) {
  let headingSeq = 0
  let lastSignature = ''
  const headingEls = new Map()

  function extractToc() {
    const root = getRootEl()
    if (!root) return
    const headings = [...root.querySelectorAll('h1, h2, h3, h4, h5, h6')]
    const sigParts = []
    const texts = []
    headings.forEach((h) => {
      const clone = h.cloneNode(true)
      clone.querySelectorAll('.vditor-wysiwyg__marker').forEach((m) => m.remove())
      const text = clone.textContent.replace(/\u200b/g, '').replace(/\s+/g, ' ').trim()
      texts.push(text)
      sigParts.push(h.tagName + '\u0001' + text)
    })
    const signature = sigParts.join('\u0002')
    const nonEmpty = texts.filter(Boolean).length
    // 标题结构未变化（键入正文是常态）时仅刷新活跃项：
    // 不重建 Map、不替换 store.toc，避免目录面板整表重渲染
    if (
      signature === lastSignature &&
      headingEls.size === nonEmpty &&
      [...headingEls.values()].every((el) => el.isConnected)
    ) {
      updateActiveHeading()
      return
    }
    lastSignature = signature
    headingEls.clear()
    const items = []
    headings.forEach((h, i) => {
      const text = texts[i]
      if (!text) return
      const id = 'h' + ++headingSeq
      headingEls.set(id, h)
      items.push({ id, level: Number(h.tagName[1]), text })
    })
    store.toc = items
    updateActiveHeading()
  }

  function updateActiveHeading() {
    const root = getRootEl()
    if (!root || !store.toc.length) {
      store.tocActiveId = null
      return
    }
    const containerTop = root.getBoundingClientRect().top
    let active = store.toc[0].id
    for (const item of store.toc) {
      const el = headingEls.get(item.id)
      if (!el || !el.isConnected) continue
      if (el.getBoundingClientRect().top <= containerTop + 96) active = item.id
      else break
    }
    store.tocActiveId = active
  }

  function scrollToHeading(id) {
    const el = headingEls.get(id)
    if (!el || !el.isConnected) return
    el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    store.tocActiveId = id
  }

  /** 解析 #锚点：优先 id/user-content-id 精确匹配，其次标题文本归一化匹配 */
  function anchorTarget(name) {
    const root = getRootEl()
    if (!root || !name) return null
    const byId =
      root.querySelector('#' + CSS.escape(name)) ||
      root.querySelector('#' + CSS.escape('user-content-' + name))
    if (byId) return byId
    const want = name.toLowerCase().replace(/[-_\s]+/g, '')
    for (const el of headingEls.values()) {
      if (!el.isConnected) continue
      const t = (el.textContent || '').replace(/\u200b/g, '').toLowerCase().replace(/\s+/g, '')
      if (t === want) return el
    }
    return null
  }

  return { extractToc, updateActiveHeading, scrollToHeading, anchorTarget }
}
