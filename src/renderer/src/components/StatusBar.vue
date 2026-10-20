<script setup>
import { computed } from 'vue'
import { store, getActive } from '../store'
import { t } from '../i18n'

const pathText = computed(() => getActive()?.filePath || t('status.notSaved'))
const savedText = computed(() => {
  const at = getActive()?.savedAt
  return at ? t('status.savedAt', { time: new Date(at).toLocaleTimeString() }) : ''
})
const statText = computed(() =>
  t('status.stats', {
    words: store.stats.wordCount,
    chars: store.stats.characterCount,
    lines: store.stats.lineCount
  })
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
