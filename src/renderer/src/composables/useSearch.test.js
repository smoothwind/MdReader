import { beforeAll, describe, expect, it, vi } from 'vitest'
import { useSearch } from './useSearch'
import { setLocale } from '../i18n'

const mockSel = {
  ranges: [],
  rangeCount: 0,
  removeAllRanges() {
    this.ranges = []
    this.rangeCount = 0
  },
  addRange(r) {
    this.ranges = [r]
    this.rangeCount = 1
  },
  getRangeAt(i) {
    return this.ranges[i]
  },
  toString() {
    return ''
  }
}

beforeAll(() => {
  // 文案断言基于中文词典；locale 默认跟随 jsdom 的 navigator.language
  setLocale('zh-CN', { persist: false, notifyNative: false })
  window.getSelection = () => mockSel
  Element.prototype.scrollIntoView = vi.fn()
  // 模拟 execCommand('insertText')：按当前选区执行真实文本替换
  document.execCommand = vi.fn((_cmd, _ui, text) => {
    const r = mockSel.ranges[0]
    if (!r) return false
    const node = r.startContainer
    const v = node.nodeValue || ''
    node.nodeValue = v.slice(0, r.startOffset) + text + v.slice(r.endOffset)
    return true
  })
})

function setup(html) {
  const host = document.createElement('div')
  host.innerHTML = html
  document.body.appendChild(host)
  const notified = []
  const selectRange = (r) => mockSel.addRange(r)
  const api = useSearch({
    getRootEl: () => host,
    getScroller: () => null,
    notify: (m) => notified.push(m),
    selectRange
  })
  return { host, api, notified }
}

describe('useSearch collectMatches', () => {
  it('普通文本匹配计数', () => {
    const { host, api } = setup('<p>hello world hello</p>')
    api.search.query = 'hello'
    expect(api.collectMatches().length).toBe(2)
    expect(host.textContent).toBe('hello world hello')
  })

  it('大小写不敏感为默认', () => {
    const { api } = setup('<p>Hello HELLO hello</p>')
    api.search.query = 'hello'
    expect(api.collectMatches().length).toBe(3)
  })

  it('区分大小写', () => {
    const { api } = setup('<p>Hello HELLO hello</p>')
    api.search.query = 'hello'
    api.search.caseSensitive = true
    expect(api.collectMatches().length).toBe(1)
  })

  it('整词匹配不命中子串', () => {
    const { api } = setup('<p>hello helloX Xhello</p>')
    api.search.query = 'hello'
    api.search.wholeWord = true
    expect(api.collectMatches().length).toBe(1)
  })

  it('正则匹配与无效正则', () => {
    const { api } = setup('<p>a1b a2b abc</p>')
    api.search.query = 'a\\db'
    api.search.regex = true
    expect(api.collectMatches().length).toBe(2)
    api.search.query = 'a('
    expect(api.collectMatches().length).toBe(0)
    expect(api.search.info).toBe('正则无效')
  })

  it('跨节点不串扰', () => {
    const { api } = setup('<p>foo</p><p>bar</p>')
    api.search.query = 'bar'
    const m = api.collectMatches()
    expect(m.length).toBe(1)
    expect(m[0].node.nodeValue).toBe('bar')
  })
})

describe('useSearch replaceAll', () => {
  it('同节点多处倒序替换全部命中', async () => {
    const { host, api, notified } = setup('<p>hello world hello</p>')
    api.search.query = 'hello'
    api.search.replaceText = 'hi'
    await api.replaceAll()
    expect(host.textContent).toBe('hi world hi')
    expect(notified.join()).toContain('已替换 2 处')
  })

  it('大小写不敏感替换保留原文本校验', async () => {
    const { host, api } = setup('<p>Hello hello</p>')
    api.search.query = 'hello'
    api.search.replaceText = 'x'
    await api.replaceAll()
    expect(host.textContent).toBe('x x')
  })

  it('无匹配时提示', async () => {
    const { api, notified } = setup('<p>abc</p>')
    api.search.query = 'zzz'
    api.search.replaceText = 'x'
    await api.replaceAll()
    expect(notified.join()).toContain('未找到匹配内容')
  })
})

describe('useSearch 状态流转', () => {
  it('openSearch 带入选区文本 / closeSearch 清理', () => {
    const { api } = setup('<p>hello</p>')
    window.getSelection = () => ({ ...mockSel, toString: () => 'picked' })
    api.openSearch(false)
    expect(api.search.open).toBe(true)
    expect(api.search.query).toBe('picked')
    api.closeSearch()
    expect(api.search.open).toBe(false)
    expect(api.collectMatches().length).toBe(0)
  })

  it('toggleRegex 与 wholeWord 互斥', () => {
    const { api } = setup('<p>x</p>')
    api.toggleWholeWord()
    expect(api.search.wholeWord).toBe(true)
    api.toggleRegex()
    expect(api.search.regex).toBe(true)
    expect(api.search.wholeWord).toBe(false)
    api.toggleWholeWord()
    expect(api.search.regex).toBe(false)
  })
})
