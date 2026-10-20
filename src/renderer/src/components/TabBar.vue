<script setup>
import { computed } from 'vue'
import { store } from '../store'
import { UxButton } from '@ux/components'
import { UxTabs } from '@ux/shell'
import { t } from '../i18n'

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
  store.tabs.map((tab) => ({
    id: tab.id,
    title: tab.fileName || t('common.untitled'),
    dirty: !!tab.dirty
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
        <span>{{ t('tabbar.welcome') }}</span>
        <UxButton size="sm" variant="secondary" @click="$emit('new')">{{ t('tabbar.newFile') }}</UxButton>
        <UxButton size="sm" variant="primary" @click="$emit('open')">{{ t('tabbar.openFile') }}</UxButton>
      </div>
      <UxTabs
        v-else
        :items="tabs"
        :active-id="store.activeId || ''"
        :label="t('tabbar.tabsLabel')"
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
        :label="store.showFileTree ? t('tabbar.hideTree') : t('tabbar.fileTree')"
        @click="$emit('toggle-file-tree')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-help"
        :label="t('tabbar.tour')"
        data-tour="help"
        @click="$emit('open-tour')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-settings"
        :label="t('tabbar.settings')"
        data-tour="settings"
        @click="$emit('open-settings')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        :icon="store.theme === 'dark' ? 'act-theme-light' : 'act-theme-dark'"
        :label="store.theme === 'dark' ? t('tabbar.themeToLight') : t('tabbar.themeToDark')"
        data-tour="theme"
        @click="$emit('cycle-theme')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-mindmap"
        :label="t('tabbar.insertMindmap')"
        data-tour="insert-mindmap"
        @click="$emit('insert-mindmap')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-open-file"
        :label="t('tabbar.openFileShortcut')"
        data-tour="doc-actions"
        @click="$emit('open')"
      />
      <UxButton
        size="sm"
        variant="ghost"
        icon="act-file-plus"
        :label="t('tabbar.newFileShortcut')"
        @click="$emit('new')"
      />
      <UxButton
        size="sm"
        variant="primary"
        icon="act-save"
        :label="t('tabbar.saveFile')"
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
