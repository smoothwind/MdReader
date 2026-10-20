<script setup>
import { ref } from 'vue'
import { store } from '../store'
import { ChevronsRight } from 'lucide-vue-next'
import { t } from '../i18n'

defineEmits(['jump'])

const collapsed = ref(localStorage.getItem('mdreader:toc-collapsed') === '1')

function toggle() {
  collapsed.value = !collapsed.value
  try {
    localStorage.setItem('mdreader:toc-collapsed', collapsed.value ? '1' : '0')
  } catch {
    /* ignore */
  }
}
</script>

<template>
  <div v-if="store.toc.length">
    <div v-if="!collapsed" class="toc-panel">
      <div class="toc-head">
        <span>{{ t('toc.title') }}</span>
        <button class="toc-toggle" :title="t('toc.collapse')" @click="toggle">
          <ChevronsRight :size="14" />
        </button>
      </div>
      <div class="toc-body">
        <button
          v-for="item in store.toc"
          :key="item.id"
          class="toc-item"
          :class="['lv' + item.level, { active: item.id === store.tocActiveId }]"
          :title="item.text"
          @click="$emit('jump', item.id)"
        >
          {{ item.text }}
        </button>
      </div>
    </div>
    <button v-else class="toc-collapsed-btn" :title="t('toc.expand')" @click="toggle">{{ t('toc.title') }}</button>
  </div>
</template>
