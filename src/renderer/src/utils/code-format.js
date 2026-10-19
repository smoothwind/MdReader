// 纯函数：SQL / JSON 格式化与压缩（无 DOM 依赖，可单元测试）

export function parseJsonLoose(text) {
  try {
    return JSON.parse(text)
  } catch {
    /* try loose */
  }
  try {
    const noComments = text.replace(/\/\/[^\n]*/g, '').replace(/\/\*[\s\S]*?\*\//g, '')
    return JSON.parse(noComments.replace(/,\s*([}\]])/g, '$1'))
  } catch {
    return undefined
  }
}

export function minifySql(sql) {
  let out = ''
  let pending = false
  const needSpaceBefore = (ch) => {
    if (!out) return false
    const last = out[out.length - 1]
    if (',;)'.includes(ch)) return false
    if ('(;'.includes(last)) return false
    return true
  }
  let i = 0
  const n = sql.length
  while (i < n) {
    const ch = sql[i]
    if (ch === "'" || ch === '"' || ch === '`') {
      let j = i + 1
      while (j < n) {
        if (ch === "'" && sql[j] === "'" && sql[j + 1] === "'") {
          j += 2
          continue
        }
        if (sql[j] === ch) break
        j++
      }
      const seg = sql.slice(i, Math.min(j + 1, n))
      if (pending) {
        if (needSpaceBefore(seg[0])) out += ' '
        pending = false
      }
      out += seg
      i = j + 1
      continue
    }
    if (ch === '-' && sql[i + 1] === '-') {
      while (i < n && sql[i] !== '\n') i++
      pending = out.length > 0
      continue
    }
    if (ch === '/' && sql[i + 1] === '*') {
      i += 2
      while (i < n && !(sql[i] === '*' && sql[i + 1] === '/')) i++
      i += 2
      pending = out.length > 0
      continue
    }
    if (/\s/.test(ch)) {
      if (out) pending = true
      i++
      continue
    }
    if (pending) {
      if (needSpaceBefore(ch)) out += ' '
      pending = false
    }
    out += ch
    i++
  }
  return out.trim()
}

export async function formatCode(lang, code, mode) {
  if (lang === 'json') {
    const parsed = parseJsonLoose(code)
    if (parsed === undefined) return null
    return mode === 'pretty' ? JSON.stringify(parsed, null, 2) : JSON.stringify(parsed)
  }
  if (mode === 'pretty') {
    try {
      const { format } = await import('sql-formatter')
      return format(code, { language: 'sql' })
    } catch {
      return null
    }
  }
  return minifySql(code)
}
