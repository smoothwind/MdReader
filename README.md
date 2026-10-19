# MdReader

[![CI](https://github.com/smoothwind/MdReader/actions/workflows/ci.yml/badge.svg)](https://github.com/smoothwind/MdReader/actions/workflows/ci.yml)
[![Release](https://github.com/smoothwind/MdReader/actions/workflows/release.yml/badge.svg)](https://github.com/smoothwind/MdReader/actions/workflows/release.yml)
[![GitHub Pages](https://github.com/smoothwind/MdReader/actions/workflows/pages.yml/badge.svg)](https://github.com/smoothwind/MdReader/actions/workflows/pages.yml)
[![Release version](https://img.shields.io/github/v/release/smoothwind/MdReader?include_prereleases&label=release)](https://github.com/smoothwind/MdReader/releases)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

参考 Typora 编辑体验的 Markdown 桌面工具，基于 **Vue 3 + Vditor**，支持 **Electron** 与 **Tauri 2 + WebView2** 双运行方案（渲染层 100% 共用，按需选择其一构建）。

- 官网（GitHub Pages）：<https://smoothwind.github.io/MdReader/>
- 在线体验（Web 演示版，无需安装）：<https://smoothwind.github.io/MdReader/app/>
- 下载安装包：<https://github.com/smoothwind/MdReader/releases>

## 功能特性

- **所见即所得编辑**：Vditor WYSIWYG 模式，输入即所见
- **全类型源码可见**：点击 Mermaid/图表面板原地编辑源码（失焦自动渲染，编辑期间零渲染干扰）；双击段落/标题/表格原地编辑 Markdown 源码（Lute 精确双向转换）；视图菜单查看全文 Markdown
- **代码块语言管理**：工具条输入框指定/修改语言，右上角徽标实时显示；未指定语言时保持纯源码态不被渲染打断
- **多标签编辑**：标签切换 / 中键关闭 / 关闭前确认，会话自动恢复（重启还原标签、滚动位置与未保存状态）
- **脑图**：`Ctrl+M` 光标处插入模板，悬浮「编辑」打开画布可视化编辑，支持导出 JSON/SVG/PNG；悬浮工具条支持缩放（−/＋、实时比例、一键还原视图）
- **Mermaid 图表**：流程图/时序图/甘特图离线渲染，可导出 PNG
- **代码块工具**：SQL/JSON 格式化与压缩；**任意代码块导出为 PNG**（保留 ASCII 图排版）；复制源码
- **表格工具**：导出图片 / Excel，斑马纹等样式切换；双击表格编辑 Markdown 源码
- **查找替换**：`Ctrl+F` / `Ctrl+H`，大小写区分，逐个/全部替换
- **富文本浮动工具条**：加粗/斜体/上下标/高亮/波浪线/颜色/字号/字体，选区一键转 Markdown
- **目录浮窗**：标题跳转与当前章节高亮
- **导出**：文档导出 HTML / Word、导出整篇长图、打印 / 导出 PDF（`Ctrl+P`）
- **链接智能分流**：`#锚点` 文内跳转、外链开系统浏览器、本地 `.md` 应用内打开、其他文件交系统程序；悬浮显示地址 + 复制 + 锚点有效性校验
- **文件树侧边栏**：按文件夹浏览与打开文档，当前文件自动定位
- **外部修改检测**：文档被其他程序修改后自动提示并重载
- **图片插入**：拖入或直接粘贴图片，自动复制到文档旁 `assets/` 并插入相对引用
- **自动保存**：每 30 秒静默保存已落盘文档（可在设置中开关）
- **性能与监控面板**：各进程内存/CPU 实时折线图（ECharts），托盘常驻
- **渲染样式自定义**：设置中切换内容主题（自动/Ant Design/WeChat 等）与自定义 CSS，实时预览，导出/打印继承
- **主题**：浅色 / 深色（滚动条、右键菜单等全面适配），深浅即切
- **其他**：字数统计、最近打开、拖拽打开、单实例运行、双击 `.md` 打开（安装后文件关联）
- **Web 演示版**：同一渲染层在浏览器中运行（文档存浏览器本地、导出走下载、PDF 降级打印），随 `main` 自动部署到 GitHub Pages
- **质量**：vitest 单元测试（`npm run test`）、CI 构建与 Rust 测试、原子写盘、版本号单一来源同步

## 技术栈

| 层 | 技术 |
| --- | --- |
| 前端框架 | Vue 3 + Vite |
| 编辑器 | Vditor（WYSIWYG） |
| 方案 A | Electron（主进程 + preload） |
| 方案 B | Tauri 2 + WebView2（Rust 外壳） |
| 图表 | ECharts（按需加载） |
| 打包 | electron-builder / tauri-cli NSIS |

## 快速开始

```bash
npm install        # postinstall 会复制 vditor 静态资源到 src/renderer/public/vditor/
npm run dev        # Electron 方案开发调试
npm run tauri:dev  # Tauri 方案开发调试（需要 Rust 工具链：winget install Rustlang.Rustup）
npm run dev:web    # Web 演示版开发调试（浏览器打开 http://localhost:5174/）
```

> Electron 二进制下载缓慢可设置镜像：`$env:ELECTRON_MIRROR = 'https://npmmirror.com/mirrors/electron/'`；
> Rust/crates 建议配置国内镜像（rustup `RUSTUP_DIST_SERVER` + cargo sparse registry）。

## 打包 Windows 安装包

```bash
npm run dist         # Electron 方案 → release/（NSIS）
npm run tauri:build  # Tauri 方案 → src-tauri/target/release/bundle/nsis/（NSIS，体积约 7MB）
```

CI：推送 `v*` 标签会自动构建 Tauri 安装包并附加到 GitHub Release（见 `.github/workflows/`）。

## CI / 自动化

| 工作流 | 触发 | 作用 |
| --- | --- | --- |
| `ci.yml` | push / PR（`main`、`master`） | lint、单元测试、令牌与命令映射校验、Electron 构建、Rust `check` + `test` |
| `release.yml` | 推送 `v*` 标签 | 同步版本号（`package.json` 为准）→ 构建 Tauri NSIS 安装包 → 附加到 GitHub Release；`beta`/`rc` 自动标记预发布 |
| `pages.yml` | push `main` | 构建官网 + Web 演示版并部署 GitHub Pages（应用位于项目站 `/app/` 子路径） |

在线入口由 `pages.yml` 发布后可用：官网 <https://smoothwind.github.io/MdReader/>，Web 演示版 <https://smoothwind.github.io/MdReader/app/>。

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| `Ctrl + N` / `Ctrl + O` | 新建 / 打开 |
| `Ctrl + S` / `Ctrl + Shift + S` | 保存 / 另存为 |
| `Ctrl + F` / `Ctrl + H` | 查找 / 替换 |
| `Ctrl + M` | 插入脑图 |
| `Ctrl + B` / `I` / `U` | 加粗 / 斜体 / 下划线 |
| `Ctrl + Shift + X` | 删除线 |
| `Ctrl + =` / `Ctrl + Shift + =` | 下标 / 上标 |
| `Ctrl + P` | 打印 / 导出 PDF |
| `F11` | 全屏（Tauri 方案） |

## 目录结构

```
MdReader/
├── electron.vite.config.mjs      # Electron 构建配置
├── vite.tauri.config.mjs         # Tauri / Web 前端构建配置（WEB_BASE 支持子路径部署）
├── electron-builder.yml          # Electron 打包配置
├── website/index.html            # GitHub Pages 官网落地页
├── vendor/uxkit/                 # @ux 组件库副本（CI/Pages 无上游仓库时使用）
├── scripts/                      # copy-vditor / sync-version / sync-ux / check-*
├── .github/workflows/            # ci.yml / release.yml / pages.yml
├── src-tauri/                    # Tauri 2 Rust 外壳（方案 B）
│   ├── src/lib.rs                # 窗口/托盘/菜单/文件/链接分流/监控
│   ├── tauri.conf.json
│   └── icons/
└── src/
    ├── main/index.js             # Electron 主进程（方案 A）
    ├── preload/index.js          # contextBridge API
    └── renderer/
        ├── index.html            # CSP 与 favicon
        ├── public/vditor/        # 运行时编辑器资源（gitignore）
        └── src/
            ├── App.vue           # 标签页/命令路由/拖拽/会话/自动保存
            ├── store.js          # 全局响应式状态
            ├── welcome.js        # 内置欢迎文档
            ├── api/                  # window.mdreader 三端契约
            │   ├── tauri-mdreader.js # Tauri 适配器
            │   └── web-mdreader.js   # 浏览器降级适配器（Web 演示版）
            ├── composables/useTheme.js
            ├── utils/mindmap-convert.js
            ├── components/
            │   ├── TabBar.vue          # 标签栏与全局动作
            │   ├── EditorPane.vue      # Vditor 封装（悬浮工具条/查找/导出/右键菜单）
            │   ├── MindMapEditor.vue   # 脑图画布（按需加载）
            │   ├── FileTreePanel.vue   # 文件树侧边栏（FileTreeNode 递归节点）
            │   ├── TocPanel.vue        # 目录浮窗
            │   ├── StatusBar.vue       # 字数/保存时间
            │   ├── SettingsDialog.vue  # 性能与监控
            │   └── LineChart.vue       # ECharts 折线图（按需加载）
            └── styles/main.css   # CSS 变量双主题
```

## 许可证

MIT（见 [LICENSE](LICENSE)）。

