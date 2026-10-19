import { ref } from 'vue'
import { fetchLatestRelease, isNewerTag, RELEASES_PAGE_URL } from '../utils/update-check'

const DISMISS_KEY = 'mdreader:update-dismissed'

/** define 注入的构建常量；缺失（单测/异常环境）时退化为 0.0.0 */
function appVersion() {
  return typeof __APP_VERSION__ === 'string' && __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '0.0.0'
}

/**
 * 轻量更新检查（GitHub Releases）：启动静默轮询 + 关于页手动检查。
 * - silent 启动检查：仅发现新版本且未被本会话忽略时弹出横幅
 * - 手动检查：结果在调用方界面呈现（latest / upToDate / lastError），不受忽略记录影响
 */
export function useUpdateCheck({ currentVersion, fetchImpl = fetchLatestRelease } = {}) {
  const latest = ref(null)
  const checking = ref(false)
  const upToDate = ref(false)
  const lastError = ref(false)

  async function check({ silent = false } = {}) {
    if (checking.value) return false
    checking.value = true
    lastError.value = false
    upToDate.value = false
    try {
      const r = await fetchImpl()
      if (!r) {
        if (!silent) lastError.value = true
        return false
      }
      if (!isNewerTag(currentVersion || appVersion(), r.tag)) {
        if (!silent) upToDate.value = true
        return false
      }
      if (silent && sessionStorage.getItem(DISMISS_KEY) === r.tag) return false
      latest.value = r
      return true
    } finally {
      checking.value = false
    }
  }

  /** 停止横幅提醒，并记录忽略的版本（仅本会话生效，重启后仍会提示） */
  function dismiss() {
    if (latest.value) sessionStorage.setItem(DISMISS_KEY, latest.value.tag)
    latest.value = null
  }

  function openReleases() {
    window.mdreader?.openExternal?.(latest.value?.url || RELEASES_PAGE_URL)
  }

  return { latest, checking, upToDate, lastError, check, dismiss, openReleases }
}
