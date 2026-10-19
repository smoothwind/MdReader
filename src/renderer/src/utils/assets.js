/**
 * public/ 静态资源基址拼接（vditor 资源、欢迎文档图片等）。
 *
 * Electron/Tauri 本地构建 BASE_URL 为 './' 或 '/'，保持相对路径行为不变；
 * GitHub Pages 项目站以 WEB_BASE=/MdReader/ 构建，需以绝对前缀引用 public 资源，
 * 否则子路径页面（如 /MdReader/app/）下的相对引用会解析到错误目录。
 */
export function publicPath(rel) {
  const base = import.meta.env.BASE_URL || '/'
  if (base === '/' || base === './') return rel
  return base.replace(/\/?$/, '/') + String(rel).replace(/^\.\//, '')
}
