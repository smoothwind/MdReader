import { beforeEach, describe, expect, it } from 'vitest'
import { useUpdateCheck } from './useUpdateCheck'

function stubResult(value) {
  let calls = 0
  return {
    calls: () => calls,
    impl: async () => {
      calls++
      if (value instanceof Error) throw value
      return value
    }
  }
}

const NEW = { tag: 'v0.4.0', url: 'https://rel/v0.4.0' }
const OLD = { tag: 'v0.3.0-beta.1', url: 'https://rel/v0.3.0-beta.1' }

describe('useUpdateCheck', () => {
  beforeEach(() => {
    sessionStorage.clear()
  })

  it('发现新版本：latest 有值并返回 true，结果可复现', async () => {
    const f = stubResult(NEW)
    const uc = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: f.impl })
    expect(await uc.check()).toBe(true)
    expect(uc.latest.value).toEqual(NEW)
    expect(uc.upToDate.value).toBe(false)
    expect(await uc.check({ silent: true })).toBe(true)
    expect(f.calls()).toBe(2)
  })

  it('已是最新：手动检查 → upToDate；静默 → 无横幅', async () => {
    const f = stubResult(OLD)
    const uc = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: f.impl })
    expect(await uc.check()).toBe(false)
    expect(uc.upToDate.value).toBe(true)
    expect(uc.latest.value).toBeNull()
  })

  it('拉取失败：手动 → lastError；静默 → 静默无痕', async () => {
    const f = stubResult(null)
    const uc = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: f.impl })
    expect(await uc.check()).toBe(false)
    expect(uc.lastError.value).toBe(true)
    const uc2 = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: f.impl })
    expect(await uc2.check({ silent: true })).toBe(false)
    expect(uc2.lastError.value).toBe(false)
  })

  it('build 常量缺失（currentVersion 未传）：回退 0.0.0 → 任何版本都视为新版（宁可提示）', async () => {
    const uc = useUpdateCheck({ fetchImpl: stubResult(NEW).impl })
    expect(await uc.check()).toBe(true)
    expect(uc.latest.value).toEqual(NEW)
    const f2 = stubResult(OLD)
    const uc2 = useUpdateCheck({ fetchImpl: f2.impl })
    expect(await uc2.check()).toBe(true)
    expect(uc2.latest.value).toEqual(OLD)
  })

  it('silent 启动检查尊重本会话忽略记录；手动检查不受其影响', async () => {
    const f = stubResult(NEW)
    const uc = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: f.impl })
    await uc.check()
    uc.dismiss()
    expect(uc.latest.value).toBeNull()
    expect(sessionStorage.getItem('mdreader:update-dismissed')).toBe('v0.4.0')
    const uc2 = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: f.impl })
    await uc2.check({ silent: true })
    expect(uc2.latest.value).toBeNull()
    await uc2.check()
    expect(uc2.latest.value).toEqual(NEW)
  })

  it('dismiss 换新版后旧忽略记录失效', async () => {
    sessionStorage.setItem('mdreader:update-dismissed', 'v0.3.9')
    const uc = useUpdateCheck({ currentVersion: '0.3.0-beta.1', fetchImpl: stubResult(NEW).impl })
    await uc.check({ silent: true })
    expect(uc.latest.value).toEqual(NEW)
  })
})
