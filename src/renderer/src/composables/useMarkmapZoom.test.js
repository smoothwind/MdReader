import { describe, expect, it } from 'vitest'
import { reactive } from 'vue'
import { useMarkmapZoom } from './useMarkmapZoom'

function makePanel(initialScale) {
  const panel = document.createElement('div')
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const g = document.createElementNS('http://www.w3.org/2000/svg', 'g')
  g.setAttribute('transform', `translate(10,20) scale(${initialScale})`)
  svg.appendChild(g)
  panel.appendChild(svg)
  document.body.appendChild(panel)
  return { panel, svg, g }
}

function harness(initialScale) {
  const { panel, svg, g } = makePanel(initialScale)
  const bar = reactive({ visible: true, type: 'markmap', el: panel })
  const api = useMarkmapZoom({ getBar: () => bar })
  return { ...api, bar, panel, svg, g }
}

describe('useMarkmapZoom', () => {
  it('mmUpdate 以首次观察到的 transform 为 100% 基准', () => {
    const h = harness(0.5)
    h.mmUpdate()
    expect(h.mmCtl.pct).toBe(100)
  })

  it('外部改写 transform（panzoom 场景）后 mmUpdate 刷新百分比', () => {
    const h = harness(0.5)
    h.mmUpdate()
    h.g.setAttribute('transform', 'translate(10,20) scale(1)')
    h.mmUpdate()
    expect(h.mmCtl.pct).toBe(200)
  })

  it('mmZoom 按倍率缩放并同步百分比', () => {
    const h = harness(0.4)
    h.mmUpdate()
    h.mmZoom(1)
    const s = parseFloat(/scale\(([\d.]+)\)/.exec(h.g.getAttribute('transform'))[1])
    expect(s).toBeCloseTo(0.5, 5)
    expect(h.mmCtl.pct).toBe(125)
    h.mmZoom(-1)
    const s2 = parseFloat(/scale\(([\d.]+)\)/.exec(h.g.getAttribute('transform'))[1])
    expect(s2).toBeCloseTo(0.4, 5)
    expect(h.mmCtl.pct).toBe(100)
  })

  it('mmZoom 缩放夹在 [0.1, 10]', () => {
    const h = harness(9.5)
    h.mmUpdate()
    h.mmZoom(1)
    const s = parseFloat(/scale\(([\d.]+)\)/.exec(h.g.getAttribute('transform'))[1])
    expect(s).toBe(10)
    // 百分比相对初始 transform（9.5）：10 / 9.5 ≈ 105%
    expect(h.mmCtl.pct).toBe(105)
  })

  it('mmReset 还原初始视图；bar 失去面板后 mmUpdate 清空引用', () => {
    const h = harness(0.8)
    h.mmUpdate()
    h.mmZoom(1)
    expect(h.mmCtl.pct).toBe(125)
    h.mmReset()
    const s = parseFloat(/scale\(([\d.]+)\)/.exec(h.g.getAttribute('transform'))[1])
    expect(s).toBeCloseTo(0.8, 5)
    expect(h.mmCtl.pct).toBe(100)
    h.bar.visible = false
    h.mmUpdate()
    // 不抛错即可：面板引用已清空，再次缩放为 no-op
    expect(() => h.mmZoom(1)).not.toThrow()
  })

  it('dispose 幂等且不抛错', () => {
    const h = harness(1)
    h.mmUpdate()
    expect(() => {
      h.dispose()
      h.dispose()
    }).not.toThrow()
  })
})
