import { reactive } from 'vue'
import { getWelcomeDoc } from './welcome'

let seq = 0

export const store = reactive({
  tabs: [],
  activeId: null,
  theme: 'light',
  showFileTree: false,
  stats: { wordCount: 0, characterCount: 0, lineCount: 0 },
  savedAt: null,
  toc: [],
  tocActiveId: null
})

export function nextTabId() {
  return 'tab' + ++seq
}

export function getActive() {
  return store.tabs.find((t) => t.id === store.activeId) || null
}

export function createTab(filePath, fileName, content) {
  const tab = {
    id: nextTabId(),
    filePath: filePath || null,
    fileName: fileName || '',
    content: content || '',
    dirty: false,
    savedAt: null,
    scrollTop: 0
  }
  store.tabs.push(tab)
  store.activeId = tab.id
  return tab
}

export { getWelcomeDoc }
