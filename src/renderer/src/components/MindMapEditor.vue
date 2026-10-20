<script setup>
import { computed, nextTick, onBeforeUnmount, ref } from 'vue'
import MindElixir from 'mind-elixir'
import {
  ZoomIn, ZoomOut, Maximize, LocateFixed, CircleHelp, X,
  ClipboardCopy, FileJson, FileDown, ImageDown, Save
} from 'lucide-vue-next'
import { UxButton } from '@ux/components'
import { mdListToTree, treeToMdList } from '../utils/mindmap-convert'
import Dropdown from './Dropdown.vue'
import { locale, t } from '../i18n'

const overlay = ref(null)
const mapEl = ref(null)
const visible = ref(false)
const layout = ref('side')
const themeName = ref('classic')
const uiFeedback = ref('')
const helpOpen = ref(false)
let mind = null
let resolver = null
let feedbackTimer = null

const LAYOUTS = computed(() => [
  { value: 'side', label: t('mindmap.layoutSide') },
  { value: 'right', label: t('mindmap.layoutRight') },
  { value: 'left', label: t('mindmap.layoutLeft') }
])

const THEMES = computed(() => [
  { value: 'classic', label: t('mindmap.themeClassic') },
  { value: 'forest', label: t('mindmap.themeForest') },
  { value: 'sunset', label: t('mindmap.themeSunset') },
  { value: 'dark', label: t('mindmap.themeDark') }
])

const SHORTCUTS = computed(() => [
  ['Tab', t('mindmap.scNewChild')],
  ['Enter', t('mindmap.scNewSibling')],
  [t('mindmap.scDoubleClick'), t('mindmap.scEdit')],
  ['Delete / Backspace', t('mindmap.scDelete')],
  ['Ctrl + Z / Ctrl + Y', t('mindmap.scUndo')],
  ['Alt + ↑ / Alt + ↓', t('mindmap.scMove')],
  [t('mindmap.scDragMouse'), t('mindmap.scDrag')],
  [t('mindmap.scWheelMouse'), t('mindmap.scWheel')],
  [t('mindmap.scRightClick'), t('mindmap.scContext')]
])

// 脑图画布主题预设：mind-elixir 配置数据（内容主题，非应用 chrome 样式），
// 其配色独立于设计令牌体系，tokens 检查豁免（scripts/check-tokens.mjs 识别此标记）
/* tokens-exempt */
const MM_THEME_PRESETS = {
  classic: {
    name: '经典蓝',
    palette: ['#3b82f6', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#06b6d4'],
    cssVar: {
      '--gap': '30px',
      '--main-color': '#444446',
      '--main-bgcolor': '#ffffff',
      '--color': '#777777',
      '--bgcolor': '#f6f6f6',
      '--panel-color': '#444446',
      '--panel-bgcolor': '#ffffff',
      '--panel-border-color': '#eaeaea'
    }
  },
  forest: {
    name: '森林绿',
    palette: ['#10b981', '#059669', '#84cc16', '#14b8a6', '#65a30d', '#22c55e'],
    cssVar: {
      '--gap': '30px',
      '--main-color': '#1f3d2b',
      '--main-bgcolor': '#f2fbf6',
      '--color': '#4b6357',
      '--bgcolor': '#f4faf7',
      '--panel-color': '#1f3d2b',
      '--panel-bgcolor': '#ffffff',
      '--panel-border-color': '#d3e8dc'
    }
  },
  sunset: {
    name: '暖阳橙',
    palette: ['#f59e0b', '#ef4444', '#ec4899', '#f97316', '#e11d48', '#d97706'],
    cssVar: {
      '--gap': '30px',
      '--main-color': '#513a2a',
      '--main-bgcolor': '#fff8f1',
      '--color': '#8a6a52',
      '--bgcolor': '#fdf6ef',
      '--panel-color': '#513a2a',
      '--panel-bgcolor': '#ffffff',
      '--panel-border-color': '#f0ddc8'
    }
  },
  dark: {
    name: '暗夜',
    type: 'dark',
    palette: ['#8b5cf6', '#22d3ee', '#f472b6', '#facc15', '#34d399', '#fb923c'],
    cssVar: {
      '--gap': '30px',
      '--main-color': '#e5e7eb',
      '--main-bgcolor': '#3a4160',
      '--color': '#a5adc4',
      '--bgcolor': '#1f2430',
      '--panel-color': '#e5e7eb',
      '--panel-bgcolor': '#2d3748',
      '--panel-border-color': '#4a5273'
    }
  }
}

function flash(msg) {
  uiFeedback.value = msg
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => (uiFeedback.value = ''), 1200)
}

function onKeydown(e) {
  if (!mind || !e.altKey) return
  if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return
  const node = mind.currentNode
  if (!node) return
  e.preventDefault()
  e.stopPropagation()
  try {
    if (e.key === 'ArrowUp') mind.moveUpNode(node)
    else mind.moveDownNode(node)
  } catch {
    /* ignore */
  }
}

async function open(mdList) {
  visible.value = true
  layout.value = 'side'
  themeName.value = 'classic'
  await nextTick()
  await new Promise((r) => setTimeout(r, 30))
  const nodeData = mdListToTree(mdList)
  mind = new MindElixir({
    el: mapEl.value,
    direction: MindElixir.SIDE,
    locale: locale.value === 'zh-CN' ? 'zh_CN' : 'en',
    draggable: true,
    editable: true,
    contextMenu: true,
    keypress: true,
    allowUndo: true,
    overflowHidden: false,
    theme: MM_THEME_PRESETS.classic
  })
  mind.init({ nodeData })
  window.addEventListener('keydown', onKeydown, true)
  setTimeout(() => {
    try {
      mind.scaleFit()
    } catch {
      /* ignore */
    }
  }, 60)
  return new Promise((resolve) => {
    resolver = resolve
  })
}

function confirm() {
  if (!mind) return cancel()
  let list
  try {
    list = treeToMdList(mind.getData().nodeData)
  } catch {
    list = ''
  }
  const r = resolver
  cleanup()
  r?.(list)
}

function cancel() {
  const r = resolver
  cleanup()
  r?.(null)
}

function cleanup() {
  visible.value = false
  window.removeEventListener('keydown', onKeydown, true)
  try {
    mind?.destroy()
  } catch {
    /* ignore */
  }
  mind = null
  if (mapEl.value) mapEl.value.innerHTML = ''
  resolver = null
  clearTimeout(feedbackTimer)
}

function applyLayout(mode) {
  layout.value = mode
  if (!mind) return
  if (mode === 'left') mind.initLeft()
  else if (mode === 'right') mind.initRight()
  else mind.initSide()
  setTimeout(() => {
    try {
      mind.scaleFit()
    } catch {
      /* ignore */
    }
  }, 40)
}

function applyTheme(name) {
  themeName.value = name
  if (!mind) return
  try {
    mind.changeTheme(MM_THEME_PRESETS[name], true)
  } catch {
    /* ignore */
  }
}

function zoomIn() {
  if (!mind) return
  try {
    mind.scale(Math.min((mind.scaleVal || 1) * 1.2, 4))
  } catch {
    /* ignore */
  }
}

function zoomOut() {
  if (!mind) return
  try {
    mind.scale(Math.max((mind.scaleVal || 1) / 1.2, 0.25))
  } catch {
    /* ignore */
  }
}

function fitView() {
  try {
    mind?.scaleFit()
  } catch {
    /* ignore */
  }
}

function centerView() {
  try {
    mind?.toCenter()
  } catch {
    /* ignore */
  }
}

async function copyOutline() {
  if (!mind) return
  try {
    const list = treeToMdList(mind.getData().nodeData)
    await navigator.clipboard.writeText(list)
    flash(t('mindmap.copied'))
  } catch {
    flash(t('mindmap.copyFailed'))
  }
}

async function exportJson() {
  if (!mind) return
  try {
    const data = mind.getDataString()
    const r = await window.mdreader.exportSave({
      data: new TextEncoder().encode(data),
      name: `${t('mindmap.fileName')}.json`,
      ext: 'json',
      extName: t('mindmap.jsonFile')
    })
    if (!r.canceled) flash(t('mindmap.jsonExported'))
  } catch {
    flash(t('mindmap.exportFailed'))
  }
}

async function exportImage(kind) {
  if (!mind) return
  try {
    const blob = kind === 'png' ? await mind.exportPng() : await mind.exportSvg()
    if (!blob) return
    const data = new Uint8Array(await blob.arrayBuffer())
    const r = await window.mdreader.exportSave({
      data,
      name: `${t('mindmap.fileName')}.${kind}`,
      ext: kind,
      extName: kind === 'png' ? t('mindmap.pngFile') : t('mindmap.svgFile')
    })
    if (!r.canceled) flash(t('mindmap.exported', { kind: kind.toUpperCase() }))
  } catch {
    flash(t('mindmap.exportFailed'))
  }
}

onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown, true)
  clearTimeout(feedbackTimer)
})

defineExpose({ open })
</script>

<template>
  <teleport to="body">
    <div v-if="visible" ref="overlay" class="mm-overlay">
      <div class="mm-window">
        <div class="mm-toolbar">
          <span class="mm-title">{{ t('mindmap.title') }}</span>
          <Dropdown :options="LAYOUTS" :model-value="layout" @update:model-value="applyLayout" />
          <Dropdown :options="THEMES" :model-value="themeName" @update:model-value="applyTheme" />
          <span class="mm-hint">{{ t('mindmap.hint') }}</span>
          <span class="mm-spacer"></span>
          <span v-if="uiFeedback" class="mm-feedback">{{ uiFeedback }}</span>
          <UxButton size="sm" variant="ghost" :label="t('mindmap.copyOutlineTitle')" @click="copyOutline">
            <template #icon><ClipboardCopy :size="13" /></template>
            {{ t('mindmap.copyOutline') }}
          </UxButton>
          <UxButton size="sm" variant="ghost" :label="t('mindmap.exportJson')" @click="exportJson">
            <template #icon><FileJson :size="13" /></template>
            JSON
          </UxButton>
          <UxButton size="sm" variant="ghost" :label="t('mindmap.exportSvg')" @click="exportImage('svg')">
            <template #icon><FileDown :size="13" /></template>
            SVG
          </UxButton>
          <UxButton size="sm" variant="ghost" :label="t('mindmap.exportPng')" @click="exportImage('png')">
            <template #icon><ImageDown :size="13" /></template>
            PNG
          </UxButton>
          <UxButton size="sm" variant="ghost" :label="t('mindmap.cancel')" @click="cancel">
            <template #icon><X :size="13" /></template>
            {{ t('mindmap.cancel') }}
          </UxButton>
          <UxButton size="sm" variant="primary" :label="t('mindmap.save')" @click="confirm">
            <template #icon><Save :size="13" /></template>
            {{ t('mindmap.save') }}
          </UxButton>
        </div>
        <div class="mm-stage">
          <div ref="mapEl" class="mm-canvas"></div>
          <div class="mm-controls">
            <button class="mm-ctrl" :title="t('mindmap.zoomIn')" @click="zoomIn"><ZoomIn :size="14" /></button>
            <button class="mm-ctrl" :title="t('mindmap.zoomOut')" @click="zoomOut"><ZoomOut :size="14" /></button>
            <button class="mm-ctrl" :title="t('mindmap.fit')" @click="fitView"><Maximize :size="14" /></button>
            <button class="mm-ctrl" :title="t('mindmap.center')" @click="centerView"><LocateFixed :size="14" /></button>
            <button class="mm-ctrl" :class="{ on: helpOpen }" :title="t('mindmap.shortcuts')" @click="helpOpen = !helpOpen">
              <CircleHelp :size="14" />
            </button>
          </div>
          <div v-if="helpOpen" class="mm-help">
            <div class="mm-help-head">
              <span>{{ t('mindmap.shortcuts') }}</span>
              <button class="mm-ctrl" @click="helpOpen = false"><X :size="12" /></button>
            </div>
            <div v-for="[k, d] in SHORTCUTS" :key="k" class="mm-help-row">
              <span class="mm-help-key">{{ k }}</span>
              <span class="mm-help-desc">{{ d }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </teleport>
</template>
