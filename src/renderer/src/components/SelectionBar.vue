<script setup>
import {
  Bold, Italic, Underline, Strikethrough, Waves, Superscript, Subscript,
  Highlighter, Palette, RemoveFormatting
} from 'lucide-vue-next'
import { UxButton } from '@ux/components'
import Dropdown from './Dropdown.vue'

defineProps({
  bar: { type: Object, required: true },
  api: { type: Object, required: true }
})

// 选区高亮取色器功能调色板（用户可选数据，非应用 chrome 样式），tokens 检查豁免
/* tokens-exempt */
const PALETTE = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599', '#e64980', '#343a40']
const FONTS = [
  { value: "'Segoe UI', 'Microsoft YaHei', sans-serif", label: '无衬线' },
  { value: 'Georgia, serif', label: '衬线' },
  { value: 'Consolas, monospace', label: '等宽' },
  { value: "'KaiTi', '楷体', serif", label: '楷体' }
]
const SIZES = [
  { value: '13px', label: '小' },
  { value: '19px', label: '大' },
  { value: '24px', label: '特大' }
]
</script>

<template>
  <div
    v-if="bar.visible"
    :ref="(el) => api.setBarEl(el)"
    class="selbar"
    :style="{ left: bar.x + 'px', top: bar.y + 'px' }"
    @mousedown="api.onSelbarMousedown"
  >
    <UxButton size="sm" variant="ghost" label="加粗（Ctrl+B）" @click="api.execFormat('bold')">
      <template #icon><Bold :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="斜体（Ctrl+I）" @click="api.execFormat('italic')">
      <template #icon><Italic :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="下划线（Ctrl+U）" @click="api.execFormat('underline')">
      <template #icon><Underline :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="删除线" @click="api.execFormat('strikeThrough')">
      <template #icon><Strikethrough :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="波浪线" @click="api.execWavy">
      <template #icon><Waves :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="上标" @click="api.execFormat('superscript')">
      <template #icon><Superscript :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="下标" @click="api.execFormat('subscript')">
      <template #icon><Subscript :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="高亮" @click="api.execHighlight">
      <template #icon><Highlighter :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" label="复制选区 Markdown" @click="api.selectionToMd">MD</UxButton>
    <div class="sb-sep"></div>
    <UxButton class="sb-color-btn" size="sm" variant="ghost" label="文字颜色" @click="bar.colorOpen = !bar.colorOpen">
      <template #icon><Palette :size="14" /><span class="sb-color-line" /></template>
    </UxButton>
    <Dropdown :options="SIZES" placeholder="字号" @update:model-value="api.applySize" />
    <Dropdown :options="FONTS" placeholder="字体" @update:model-value="api.applyFont" />
    <UxButton size="sm" variant="ghost" label="清除格式" @click="api.execFormat('removeFormat')">
      <template #icon><RemoveFormatting :size="14" /></template>
    </UxButton>
    <div v-if="bar.colorOpen" class="sb-colors">
      <button
        v-for="c in PALETTE"
        :key="c"
        class="sb-color"
        :style="{ background: c }"
        :title="c"
        @click="api.applyColor(c)"
      ></button>
      <label class="sb-custom" title="自定义颜色">
        <input type="color" :value="PALETTE[0]" @change="api.applyColor($event.target.value)" />
        <span>自定义</span>
      </label>
    </div>
  </div>
</template>
