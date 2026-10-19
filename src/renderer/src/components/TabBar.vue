<script setup>
import { computed } from 'vue'
import { store } from '../store'
import { UxButton } from '@ux/components'
import { UxTabs } from '@ux/shell'

const emit = defineEmits([
  'select',
  'close',
  'close-others',
  'close-right',
  'close-left',
  'close-all',
  'new',
  'open',
  'save',
  'insert-mindmap',
  'cycle-theme',
  'open-settings',
  'open-tour',
  'toggle-file-tree'
])

const noDoc = computed(() => store.tabs.length === 0)

// store.tabs → UxTabs 数据模型（title / dirty）
const tabs = computed(() =>
  store.tabs.map((t) => ({
    id: t.id,
    title: t.fileName || '未命名',
    dirty: !!t.dirty
  }))
)

// 拖拽排序：UxTabs 仅上报 (fromId, toIndex)，由宿主修正下标并落库
function onReorder(fromId, toIndex) {
  const from = store.tabs.findIndex((t) => t.id === fromId)
  if (from < 0) return
  const [moved] = store.tabs.splice(from, 1)
  const idx = Math.max(0, Math.min(store.tabs.length, toIndex > from ? toIndex - 1 : toIndex))
  store.tabs.splice(idx, 0, moved)
  emit('select', moved.id)
}
</script>

<template>
  <div class="tabbar">
    <div class="tabbar-tabs">
      <div v-if="noDoc" class="tabbar-empty">
        <span>欢迎使用 MdReader — 也可直接拖入 .md 文件</span>
        <UxButton size="sm" variant="secondary" @click="$emit('new')">新建文件</UxButton>
        <UxButton size="sm" variant="primary" @click="$emit('open')">打开文件…</UxButton>
      </div>
      <UxTabs
        v-else
        :items="tabs"
        :active-id="store.activeId || ''"
        label="文档标签"
        @select="(id) => $emit('select', id)"
        @close="(id) => $emit('close', id)"
        @close-others="(id) => $emit('close-others', id)"
        @close-right="(id) => $emit('close-right', id)"
        @close-left="(id) => $emit('close-left', id)"
        @close-all="$emit('close-all')"
        @reorder="onReorder"
      />
    </div>
    <div class="tabbar-actions">
      <UxButton
        size="sm"
        :variant="store.showFileTree ? 'primary' : 'ghost'"
        icon="obj-folder-tree"
        :label="store.showFileTree ? '收起文件树' : '文件树'"
        @click="$emit('toggle-file-tree')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-help"
        label="漫游引导"
        data-tour="help"
        @click="$emit('open-tour')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-settings"
        label="性能与监控"
        data-tour="settings"
        @click="$emit('open-settings')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        :icon="store.theme === 'dark' ? 'act-theme-light' : 'act-theme-dark'"
        :label="store.theme === 'dark' ? '切换为浅色主题' : '切换为深色主题'"
        data-tour="theme"
        @click="$emit('cycle-theme')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-mindmap"
        label="插入脑图（Ctrl+M）"
        data-tour="insert-mindmap"
        @click="$emit('insert-mindmap')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-open-file"
        label="打开文件（Ctrl+O）"
        data-tour="doc-actions"
        @click="$emit('open')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-file-plus"
        label="新建文件（Ctrl+N）"
        @click="$emit('new')"
      />
      <UxButton
        size="sm"
        variant="primary"
        icon="act-save"
        label="保存当前文件（Ctrl+S）"
        :disabled="noDoc"
        @click="$emit('save')"
      />
    </div>
  </div>
</template>

<style scoped>
/* 让 UxTabs 只承担标签条本身，容器外观仍由 .tabbar 统一控制 */
:deep(.ux-tabs) {
  flex: 1;
  min-width: 0;
  background: transparent;
  border-bottom: none;
}
</style>
