/**
 * langIcon.js — 代码块语言徽标图标与颜色映射
 * 数据源：工作区 codeblock-icons/.gen.json（21 字形：17 语言 + json/database/terminal/mermaid）。
 * 颜色一律走 tokens.css 的 --lang-* 双主题令牌（WCAG 1.4.11 对 #ffffff/#f6f8fa/#1f2430/#272e3d
 * 四种底色实测 ≥3.3:1，数据与再生成方式见 lang-colors.css / README）。
 * 字形：24 视窗 / 1.8 线宽 / currentColor，使用处 stroke=currentColor + color: var(--lang-*)。
 * 注：js/ts/go/php 字形含 <text> 元素，依赖系统无衬线字体（Segoe UI/system-ui 回退）。
 */

export const LANG_ICONS = {
  'lang-js': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M10.2 7.8v6.4c0 1.2-.9 2-2.1 2-.8 0-1.5-.35-1.9-.95\"/><text x=\"15.3\" y=\"16\" text-anchor=\"middle\" font-family=\"'Segoe UI',system-ui,sans-serif\" font-size=\"8.5\" font-weight=\"700\" fill=\"currentColor\" stroke=\"none\">S</text>",
  'lang-ts': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><text x=\"12\" y=\"15.5\" text-anchor=\"middle\" font-family=\"'Segoe UI',system-ui,sans-serif\" font-size=\"8.5\" font-weight=\"700\" fill=\"currentColor\" stroke=\"none\">TS</text>",
  'lang-python': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M7.6 10.6V8.7a2.1 2.1 0 0 1 2.1-2.1h4.6a2.1 2.1 0 0 1 2.1 2.1v3.4H10.9\"/><path d=\"M16.4 13.4v1.9a2.1 2.1 0 0 1-2.1 2.1H9.7a2.1 2.1 0 0 1-2.1-2.1v-3.4h5.5\"/><circle cx=\"14.7\" cy=\"8.5\" r=\"0.55\" fill=\"currentColor\" stroke=\"none\"/><circle cx=\"9.3\" cy=\"15.5\" r=\"0.55\" fill=\"currentColor\" stroke=\"none\"/>",
  'lang-java': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M8 10.5h7V15a3 3 0 0 1-3 3h-1a3 3 0 0 1-3-3z\"/><path d=\"M15 11.5h1.2a2 2 0 0 1 0 4H15\"/><path d=\"M10.3 4.9c-.7.8.7 1.5 0 2.3M13.2 4.9c-.7.8.7 1.5 0 2.3\"/>",
  'lang-c': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M15.5 8.4A5.4 5.4 0 1 0 15.5 15.6\"/>",
  'lang-cpp': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M13.2 8.6a4.9 4.9 0 1 0 0 6.8\"/><path d=\"M16.6 7.7v2.8m-1.4-1.4h2.8\"/><path d=\"M19 12.3v2.4m-1.2-1.2h2.4\"/>",
  'lang-csharp': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M13 8.4a5 5 0 1 0 0 7.2\"/><path d=\"M16.2 9.3v5.8m2.7-5.8v5.8M15.1 11.1h5.1M15.4 13.3h5.1\"/>",
  'lang-go': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><text x=\"12\" y=\"15.5\" text-anchor=\"middle\" font-family=\"'Segoe UI',system-ui,sans-serif\" font-size=\"8\" font-weight=\"700\" fill=\"currentColor\" stroke=\"none\">GO</text>",
  'lang-rust': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><circle cx=\"12\" cy=\"12\" r=\"6.2\"/><circle cx=\"12\" cy=\"12\" r=\"2.2\"/><path d=\"M18.2 12h1.8M4 12h1.8M12 5.8V4M12 18.2V20M16.38 7.62l1.28-1.28M7.62 7.62 6.34 6.34M16.38 16.38l1.28 1.28M7.62 16.38l-1.28 1.28\"/>",
  'lang-php': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><ellipse cx=\"12\" cy=\"12\" rx=\"8\" ry=\"4.8\"/><text x=\"12\" y=\"14.2\" text-anchor=\"middle\" font-family=\"'Segoe UI',system-ui,sans-serif\" font-size=\"5.5\" font-weight=\"700\" fill=\"currentColor\" stroke=\"none\">php</text>",
  'lang-ruby': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M6.8 9 9.2 5.6h5.6L17.2 9 12 18.8z\"/><path d=\"M6.8 9h10.4M9.2 5.6 10.8 9l1.2 9.8M14.8 5.6 13.2 9\"/>",
  'lang-swift': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M5.8 15.4c4.3 1.5 9.2.2 11.9-3.6.9-1.3 1.5-2.7 1.7-4.1\"/><path d=\"M7.9 17.4c3.4.5 6.9-.6 9.4-2.9\"/>",
  'lang-kotlin': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M8.7 6.5v11\"/><path d=\"M8.7 12l7.1-5.5M8.7 12l7.1 5.5\"/>",
  'lang-html': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"m12 5.6 5.4 1.9v3.7c0 3.3-2.2 5.6-5.4 6.6-3.2-1-5.4-3.3-5.4-6.6V7.5z\"/><path d=\"m10.4 10-1.7 1.7 1.7 1.7M13.6 10l1.7 1.7-1.7 1.7\"/>",
  'lang-css': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"m12 5.6 5.4 1.9v3.7c0 3.3-2.2 5.6-5.4 6.6-3.2-1-5.4-3.3-5.4-6.6V7.5z\"/><path d=\"M10.7 9.8v4.4M13.3 9.8v4.4M9.5 11.2h5M9.5 12.8h5\"/>",
  'lang-yaml': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><rect x=\"6.8\" y=\"7.8\" width=\"3.6\" height=\"3\" rx=\"1\"/><path d=\"M13 9.3h4.2\"/><rect x=\"6.8\" y=\"13.2\" width=\"3.6\" height=\"3\" rx=\"1\"/><path d=\"M13 14.7h4.2\"/>",
  'lang-markdown': "<rect x=\"2.5\" y=\"2.5\" width=\"19\" height=\"19\" rx=\"4\"/><path d=\"M6.8 15.5V8.7l3 3.5 3-3.5v6.8\"/><path d=\"M16.4 8.5v7m-2.1-2.1 2.1 2.1 2.1-2.1\"/>",
  'json': "<path d=\"M8.5 3.5H8a2 2 0 0 0-2 2V9a2 2 0 0 1-2 2 2 2 0 0 1 2 2v3.5a2 2 0 0 0 2 2h.5\"/><path d=\"M15.5 3.5h.5a2 2 0 0 1 2 2V9a2 2 0 0 0 2 2 2 2 0 0 0-2 2v3.5a2 2 0 0 1-2 2h-.5\"/>",
  'database': "<ellipse cx=\"12\" cy=\"5.5\" rx=\"7\" ry=\"2.5\"/><path d=\"M5 5.5v13c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-13\"/><path d=\"M5 12c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5\"/>",
  'terminal': "<rect x=\"3\" y=\"4.5\" width=\"18\" height=\"15\" rx=\"2\"/><path d=\"m7.5 9.5 2.5 2.5-2.5 2.5\"/><path d=\"M12.5 14.5H16\"/>",
  'mermaid': "<rect x=\"9\" y=\"3\" width=\"6\" height=\"4.5\" rx=\"1\"/><rect x=\"3\" y=\"16.5\" width=\"6\" height=\"4.5\" rx=\"1\"/><rect x=\"15\" y=\"16.5\" width=\"6\" height=\"4.5\" rx=\"1\"/><path d=\"M12 7.5V13m0 0v5.5M6 13v3.5m12-3.5v3.5M6 13h12\"/>"
}

/** 常见语言别名 → 图标键（全小写匹配） */
const LANG_ALIAS = {
  javascript: 'lang-js', js: 'lang-js', node: 'lang-js', nodejs: 'lang-js',
  typescript: 'lang-ts', ts: 'lang-ts',
  python: 'lang-python', py: 'lang-python', python3: 'lang-python',
  java: 'lang-java',
  c: 'lang-c',
  cpp: 'lang-cpp', 'c++': 'lang-cpp',
  csharp: 'lang-csharp', cs: 'lang-csharp', 'c#': 'lang-csharp',
  go: 'lang-go', golang: 'lang-go',
  rust: 'lang-rust', rs: 'lang-rust',
  php: 'lang-php',
  ruby: 'lang-ruby', rb: 'lang-ruby',
  swift: 'lang-swift',
  kotlin: 'lang-kotlin', kt: 'lang-kotlin',
  html: 'lang-html', html5: 'lang-html',
  css: 'lang-css', scss: 'lang-css', less: 'lang-css',
  yaml: 'lang-yaml', yml: 'lang-yaml',
  markdown: 'lang-markdown', md: 'lang-markdown',
  json: 'json', jsonc: 'json', json5: 'json',
  sql: 'database',
  bash: 'terminal', sh: 'terminal', shell: 'terminal', shellscript: 'terminal',
  zsh: 'terminal', powershell: 'terminal', ps1: 'terminal',
  mermaid: 'mermaid'
}

/** 语言名 → 徽标渲染数据 { key, inner, var }；未识别语言返回 null（徽标退化为纯文本） */
export function resolveLangIcon(lang) {
  if (!lang) return null
  const key = LANG_ALIAS[String(lang).trim().toLowerCase()]
  const inner = key && LANG_ICONS[key]
  if (!inner) return null
  return { key, inner, var: `--${key}` }
}
