import { watch } from 'vue'
import { applyTheme } from '@ux/tokens'
import { store } from '../store'

export function setupTheme() {
  watch(
    () => store.theme,
    (t) => {
      document.documentElement.dataset.theme = t
      // 桥接 UxKit 令牌：三通道同步（.dark 类 / data-color-mode / color-scheme），
      // 使 UxKit 组件（右键菜单/引导等）跟随 MdReader 的浅深主题。
      applyTheme(t)
      window.mdreader.setThemeSource(t)
      window.mdreader.reportTheme(t)
    },
    { immediate: true }
  )
}
