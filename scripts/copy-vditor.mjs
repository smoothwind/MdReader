import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'node_modules', 'vditor', 'dist')
const dest = join(root, 'src', 'renderer', 'public', 'vditor', 'dist')

if (!existsSync(src)) {
  console.error('[copy-vditor] vditor dist not found:', src)
  process.exit(1)
}

// 白名单复制：只保留运行时会懒加载的资源（懒加载路径可 grep dist/index.min.js 确认）。
// 被排除的渲染器（mathjax/graphviz/echarts/abcjs/wavedrom/smiles-drawer/plantuml/flowchart）
// 在文档中书写对应代码块时不会渲染（应用未使用这些能力，默认约省 11MB 安装/部署体积）；
// 数学渲染用默认 KaTeX 引擎。如需支持某个能力，把对应目录加回 KEEP 即可。
const KEEP = [
  'index.min.js',
  'method.min.js',
  'index.css',
  'css/content-theme',
  'images',
  'js/icons',
  'js/i18n',
  'js/lute',
  'js/highlight.js',
  'js/katex',
  'js/mermaid',
  'js/markmap'
]

rmSync(dest, { recursive: true, force: true })
mkdirSync(dest, { recursive: true })
for (const rel of KEEP) {
  const from = join(src, rel)
  if (!existsSync(from)) {
    console.warn('[copy-vditor] skip missing:', rel)
    continue
  }
  cpSync(from, join(dest, rel), { recursive: true })
}
console.log('[copy-vditor] copied', KEEP.length, 'entries ->', dest)
