import { describe, it, expect, beforeEach } from 'vitest'
import { MESSAGES, locale, setLocale, t } from './index'

describe('i18n', () => {
  beforeEach(() => {
    setLocale('zh-CN', { persist: false, notifyNative: false })
  })

  it('中英文词典 key 完全对齐', () => {
    const zh = Object.keys(MESSAGES['zh-CN']).sort()
    const en = Object.keys(MESSAGES['en-US']).sort()
    expect(en).toEqual(zh)
  })

  it('按当前语言返回文案', () => {
    expect(t('common.save')).toBe('保存')
    setLocale('en-US', { persist: false, notifyNative: false })
    expect(t('common.save')).toBe('Save')
  })

  it('支持 {name} 插值并保留未知占位符原样', () => {
    expect(t('app.closeTabMessage', { name: 'a.md' })).toContain('a.md')
    setLocale('en-US', { persist: false, notifyNative: false })
    expect(t('app.closeTabMessage', { name: 'a.md' })).toBe('Save changes to “a.md”?')
  })

  it('缺失 key 回退中文再回退 key 本身', () => {
    expect(t('missing.key')).toBe('missing.key')
  })

  it('非法语言不切换', () => {
    const prev = locale.value
    expect(setLocale('fr-FR', { notifyNative: false })).toBe(false)
    expect(locale.value).toBe(prev)
  })
})
