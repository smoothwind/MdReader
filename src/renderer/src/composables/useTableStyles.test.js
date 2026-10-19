import { describe, expect, it } from 'vitest'
import { useTableStyles } from './useTableStyles'

function makeRoot(tableCount) {
  const root = document.createElement('div')
  for (let i = 0; i < tableCount; i++) {
    const t = document.createElement('table')
    const tr = document.createElement('tr')
    const td = document.createElement('td')
    tr.appendChild(td)
    t.appendChild(tr)
    root.appendChild(t)
  }
  document.body.appendChild(root)
  return root
}

function apiFor(filePath) {
  return useTableStyles({
    getRootEl: () => root,
    getActiveDoc: () => (filePath ? { filePath } : null)
  })
}

let root = null

describe('useTableStyles', () => {
  it('applyStyle 写入样式类并持久化到 localStorage', () => {
    root = makeRoot(2)
    const { applyStyle, TABLE_STYLES } = apiFor('doc-a.md')
    expect(TABLE_STYLES.length).toBe(4)
    applyStyle(root.querySelectorAll('table')[1], 1, 'md-tbl-zebra')
    expect(root.querySelectorAll('table')[1].classList.contains('md-tbl-zebra')).toBe(true)
    const stored = JSON.parse(localStorage.getItem('mdreader:tblstyle:doc-a.md'))
    expect(stored[1]).toBe('md-tbl-zebra')
  })

  it('切换样式会清除旧样式类（default 表示清除全部）', () => {
    const { applyStyle } = apiFor('doc-a.md')
    const table = root.querySelectorAll('table')[1]
    expect(table.classList.contains('md-tbl-zebra')).toBe(true)
    applyStyle(table, 1, 'md-tbl-default')
    expect(table.classList.contains('md-tbl-zebra')).toBe(false)
    const stored = JSON.parse(localStorage.getItem('mdreader:tblstyle:doc-a.md'))
    expect(stored[1]).toBe('md-tbl-default')
  })

  it('applyRememberedStyles 按文档回放样式；空映射且无样式类时跳过', () => {
    localStorage.setItem('mdreader:tblstyle:doc-b.md', JSON.stringify({ 0: 'md-tbl-plain' }))
    root = makeRoot(1)
    // 空映射文档：不改动任何表格
    apiFor('doc-c.md').applyRememberedStyles()
    expect(root.querySelector('table').className).toBe('')
    // 有映射文档：回放对应样式
    apiFor('doc-b.md').applyRememberedStyles()
    expect(root.querySelector('table').classList.contains('md-tbl-plain')).toBe(true)
  })

  it('不同文档的映射互相隔离', () => {
    root = makeRoot(1)
    apiFor('doc-c.md').applyRememberedStyles()
    // doc-b 的样式不应落到 doc-c 的表格上
    expect(root.querySelector('table').classList.contains('md-tbl-plain')).toBe(false)
    localStorage.setItem('mdreader:tblstyle:doc-c.md', JSON.stringify({ 0: 'md-tbl-zebra' }))
    apiFor('doc-c.md').applyRememberedStyles()
    expect(root.querySelector('table').classList.contains('md-tbl-zebra')).toBe(true)
  })
})
