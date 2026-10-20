<script setup>
import {
  Bold, Italic, Underline, Strikethrough, Waves, Superscript, Subscript,
  Highlighter, Palette, RemoveFormatting
} from 'lucide-vue-next'
import { computed } from 'vue'
import { UxButton } from '@ux/components'
import Dropdown from './Dropdown.vue'
import { t } from '../i18n'

defineProps({
  bar: { type: Object, required: true },
  api: { type: Object, required: true }
})

// 选区高亮取色器功能调色板（用户可选数据，非应用 chrome 样式），tokens 检查豁免
/* tokens-exempt */
const PALETTE = ['#e03131', '#2f9e44', '#1971c2', '#f08c00', '#9c36b5', '#0c8599', '#e64980', '#343a40']
const FONTS = computed(() => [
  { value: "'Segoe UI', 'Microsoft YaHei', sans-serif", label: t('sel.sans') },
  { value: 'Georgia, serif', label: t('sel.serif') },
  { value: 'Consolas, monospace', label: t('sel.mono') },
  { value: "'KaiTi', '楷体', serif", label: t('sel.kai') }
])
const SIZES = computed(() => [
  { value: '13px', label: t('sel.small') },
  { value: '19px', label: t('sel.large') },
  { value: '24px', label: t('sel.xlarge') }
])
</script>

<template>
  <div
    v-if="bar.visible"
    :ref="(el) => api.setBarEl(el)"
    class="selbar"
    :style="{ left: bar.x + 'px', top: bar.y + 'px' }"
    @mousedown="api.onSelbarMousedown"
  >
    <UxButton size="sm" variant="ghost" :label="t('sel.bold')" @click="api.execFormat('bold')">
      <template #icon><Bold :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.italic')" @click="api.execFormat('italic')">
      <template #icon><Italic :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.underline')" @click="api.execFormat('underline')">
      <template #icon><Underline :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.strike')" @click="api.execFormat('strikeThrough')">
      <template #icon><Strikethrough :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.wavy')" @click="api.execWavy">
      <template #icon><Waves :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.superscript')" @click="api.execFormat('superscript')">
      <template #icon><Superscript :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.subscript')" @click="api.execFormat('subscript')">
      <template #icon><Subscript :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.highlight')" @click="api.execHighlight">
      <template #icon><Highlighter :size="14" /></template>
    </UxButton>
    <UxButton size="sm" variant="ghost" :label="t('sel.copyMd')" @click="api.selectionToMd">MD</UxButton>
    <div class="sb-sep"></div>
    <UxButton class="sb-color-btn" size="sm" variant="ghost" :label="t('sel.color')" @click="bar.colorOpen = !bar.colorOpen">
      <template #icon><Palette :size="14" /><span class="sb-color-line" /></template>
    </UxButton>
    <Dropdown :options="SIZES" :placeholder="t('sel.size')" @update:model-value="api.applySize" />
    <Dropdown :options="FONTS" :placeholder="t('sel.font')" @update:model-value="api.applyFont" />
    <UxButton size="sm" variant="ghost" :label="t('sel.clear')" @click="api.execFormat('removeFormat')">
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
      <label class="sb-custom" :title="t('sel.customColor')">
        <input type="color" :value="PALETTE[0]" @change="api.applyColor($event.target.value)" />
        <span>{{ t('sel.custom') }}</span>
      </label>
    </div>
  </div>
</template>
