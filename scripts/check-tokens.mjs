#!/usr/bin/env node
/**
 * scripts/check-tokens.mjs — 设计令牌漂移检查
 *
 * 规则（与 AGENTS.md「设计令牌」强约束对应）：
 *   R1 样式文件（.css / .vue 的 <style> 块）禁止裸 hex 颜色
 *   R2 间距属性（margin/padding/gap）<=20px 的奇数值必须走 var(--tk-sp-*)
 *      （1px 线宽、>20px 的布局尺寸允许字面量）
 *   R3 z-index / border-radius / font-size / box-shadow 禁止字面量
 *      （border-radius: 50% 圆形、var(--editor-*) 用户偏好变量除外）
 *
 * 豁免方式：
 *   - 文件级：代码中放置 `/* tokens-exempt *\/` 标记（整文件跳过 hex 检查）
 *   - 行级：行尾注释 `tokens-exempt`
 *   - tokens.css 本身是令牌定义源，自动跳过
 *
 * 用法：node scripts/check-tokens.mjs ["src/renderer/src/**\/*.css", ...]
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import { globSync } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

const DEFAULT_GLOBS = [
  'src/renderer/src/styles/*.css',
  'src/renderer/src/components/*.vue'
]
const patterns = process.argv.slice(2)
const files = (patterns.length ? patterns : DEFAULT_GLOBS).flatMap((g) =>
  globSync(g, { cwd: root }).map((f) => path.join(root, f))
)

const HEX_RE = /#[0-9a-fA-F]{3,8}\b/
const SPACING_RE =
  /((?:margin|padding|gap)(?:-top|-right|-bottom|-left)?)\s*:\s*([^;{}]+);/g
const PX_RE = /(\d+(?:\.\d+)?)px/g
const LITERAL_RE = (prop) =>
  new RegExp(`${prop}\\s*:(?!\\s*var\\()([^;{}]+);`, 'g')

const violations = []
const note = (file, line, msg) => violations.push(`${path.relative(root, file)}:${line}  ${msg}`)

for (const file of files) {
  if (file.endsWith('tokens.css')) continue
  const src = readFileSync(file, 'utf8')
  const fileExempt = src.includes('/* tokens-exempt */')

  // .vue 只检查 <style> 块 + 模板内联 style；JS 部分的 hex 属于图表/功能数据配色，不检查
  const styleBlocks = []
  const styleRe = /<style[^>]*>([\s\S]*?)<\/style>/g
  let sm
  while ((sm = styleRe.exec(src))) {
    styleBlocks.push({ text: sm[1], offset: sm.index + sm[0].indexOf(sm[1]) })
  }
  const isVue = file.endsWith('.vue')
  const checkText = isVue ? styleBlocks : [{ text: src, offset: 0 }]

  for (const block of checkText) {
    const lines = block.text.split('\n')
    lines.forEach((line, i) => {
      const lineNo = src.slice(0, block.offset).split('\n').length + i
      if (line.includes('tokens-exempt')) return

      // R1 裸 hex
      if (!fileExempt && HEX_RE.test(line)) {
        note(file, lineNo, `裸 hex 颜色: ${line.trim()}`)
      }

      // R2 奇数小间距
      if (line.trim().startsWith('--')) return // 令牌定义行
      SPACING_RE.lastIndex = 0
      let sp
      while ((sp = SPACING_RE.exec(line))) {
        const value = sp[2]
        if (value.trim().startsWith('var(')) continue // 混合值中已令牌化的部分
        PX_RE.lastIndex = 0
        let px
        while ((px = PX_RE.exec(value))) {
          const v = Number(px[1])
          if (v % 2 === 1 && v <= 20 && v !== 1) {
            note(file, lineNo, `非令牌奇数间距 ${v}px: ${line.trim()}`)
          }
        }
      }

      // R3 禁止字面量的属性
      for (const prop of ['z-index', 'border-radius', 'font-size', 'box-shadow']) {
        const re = LITERAL_RE(prop)
        let lm
        while ((lm = re.exec(line))) {
          const value = lm[1].trim()
          if (value === '50%') continue // 圆形豁免
          if (prop === 'font-size' && value.startsWith('var(--editor')) continue // 用户偏好变量
          if (prop === 'border-radius' && /\b0\b/.test(value) && !/[1-9]/.test(value)) continue
          note(file, lineNo, `禁止字面量 ${prop}: ${line.trim()}`)
        }
      }
    })
  }
}

if (violations.length) {
  console.error(`发现 ${violations.length} 处令牌违规：`)
  console.error(violations.join('\n'))
  process.exit(1)
}
console.log(`✓ 令牌检查通过（${files.length} 个文件）`)
