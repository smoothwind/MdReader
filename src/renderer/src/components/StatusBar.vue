<script setup>
import { computed } from 'vue'
import { store, getActive } from '../store'

const pathText = computed(() => getActive()?.filePath || '尚未保存到文件')
const savedText = computed(() => {
  const at = getActive()?.savedAt
  return at ? '已保存 ' + new Date(at).toLocaleTimeString() : ''
})
const statText = computed(
  () =>
    store.stats.wordCount + ' 词 · ' + store.stats.characterCount + ' 字符 · ' + store.stats.lineCount + ' 行'
)
const showPath = computed(() => store.tabs.length > 0)
</script>

<template>
  <footer class="statusbar">
    <span v-if="showPath" class="path" :title="pathText">{{ pathText }}</span>
    <span class="spacer"></span>
    <span v-if="savedText" class="saved">{{ savedText }}</span>
    <span class="stats">{{ statText }}</span>
  </footer>
</template>
