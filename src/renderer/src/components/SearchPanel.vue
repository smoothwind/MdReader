<script setup>
import { UxButton } from '@ux/components'
import { ArrowUp, ArrowDown, X, CaseSensitive, Replace, ReplaceAll, Regex } from 'lucide-vue-next'
import { t } from '../i18n'

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
        :placeholder="t('search.find')"
        @input="api.onQueryInput"
        @keydown="api.onSearchKeydown"
      />
      <UxButton
        size="sm"
        :variant="state.caseSensitive ? 'primary' : 'ghost'"
        :label="t('search.caseSensitive')"
        @click="api.toggleCase"
      >
        <template #icon><CaseSensitive :size="15" /></template>
      </UxButton>
      <UxButton
        size="sm"
        :variant="state.wholeWord ? 'primary' : 'ghost'"
        :label="t('search.wholeWord')"
        @click="api.toggleWholeWord"
      >
        <template #icon><b style="font-size: 11px">W</b></template>
      </UxButton>
      <UxButton
        size="sm"
        :variant="state.regex ? 'primary' : 'ghost'"
        :label="t('search.regex')"
        @click="api.toggleRegex"
      >
        <template #icon><Regex :size="15" /></template>
      </UxButton>
      <span class="search-info">{{ state.info }}</span>
      <UxButton size="sm" variant="ghost" :label="t('search.prev')" @click="api.gotoMatch(state.index - 1)">
        <template #icon><ArrowUp :size="14" /></template>
      </UxButton>
      <UxButton size="sm" variant="ghost" :label="t('search.next')" @click="api.gotoMatch(state.index + 1)">
        <template #icon><ArrowDown :size="14" /></template>
      </UxButton>
      <UxButton size="sm" variant="ghost" :label="t('search.close')" @click="api.closeSearch">
        <template #icon><X :size="14" /></template>
      </UxButton>
    </div>
    <div v-if="state.withReplace" class="search-row">
      <input
        v-model="state.replaceText"
        class="search-input"
        :placeholder="t('search.replace')"
        @keydown="api.onReplaceKeydown"
      />
      <UxButton size="sm" variant="ghost" :label="t('search.replaceCurrent')" @click="api.replaceCurrent">
        <template #icon><Replace :size="14" /></template>
      </UxButton>
      <UxButton size="sm" variant="ghost" :label="t('search.replaceAll')" @click="api.replaceAll">
        <template #icon><ReplaceAll :size="14" /></template>
      </UxButton>
    </div>
  </div>
</template>
