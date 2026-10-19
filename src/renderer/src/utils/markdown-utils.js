// 纯函数：Markdown 相关统计与转换（无 DOM 依赖，可单元测试）

export function computeStats(text) {
  const clean = text.replace(/```[\s\S]*?```/g, ' ')
  const cjk = (clean.match(/[\u4e00-\u9fff\u3400-\u4dbf]/g) || []).length
  const words = (clean.match(/[A-Za-z0-9]+/g) || []).length + cjk
  return {
    wordCount: words,
    characterCount: clean.replace(/\s/g, '').length,
    lineCount: text.split('\n').length
  }
}

export function tableToMarkdown(table) {
  if (!table) return ''
  const clean = (s) =>
    (s || '').replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ').trim()
  const lines = []
  const rows = table.querySelectorAll('tr')
  rows.forEach((tr, i) => {
    const cells = [...tr.children]
      .filter((c) => c.tagName === 'TD' || c.tagName === 'TH')
      .map((c) => clean(c.textContent))
    if (!cells.length) return
    lines.push('| ' + cells.join(' | ') + ' |')
    if (i === 0) lines.push('|' + cells.map(() => ' --- ').join('|') + '|')
  })
  return lines.join('\n')
}

export function replaceCodeBlockInMd(md, lang, index, newCode) {
  let seen = -1
  const re = new RegExp('^```' + lang + '\\s*\\n([\\s\\S]*?)```\\s*$', 'gm')
  return md.replace(re, (m) => {
    seen++
    if (seen === index) return '```' + lang + '\n' + newCode.replace(/\s+$/, '') + '\n```'
    return m
  })
}
