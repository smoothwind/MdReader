import { reactive } from 'vue'
import { t } from '../i18n'

const SEARCH_COLLECT_MS = 200
const SEARCH_RECOLLECT_MS = 250
const REPLACE_ALL_MAX = 1000
const REPLACE_ALL_YIELD_EVERY = 50

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** 构造匹配器：普通文本 / 整词 / 正则；返回 null 表示模式无效 */
function buildMatcher(search) {
  if (!search.query) return null
  try {
    if (search.regex) {
      return new RegExp(search.query, search.caseSensitive ? 'g' : 'gi')
    }
    const src = search.wholeWord ? '\\b' + escapeRe(search.query) + '\\b' : escapeRe(search.query)
    return new RegExp(src, search.caseSensitive ? 'g' : 'gi')
  } catch {
    return null
  }
}

/**
 * 查找/替换：DOM 文本节点收集匹配 + 选区定位 + 逐个/全部替换。
 * 支持普通文本 / 整词 / 正则三种模式。
 * 由 EditorPane 注入 rootEl/getScroller/selectRange/notify。
 */
export function useSearch({ getRootEl, getScroller, notify, selectRange }) {
  const search = reactive({
    open: false,
    withReplace: false,
    query: '',
    replaceText: '',
    caseSensitive: false,
    regex: false,
    wholeWord: false,
    index: 0,
    info: ''
  })
  let searchMatches = []
  let collectTimer = null

  function collectMatches() {
    const root = getRootEl()
    searchMatches = []
    const matcher = buildMatcher(search)
    if (!root || !matcher) {
      if (root && search.query) search.info = t('search.invalidRegex')
      return searchMatches
    }
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    let node
    while ((node = walker.nextNode())) {
      const text = node.nodeValue
      if (!text) continue
      matcher.lastIndex = 0
      let m
      while ((m = matcher.exec(text))) {
        searchMatches.push({ node, start: m.index, end: m.index + m[0].length, text: m[0] })
        if (m[0].length === 0) matcher.lastIndex++
        if (searchMatches.length >= REPLACE_ALL_MAX) break
      }
      if (searchMatches.length >= REPLACE_ALL_MAX) break
    }
    return searchMatches
  }

  function scheduleCollect(resetIndex) {
    collectMatches()
    if (resetIndex) gotoMatch(0)
    else gotoMatch(Math.min(search.index, Math.max(0, searchMatches.length - 1)))
  }

  function gotoMatch(i) {
    if (!search.query) {
      search.info = ''
      return
    }
    if (!searchMatches.length) {
      search.info = t('search.noResult')
      search.index = 0
      return
    }
    search.index = ((i % searchMatches.length) + searchMatches.length) % searchMatches.length
    const m = searchMatches[search.index]
    try {
      const range = document.createRange()
      range.setStart(m.node, m.start)
      range.setEnd(m.node, m.end)
      const sel = window.getSelection()
      sel.removeAllRanges()
      sel.addRange(range)
      const el = m.node.parentElement
      const sc = getScroller()
      if (el && sc) {
        const r = el.getBoundingClientRect()
        const cr = sc.getBoundingClientRect()
        if (r.top < cr.top + 40 || r.bottom > cr.bottom - 40) el.scrollIntoView({ block: 'center' })
      } else if (el) {
        el.scrollIntoView({ block: 'center' })
      }
      search.info = `${search.index + 1} / ${searchMatches.length}`
    } catch {
      collectMatches()
    }
  }

  function onSearchKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      gotoMatch(search.index + (e.shiftKey ? -1 : 1))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
    }
  }

  function onReplaceKeydown(e) {
    if (e.key === 'Enter') {
      e.preventDefault()
      replaceCurrent()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      closeSearch()
    }
  }

  function onQueryInput() {
    clearTimeout(collectTimer)
    collectTimer = setTimeout(() => scheduleCollect(true), SEARCH_COLLECT_MS)
  }

  /** 输入管线触发的重收集（EditorPane 在 vditor input 回调中调用） */
  function touchCollect() {
    if (!search.open) return
    clearTimeout(collectTimer)
    collectTimer = setTimeout(() => scheduleCollect(false), SEARCH_RECOLLECT_MS)
  }

  function toggleCase() {
    search.caseSensitive = !search.caseSensitive
    scheduleCollect(true)
  }

  function toggleRegex() {
    search.regex = !search.regex
    if (search.regex) search.wholeWord = false
    scheduleCollect(true)
  }

  function toggleWholeWord() {
    search.wholeWord = !search.wholeWord
    if (search.wholeWord) search.regex = false
    scheduleCollect(true)
  }

  function openSearch(withReplace) {
    search.open = true
    if (withReplace) search.withReplace = true
    const selText = window.getSelection()?.toString() || ''
    if (selText.trim() && !selText.includes('\n')) search.query = selText
    scheduleCollect(true)
  }

  function closeSearch() {
    search.open = false
    searchMatches = []
    search.info = ''
    try {
      window.getSelection()?.removeAllRanges()
    } catch {
      /* ignore */
    }
  }

  function replaceCurrent() {
    if (!searchMatches.length) return
    gotoMatch(search.index)
    try {
      document.execCommand('insertText', false, search.replaceText)
    } catch {
      /* ignore */
    }
    scheduleCollect(false)
  }

  /**
   * 全部替换（增量化）：一次性收集全部匹配后按文档位置倒序逐个替换，
   * 避免旧实现"每次替换后全文档重扫"的 O(n²) 开销；倒序保证未处理匹配的偏移不受影响。
   */
  async function replaceAll() {
    if (!search.query) return
    collectMatches()
    const list = [...searchMatches].reverse()
    let count = 0
    for (const m of list) {
      if (count >= REPLACE_ALL_MAX) break
      const v = m.node.nodeValue
      // 倒序替换时前置内容未受影响，切片应与收集到的原文一致，否则跳过
      if (v == null || m.end > v.length) continue
      if (v.slice(m.start, m.end) !== m.text) continue
      try {
        const range = document.createRange()
        range.setStart(m.node, m.start)
        range.setEnd(m.node, m.end)
        selectRange(range)
        document.execCommand('insertText', false, search.replaceText)
        count++
      } catch {
        break
      }
      if (count % REPLACE_ALL_YIELD_EVERY === 0) await new Promise((r) => setTimeout(r, 0))
    }
    scheduleCollect(false)
    notify(count > 0 ? t('search.replaced', { count }) : t('search.noMatches'))
  }

  function dispose() {
    clearTimeout(collectTimer)
  }

  return {
    search,
    collectMatches,
    openSearch,
    closeSearch,
    gotoMatch,
    replaceCurrent,
    replaceAll,
    onQueryInput,
    onSearchKeydown,
    onReplaceKeydown,
    toggleCase,
    toggleRegex,
    toggleWholeWord,
    touchCollect,
    dispose
  }
}
