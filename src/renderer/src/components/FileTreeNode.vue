<script setup>
import { computed } from 'vue'
import { ChevronDown, ChevronRight, FileText, Folder, FolderOpen } from 'lucide-vue-next'
import { store } from '../store'

const props = defineProps({
  node: { type: Object, required: true }
})

const emit = defineEmits(['open'])

const active = computed(
  () => !props.node.isDir && props.node.path === (store.tabs.find((t) => t.id === store.activeId)?.filePath || null)
)

function toggle(node) {
  if (node.isDir) {
    if (node.expanded) node.expanded = false
    else expand(node)
  } else {
    emit('open', node.path)
  }
}

async function expand(node) {
  node.expanded = true
  if (node.loaded) return
  node.loading = true
  try {
    const r = await window.mdreader.listDir(node.path)
    const children = r?.entries || []
    children.forEach((c) => {
      if (!node.children.some((x) => x.path === c.path)) {
        node.children.push({
          ...c,
          depth: (node.depth || 0) + 1,
          expanded: false,
          loading: false,
          loaded: false,
          children: []
        })
      }
    })
    node.loaded = true
  } finally {
    node.loading = false
  }
}

defineExpose({ toggle, expand })
</script>

<template>
  <button
    class="ft-item"
    :class="{ dir: node.isDir, active }"
    :style="{ paddingLeft: 8 + node.depth * 14 + 'px' }"
    :title="node.path"
    @click="toggle(node)"
  >
    <ChevronDown v-if="node.isDir && node.expanded" :size="13" class="ft-caret" />
    <ChevronRight v-else-if="node.isDir" :size="13" class="ft-caret" />
    <span v-else class="ft-caret-spacer"></span>
    <FolderOpen v-if="node.isDir && node.expanded" :size="14" class="ft-ico" />
    <Folder v-else-if="node.isDir" :size="14" class="ft-ico" />
    <FileText v-else :size="14" class="ft-ico" />
    <span class="ft-name">{{ node.name }}</span>
  </button>
  <template v-if="node.isDir && node.expanded">
    <FileTreeNode
      v-for="c in node.children"
      :key="c.path"
      :node="c"
      @open="(p) => emit('open', p)"
    />
  </template>
</template>
