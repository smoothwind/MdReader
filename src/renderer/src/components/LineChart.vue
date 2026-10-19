<script setup>
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import * as echarts from 'echarts/core'
import { LineChart as ELineChart } from 'echarts/charts'
import { GridComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'

echarts.use([ELineChart, GridComponent, TooltipComponent, CanvasRenderer])

const props = defineProps({
  series: { type: Array, default: () => [] },
  seriesRight: { type: Array, default: () => [] },
  unit: { type: String, default: '' },
  unitRight: { type: String, default: '' },
  yMax: { type: Number, default: 0 },
  yMaxRight: { type: Number, default: 0 },
  height: { type: Number, default: 150 }
})

const el = ref(null)
let chart = null
let ro = null

function niceCeil(v) {
  if (v <= 0) return 1
  const exp = Math.pow(10, Math.floor(Math.log10(v)))
  const f = v / exp
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10
  return nice * exp
}

function upperOf(seriesList, fixed) {
  if (fixed > 0) return fixed
  let m = 0
  for (const s of seriesList) for (const v of s.values) if (v > m) m = v
  return Math.max(niceCeil(m * 1.15), 1)
}

// ECharts 监控图表配色（坐标轴/tooltip 为图表绘制数据，非应用 chrome 样式），tokens 检查豁免
/* tokens-exempt */
function axisCfg(max, _unit) {
  return {
    type: 'value',
    min: 0,
    max,
    axisLine: { show: false },
    axisTick: { show: false },
    axisLabel: {
      fontSize: 10,
      color: '#808080',
      formatter: (v) => (v >= 100 ? String(Math.round(v)) : String(Math.round(v * 10) / 10))
    },
    splitLine: { lineStyle: { color: 'rgba(128,128,128,0.22)', type: 'dashed' } }
  }
}

function buildOption() {
  const left = upperOf(props.series, props.yMax)
  const hasRight = props.seriesRight.length > 0
  const right = hasRight ? upperOf(props.seriesRight, props.yMaxRight) : 0

  const units = new Map()
  const mk = (s, i, unit, axisIndex) => {
    units.set(s.label, unit)
    return {
      name: s.label,
      type: 'line',
      yAxisIndex: axisIndex,
      data: s.values,
      showSymbol: false,
      lineStyle: { width: axisIndex === 0 && i === 0 ? 2 : 1.3 },
      itemStyle: { color: s.color },
      z: axisIndex === 0 && i === 0 ? 5 : 3
    }
  }
  const seriesList = [
    ...props.series.map((s, i) => mk(s, i, props.unit, 0)),
    ...props.seriesRight.map((s, i) => mk(s, i, props.unitRight, 1))
  ]

  return {
    animation: false,
    grid: { left: 10, right: 52, top: 12, bottom: 8 },
    xAxis: { type: 'category', show: false, boundaryGap: false },
    yAxis: hasRight ? [axisCfg(left, props.unit), axisCfg(right, props.unitRight)] : axisCfg(left, props.unit),
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'none' },
      backgroundColor: 'rgba(28,28,30,0.92)',
      borderColor: 'transparent',
      textStyle: { color: '#f5f5f5', fontSize: 11 },
      formatter: (params) => {
        if (!Array.isArray(params)) params = [params]
        return params
          .map((p) => {
            const u = units.get(p.seriesName) || ''
            const v = p.value == null ? '-' : Math.round(p.value * 100) / 100
            return `${p.marker}${p.seriesName}\u3000<b>${v}</b> ${u}`
          })
          .join('<br/>')
      }
    },
    series: seriesList
  }
}

function refresh() {
  chart && chart.setOption(buildOption(), { lazyUpdate: true })
}

onMounted(() => {
  chart = echarts.init(el.value, null, { renderer: 'canvas' })
  chart.setOption(buildOption())
  ro = new ResizeObserver(() => chart && chart.resize())
  ro.observe(el.value)
})

watch(
  () =>
    [...props.series, ...props.seriesRight]
      .map((s) => s.values.length + ':' + (s.values[s.values.length - 1] ?? 0))
      .join('|'),
  refresh
)
watch(() => [props.yMax, props.yMaxRight], refresh)

onBeforeUnmount(() => {
  ro?.disconnect()
  chart?.dispose()
  chart = null
})
</script>

<template>
  <div ref="el" class="lc-wrap" :style="{ height: height + 'px' }"></div>
</template>

<style scoped>
.lc-wrap {
  width: 100%;
}
</style>
