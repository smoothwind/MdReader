<script setup>
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { UxButton } from '@ux/components'
import { store } from '../store'
import { t } from '../i18n'
import FileTreeNode from './FileTreeNode.vue'

const TREE_REFRESH_MS = 5000

const emit = defineEmits(['open', 'close'])

const root = ref(null)
const loading = ref(false)
const rootEntry = ref(null)
const treeBody = ref(null)
let refreshTimer = null

async function listDir(p) {
  try {
    const r = await window.mdreader.listDir(p)
    return r?.entries || []
  } catch {
    return []
  }
}

async function loadEntry(node) {
  node.loading = true
  try {
    const children = await listDir(node.path)
    node.children = children.map((c) => ({
      ...c,
      depth: (node.depth || 0) + 1,
      expanded: false,
      loading: false,
      loaded: false,
      children: []
    }))
    node.loaded = true
  } finally {
    node.loading = false
  }
}

/** 刷新目录内容：diff 合并，保留已加载子树的展开状态 */
async function refreshChildren(node) {
  const entries = await listDir(node.path)
  const prev = new Map(node.children.map((c) => [c.path, c]))
  node.children = entries.map((e) => {
    return (
      prev.get(e.path) || {
        ...e,
        depth: (node.depth || 0) + 1,
        expanded: false,
        loading: false,
        loaded: false,
        children: []
      }
    )
  })
  node.loaded = true
}

/** 递归收集所有已展开且已加载的目录节点 */
function collectLoadedDirs(node, out) {
  if (!node.isDir) return
  if (node.loaded) out.push(node)
  for (const c of node.children) collectLoadedDirs(c, out)
}

async function autoRefresh() {
  const rootNode = rootEntry.value
  if (!rootNode) return
  const dirs = []
  collectLoadedDirs(rootNode, dirs)
  for (const d of dirs) {
    try {
      await refreshChildren(d)
    } catch {
      /* 单个目录刷新失败不影响其余 */
    }
  }
}

async function pickRoot() {
  try {
    const r = await window.mdreader.openFolderDialog()
    if (r?.canceled || !r.path) return
    setRoot(r.path)
  } catch {
    /* ignore */
  }
}

async function setRoot(p) {
  root.value = p
  const entry = {
    name: p.split(/[\\/]/).filter(Boolean).pop() || p,
    path: p,
    isDir: true,
    depth: 0,
    expanded: false,
    loading: false,
    loaded: false,
    children: []
  }
  rootEntry.value = entry
  loading.value = true
  await loadEntry(entry)
  entry.expanded = true
  loading.value = false
  revealActive()
}

async function reloadRoot() {
  if (rootEntry.value) {
    await refreshChildren(rootEntry.value)
    rootEntry.value.expanded = true
  }
}

function activePath() {
  return store.tabs.find((t) => t.id === store.activeId)?.filePath || null
}

/** 展开目录链直到当前活动文档所在目录 */
async function revealActive() {
  const fp = activePath()
  if (!fp || !root.value) return
  const norm = (s) => s.toLowerCase().replace(/\//g, '\\')
  if (!norm(fp).startsWith(norm(root.value) + '\\')) return
  let entry = rootEntry.value
  if (!entry) return
  if (!entry.expanded) {
    entry.expanded = true
  }
  if (!entry.loaded) await loadEntry(entry)
  const rel = fp.slice(root.value.length).replace(/^[\\/]/, '')
  const parts = rel.split(/[\\/]/)
  for (let i = 0; i < parts.length - 1; i++) {
    const next = entry.children.find((c) => c.name === parts[i] && c.isDir)
    if (!next) return
    next.expanded = true
    if (!next.loaded) await loadEntry(next)
    entry = next
  }
  await nextTick()
  treeBody.value?.querySelector('.ft-item.active')?.scrollIntoView({ block: 'nearest' })
}

defineExpose({ revealActive })

onMounted(() => {
  refreshTimer = setInterval(autoRefresh, TREE_REFRESH_MS)
  const fp = activePath()
  if (fp) setRoot(fp.replace(/[\\/][^\\/]*$/, ''))
  else pickRoot()
})

onBeforeUnmount(() => {
  clearInterval(refreshTimer)
})
</script>

<template>
  <aside class="file-tree" role="navigation" :aria-label="t('fileTree.title')">
    <div class="ft-head">
      <span class="ft-title" :title="root">
        {{ root ? root.split(/[\\/]/).filter(Boolean).pop() : t('fileTree.title') }}
      </span>
      <UxButton size="sm" variant="ghost" icon="obj-folder" :label="t('fileTree.openFolder')" @click="pickRoot" />
      <UxButton size="sm" variant="ghost" icon="act-retry" :label="t('fileTree.refresh')" @click="reloadRoot" />
      <UxButton size="sm" variant="ghost" icon="act-close" :label="t('fileTree.hide')" @click="emit('close')" />
    </div>
    <div ref="treeBody" class="ft-body">
      <FileTreeNode
        v-if="rootEntry"
        :node="rootEntry"
        @open="(p) => emit('open', p)"
      />
      <div v-if="loading" class="ft-hint">{{ t('fileTree.loading') }}</div>
      <div v-else-if="!rootEntry" class="ft-hint">{{ t('fileTree.pickFolder') }}</div>
    </div>
  </aside>
</template>
