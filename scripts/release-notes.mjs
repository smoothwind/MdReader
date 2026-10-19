// 从 CHANGELOG.md 提取指定版本的发布说明，写入 release-notes.md（供 release 工作流使用）
import { readFileSync, writeFileSync } from 'node:fs'

const tag = (process.argv[2] || '').replace(/^v/, '').trim()
if (!tag) {
  console.error('用法: node scripts/release-notes.mjs <tag>')
  process.exit(1)
}

const lines = readFileSync('CHANGELOG.md', 'utf-8').split('\n')
const esc = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
const headRe = new RegExp(`^##\\s+v?${esc}(?=$|[\\s（(])`)
const start = lines.findIndex((l) => headRe.test(l))

if (start < 0) {
  writeFileSync('release-notes.md', '')
  console.log(`[release-notes] 未找到 ${tag} 的更新日志，正文留空`)
  process.exit(0)
}

let end = lines.length
for (let i = start + 1; i < lines.length; i++) {
  if (/^##\s/.test(lines[i])) {
    end = i
    break
  }
}
const body = lines.slice(start + 1, end).join('\n').trim()
writeFileSync('release-notes.md', body + '\n')
console.log(`[release-notes] ${tag}: ${body.split('\n').length} 行`)
