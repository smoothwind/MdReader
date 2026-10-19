// 块级 DOM 定位与源码回收：纯 DOM 函数，无组件状态（可单元测试）

export const MERMAID_PANEL_SEL = '.vditor-wysiwyg__preview'

export function recoverDiagramSource(panel, lang = 'mermaid') {
  if (!panel) return null
  const block = panel.closest('[data-type="code-block"]') || panel.parentElement
  if (!block) return null
  const candidates = block.querySelectorAll('pre > code.language-' + lang)
  for (const c of candidates) {
    if (panel.contains(c)) continue
    const text = (c.textContent || '').replace(/\u200b/g, '')
    if (text.trim() && !text.trim().startsWith('```')) return text
  }
  return null
}

export function langOfBlock(block) {
  const code = [...block.querySelectorAll('pre > code')].find(
    (c) => !c.closest(MERMAID_PANEL_SEL) && /language-/.test(c.className)
  )
  const m = code ? code.className.match(/language-([\w-]+)/) : null
  return m ? m[1].toLowerCase() : ''
}

export function recoverCodeSource(block, lang) {
  if (!block) return null
  const candidates = block.querySelectorAll('pre > code.language-' + lang)
  for (const c of candidates) {
    if (c.closest(MERMAID_PANEL_SEL)) continue
    const text = (c.textContent || '').replace(/\u200b/g, '')
    if (text.trim() && !text.trim().startsWith('```')) return text
  }
  return null
}

export function codeBlockText(block) {
  if (!block) return ''
  const code = [...block.querySelectorAll('pre > code')].find((c) => !c.closest(MERMAID_PANEL_SEL))
  return ((code || block).textContent || '').replace(/\u200b/g, '')
}

export function genericBlockFrom(target) {
  let g = target.closest('p, h1, h2, h3, h4, h5, h6, blockquote, ul, ol, li')
  if (!g) return null
  // 列表项不是独立块：上溯到所属列表，避免逐项替换破坏列表结构
  if (g.tagName === 'LI') g = g.closest('ul, ol') || g
  return g
}

/** 悬浮工具条命中测试：mermaid/markmap 面板 > 代码块 > 表格 > 通用块 */
export function findHit(target, rootEl) {
  if (target.closest?.('.md-inline-src')) return null
  const root = rootEl()
  if (!root) return null
  const panels = [...root.querySelectorAll(MERMAID_PANEL_SEL)]
  const panel = target.closest(MERMAID_PANEL_SEL)
  if (panel && root.contains(panel) && panel.querySelector('svg')) {
    if (panel.querySelector('.language-mermaid')) {
      return { el: panel, type: 'mermaid', language: 'mermaid', index: panels.indexOf(panel) }
    }
    if (panel.querySelector('.language-markmap')) {
      const blocks = [...root.querySelectorAll('[data-type="code-block"]')].filter(
        (b) => langOfBlock(b) === 'markmap'
      )
      const block =
        blocks.find((b) => b.contains(panel)) || panel.closest('[data-type="code-block"]')
      return {
        el: panel,
        type: 'markmap',
        language: 'markmap',
        index: panels.indexOf(panel),
        blockIndex: block ? blocks.indexOf(block) : -1
      }
    }
  }
  const codeBlock = target.closest('[data-type="code-block"]')
  if (codeBlock && root.contains(codeBlock)) {
    const lang = langOfBlock(codeBlock)
    const siblings = [...root.querySelectorAll('[data-type="code-block"]')].filter(
      (b) => langOfBlock(b) === lang
    )
    return { el: codeBlock, type: 'code', language: lang, index: siblings.indexOf(codeBlock) }
  }
  const table = target.closest('table')
  if (table && root.contains(table) && !table.closest(MERMAID_PANEL_SEL)) {
    return { el: table, type: 'table', language: null, index: [...root.querySelectorAll('table')].indexOf(table) }
  }
  const generic = genericBlockFrom(target)
  if (
    generic &&
    root.contains(generic) &&
    !generic.closest(MERMAID_PANEL_SEL) &&
    !generic.closest('[data-type="code-block"]') &&
    !generic.closest('table')
  ) {
    return { el: generic, type: 'generic', language: null, index: -1 }
  }
  return null
}
