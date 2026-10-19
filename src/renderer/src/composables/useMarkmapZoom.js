import { reactive, watch } from 'vue'

/**
 * 脑图缩放控制：读取/改写 markmap SVG 的 <g transform>，同步百分比显示。
 * 缩放由 markmap 内部 panzoom 直接改写 transform 属性，故用 MutationObserver
 * 属性观察（事件驱动，无轮询）；工具条显示期间观察面板，隐藏即断开。
 * 依赖注入：getBar 返回悬浮工具条状态（bar.el 为 markmap 渲染面板元素）。
 */
export function useMarkmapZoom({ getBar }) {
  const mmCtl = reactive({ pct: 100 })
  let mmPanelEl = null
  let mmObserver = null
  const mmInitial = new WeakMap()

  function mmSvgOf(panel) {
    return panel?.querySelector('svg') || null
  }

  function mmGOf(svg) {
    return svg.querySelector('g')
  }

  function mmParseTf(str) {
    const m = /translate\(([-\d.]+)[, ]+([-\d.]+)\)\s*scale\(([\d.]+)\)/.exec(str || '')
    return m ? { x: +m[1], y: +m[2], s: +m[3] } : { x: 0, y: 0, s: 1 }
  }

  function mmSetTf(svg, o) {
    const g = mmGOf(svg)
    if (g) g.setAttribute('transform', `translate(${o.x},${o.y}) scale(${o.s})`)
  }

  function mmInit(svg) {
    if (!svg || mmInitial.has(svg)) return
    const g = mmGOf(svg)
    mmInitial.set(svg, g ? g.getAttribute('transform') || '' : '')
  }

  function panelWidth(el) {
    return el?.clientWidth || 600
  }

  function panelHeight(el) {
    return el?.clientHeight || 400
  }

  function mmUpdate() {
    const bar = getBar()
    const panel = bar.visible && bar.type === 'markmap' && bar.el?.isConnected ? bar.el : null
    const svg = mmSvgOf(panel)
    if (!svg) {
      mmPanelEl = null
      return
    }
    mmInit(svg)
    mmPanelEl = panel
    const cur = mmParseTf(mmGOf(svg)?.getAttribute('transform'))
    const init = mmParseTf(mmInitial.get(svg))
    const pct = Math.round((cur.s / (init.s || 1)) * 100)
    if (pct !== mmCtl.pct) mmCtl.pct = pct
  }

  function mmZoom(dir) {
    const svg = mmSvgOf(mmPanelEl)
    if (!svg) return
    const g = mmGOf(svg)
    const cur = mmParseTf(g?.getAttribute('transform'))
    const init = mmParseTf(mmInitial.get(svg))
    const k = dir > 0 ? 1.25 : 0.8
    const s2 = Math.min(10, Math.max(0.1, cur.s * k))
    const cx = (svg.clientWidth || panelWidth(mmPanelEl)) / 2
    const cy = (svg.clientHeight || panelHeight(mmPanelEl)) / 2
    mmSetTf(svg, {
      x: cx - ((cx - cur.x) * s2) / cur.s,
      y: cy - ((cy - cur.y) * s2) / cur.s,
      s: s2
    })
    mmCtl.pct = Math.round((s2 / (init.s || 1)) * 100)
  }

  function mmReset() {
    const svg = mmSvgOf(mmPanelEl)
    if (!svg) return
    const init = mmParseTf(mmInitial.get(svg))
    mmSetTf(svg, init)
    mmCtl.pct = 100
  }

  watch(
    () => {
      const bar = getBar()
      return bar.visible && bar.type === 'markmap' && !!bar.el
    },
    (v) => {
      mmObserver?.disconnect()
      mmObserver = null
      if (!v) {
        mmPanelEl = null
        return
      }
      mmObserver = new MutationObserver(() => mmUpdate())
      mmObserver.observe(getBar().el, { subtree: true, attributes: true, attributeFilter: ['transform'] })
      mmUpdate()
    }
  )

  return { mmCtl, mmUpdate, mmZoom, mmReset, dispose: () => mmObserver?.disconnect() }
}
