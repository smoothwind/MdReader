// 校验三份菜单命令映射无漂移：
//   1. src/main/index.js      —— Electron 菜单 action('xxx') / send('menu:action', 'xxx')
//   2. src-tauri/src/lib.rs   —— Tauri 菜单 match 表 "id" => "name"
//   3. App.vue menuActions    —— 渲染层命令处理表
// 任一端使用了渲染层未注册的命令名时，脚本以非零码退出（CI 拦截）。
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(resolve(root, p), 'utf-8')

const indexJs = read('src/main/index.js')
const libRs = read('src-tauri/src/lib.rs')
const appVue = read('src/renderer/src/App.vue')

// 渲染层注册的命令：menuActions 表的键 + 'theme'（onMenuAction 中特判）
const actionsBlock = appVue.match(/const menuActions = \{([\s\S]*?)\n\}/)?.[1] || ''
const rendererActions = new Set(['theme'])
for (const m of actionsBlock.matchAll(/'([^']+)'\s*:/g)) rendererActions.add(m[1])
for (const m of actionsBlock.matchAll(/(?<=^|\s)([a-z][\w:-]+)\s*:/gm)) rendererActions.add(m[1])

// Electron 菜单用到的命令
const electronActions = new Set()
for (const m of indexJs.matchAll(/action\('([^']+)'\)/g)) electronActions.add(m[1])
for (const m of indexJs.matchAll(/send\('menu:action',\s*'([^']+)'/g)) electronActions.add(m[1])

// Tauri 菜单映射的目标命令（match 表右侧）+ 直接 emit 的 ("about"/"theme"/"file:new")
const tauriActions = new Set()
for (const m of libRs.matchAll(/=>\s*"(file:[^"]+|view:[^"]+|edit:[^"]+|fmt:[^"]+|insert:[^"]+|help:[^"]+)"/g)) {
  tauriActions.add(m[1])
}
for (const m of libRs.matchAll(/emit\("menu:action",\s*\("([^"]+)"/g)) tauriActions.add(m[1])

let failed = false
const check = (side, set) => {
  for (const name of [...set].sort()) {
    if (!rendererActions.has(name)) {
      console.error(`[check-commands] ${side} 使用了渲染层未注册的命令: ${name}`)
      failed = true
    }
  }
}
check('Electron 菜单', electronActions)
check('Tauri 菜单', tauriActions)

if (failed) process.exit(1)
console.log(
  `[check-commands] OK：渲染层 ${rendererActions.size} 个命令，` +
    `Electron ${electronActions.size}、Tauri ${tauriActions.size} 个引用全部对齐`
)
