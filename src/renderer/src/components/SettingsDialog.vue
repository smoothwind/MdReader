<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { defineAsyncComponent } from 'vue'
import { Activity, FolderCog, RefreshCw, SlidersHorizontal, X } from 'lucide-vue-next'
import { store } from '../store'

// ECharts 体积较大，随弹窗按需加载
const LineChart = defineAsyncComponent(() => import('./LineChart.vue'))

const emit = defineEmits(['close'])

// ---------- 设置分类导航 ----------
const SECTIONS = [
  { key: 'editor', label: '编辑器', icon: SlidersHorizontal },
  { key: 'docs', label: '文档与资源', icon: FolderCog },
  { key: 'monitor', label: '性能监控', icon: Activity }
]
const activeSection = ref('editor')
const footNote = computed(() => {
  if (activeSection.value === 'docs')
    return isElectron ? '资源配置保存于 userData/config.json' : '监控数据来自系统进程快照'
  if (activeSection.value === 'monitor') return '监控数据来自系统进程快照'
  return '本页改动即时生效，无需保存'
})

const overlayEl = ref(null)

const runtime = window.mdreader?.runtime || 'electron'
const isElectron = runtime === 'electron'
const cfg = ref(null)
const saving = ref(false)
const saveErr = ref('')
const metrics = ref(null)
const history = ref([])
const autoRefresh = ref(true)
const autosaveOn = ref(localStorage.getItem('mdreader:autosave') !== '0')

// ---------- 编辑区字号 / 行高（CSS 变量注入，持久化到 localStorage） ----------
const EDITOR_PREFS_KEY = 'mdreader:editorprefs'

function loadEditorPrefs() {
  try {
    return JSON.parse(localStorage.getItem(EDITOR_PREFS_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

const editorPrefs = loadEditorPrefs()
const editorFontSize = ref(Number(editorPrefs.fontSize) || 16)
const editorLineHeight = ref(Number(editorPrefs.lineHeight) || 1.7)

function applyEditorPrefs() {
  const root = document.documentElement
  root.style.setProperty('--editor-font-size', editorFontSize.value + 'px')
  root.style.setProperty('--editor-line-height', String(editorLineHeight.value))
  localStorage.setItem(
    EDITOR_PREFS_KEY,
    JSON.stringify({ fontSize: editorFontSize.value, lineHeight: editorLineHeight.value })
  )
}

watch([editorFontSize, editorLineHeight], applyEditorPrefs)
applyEditorPrefs()

// ---------- 文档资产管理（未引用图片检查/删除） ----------
const activeTab = computed(() => store.tabs.find((t) => t.id === store.activeId) || null)
const assetScanning = ref(false)
const assetScanInfo = ref('')
const assetOrphans = ref([])
let deleteArmed = ref(false)
let deleteArmTimer = null

async function scanOrphans() {
  const tab = activeTab.value
  if (!tab?.filePath) return
  assetScanning.value = true
  assetScanInfo.value = ''
  deleteArmed.value = false
  try {
    const refs = [...tab.content.matchAll(/assets\/([^)\s"']+)/g)].map((m) => decodeURIComponent(m[1]))
    const r = await window.mdreader.checkAssets(tab.filePath, refs)
    assetOrphans.value = r?.orphans || []
    assetScanInfo.value = assetOrphans.value.length
      ? `发现 ${assetOrphans.value.length} 个未引用文件`
      : '没有未引用文件'
  } catch {
    assetScanInfo.value = '检查失败'
  } finally {
    assetScanning.value = false
  }
}

async function deleteOrphans() {
  const tab = activeTab.value
  if (!tab?.filePath || !assetOrphans.value.length) return
  // 二次点击确认，防误删（3 秒未确认自动复位）
  if (!deleteArmed.value) {
    deleteArmed.value = true
    clearTimeout(deleteArmTimer)
    deleteArmTimer = setTimeout(() => (deleteArmed.value = false), 3000)
    return
  }
  clearTimeout(deleteArmTimer)
  deleteArmed.value = false
  try {
    const r = await window.mdreader.deleteAssets(tab.filePath, assetOrphans.value)
    assetScanInfo.value = `已删除 ${r?.deleted ?? 0} 个文件`
    assetOrphans.value = []
  } catch {
    assetScanInfo.value = '删除失败'
  }
}

watch(autosaveOn, (v) => {
  localStorage.setItem('mdreader:autosave', v ? '1' : '0')
})

let timer = null

// 监控图表系列色（ECharts 数据 + 图例点共用，非应用 chrome 样式），tokens 检查豁免
/* tokens-exempt */
const MEM_TYPES = [
  { key: 'Browser', label: '主进程', color: '#2f9e44' },
  { key: 'Renderer', label: '渲染进程', color: '#f08c00' },
  { key: 'GPU', label: 'GPU 进程', color: '#9c36b5' },
  { key: 'Utility', label: '工具进程', color: '#0c8599' }
]
const CHART_COLORS = { total: '#4c8dff', cpu: '#e03131' }
const HISTORY_MAX = 60

function fmtUptime(sec) {
  const h = Math.floor(sec / 3600)
  const m = Math.floor((sec % 3600) / 60)
  const s = sec % 60
  return (h ? h + ' 时 ' : '') + m + ' 分 ' + s + ' 秒'
}

async function loadConfig() {
  cfg.value = await window.mdreader.getPerfConfig()
}

async function loadMetrics() {
  try {
    metrics.value = await window.mdreader.getMetrics()
    const sample = { types: {}, total: metrics.value.total || 0, cpu: 0 }
    for (const p of metrics.value.processes) {
      sample.types[p.type] = (sample.types[p.type] || 0) + (p.memory || 0)
      sample.cpu += p.cpu || 0
    }
    history.value.push(sample)
    if (history.value.length > HISTORY_MAX) history.value.shift()
  } catch {
    /* 监控读取失败时保留上次采样，下个周期自动重试 */
  }
}

const memSeries = computed(() => [
  { label: '合计', color: CHART_COLORS.total, values: history.value.map((s) => s.total) },
  ...MEM_TYPES.map((t) => ({
    label: t.label,
    color: t.color,
    values: history.value.map((s) => s.types[t.key] || 0)
  }))
])
const cpuSeries = computed(() => [
  { label: 'CPU', color: CHART_COLORS.cpu, values: history.value.map((s) => s.cpu) }
])

function curMem(key) {
  const v = (metrics.value?.processes || [])
    .filter((p) => p.type === key)
    .reduce((s, p) => s + (p.memory || 0), 0)
  return Math.round(v * 100) / 100
}
const curTotal = computed(() => metrics.value?.total ?? 0)
const curCpu = computed(() => {
  const v = (metrics.value?.processes || []).reduce((s, p) => s + (p.cpu || 0), 0)
  return Math.round(v * 100) / 100
})

async function save(needRestart) {
  if (!cfg.value) return
  saving.value = true
  saveErr.value = ''
  try {
    await window.mdreader.setPerfConfig({ ...cfg.value })
    if (needRestart) window.mdreader.relaunchApp()
    else emit('close')
  } catch (err) {
    saveErr.value = '保存失败：' + (err?.message || err)
  } finally {
    saving.value = false
  }
}

function startTimer() {
  stopTimer()
  if (autoRefresh.value) timer = setInterval(loadMetrics, 2000)
}

function stopTimer() {
  clearInterval(timer)
  timer = null
}

watch(autoRefresh, (on) => {
  stopTimer()
  if (on) {
    loadMetrics()
    startTimer()
  }
})

onMounted(() => {
  overlayEl.value?.focus()
  if (isElectron) loadConfig()
  loadMetrics()
  startTimer()
})

onBeforeUnmount(() => {
  clearTimeout(deleteArmTimer)
  stopTimer()
})
</script>

<template>
  <div
    ref="overlayEl"
    class="pf-overlay"
    role="dialog"
    aria-modal="true"
    aria-label="设置"
    tabindex="-1"
    @mousedown.self="emit('close')"
    @keydown.esc="emit('close')"
  >
    <div class="pf-window">
      <div class="pf-head">
        <span class="pf-title">设置</span>
        <button class="pf-close" title="关闭" @click="emit('close')"><X :size="15" /></button>
      </div>

      <div class="pf-layout">
        <nav class="pf-nav" aria-label="设置分类">
          <button
            v-for="sec in SECTIONS"
            :key="sec.key"
            class="pf-nav-item"
            :class="{ active: activeSection === sec.key }"
            :aria-current="activeSection === sec.key ? 'page' : undefined"
            @click="activeSection = sec.key"
          >
            <component :is="sec.icon" :size="14" />
            <span>{{ sec.label }}</span>
          </button>
        </nav>

        <div class="pf-content">
          <!-- 编辑器 -->
          <template v-if="activeSection === 'editor'">
            <section class="pf-sec">
              <div class="pf-sec-head">编辑器</div>
              <label class="pf-row">
                <input v-model="autosaveOn" type="checkbox" />
                <span>自动保存<span class="pf-desc">每 30 秒，仅已保存到磁盘的文档</span></span>
              </label>
              <div class="pf-row pf-inline">
                <span>编辑区字号</span>
                <select v-model.number="editorFontSize" class="pf-num">
                  <option :value="14">14px</option>
                  <option :value="15">15px</option>
                  <option :value="16">16px（默认）</option>
                  <option :value="17">17px</option>
                  <option :value="18">18px</option>
                  <option :value="20">20px</option>
                </select>
                <span>行高</span>
                <select v-model.number="editorLineHeight" class="pf-num">
                  <option :value="1.6">1.6</option>
                  <option :value="1.7">1.7（默认）</option>
                  <option :value="1.8">1.8</option>
                  <option :value="2">2.0</option>
                </select>
              </div>
            </section>
          </template>

          <!-- 文档与资源 -->
          <template v-if="activeSection === 'docs'">
            <section class="pf-sec">
              <div class="pf-sec-head">文档资产 <span class="pf-note">针对当前活动文档旁的 assets/ 目录</span></div>
              <div class="pf-row pf-inline">
                <button class="pf-btn" :disabled="!activeTab?.filePath || assetScanning" @click="scanOrphans">
                  {{ assetScanning ? '检查中…' : '检查未引用图片' }}
                </button>
                <button
                  v-if="assetOrphans.length"
                  class="pf-btn"
                  :class="{ ghost: !deleteArmed }"
                  @click="deleteOrphans"
                >
                  {{ deleteArmed ? `确认删除 ${assetOrphans.length} 个文件` : '删除未引用文件' }}
                </button>
                <span v-if="assetScanInfo" class="pf-note">{{ assetScanInfo }}</span>
              </div>
            </section>

            <section v-if="isElectron" class="pf-sec">
              <div class="pf-sec-head">资源配置 <span class="pf-note">修改后需重启应用生效</span></div>
              <label v-if="cfg" class="pf-row">
                <input v-model="cfg.disableHardwareAcceleration" type="checkbox" />
                <span>禁用 GPU 硬件加速<span class="pf-desc">软渲染，可显著降低 GPU 进程内存占用</span></span>
              </label>
              <label v-if="cfg" class="pf-row">
                <input v-model="cfg.inProcessGpu" type="checkbox" />
                <span>合并 GPU 进程（in-process-gpu）<span class="pf-desc">减少一个独立进程的开销</span></span>
              </label>
              <label v-if="cfg" class="pf-row pf-inline">
                <input v-model.number="cfg.maxOldSpaceSize" type="number" min="0" max="4096" step="32" class="pf-num" />
                <span>渲染器堆上限（MB，0 = 不限制）<span class="pf-desc">限制 V8 堆，促使及时回收；过小会导致大文档崩溃</span></span>
              </label>
            </section>
          </template>

          <!-- 性能监控 -->
          <template v-if="activeSection === 'monitor'">
            <section class="pf-sec">
              <div class="pf-sec-head">
                实时资源监控
                <label class="pf-auto"><input v-model="autoRefresh" type="checkbox" />自动刷新（2 秒）</label>
                <button class="pf-btn ghost" title="立即刷新" @click="loadMetrics"><RefreshCw :size="13" /></button>
              </div>
              <div class="pf-chart-block">
                <div class="pf-chart-title">资源占用（左轴：内存 MB ／ 右轴：CPU %）</div>
                <LineChart
                  :series="memSeries"
                  :series-right="cpuSeries"
                  unit="MB"
                  unit-right="%"
                  :y-max-right="100"
                  :height="190"
                />
              </div>
              <div class="pf-legend">
                <span class="pf-legend-item">
                  <i class="pf-dot" :style="{ background: CHART_COLORS.total }"></i>合计
                  <b>{{ curTotal }} MB</b>
                </span>
                <span v-for="t2 in MEM_TYPES" :key="t2.key" class="pf-legend-item">
                  <i class="pf-dot" :style="{ background: t2.color }"></i>{{ t2.label }}
                  <b>{{ curMem(t2.key) }} MB</b>
                </span>
                <span class="pf-legend-item">
                  <i class="pf-dot" :style="{ background: CHART_COLORS.cpu }"></i>CPU
                  <b>{{ curCpu }} %</b>
                </span>
              </div>
              <div class="pf-uptime" v-if="metrics">运行时长：{{ fmtUptime(metrics.uptime) }}</div>
            </section>
          </template>
        </div>
      </div>

      <div class="pf-foot">
        <span class="pf-note">{{ footNote }}</span>
        <span v-if="saveErr" class="pf-save-err">{{ saveErr }}</span>
        <span class="pf-spacer"></span>
        <template v-if="activeSection === 'docs' && isElectron">
          <button class="pf-btn" :disabled="saving" @click="emit('close')">取消</button>
          <button class="pf-btn" :disabled="saving" @click="save(false)">保存</button>
          <button class="pf-btn primary" :disabled="saving" @click="save(true)">保存并重启</button>
        </template>
        <button v-else class="pf-btn" @click="emit('close')">关闭</button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pf-overlay {
  position: fixed;
  inset: 0;
  z-index: var(--tk-z-modal);
  background: rgba(0, 0, 0, 0.45);
  display: flex;
  align-items: center;
  justify-content: center;
}
.pf-window {
  width: min(760px, 92vw);
  height: min(620px, 88vh);
  display: flex;
  flex-direction: column;
  background: var(--bg);
  border: 1px solid var(--border);
  border-radius: var(--tk-rd-10);
  overflow: hidden;
  box-shadow: var(--tk-sh-8);
}
.pf-head {
  display: flex;
  align-items: center;
  padding: var(--tk-sp-10) var(--tk-sp-14);
  border-bottom: 1px solid var(--border);
}
.pf-title {
  font-weight: 600;
  font-size: var(--tk-fs-13);
}
.pf-close {
  margin-left: auto;
  border: none;
  background: transparent;
  color: var(--fg-soft);
  cursor: pointer;
  display: inline-flex;
  padding: var(--tk-sp-4);
  border-radius: var(--tk-rd-6);
}
.pf-close:hover {
  background: var(--bg-soft);
  color: var(--fg);
}
.pf-layout {
  flex: 1;
  display: flex;
  min-height: 0;
}
.pf-nav {
  flex: 0 0 148px;
  display: flex;
  flex-direction: column;
  gap: var(--tk-sp-2);
  padding: var(--tk-sp-10) var(--tk-sp-8);
  border-right: 1px solid var(--border);
  background: var(--bg-soft);
}
.pf-nav-item {
  display: inline-flex;
  align-items: center;
  gap: var(--tk-sp-8);
  padding: var(--tk-sp-8) var(--tk-sp-10);
  border: none;
  border-radius: var(--tk-rd-6);
  background: transparent;
  color: var(--fg-soft);
  font-size: var(--tk-fs-13);
  cursor: pointer;
  text-align: left;
}
.pf-nav-item:hover {
  background: var(--bg);
  color: var(--fg);
}
.pf-nav-item.active {
  background: var(--bg);
  color: var(--accent);
  font-weight: 600;
}
.pf-content {
  flex: 1;
  min-width: 0;
  overflow: auto;
  padding: var(--tk-sp-14);
  display: flex;
  flex-direction: column;
  gap: var(--tk-sp-14);
  background: var(--bg);
}
.pf-sec {
  border: 1px solid var(--border);
  border-radius: var(--tk-rd-8);
  padding: var(--tk-sp-10) var(--tk-sp-12);
}
.pf-inline {
  display: flex;
  align-items: center;
  gap: var(--tk-sp-10);
  flex-wrap: wrap;
}
.pf-row > span {
  display: inline-flex;
  align-items: baseline;
  gap: var(--tk-sp-6);
  flex-wrap: wrap;
}
@media (max-width: 600px) {
  .pf-layout {
    flex-direction: column;
  }
  .pf-nav {
    flex-direction: row;
    flex: 0 0 auto;
    overflow-x: auto;
    border-right: none;
    border-bottom: 1px solid var(--border);
  }
  .pf-nav-item {
    flex: 0 0 auto;
  }
  .pf-window {
    height: min(640px, 90vh);
  }
}
.pf-sec-head {
  display: flex;
  align-items: center;
  gap: var(--tk-sp-8);
  font-size: var(--tk-fs-12);
  font-weight: 600;
  color: var(--fg-soft);
  margin-bottom: var(--tk-sp-8);
}

.pf-note {
  font-weight: 400;
  font-size: var(--tk-fs-11);
}
.pf-row {
  display: flex;
  align-items: center;
  gap: var(--tk-sp-8);
  font-size: var(--tk-fs-13);
  padding: var(--tk-sp-5) 0;
  cursor: pointer;
}
.pf-desc {
  font-size: var(--tk-fs-11);
  color: var(--fg-soft);
}
.pf-num {
  width: 76px;
  padding: var(--tk-sp-3) var(--tk-sp-6);
  border: 1px solid var(--border);
  border-radius: var(--tk-rd-6);
  background: var(--bg-soft);
  color: var(--fg);
}
.pf-auto {
  display: inline-flex;
  align-items: center;
  gap: var(--tk-sp-4);
  font-weight: 400;
  cursor: pointer;
}
.pf-chart-block {
  margin-bottom: var(--tk-sp-10);
}
.pf-chart-title {
  font-size: var(--tk-fs-11);
  color: var(--fg-soft);
  margin-bottom: var(--tk-sp-2);
}
.pf-legend {
  display: flex;
  flex-wrap: wrap;
  gap: var(--tk-sp-4) var(--tk-sp-14);
  margin-top: var(--tk-sp-4);
  font-size: var(--tk-fs-11);
  color: var(--fg-soft);
}
.pf-legend-item {
  display: inline-flex;
  align-items: center;
  gap: var(--tk-sp-5);
}
.pf-legend-item b {
  color: var(--fg);
  font-variant-numeric: tabular-nums;
}
.pf-dot {
  display: inline-block;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}
.pf-uptime {
  margin-top: var(--tk-sp-8);
  font-size: var(--tk-fs-11);
  color: var(--fg-soft);
}
.pf-foot {
  display: flex;
  align-items: center;
  gap: var(--tk-sp-8);
  padding: var(--tk-sp-10) var(--tk-sp-14);
  border-top: 1px solid var(--border);
}
.pf-spacer {
  flex: 1;
}
.pf-save-err {
  font-size: var(--tk-fs-12);
  color: var(--tk-danger);
}
.pf-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--tk-sp-4);
  padding: var(--tk-sp-5) var(--tk-sp-12);
  font-size: var(--tk-fs-12);
  border: 1px solid var(--border);
  background: transparent;
  color: var(--fg);
  border-radius: var(--tk-rd-6);
  cursor: pointer;
}
.pf-btn:hover {
  background: var(--bg-soft);
}
.pf-btn.primary {
  background: var(--accent);
  border-color: var(--accent);
  color: var(--accent-fg);
}
.pf-btn.primary:hover {
  opacity: 0.9;
  background: var(--accent);
}
.pf-btn.ghost {
  border: none;
  padding: var(--tk-sp-4);
}
</style>
