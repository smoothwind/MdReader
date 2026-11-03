import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { store } from '../store'
import { useToc } from './useToc'

function makeRoot() {
  const root = document.createElement('div')
  root.innerHTML = `
    <h1>标题：简介</h1>
    <h2>1.2 小节</h2>
    <h3>你好，世界</h3>
    <h3>foo-bar</h3>
    <h2 id="custom-id">有 id 的标题</h2>
    <h2 id="user-content-prefixed">user-content 前缀</h2>
  `
  document.body.appendChild(root)
  return root
}

describe('useToc anchorTarget', () => {
  let root
  let toc

  beforeEach(() => {
    root = makeRoot()
    toc = useToc({ getRootEl: () => root })
    toc.extractToc()
  })

  afterEach(() => {
    root.remove()
    store.toc = []
    store.tocActiveId = null
  })

  it('标题带标点/连字符时，锚点省略形式也能匹配（回归：误报“锚点无效”）', () => {
    // 「标题：简介」→ #标题简介 / #标题：简介
    expect(toc.anchorTarget('标题简介')).not.toBeNull()
    expect(toc.anchorTarget('标题：简介')).not.toBeNull()
    // 「1.2 小节」→ #12小节 / #1.2小节
    expect(toc.anchorTarget('12小节')).not.toBeNull()
    expect(toc.anchorTarget('1.2小节')).not.toBeNull()
    // 「你好，世界」→ #你好世界
    expect(toc.anchorTarget('你好世界')).not.toBeNull()
    // 「foo-bar」→ #foobar / #foo-bar
    expect(toc.anchorTarget('foobar')).not.toBeNull()
    expect(toc.anchorTarget('foo-bar')).not.toBeNull()
  })

  it('优先 id / user-content-id 精确匹配', () => {
    const el = toc.anchorTarget('custom-id')
    expect(el).not.toBeNull()
    expect(el?.id).toBe('custom-id')
    const pref = toc.anchorTarget('prefixed')
    expect(pref).not.toBeNull()
    expect(pref?.id).toBe('user-content-prefixed')
  })

  it('不存在的锚点返回 null', () => {
    expect(toc.anchorTarget('不存在的标题')).toBeNull()
    expect(toc.anchorTarget('')).toBeNull()
    expect(toc.anchorTarget(null)).toBeNull()
  })
})
