import { resolve } from 'node:path'
import { readFileSync } from 'node:fs'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { uxAliases } from './scripts/ux-aliases.mjs'

const { version } = JSON.parse(readFileSync('package.json', 'utf-8'))

// Tauri 专用前端配置（与 electron-vite 配置互不影响）
export default defineConfig({
  root: 'src/renderer',
  plugins: [vue()],
  define: {
    __APP_VERSION__: JSON.stringify(version)
  },
  resolve: {
    alias: [
      // UxKit：本地直连 ../UX-FRW，无上游时回退 vendor/uxkit（CI / Pages）
      ...uxAliases(),
      { find: '@', replacement: resolve('src/renderer/src') }
    ]
  },
  clearScreen: false,
  envPrefix: ['VITE_', 'TAURI_'],
  // GitHub Pages 项目站构建时注入：WEB_BASE=/MdReader/ npm run build:web
  base: process.env.WEB_BASE || '/',
  server: {
    port: 5174,
    strictPort: true
  },
  build: {
    outDir: '../../dist-web',
    emptyOutDir: true,
    target: 'chrome110',
    rollupOptions: {
      output: {
        // 大依赖分包：首屏可并行加载，且版本未变时命中缓存（vditor 最大且很少变动）
        manualChunks(id) {
          if (id.includes('node_modules/vditor')) return 'vditor'
          if (id.includes('node_modules/echarts') || id.includes('node_modules/zrender')) return 'echarts'
          if (id.includes('node_modules/xlsx')) return 'xlsx'
          return undefined
        }
      }
    }
  }
})
