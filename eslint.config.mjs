import js from '@eslint/js'
import pluginVue from 'eslint-plugin-vue'
import globals from 'globals'

// 用户的一次性工具脚本不纳入 lint 约束
const LEGACY_SCRIPTS = ['scripts/diag-export.mjs', 'scripts/gen-icon.cjs', 'scripts/gen-md-file-icon.mjs']

export default [
  {
    ignores: [
      'out/**',
      'dist-web/**',
      'release/**',
      'node_modules/**',
      'src/renderer/public/**',
      'src-tauri/target/**',
      ...LEGACY_SCRIPTS
    ]
  },
  js.configs.recommended,
  ...pluginVue.configs['flat/essential'],
  {
    // 渲染层：浏览器环境（__APP_VERSION__ 为 Vite define 注入的构建常量）
    files: ['src/renderer/**/*.{js,vue}'],
    languageOptions: { globals: { ...globals.browser, __APP_VERSION__: 'readonly' } }
  },
  {
    // Electron 主进程 / preload：Node + Electron 环境
    files: ['src/main/**/*.js', 'src/preload/**/*.js'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } }
  },
  {
    // 构建/校验脚本：Node 环境
    files: ['scripts/**/*.{js,mjs,cjs}'],
    languageOptions: { globals: globals.node }
  },
  {
    files: ['**/*.vue'],
    rules: {
      'vue/no-v-html': 'off',
      'vue/require-default-prop': 'off',
      'vue/multi-word-component-names': 'off',
      'no-unused-vars': ['error', { argsIgnorePattern: '^_', caughtErrors: 'none' }]
    }
  },
  {
    // FileTreeNode / SelectionBar / SearchPanel：props 传入的是父级持有的响应式对象
    // （树节点 / 工具条状态），组件内修改其属性是既定的共享可变状态设计
    files: [
      'src/renderer/src/components/FileTreeNode.vue',
      'src/renderer/src/components/SelectionBar.vue',
      'src/renderer/src/components/SearchPanel.vue'
    ],
    rules: {
      'vue/no-mutating-props': 'off'
    }
  },
  {
    files: ['src/renderer/src/**/*.test.js'],
    languageOptions: { globals: { ...globals.browser, describe: 'readonly', expect: 'readonly', it: 'readonly' } }
  }
]
