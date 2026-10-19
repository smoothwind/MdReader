/**
 * 漫游引导步骤（供 @ux/patterns 的 TourGuide 消费）
 * target 为 CSS 选择器；无 target 的步骤整屏暗化居中。
 */
export const TOUR_STEPS = [
  {
    title: '欢迎使用 MdReader',
    desc: '所见即所得的 Markdown 编辑器：像写字板一样输入，标题、列表、表格、代码块实时渲染。\n顶部是多文档标签页，底部是字数统计。\n跟随本引导浏览主要功能（约 1 分钟），随时可按 Esc 退出。'
  },
  {
    target: '[data-tour="doc-actions"]',
    title: '文档管理',
    desc: '打开（Ctrl+O）本地 .md 文件、新建（Ctrl+N）空白文档、保存（Ctrl+S，另存为 Ctrl+Shift+S）。\n也可以直接把 .md 文件拖进窗口打开；拖入图片会自动复制到文档旁 assets/ 目录并插入引用。\n标签点击切换，中键或 ✕ 关闭，关闭前会询问是否保存。'
  },
  {
    target: '[data-tour="insert-mindmap"]',
    title: '插入脑图',
    desc: '点击后在光标处插入 markmap 代码块，实时渲染为思维导图。\n悬浮工具条：打开画布可视化编辑（导出 PNG / SVG / JSON），以及缩放控制——−/＋ 放大缩小、实时比例显示、⟲ 一键还原视图。'
  },
  {
    target: '.editor-host',
    title: '所见即所得编辑',
    desc: '直接书写即可：# 标题、- 列表、> 引用、``` 代码块实时渲染。\n悬浮表格、代码块、图表会出现工具条：复制源码、导出图片、SQL/JSON 格式化，还能指定/修改代码块语言（右上角徽标实时显示）。\n点击图表面板可原地编辑源码，失焦后自动渲染；双击段落/标题可原地编辑 Markdown 源码，双击表格可编辑表格源码。\n选中文字弹出格式条（加粗、高亮、颜色…）与右键菜单，选区可一键转 Markdown。\nCtrl+F 查找、Ctrl+H 替换；代码块可一键导出为图片，ASCII 图复制不再错乱。'
  },
  {
    target: '[data-tour="settings"]',
    title: '性能与监控',
    desc: '打开实时监控面板：各进程内存 / CPU 折线图（2 秒自动刷新）。\n这里还可以开关「自动保存」——每 30 秒静默保存已保存到磁盘的文档。'
  },
  {
    target: '[data-tour="theme"]',
    title: '深浅主题',
    desc: '一键切换浅色 / 深色主题，滚动条、右键菜单、状态栏等全部跟随。'
  },
  {
    target: '.toc-panel, .toc-collapsed-btn',
    title: '目录导航',
    desc: '右侧目录列出文档所有标题，点击快速跳转，当前章节自动高亮，可折叠收起。'
  },
  {
    target: '.statusbar',
    title: '状态栏',
    desc: '实时显示字数 / 字符数 / 行数，以及当前文档最近一次保存时间。'
  },
  {
    title: '开始使用',
    desc: '常用快捷键：Ctrl+F 查找 · Ctrl+H 替换 · Ctrl+M 脑图 · Ctrl+P 打印/PDF · F11 全屏。\n关闭窗口会最小化到系统托盘，右键托盘图标可退出或新建文档。\n随时点击顶栏的 ? 按钮重新查看本引导。祝创作愉快！'
  }
]
