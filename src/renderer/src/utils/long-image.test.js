import { describe, expect, it } from 'vitest'
import { PAGE } from './doc-export'
import { captureRatioFor, rangeToPixels, totalPagesFor } from './long-image'

describe('totalPagesFor（A4 页高切分）', () => {
  it('空文档至少 1 页', () => {
    expect(totalPagesFor(0)).toBe(1)
    expect(totalPagesFor(-5)).toBe(1)
  })

  it('整页与跨页', () => {
    expect(totalPagesFor(PAGE.contentHeight)).toBe(1)
    expect(totalPagesFor(PAGE.contentHeight + 1)).toBe(2)
    expect(totalPagesFor(PAGE.contentHeight * 3)).toBe(3)
    expect(totalPagesFor(PAGE.contentHeight * 3 + 500)).toBe(4)
  })

  it('非法输入按 1 页处理', () => {
    expect(totalPagesFor(NaN)).toBe(1)
    expect(totalPagesFor('x')).toBe(1)
  })
})

describe('rangeToPixels', () => {
  const totalHeight = PAGE.contentHeight * 3 + 200 // 3.2 页
  const totalPages = totalPagesFor(totalHeight)

  it('全部范围覆盖整篇', () => {
    const r = rangeToPixels({ startPage: 1, endPage: totalPages, totalPages, totalHeight })
    expect(r).toEqual({ startPage: 1, endPage: 4, top: 0, height: totalHeight })
  })

  it('中间页按 A4 页高映射像素区间', () => {
    const r = rangeToPixels({ startPage: 2, endPage: 3, totalPages, totalHeight })
    expect(r.top).toBe(PAGE.contentHeight)
    expect(r.height).toBe(PAGE.contentHeight * 2)
  })

  it('末页高度截断到文档实际高度', () => {
    const r = rangeToPixels({ startPage: 4, endPage: 4, totalPages, totalHeight })
    expect(r.height).toBe(200)
  })

  it('越界/非法输入被 clamp', () => {
    expect(rangeToPixels({ startPage: -3, endPage: 99, totalPages, totalHeight })).toMatchObject({
      startPage: 1,
      endPage: 4
    })
    expect(rangeToPixels({ startPage: 'x', endPage: undefined, totalPages, totalHeight })).toMatchObject({
      startPage: 1,
      endPage: 4
    })
  })

  it('start > end 时 end 拉起为 start', () => {
    const r = rangeToPixels({ startPage: 3, endPage: 1, totalPages, totalHeight })
    expect(r.startPage).toBe(3)
    expect(r.endPage).toBe(3)
  })
})

describe('captureRatioFor', () => {
  it('超出目标高度时按比例收缩，并限制在 [0.3, 2]', () => {
    expect(captureRatioFor(1000)).toBe(2)
    expect(captureRatioFor(16000)).toBe(1)
    expect(captureRatioFor(32000)).toBeCloseTo(0.5, 5)
    expect(captureRatioFor(200000)).toBe(0.3)
    expect(captureRatioFor(0)).toBe(2)
  })
})
