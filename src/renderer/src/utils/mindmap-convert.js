export function mdListToTree(text) {
  const lines = (text || '').split('\n').filter((l) => l.trim())
  const tops = []
  const stack = []
  let seq = 0
  for (const raw of lines) {
    const expanded = raw.replace(/\t/g, '    ')
    const indent = expanded.match(/^ */)[0].length
    const content = expanded
      .trim()
      .replace(/^[-*+]\s+/, '')
      .replace(/^\d+[.)]\s+/, '')
      .trim()
    if (!content) continue
    const level = Math.floor(indent / 2)
    const node = { id: 'n' + ++seq, topic: content, children: [] }
    while (stack.length > level) stack.pop()
    if (stack.length === 0) tops.push(node)
    else stack[stack.length - 1].children.push(node)
    stack.push(node)
  }
  if (tops.length === 0) return { id: 'n0', topic: '脑图', children: [] }
  if (tops.length === 1) return tops[0]
  const root = tops[0]
  root.children = [...(root.children || []), ...tops.slice(1)]
  return root
}

export function treeToMdList(node) {
  const lines = []
  const walk = (n, depth) => {
    lines.push('  '.repeat(depth) + '- ' + String(n.topic || '').replace(/\n+/g, ' ').trim())
    ;(n.children || []).forEach((c) => walk(c, depth + 1))
  }
  if (node) walk(node, 0)
  return lines.join('\n')
}
