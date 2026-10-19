import { describe, expect, it } from 'vitest'
import { compareTags, fetchLatestRelease, isNewerTag, parseTag, RELEASES_URL } from './update-check'

describe('parseTag', () => {
  it('解析 v 前缀 / 无前缀 / 预发布', () => {
    expect(parseTag('v0.3.0-beta.1')).toEqual({ core: [0, 3, 0], pre: ['beta', 1] })
    expect(parseTag('1.2.3')).toEqual({ core: [1, 2, 3], pre: null })
    expect(parseTag('0.4.0')).toEqual({ core: [0, 4, 0], pre: null })
  })

  it('非法输入返回 null', () => {
    for (const bad of ['', null, undefined, '0.3', 'v0.3.0-', 'abc', 123])
      expect(parseTag(bad)).toBeNull()
  })
})

describe('compareTags（semver 预发布 #11）', () => {
  const lt = [
    ['0.3.0-beta.1', '0.3.0-beta.2'],
    ['0.3.0-beta.2', '0.3.0'],
    ['0.3.0-beta.1', '0.3.0-rc.1'], // beta < rc（字母序）
    ['0.9.9', '1.0.0'],
    ['1.0.0', '1.0.1'],
    ['1.2.3', '1.3.0'],
    ['0.3.0-beta.1', '0.4.0-beta.1'],
    ['0.3.0-beta.beta', '0.3.0'], // 正式 > 预发布
    ['1.0.0-alpha', '1.0.0-alpha.1'],
    ['1.0.0-alpha.1.2', '1.0.0-alpha.1.10'] // 数字比较而非字典序
  ]
  for (const [a, b] of lt)
    it(`${a} < ${b}`, () => expect(compareTags(a, b)).toBe(-1))
  it('相等', () => {
    expect(compareTags('v0.3.0-beta.1', '0.3.0-beta.1')).toBe(0)
    expect(compareTags('1.0.0', 'v1.0.0')).toBe(0)
  })
  it('非法任一返回 null', () => {
    expect(compareTags('0.3.0', 'x')).toBeNull()
    expect(compareTags(null, '0.3.0')).toBeNull()
  })
})

describe('isNewerTag', () => {
  it('真实版本场景', () => {
    expect(isNewerTag('0.3.0-beta.1', 'v0.4.0')).toBe(true)
    expect(isNewerTag('0.3.0-beta.1', 'v0.3.0-beta.2')).toBe(true)
    expect(isNewerTag('0.3.0', 'v0.3.0-beta.9')).toBe(false)
    expect(isNewerTag('0.3.0-beta.1', 'v0.3.0-beta.1')).toBe(false)
    expect(isNewerTag('0.4.0-dev.17', 'v0.3.0-beta.1')).toBe(false)
    expect(isNewerTag('0.4.0-dev.17', 'x')).toBe(false)
  })
})

describe('fetchLatestRelease', () => {
  function stubFetch(status, body) {
    let called = null
    return {
      get called() {
        return called
      },
      impl: async function (url, init) {
        called = { url, init }
        return { ok: status >= 200 && status < 300, status, json: async () => body }
      }
    }
  }

  it('取第一个非 draft（允许 prerelease），含 tag 与下载页', async () => {
    const s = stubFetch(200, [
      { draft: true, tag_name: 'v9.0.0-internal', html_url: 'https://x/9' },
      { tag_name: 'v0.4.0', html_url: 'https://github.com/o/r/releases/tag/v0.4.0' }
    ])
    const r = await fetchLatestRelease({ fetchImpl: s.impl })
    expect(r).toEqual({ tag: 'v0.4.0', url: 'https://github.com/o/r/releases/tag/v0.4.0' })
    expect(s.called.url).toBe(RELEASES_URL)
    expect(s.called.init.headers.Accept).toBe('application/vnd.github+json')
  })

  it('非 2xx / 非 JSON / 异常均返回 null', async () => {
    expect(await fetchLatestRelease({ fetchImpl: stubFetch(403, {}).impl })).toBeNull()
    expect(await fetchLatestRelease({ fetchImpl: stubFetch(200, {}).impl })).toBeNull()
    expect(
      await fetchLatestRelease({
        fetchImpl: async () => {
          throw new Error('offline')
        }
      })
    ).toBeNull()
  })
})
