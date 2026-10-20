/**
 * 表格样式记忆：按「文档 filePath + 表格序号」记忆样式类，DOM 变更后重放。
 * 依赖注入：getRootEl 返回编辑器根元素；getActiveDoc 返回活动标签（含 filePath）或 null。
 * 样式映射带缓存：避免每次 DOM 变更都同步读 localStorage + JSON.parse；
 * 写入时原地更新缓存对象，读写共用同一引用。
 */
const DEFAULT_TABLE_STYLE = 'md-tbl-compact'

const TABLE_STYLES = [
  { name: 'md-tbl-default', labelKey: 'style.loose' },
  { name: 'md-tbl-zebra', labelKey: 'style.zebra' },
  { name: 'md-tbl-compact', labelKey: 'style.compact' },
  { name: 'md-tbl-plain', labelKey: 'style.plain' }
]

export function useTableStyles({ getRootEl, getActiveDoc }) {
  let styleMapCache = { key: null, map: null }

  function styleStoreKey() {
    return 'mdreader:tblstyle:' + (getActiveDoc()?.filePath || 'untitled')
  }

  function readStyleMap() {
    const key = styleStoreKey()
    if (styleMapCache.key === key && styleMapCache.map) return styleMapCache.map
    let map
    try {
      map = JSON.parse(localStorage.getItem(key) || '{}') || {}
    } catch {
      map = {}
    }
    styleMapCache = { key, map }
    return map
  }

  /** 把记忆的样式类重放到当前 DOM 的全部表格（MutationObserver 合帧调用） */
  function applyRememberedStyles() {
    const root = getRootEl()
    if (!root) return
    const map = readStyleMap()
    // 无历史样式且当前表格未带样式类：直接跳过（避免每次输入都全量比对）
    if (!Object.keys(map).length && !root.querySelector('table[class*="md-tbl-"]')) return
    root.querySelectorAll('table').forEach((t, i) => {
      const name = map[i] || DEFAULT_TABLE_STYLE
      TABLE_STYLES.forEach(({ name: n }) => {
        if (n !== 'md-tbl-default') t.classList.toggle(n, n === name)
      })
    })
  }

  /** 应用样式到单个表格并持久化（样式菜单选择时调用） */
  function applyStyle(table, index, name) {
    TABLE_STYLES.forEach(({ name: n }) => {
      if (n !== 'md-tbl-default') table.classList.remove(n)
    })
    if (name !== 'md-tbl-default') table.classList.add(name)
    const map = readStyleMap()
    map[index] = name
    try {
      localStorage.setItem(styleStoreKey(), JSON.stringify(map))
    } catch {
      /* ignore */
    }
  }

  return { DEFAULT_TABLE_STYLE, TABLE_STYLES, applyRememberedStyles, applyStyle }
}
