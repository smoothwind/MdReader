import { dataUrlToBytes, svgToPngBytes, exportBytes } from '../utils/exporters'
import { codeBlockText } from '../utils/dom-blocks'

/**
 * 块级导出：代码块 / 表格 / 图表 PNG、表格 Excel。
 * 依赖注入（均由宿主 EditorPane 提供）：
 *  - resolveTable / resolveMermaidPanel / resolveCodeBlock：按工具条索引定位目标元素
 *  - getBar：悬浮工具条状态（语言、序号用于命名文件）
 *  - baseName：导出文件名前缀；themeBg：主题背景色；notify：提示
 */
export function useBlockExports({
  resolveTable,
  resolveMermaidPanel,
  resolveCodeBlock,
  getBar,
  baseName,
  themeBg,
  notify
}) {
  async function exportCodeImage() {
    const bar = getBar()
    const block = resolveCodeBlock()
    if (!block) return notify('未找到代码块')
    const text = codeBlockText(block).replace(/\s+$/, '')
    if (!text.trim()) return notify('代码块为空')
    try {
      const { toPng } = await import('html-to-image')
      const holder = document.createElement('div')
      holder.style.cssText = 'position:fixed;left:-99999px;top:0;'
      const pre = document.createElement('pre')
      pre.textContent = text
      // 导出图内文样式取主题令牌运行时值（原暗色边框 #3a4356 统一为 --border #363e52）
      const cs = getComputedStyle(document.documentElement)
      const vFg = cs.getPropertyValue('--fg').trim()
      const vBg = cs.getPropertyValue('--bg-soft').trim()
      const vBorder = cs.getPropertyValue('--border').trim()
      pre.style.cssText = [
        'margin:0',
        'padding:16px 20px',
        'font-family:Consolas,"Cascadia Mono","Courier New",monospace',
        'font-size:13px',
        'line-height:1.5',
        'white-space:pre',
        'tab-size:4',
        'color:' + vFg,
        'background:' + vBg,
        'border:1px solid ' + vBorder,
        'border-radius:8px'
      ].join(';')
      holder.appendChild(pre)
      document.body.appendChild(holder)
      const data = await dataUrlToBytes(await toPng(pre, { pixelRatio: 2 }))
      holder.remove()
      const tag = bar.language ? '-' + bar.language : ''
      await exportBytes(data, `${baseName()}-code${tag}-${bar.index + 1}.png`, 'png', 'PNG 图片', {
        notify,
        okMsg: '已导出图片'
      })
    } catch {
      notify('导出失败')
    }
  }

  async function exportTableImage() {
    const bar = getBar()
    const table = resolveTable()
    if (!table) return
    try {
      const { toPng } = await import('html-to-image')
      const data = await dataUrlToBytes(await toPng(table, { pixelRatio: 2, backgroundColor: themeBg() }))
      await exportBytes(data, `${baseName()}-table-${bar.index + 1}.png`, 'png', 'PNG 图片', {
        notify,
        okMsg: '已导出图片'
      })
    } catch {
      notify('导出失败')
    }
  }

  async function exportTableExcel() {
    const bar = getBar()
    const table = resolveTable()
    if (!table) return
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.utils.table_to_book(table, { raw: false })
      const data = new Uint8Array(XLSX.write(wb, { bookType: 'xlsx', type: 'array' }))
      await exportBytes(data, `${baseName()}-table-${bar.index + 1}.xlsx`, 'xlsx', 'Excel 工作簿', {
        notify,
        okMsg: '已导出 Excel'
      })
    } catch {
      notify('导出失败')
    }
  }

  async function exportDiagramPng(lang) {
    const bar = getBar()
    const panel = resolveMermaidPanel()
    const svg = panel && panel.querySelector('svg')
    if (!svg) return
    try {
      const data = await svgToPngBytes(svg, themeBg())
      await exportBytes(data, `${baseName()}-${lang}-${bar.index + 1}.png`, 'png', 'PNG 图片', {
        notify,
        okMsg: '已导出 PNG'
      })
    } catch {
      notify('导出失败')
    }
  }

  function exportMermaidPng() {
    return exportDiagramPng('mermaid')
  }

  function exportMarkmapPng() {
    return exportDiagramPng('markmap')
  }

  return {
    exportCodeImage,
    exportTableImage,
    exportTableExcel,
    exportDiagramPng,
    exportMermaidPng,
    exportMarkmapPng
  }
}
