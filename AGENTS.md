# MdReader 开发注意事项（经验教训）

本文件记录开发中踩过的坑与必须遵守的规则，供后续开发/维护参考。

## 项目架构速览

- 双运行方案：Electron（`src/main` + `src/preload`）与 Tauri 2（`src-tauri`），渲染层（`src/renderer`）100% 共用
- 渲染层通过 `window.mdreader` API 工作：Electron 由 preload 提供，Tauri 由 `src/renderer/src/api/tauri-mdreader.js` 适配器提供——**两端必须保持同一接口契约**（方法名、参数、返回结构、事件通道名）
- 编辑器为 Vditor WYSIWYG 模式，所有块级交互依赖其 DOM 结构

## 关键规则（避免再犯）

### 1. contenteditable 内嵌编辑控件必须做事件隔离

在 Vditor 宿主（contenteditable）内部挂载任何编辑控件（输入框/textarea）时，
`input / keydown / keyup / composition* / paste / copy / cut` 等事件会**冒泡进 Vditor 输入管线**，
导致：当前 DOM 被序列化进文档（控件 HTML 混入 Markdown）、块 DOM 被重渲染（控件被摧毁、无法输入）。

**必须**：在控件容器上对所有冒泡事件 `stopPropagation()`（参考 EditorPane 中
`.md-inline-src` / `.md-link-edit` 的事件隔离代码块）。容器自身的逻辑挂在更深层，不受影响。

### 2. 拦截原生默认行为时，所有提前 return 的分支都要 preventDefault

例如拦截 `<a href>` 点击导航：守卫分支（如"编辑态直接返回"）若不 `preventDefault()`，
浏览器默认导航照常执行。同理注意 `auxclick`（中击）、`dragstart`（链接拖拽）。

### 3. Vditor 块级源码/渲染切换：复用原生 showCode 语义，不要自创状态机

- WYSIWYG 渲染型块（mermaid/markmap/数学/HTML）DOM 中**源码 `<pre>` 与预览面板并存**
- 原生切换 = 源码 pre 设内联 `style.display='block'` + Range 光标移入；退出设回 `'none'`
- **不要**用自定义 class + `:has()` + `!important` 与 vditor 自身样式对抗（曾因此整版回退）
- 渲染必须门控：光标在块内（编辑中）永不渲染，失焦 + 防抖后才渲染

### 4. 块解析时 li 不是独立块

列表项编辑必须上溯到所属 `ul/ol`（`genericBlockFrom`），
否则按 `<li>` 片段往返转换会把列表项替换成 `<p>`，列表降级、内容追加。

### 5. 双击会选中单词，"选区非折叠"守卫会吞掉 dblclick

区分双击/三击用 `e.detail`（>2 为三击），不要用选区状态判断。

### 6. 工具条 mousedown.prevent 会阻止内部输入框聚焦

悬浮工具条容器的 `@mousedown.prevent`（防编辑器失焦）会连带拦截内部 `<input>`；
输入框需 `@mousedown.stop`。

### 7. 悬浮工具条命中优先级：保持区 > 新命中

链接嵌套在段落里，移动光标经过段落时 `findHit` 会命中段落分支并**立即抢占/重定位**工具条。
必须先判定"工具条可见且光标在其保持区（工具条±14px ∪ 目标↔工具条走廊±14px）内"，
在区内保持现工具条，离开后正常切换。鼠标坐标需在 `window` 级监听（工具条挂 body，host 内监听覆盖不到）。

### 8. Lute 引擎是块级 DOM↔MD 转换的正解

`window.Lute.New()`（Vditor 初始化后可用）提供：
- `VditorDOM2Md(domHtml)` / `Md2VditorDOM(md)`：wysiwyg DOM 与 Markdown 精确互转（段落/标题/表格原地源码编辑即基于此）
- `HTML2Md(html)`：通用 HTML 转 MD（选区转换等近似场景）

不要手写转换器。注意 HTML2Md 为近似（标记归一化/行内样式降级），只用于只读展示与复制。

### 9. 悬浮层/挂载进文档的 DOM 会被序列化

任何插入到编辑器宿主内的元素（含 button 等带文本的节点）都会被 `getValue()` 序列化进 Markdown。
注入型 UI 一律放 `teleport`/body（如各工具条、弹层），或确保在序列化前移除。

### 10. 导出 PDF / 长图必须走独立打印版式

- `utils/doc-export.js#mountPrintRoot` 生成离屏打印根（A4 内容宽 674px、`#app` 在 `@media print` 隐藏、body 放开 `overflow:hidden`/`height:100%`）；PDF、系统打印、长图共用，保证页码口径一致
- **不要**直接对应用 UI 调 `printToPDF` 或截 `.vditor-wysiwyg`：前者受动态内边距/视口宽度影响会溢出裁切、产生空白首页；后者高度等于视口，只能截到当前页
- 长图按 A4 内容页高 1003px 切页（与 PDF 页码一致），范围为所选页合成一张连续图
- **html-to-image 无法捕获 `position:fixed` 的离屏元素**（克隆体保留负偏移，foreignObject 内为空白）：捕获前临时改为文档流定位，结束后还原

## 其他已知限制（勿重复踩坑）

- 原生菜单/托盘菜单/系统文件对话框的样式由操作系统决定，应用内无法主题化
- `window.print()` 与系统打印管线保持原生
- Tauri 下 `Webview::show()` 只显示 webview 控件；**窗口级显示必须 `window().show()`**
  （曾导致启动后主窗体不显示）
- Tauri 单实例转发窗口（`{identifier}-sic`）存在属正常现象
- 渲染型块的"由输入触发的自动渲染"来自 Vditor 内建管线，只能通过隐藏面板 + 失焦渲染来门控，
  无法从外部拦截其内部调用
- `xlsx`（SheetJS 0.18.5，npm 上最后版本）只用于**导出** `.xlsx`（不解析外部文件），且已改为
  动态 `import('xlsx')` 不进主包；如需升级须走 SheetJS 官方 CDN 源，并重新评估 CVE（读取场景才有风险）
- vditor 静态资源按白名单复制（`scripts/copy-vditor.mjs`，21.9MB→11MB）：mathjax/graphviz/echarts/
  abcjs/wavedrom/smiles-drawer/plantuml/flowchart 已裁剪，文档书写对应代码块**不会渲染**；
  数学渲染走默认 KaTeX 引擎。需要某个能力时把对应目录加回 KEEP 列表即可
- 并发/日志：Tauri 侧互斥锁一律用 `lock_ok()`（中毒容错，release `panic="abort"` 下 `unwrap` 会直接杀进程）；
  阻塞式对话框只能出现在 `async` command 中（同步 command 阻塞主线程）；渲染层日志超 2MB 轮转为
  `mdreader.log.1`

## 设计令牌（强约束，CI 拦截）

设计令牌单一来源：`src/renderer/src/styles/tokens.css`（基础层 → 语义层 → 旧名别名三层；暗色只翻转语义层）。
检查脚本：`npm run check:tokens`（scripts/check-tokens.mjs，CI 强制执行）。

1. 样式禁写裸 hex 颜色，一律引用 `var(--tk-*)` 语义令牌（或兼容旧名 `--bg` 系）；
   图表/画布/取色器等数据配色用 `/* tokens-exempt */` 文件级或行内 `tokens-exempt` 标记豁免并注释用途。
2. 间距（margin/padding/gap）≤20px 的奇数值必须走 `var(--tk-sp-*)`；1px 线宽、>20px 布局尺寸允许字面量。
3. `z-index / border-radius / font-size / box-shadow` 禁止字面量，走对应令牌档位；需要新档位先在 tokens.css 登记。
4. 主题适配只允许发生在 tokens.css 的 `data-theme` 翻转块内；组件内禁止 `.dark` 选择器或 JS 主题分支样式。
   JS 需要主题色时运行时读 `getComputedStyle(document.documentElement).getPropertyValue('--fg')` 等（参考 EditorPane#themeBg）。
5. 删除/改名令牌前全局搜索引用；旧名别名（`--bg` 系）仅供存量过渡，新代码勿用。

## 双端接口契约（高优先级规则）

`window.mdreader` 的每个方法与事件通道**必须**同时存在于 `src/preload/index.js` 与
`src/renderer/src/api/tauri-mdreader.js`，且方法名/参数/返回结构一致。
第三端 `src/renderer/src/api/web-mdreader.js`（纯浏览器演示版，GitHub Pages 用）提供
同契约的降级实现（虚拟文档存 localStorage、导出走下载、原生能力返回不可用语义），
新增/修改接口时三端同步。渲染层调用任何 `window.mdreader.*` 前若不确定两端是否实现，
用可选调用（`?.`）防御。

**教训**：`onDropImage` 曾只在 Tauri 适配器实现，App.vue 挂载时无条件调用导致 Electron 下
`disposers.push(...)` 中途抛错，其后的 `onRequestSaveExit` 永远注册不上——关闭窗口时主进程
等待渲染层保存完成，应用假死。接口漂移的破坏是"启动期静默断链"，极难排查。

## 保存链路规则

- 一切 `save/saveAs/exportSave` 调用必须捕获错误并给出用户可见提示（vditor tip 或弹窗）；
  `saveAllAndExit` 在任一保存失败或被取消时**必须停留**，禁止 `finally { requestExit() }`。
- 落盘一律走双端的原子写（同目录临时文件 + rename），不要直接 `fs.write` 覆盖原文档。

## GitHub Pages 与 vendor/uxkit

- `@ux/*` 本地开发直连 `../UX-FRW`；CI/Pages 环境没有该仓库，回退 `vendor/uxkit/`
  （`scripts/ux-aliases.mjs` 决定，`FORCE_VENDORED_UX=1` 可本地强制验证 CI 行为）。
  改动 UX-FRW 后必须 `npm run sync-ux` 刷新 vendor 副本并提交，否则线上构建用的是旧源码。
- Pages 构建（`.github/workflows/pages.yml`）：`WEB_BASE=/<repo>/app/ npm run build:web`，
  应用部署在项目站 `/app/` 子路径。**引用 public/ 资源一律走 `utils/assets.js#publicPath`**
  （vditor cdn、content-theme、欢迎文档图片已是此模式），硬编码 `./vditor` 在子路径下会 404。
- 官网落地页在 `website/index.html`（纯静态、自包含，不参与 check:tokens 检查范围）。
