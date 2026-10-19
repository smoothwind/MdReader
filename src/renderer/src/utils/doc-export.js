/**
 * 文档导出共享版式：
 *  - PAGE：A4 @96dpi 版面尺寸，边距 0.625in（60px），与主进程 printToPDF 保持一致
 *  - DOC_CSS：HTML / Word 独立导出用的基础样式
 *  - mountPrintRoot：在页面内挂载离屏打印根（PDF 打印与长图共用同一版面，保证分页口径一致）
 */

export const PAGE = {
  width: 794,
  height: 1123,
  margin: 60,
  contentWidth: 674,
  contentHeight: 1003
}

export const DOC_CSS = [
  'body{max-width:860px;margin:32px auto;padding:0 20px;font-family:"Segoe UI","Microsoft YaHei",sans-serif;color:#24292f;line-height:1.7;}',
  'pre{background:#f6f8fa;padding:12px;border-radius:8px;overflow:auto;}',
  'code{font-family:Consolas,monospace;}',
  'table{border-collapse:collapse;}th,td{border:1px solid #d0d7de;padding:6px 12px;}',
  'img{max-width:100%;}',
  'blockquote{border-left:4px solid #d0d7de;margin:0;padding:0 16px;color:#57606a;}',
  'h1,h2,h3,h4{border-bottom:1px solid #eaeef2;padding-bottom:6px;}'
].join('\n')

const PRINT_ROOT_CSS = `
#md-print-root{
  position:fixed;left:-100000px;top:0;
  box-sizing:border-box;
  width:${PAGE.contentWidth}px;padding:0 20px;
  background:#fff;z-index:-1;
}
#md-print-root .md-print-doc{
  width:100%;
  font-family:"Segoe UI","Microsoft YaHei","PingFang SC",sans-serif;
  font-size:15px;line-height:1.7;color:#24292f;
  word-wrap:break-word;overflow-wrap:anywhere;
}
#md-print-root .md-print-doc > :first-child{margin-top:0;}
#md-print-root .md-print-doc h1,
#md-print-root .md-print-doc h2,
#md-print-root .md-print-doc h3,
#md-print-root .md-print-doc h4{color:#1f2328;line-height:1.35;margin:1.2em 0 .6em;break-after:avoid-page;page-break-after:avoid;}
#md-print-root .md-print-doc h1,
#md-print-root .md-print-doc h2,
#md-print-root .md-print-doc h3,
#md-print-root .md-print-doc h4{border-bottom:1px solid #eaeef2;padding-bottom:6px;}
#md-print-root .md-print-doc p{margin:.55em 0;}
#md-print-root .md-print-doc ul,
#md-print-root .md-print-doc ol{margin:.4em 0;padding-left:1.6em;}
#md-print-root .md-print-doc pre{
  background:#f6f8fa;border:1px solid #e5e9ef;border-radius:6px;
  padding:10px 12px;overflow:visible;white-space:pre-wrap;word-break:break-word;
  font-size:12.5px;line-height:1.55;break-inside:avoid-page;page-break-inside:avoid;
}
#md-print-root .md-print-doc pre code{font-family:Consolas,"Cascadia Mono",monospace;background:none;padding:0;}
#md-print-root .md-print-doc code{font-family:Consolas,"Cascadia Mono",monospace;background:#f2f4f7;border-radius:4px;padding:1px 4px;font-size:.92em;}
#md-print-root .md-print-doc table{border-collapse:collapse;width:100%;margin:.6em 0;font-size:13.5px;}
#md-print-root .md-print-doc th,
#md-print-root .md-print-doc td{border:1px solid #d0d7de;padding:5px 10px;text-align:left;vertical-align:top;}
#md-print-root .md-print-doc th{background:#f6f8fa;}
#md-print-root .md-print-doc tr{break-inside:avoid-page;page-break-inside:avoid;}
#md-print-root .md-print-doc img{max-width:100%;height:auto;break-inside:avoid-page;page-break-inside:avoid;}
#md-print-root .md-print-doc blockquote{
  border-left:4px solid #d0d7de;margin:.6em 0;padding:.1em 0 .1em 14px;color:#57606a;
}
#md-print-root .md-print-doc hr{border:none;border-top:1px solid #e5e9ef;margin:1em 0;}
#md-print-root .md-print-doc a{color:#0969da;text-decoration:none;}
#md-print-root .md-print-doc .katex-display{margin:.8em 0;break-inside:avoid-page;page-break-inside:avoid;}
@media print{
  #app{display:none !important;}
  html,body{background:#fff !important;margin:0 !important;}
  #md-print-root{position:static !important;left:auto !important;top:auto !important;width:${PAGE.contentWidth}px;margin:0 auto;z-index:auto;}
}
`

/** 挂载离屏打印根：返回 { root, dispose }；同一时间仅保留一个实例 */
export function mountPrintRoot(bodyHtml) {
  const prev = document.getElementById('md-print-root')
  if (prev) prev.remove()
  const prevStyle = document.getElementById('md-print-style')
  if (prevStyle) prevStyle.remove()

  const style = document.createElement('style')
  style.id = 'md-print-style'
  style.textContent = PRINT_ROOT_CSS
  document.head.appendChild(style)

  const root = document.createElement('div')
  root.id = 'md-print-root'
  const doc = document.createElement('article')
  doc.className = 'md-print-doc'
  doc.innerHTML = bodyHtml
  root.appendChild(doc)
  document.body.appendChild(root)

  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    root.remove()
    style.remove()
  }
  return { root, dispose }
}

/** 等待字体与图片就绪（有超时上限），避免打印/截图缺字、缺图 */
export async function waitPrintReady(root, { timeout = 2500 } = {}) {
  const pending = [...root.querySelectorAll('img')]
    .filter((img) => !img.complete)
    .map(
      (img) =>
        new Promise((resolve) => {
          img.addEventListener('load', resolve, { once: true })
          img.addEventListener('error', resolve, { once: true })
        })
    )
  const images = pending.length
    ? Promise.race([Promise.all(pending), new Promise((r) => setTimeout(r, timeout))])
    : Promise.resolve()
  const fonts = Promise.race([
    document.fonts?.ready || Promise.resolve(),
    new Promise((r) => setTimeout(r, timeout))
  ])
  await Promise.all([images, fonts])
}
