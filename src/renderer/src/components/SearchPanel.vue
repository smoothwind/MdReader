<script setup>
import { UxButton } from '@ux/components'
import { ArrowUp, ArrowDown, X, CaseSensitive, Replace, ReplaceAll, Regex } from 'lucide-vue-next'

defineProps({
  state: { type: Object, required: true },
  api: { type: Object, required: true }
})
</script>

<template>
  <div class="search-panel">
    <div class="search-row">
      <input
        v-model="state.query"
        class="search-input"
        placeholder="查找"
        @input="api.onQueryInput"
        @keydown="api.onSearchKeydown"
      />
      <UxButton
        size="sm"
        :variant="state.caseSensitive ? 'primary' : 'ghost'"
        label="区分大小写"
        @click="api.toggleCase"
      >
        <template #icon><CaseSensitive :size="15" /></template>
      </UxButton>
      <UxButton
        size="sm"
        :variant="state.wholeWord ? 'primary' : 'ghost'"
        label="整词匹配"
        @click="api.toggleWholeWord"
      >
        <template #icon><b style="font-size: 11px">W</b></template>
      </UxButton>
      <UxButton
        size="sm"
        :variant="state.regex ? 'primary' : 'ghost'"
        label="正则表达式"
        @click="api.toggleRegex"
      >
        <template #icon><Regex :size="15" /></template>
      </UxButton>
      <span class="search-info">{{ state.info }}</span>
      <UxButton size="sm" variant="ghost" label="上一个（Shift+Enter）" @click="api.gotoMatch(state.index - 1)">
        <template #icon><ArrowUp :size="14" /></template>
      </UxButton>
      <UxButton size="sm" variant="ghost" label="下一个（Enter）" @click="api.gotoMatch(state.index + 1)">
        <template #icon><ArrowDown :size="14" /></template>
      </UxButton>
      <UxButton size="sm" variant="ghost" label="关闭（Esc）" @click="api.closeSearch">
        <template #icon><X :size="14" /></template>
      </UxButton>
    </div>
    <div v-if="state.withReplace" class="search-row">
      <input
        v-model="state.replaceText"
        class="search-input"
        placeholder="替换为"
        @keydown="api.onReplaceKeydown"
      />
      <UxButton size="sm" variant="ghost" label="替换当前匹配" @click="api.replaceCurrent">
        <template #icon><Replace :size="14" /></template>
      </UxButton>
      <UxButton size="sm" variant="ghost" label="替换全部匹配" @click="api.replaceAll">
        <template #icon><ReplaceAll :size="14" /></template>
      </UxButton>
    </div>
  </div>
</template>
