import { store } from '../store'

/**
 * 目录提取与标题跳转：扫描编辑器标题生成 TOC、滚动跟随高亮、锚点解析。
 * 由 EditorPane 注入 rootEl。
 */
export function useToc({ getRootEl }) {
  let headingSeq = 0
  let lastSignature = ''
  const headingEls = new Map()

  /** 锚点/标题统一归一化：去零宽字符 + 小写 + 剔除全部非字母数字（Unicode 感知，保留中文） */
  const normAnchor = (s) =>
    String(s || '')
      .replace(/\u200b/g, '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, '')

  /** id 选择器转义：优先 CSS.escape，缺失时（测试环境/旧引擎）用最小兜底转义 */
  const cssEscape = (s) => {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') return CSS.escape(s)
    return String(s).replace(/["\\#.\s]/g, '\\$1')
  }

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
    // id 精确匹配：个别选择器（全角标点等）在部分引擎/测试环境解析失败时，落到文本匹配
    let byId = null
    try {
      byId =
        root.querySelector('#' + cssEscape(name)) ||
        root.querySelector('#' + cssEscape('user-content-' + name))
    } catch {
      byId = null
    }
    if (byId) return byId
    // 锚点文本与标题文本必须用同一套归一化：去零宽字符 + 小写 + 剔除全部非字母数字。
    // 标题里的标点/连字符/空白（如「标题：简介」「1.2 小节」「foo-bar」）与 Markdown
    // 锚点写法允许的省略形式（#标题简介 / #12小节 / #foobar）由此一一对应，避免误报无效。
    const want = normAnchor(name)
    if (!want) return null
    for (const el of headingEls.values()) {
      if (!el.isConnected) continue
      if (normAnchor(el.textContent) === want) return el
    }
    return null
  }

  return { extractToc, updateActiveHeading, scrollToHeading, anchorTarget }
}
