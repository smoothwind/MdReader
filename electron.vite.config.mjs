import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import { uxAliases } from './scripts/ux-aliases.mjs'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()]
  },
  preload: {
    plugins: [externalizeDepsPlugin()]
  },
  renderer: {
    plugins: [vue()],
    resolve: {
      alias: [
        // UxKit：本地直连 ../UX-FRW，无上游时回退 vendor/uxkit（CI / Pages）
        ...uxAliases(),
        { find: '@', replacement: resolve('src/renderer/src') }
      ]
    }
  }
})
