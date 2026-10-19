#!/usr/bin/env node
/**
 * scripts/sync-ux.mjs — 从隔壁 UX-FRW monorepo 同步源码到 vendor/uxkit/
 *
 * CI / GitHub Pages 构建环境没有 ../UX-FRW，vendor 副本是唯一的构建来源；
 * 本地开发仍默认源码直连 ../UX-FRW（见 scripts/ux-aliases.mjs），
 * 修改 UX-FRW 后运行 `npm run sync-ux` 保持 vendor 副本最新。
 *
 * 排除测试文件（__tests__、*.test.ts、*.spec.ts），vendor 内不允许出现
 * vitest / @vue/test-utils 等未安装依赖。
 */
import { cpSync, existsSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs'
import path from 'node:path'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const SRC = resolve(root, '../UX-FRW/packages')
const DEST = resolve(root, 'vendor/uxkit')
const PKGS = ['tokens', 'composables', 'services', 'components', 'shell', 'patterns']

if (!existsSync(SRC)) {
  console.error(`[sync-ux] 未找到上游目录：${SRC}（vendor/uxkit 保持不变）`)
  process.exit(1)
}

function hasTests(dir) {
  for (const name of readdirSync(dir)) {
    const p = resolve(dir, name)
    if (statSync(p).isDirectory()) {
      if (name === '__tests__' || hasTests(p)) return true
    } else if (/(\.test|\.spec)\.[cm]?[jt]sx?$/.test(name)) {
      return true
    }
  }
  return false
}

rmSync(DEST, { recursive: true, force: true })
mkdirSync(DEST, { recursive: true })
for (const pkg of PKGS) {
  const src = resolve(SRC, pkg, 'src')
  if (!existsSync(src)) {
    console.error(`[sync-ux] 缺少 ${pkg}/src，跳过`)
    continue
  }
  cpSync(src, resolve(DEST, pkg, 'src'), {
    recursive: true,
    filter: (s) => {
      const base = s.split(/[\\/]/).pop()
      if (base === '__tests__') return false
      return !/(\.test|\.spec)\.[cm]?[jt]sx?$/.test(base)
    }
  })
  if (hasTests(resolve(DEST, pkg, 'src'))) {
    console.error(`[sync-ux] ${pkg} 仍含测试文件，请检查 filter 规则`)
    process.exit(1)
  }
  console.log(`[sync-ux] ${pkg} 已同步`)
}
