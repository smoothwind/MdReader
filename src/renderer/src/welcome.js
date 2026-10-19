import { publicPath } from './utils/assets'

export const welcomeDoc = `# MdReader 功能简介

所见即所得的 Markdown 桌面编辑器，支持 **实时渲染**、**Mermaid 图表** 与 **主题切换**。

## 核心功能

| 功能 | 说明 |
| --- | --- |
| 所见即所得编辑 | 输入即渲染，无需切换预览窗口 |
| Mermaid 图表 | 流程图、时序图、甘特图，离线渲染 |
| 主题切换 | 浅色 / 深色，界面与内容同步切换 |
| 大纲目录 | 右侧目录浮窗，点击跳转、滚动定位、可收起 |
| 表格工具 | 悬停表格：复制源码、导出图片 / Excel、切换样式 |
| 代码工具 | 悬停 SQL / JSON 代码块：美化、压缩、复制 |
| 脑图 | markmap 代码块渲染为脑图，支持 XMind 式编辑画布 |
| 图表工具 | 悬停 Mermaid 图：复制源码、导出高清 PNG |
| 链接与图片 | 悬停链接复制 Markdown 源码，图片拖入自动引用 |
| 文件管理 | 新建 / 打开 / 保存 / 最近打开 / 拖拽打开 |
| 状态栏 | 实时字数统计、保存时间、文件路径 |

## 表格增强

悬停任意表格，右上角会出现操作工具条：

- **复制源码**：一键复制表格的 Markdown 源码
- **导出图片**：2 倍高清 PNG，自动适配当前主题背景
- **导出 Excel**：生成标准 .xlsx 文件
- **样式**：默认 / 斑马纹 / 紧凑 / 极简，按文档记忆

| 城市 | 人口（万） | GDP（亿元） |
| --- | :---: | ---: |
| 上海 | 2487 | 47218 |
| 北京 | 2185 | 43760 |
| 深圳 | 1779 | 34606 |

## 代码格式化

悬停 \`sql\` 或 \`json\` 代码块，右上角可一键 **美化**（格式化 + 缩进）或 **压缩**：

\`\`\`sql
SELECT c.id, c.name, COUNT(o.id) AS orders FROM customers c JOIN orders o ON o.customer_id = c.id GROUP BY c.id, c.name HAVING COUNT(o.id) > 10 ORDER BY orders DESC;
\`\`\`

\`\`\`json
{"name":"MdReader","features":["wysiwyg","mermaid","themes"],"config":{"theme":"light","toc":true}}
\`\`\`

## 图表能力

\`\`\`mermaid
flowchart LR
  A[编写 Markdown] --> B[实时渲染]
  B --> C[导出分享]
\`\`\`

\`\`\`mermaid
sequenceDiagram
  participant U as 用户
  participant E as MdReader
  U->>E: 悬停图表
  E-->>U: 复制源码 / 导出 PNG
\`\`\`

## 脑图

用嵌套列表编写，自动渲染为可缩放的脑图；悬停后点击 **编辑**，即可在 XMind 式画布中修改（Tab 子节点 / Enter 兄弟节点 / 双击改名 / 拖拽移动 / 右键菜单），保存后写回 Markdown 列表。

\`\`\`markmap
- MdReader
  - 编辑器
    - 所见即所得
    - 代码块增强
  - 渲染
    - Mermaid
    - 脑图
  - 导出
    - PNG / SVG
    - Excel
\`\`\`

## 大纲目录

右侧目录浮窗自动提取文档标题：**点击**跳转到对应章节，**滚动**时自动定位当前章节，可一键收起。

## 链接与图片

**链接**：悬停链接可查看地址、校验锚点有效性并复制 Markdown 源码；外部链接在系统浏览器打开，\`# 锚点\` 在本文档内跳转：

- [Vditor 编辑器官网](https://vditor.b3log.org)
- [Markdown 官方语法指南](https://markdown.com.cn)
- [跳转到：快捷键](#快捷键)

**图片**：支持相对路径与网络地址；把图片文件拖进窗口，会自动复制到文档旁 \`assets/\` 目录并插入引用：

![MdReader Logo](${publicPath('./vditor/dist/images/logo.png')})

## 快捷键

| 快捷键 | 功能 |
| --- | --- |
| **Ctrl + N** | 新建文件 |
| **Ctrl + O** | 打开文件 |
| **Ctrl + S** | 保存 |
| **Ctrl + Shift + S** | 另存为 |
| **Ctrl + M** | 在文档末尾插入脑图 |

> 提示：点击右上角按钮可切换 **主题**；把 .md 文件拖进窗口即可打开。
`
