import { resolve } from 'node:path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import vue from '@vitejs/plugin-vue'

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
        // UxKit（隔壁 UX-FRW monorepo）源码直连 —— 子路径样式须置于包名之前
        { find: '@ux/tokens/tokens.css', replacement: resolve('../UX-FRW/packages/tokens/src/index.css') },
        { find: '@ux/components/styles.css', replacement: resolve('../UX-FRW/packages/components/src/styles.css') },
        { find: '@ux/shell/styles.css', replacement: resolve('../UX-FRW/packages/shell/src/styles.css') },
        { find: '@ux/patterns/styles.css', replacement: resolve('../UX-FRW/packages/patterns/src/styles.css') },
        { find: '@ux/tokens', replacement: resolve('../UX-FRW/packages/tokens/src/index.ts') },
        { find: '@ux/composables', replacement: resolve('../UX-FRW/packages/composables/src/index.ts') },
        { find: '@ux/services', replacement: resolve('../UX-FRW/packages/services/src/index.ts') },
        { find: '@ux/components', replacement: resolve('../UX-FRW/packages/components/src/index.ts') },
        { find: '@ux/shell', replacement: resolve('../UX-FRW/packages/shell/src/index.ts') },
        { find: '@ux/patterns', replacement: resolve('../UX-FRW/packages/patterns/src/index.ts') },
        { find: '@', replacement: resolve('src/renderer/src') }
      ]
    }
  }
})
