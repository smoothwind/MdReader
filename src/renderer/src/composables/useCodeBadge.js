import { reactive, watch } from 'vue'
import { resolveLangIcon } from '../components/icons/langIcon'
import { t } from '../i18n'

/**
 * 代码块语言徽标：悬浮代码块时显示于块右上角（语言图标 + 语言名）。
 * 依赖注入：getBar 返回悬浮工具条状态（type === 'code' 时生效）。
 */
export function useCodeBadge({ getBar }) {
  const codeBadge = reactive({ visible: false, top: 0, right: 0, lang: '', icon: null })

  function updateCodeBadge() {
    const bar = getBar()
    if (!(bar.visible && bar.type === 'code' && bar.el?.isConnected)) {
      codeBadge.visible = false
      return
    }
    const r = bar.el.getBoundingClientRect()
    if (r.bottom < 0 || r.top > window.innerHeight) {
      codeBadge.visible = false
      return
    }
    codeBadge.visible = true
    codeBadge.lang = bar.language || t('editor.codeBlock')
    codeBadge.icon = resolveLangIcon(bar.language)
    codeBadge.top = r.top + 6
    codeBadge.right = Math.max(8, window.innerWidth - r.right + 8)
  }

  watch(
    () => getBar().visible,
    (v) => {
      if (!v) codeBadge.visible = false
    }
  )

  return { codeBadge, updateCodeBadge }
}
