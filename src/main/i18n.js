/**
 * 主进程文案（原生菜单 / 托盘 / 系统对话框）。
 * 渲染层通过 app:set-locale 同步语言，主进程据此重建菜单与托盘。
 */
const MESSAGES = {
  'zh-CN': {
    'app.unnamed': '未命名',
    'link.noDocPath': '当前文档尚未保存到磁盘，无法解析相对链接',
    'link.notFound': '文件不存在：{path}',
    'exit.title': 'MdReader',
    'exit.message': '有未保存的更改，是否保存后退出？',
    'exit.detail': '将保存所有修改过的文档。',
    'exit.saveAll': '保存全部',
    'exit.dontSave': '不保存',
    'exit.cancel': '取消',
    'menu.noRecent': '（暂无记录）',
    'menu.file': '文件',
    'menu.new': '新建',
    'menu.open': '打开…',
    'menu.recent': '最近打开',
    'menu.save': '保存',
    'menu.saveAs': '另存为…',
    'menu.exportHtml': '导出 HTML…',
    'menu.exportWord': '导出 Word 文档…',
    'menu.exportImage': '导出长图…',
    'menu.exportPdf': '导出 PDF…',
    'menu.print': '打印 / 导出 PDF',
    'menu.reveal': '在资源管理器中显示',
    'menu.quit': '退出',
    'menu.edit': '编辑',
    'menu.undo': '撤销',
    'menu.redo': '重做',
    'menu.cut': '剪切',
    'menu.copy': '复制',
    'menu.paste': '粘贴',
    'menu.selectAll': '全选',
    'menu.find': '查找…',
    'menu.replace': '替换…',
    'menu.insert': '插入',
    'menu.mindmap': '脑图…',
    'menu.format': '格式',
    'menu.bold': '加粗',
    'menu.italic': '斜体',
    'menu.underline': '下划线',
    'menu.strike': '删除线',
    'menu.superscript': '上标',
    'menu.subscript': '下标',
    'menu.highlight': '高亮',
    'menu.wavy': '波浪线',
    'menu.removeFormat': '清除格式',
    'menu.view': '视图',
    'menu.docSource': '查看全文 Markdown',
    'menu.fileTree': '文件树',
    'menu.lightTheme': '浅色主题',
    'menu.darkTheme': '深色主题',
    'menu.zoomIn': '放大',
    'menu.zoomOut': '缩小',
    'menu.resetZoom': '重置缩放',
    'menu.fullscreen': '全屏',
    'menu.devTools': '开发者工具',
    'menu.help': '帮助',
    'menu.changelog': '更新日志',
    'menu.about': '关于 MdReader',
    'dialog.openMd': '打开 Markdown 文件',
    'dialog.openFolder': '打开文件夹',
    'dialog.saveAs': '另存为',
    'dialog.export': '导出',
    'dialog.exportPdf': '导出 PDF',
    'dialog.filterMd': 'Markdown 文件',
    'dialog.filterAll': '所有文件',
    'dialog.filterPdf': 'PDF 文档',
    'dialog.filterFile': '文件',
    'dialog.exportTimeout': '导出超时：渲染进程未响应，请重试',
    'dialog.closeTab': '关闭标签',
    'dialog.closeTabMessage': '是否保存对 “{name}” 的更改？',
    'dialog.save': '保存',
    'dialog.dontSave': '不保存',
    'dialog.cancel': '取消',
    'error.needSave': '请先保存文档',
    'tray.tooltip': 'MdReader - Markdown 编辑器',
    'tray.showHide': '显示 / 隐藏窗口',
    'tray.newFile': '新建文件',
    'tray.quit': '退出'
  },
  'en-US': {
    'app.unnamed': 'Untitled',
    'link.noDocPath': 'Save the document to disk before resolving relative links',
    'link.notFound': 'File not found: {path}',
    'exit.title': 'MdReader',
    'exit.message': 'You have unsaved changes. Save before quitting?',
    'exit.detail': 'All modified documents will be saved.',
    'exit.saveAll': 'Save all',
    'exit.dontSave': "Don't save",
    'exit.cancel': 'Cancel',
    'menu.noRecent': '(No recent files)',
    'menu.file': 'File',
    'menu.new': 'New',
    'menu.open': 'Open…',
    'menu.recent': 'Open Recent',
    'menu.save': 'Save',
    'menu.saveAs': 'Save As…',
    'menu.exportHtml': 'Export HTML…',
    'menu.exportWord': 'Export Word Document…',
    'menu.exportImage': 'Export Long Image…',
    'menu.exportPdf': 'Export PDF…',
    'menu.print': 'Print / Export PDF',
    'menu.reveal': 'Show in File Explorer',
    'menu.quit': 'Quit',
    'menu.edit': 'Edit',
    'menu.undo': 'Undo',
    'menu.redo': 'Redo',
    'menu.cut': 'Cut',
    'menu.copy': 'Copy',
    'menu.paste': 'Paste',
    'menu.selectAll': 'Select All',
    'menu.find': 'Find…',
    'menu.replace': 'Replace…',
    'menu.insert': 'Insert',
    'menu.mindmap': 'Mind Map…',
    'menu.format': 'Format',
    'menu.bold': 'Bold',
    'menu.italic': 'Italic',
    'menu.underline': 'Underline',
    'menu.strike': 'Strikethrough',
    'menu.superscript': 'Superscript',
    'menu.subscript': 'Subscript',
    'menu.highlight': 'Highlight',
    'menu.wavy': 'Wavy Underline',
    'menu.removeFormat': 'Clear Formatting',
    'menu.view': 'View',
    'menu.docSource': 'View Full Markdown',
    'menu.fileTree': 'File Tree',
    'menu.lightTheme': 'Light Theme',
    'menu.darkTheme': 'Dark Theme',
    'menu.zoomIn': 'Zoom In',
    'menu.zoomOut': 'Zoom Out',
    'menu.resetZoom': 'Reset Zoom',
    'menu.fullscreen': 'Full Screen',
    'menu.devTools': 'Developer Tools',
    'menu.help': 'Help',
    'menu.changelog': 'Changelog',
    'menu.about': 'About MdReader',
    'dialog.openMd': 'Open Markdown File',
    'dialog.openFolder': 'Open Folder',
    'dialog.saveAs': 'Save As',
    'dialog.export': 'Export',
    'dialog.exportPdf': 'Export PDF',
    'dialog.filterMd': 'Markdown Files',
    'dialog.filterAll': 'All Files',
    'dialog.filterPdf': 'PDF Documents',
    'dialog.filterFile': 'File',
    'dialog.exportTimeout': 'Export timed out: the renderer is not responding. Try again.',
    'dialog.closeTab': 'Close Tab',
    'dialog.closeTabMessage': 'Save changes to “{name}”?',
    'dialog.save': 'Save',
    'dialog.dontSave': "Don't Save",
    'dialog.cancel': 'Cancel',
    'error.needSave': 'Save the document first',
    'tray.tooltip': 'MdReader - Markdown Editor',
    'tray.showHide': 'Show / Hide Window',
    'tray.newFile': 'New File',
    'tray.quit': 'Quit'
  }
}

let current = 'zh-CN'

export function initMainLocale(navLocale) {
  current = /^zh/i.test(String(navLocale || '')) ? 'zh-CN' : 'en-US'
  return current
}

export function getMainLocale() {
  return current
}

export function setMainLocale(next) {
  if (MESSAGES[next]) current = next
  return current
}

export function mt(key, params) {
  const dict = MESSAGES[current] || MESSAGES['zh-CN']
  let text = dict[key] ?? MESSAGES['zh-CN'][key] ?? key
  if (params) {
    text = text.replace(/\{(\w+)\}/g, (_, name) => (params[name] ?? ''))
  }
  return text
}

export { MESSAGES }
