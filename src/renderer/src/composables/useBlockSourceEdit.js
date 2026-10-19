// 段落/标题/表格 原地 Markdown 源码编辑：Lute VditorDOM2Md / Md2VditorDOM 精确双向转换。
// 关键：textarea 容器所有冒泡事件 stopPropagation，隔离 Vditor 输入管线（AGENTS.md 规则 1）。

export function useBlockSourceEdit({ notify, syncDoc }) {
  const srcEditPrev = new WeakMap()

  function luteEngine() {
    return window.Lute?.New?.() || null
  }

  function enterBlockSourceEdit(block, mdFallback) {
    if (!block || block.dataset.srcEdit === '1') return
    const lute = luteEngine()
    if (!lute) return notify('转换引擎未就绪，请稍后重试')
    let md
    try {
      md = (lute.VditorDOM2Md(block.outerHTML) || '').replace(/\n+$/, '')
    } catch {
      md = ''
    }
    if (!md.trim() && mdFallback) md = mdFallback.replace(/\n+$/, '')
    if (!md.trim()) return notify('未获取到源码')
    srcEditPrev.set(block, block.innerHTML)
    block.dataset.srcEdit = '1'
    block.setAttribute('contenteditable', 'false')

    const wrap = document.createElement('div')
    wrap.className = 'md-inline-src'
    const stopEv = (e) => e.stopPropagation()
    ;[
      'input', 'beforeinput', 'compositionstart', 'compositionupdate', 'compositionend',
      'keydown', 'keyup', 'keypress', 'paste', 'copy', 'cut', 'contextmenu',
      'mousedown', 'mouseup', 'click', 'auxclick', 'dblclick'
    ].forEach((ev) => wrap.addEventListener(ev, stopEv))
    const ta = document.createElement('textarea')
    ta.value = md
    ta.spellcheck = false
    const bar = document.createElement('div')
    bar.className = 'md-inline-src-bar'
    const cancel = document.createElement('button')
    cancel.textContent = '取消 (Esc)'
    const ok = document.createElement('button')
    ok.className = 'primary'
    ok.textContent = '应用 (Ctrl+Enter)'
    bar.append(cancel, ok)
    wrap.append(ta, bar)
    block.innerHTML = ''
    block.appendChild(wrap)

    const resize = () => {
      ta.style.height = 'auto'
      ta.style.height = ta.scrollHeight + 'px'
    }
    ta.addEventListener('input', resize)
    ta.addEventListener('keydown', (e) => {
      e.stopPropagation()
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault()
        finishBlockSourceEdit(block, true)
      } else if (e.key === 'Escape') {
        e.preventDefault()
        finishBlockSourceEdit(block, false)
      }
    })
    ta.addEventListener('click', (e) => e.stopPropagation())
    cancel.addEventListener('click', () => finishBlockSourceEdit(block, false))
    ok.addEventListener('click', () => finishBlockSourceEdit(block, true))
    ta.addEventListener('blur', () => {
      setTimeout(() => {
        if (block.dataset.srcEdit === '1' && !block.contains(document.activeElement)) {
          finishBlockSourceEdit(block, true)
        }
      }, 0)
    })

    ta.focus()
    ta.setSelectionRange(ta.value.length, ta.value.length)
    resize()
  }

  function finishBlockSourceEdit(block, apply) {
    if (!block || block.dataset.srcEdit !== '1') return
    const lute = luteEngine()
    const ta = block.querySelector('textarea')
    const md = ta ? ta.value : ''
    delete block.dataset.srcEdit
    block.removeAttribute('contenteditable')
    const prevHtml = srcEditPrev.get(block)
    srcEditPrev.delete(block)
    if (apply && lute && md.trim()) {
      try {
        const dom = lute.Md2VditorDOM(md)
        if (dom && dom.trim()) {
          block.outerHTML = dom
        } else {
          block.innerHTML = ''
        }
      } catch {
        notify('Markdown 解析失败，已保留原文')
        if (prevHtml != null) block.innerHTML = prevHtml
      }
    } else if (!apply && prevHtml != null) {
      block.innerHTML = prevHtml
    }
    syncDoc()
  }

  return { enterBlockSourceEdit, finishBlockSourceEdit, luteEngine }
}
