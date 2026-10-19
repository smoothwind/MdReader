// 链接原地编辑：在 <a> 内注入文本/地址输入框。
// 关键：容器上所有冒泡事件 stopPropagation，防止输入事件进入 Vditor 管线
// 导致 DOM 被序列化/重渲染（AGENTS.md 规则 1）。

const EDIT_EVENTS = [
  'input', 'beforeinput', 'compositionstart', 'compositionupdate', 'compositionend',
  'keydown', 'keyup', 'keypress', 'paste', 'copy', 'cut', 'contextmenu', 'dblclick',
  'mousedown', 'mouseup'
]

export function useLinkEdit({ notify, syncDoc }) {
  const linkEditPrev = new WeakMap()

  function enterLinkEdit(a) {
    if (!a || a.dataset.linkEdit === '1') return
    linkEditPrev.set(a, a.cloneNode(true))
    a.dataset.linkEdit = '1'
    a.setAttribute('contenteditable', 'false')
    const text = (a.textContent || '').replace(/\u200b/g, '')
    const href = a.getAttribute('href') || ''

    const wrap = document.createElement('span')
    wrap.className = 'md-link-edit'
    const stopEv = (e) => e.stopPropagation()
    const preventEv = (e) => e.preventDefault()
    EDIT_EVENTS.forEach((ev) => wrap.addEventListener(ev, stopEv))
    wrap.addEventListener('click', preventEv)
    wrap.addEventListener('auxclick', preventEv)
    wrap.addEventListener('dragstart', preventEv)
    wrap.addEventListener('mousedown', (e) => {
      stopEv(e)
      if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'BUTTON') preventEv(e)
    })
    const t = document.createElement('input')
    t.className = 'mle-input'
    t.value = text
    t.placeholder = '文本'
    const u = document.createElement('input')
    u.className = 'mle-input mle-url'
    u.value = href
    u.placeholder = '地址'
    const ok = document.createElement('button')
    ok.className = 'mle-btn primary'
    ok.textContent = '应用'
    const cancel = document.createElement('button')
    cancel.className = 'mle-btn'
    cancel.textContent = '取消'
    wrap.append(t, u, ok, cancel)
    a.innerHTML = ''
    a.appendChild(wrap)

    const apply = () => finishLinkEdit(a, true)
    const cancelFn = () => finishLinkEdit(a, false)
    const onKey = (e) => {
      e.stopPropagation()
      if (e.key === 'Enter') {
        e.preventDefault()
        apply()
      } else if (e.key === 'Escape') {
        e.preventDefault()
        cancelFn()
      }
    }
    ;[t, u].forEach((input) => {
      input.addEventListener('keydown', onKey)
      input.addEventListener('click', (e) => e.stopPropagation())
    })
    ok.addEventListener('click', apply)
    cancel.addEventListener('click', cancelFn)
    t.focus()
    t.select()
  }

  function finishLinkEdit(a, apply) {
    if (!a || a.dataset.linkEdit !== '1') return
    delete a.dataset.linkEdit
    a.removeAttribute('contenteditable')
    const prev = linkEditPrev.get(a)
    linkEditPrev.delete(a)
    const inputs = a.querySelectorAll('input')
    const text = (inputs[0]?.value || '').trim()
    const url = (inputs[1]?.value || '').trim()
    if (apply) {
      a.textContent = text || url || '链接'
      if (url) a.setAttribute('href', url)
      else a.removeAttribute('href')
      notify('链接已更新')
    } else if (prev) {
      a.replaceWith(prev)
    }
    syncDoc()
  }

  return { enterLinkEdit }
}
