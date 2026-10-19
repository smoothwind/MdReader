import { PAGE } from './doc-export'

/** 总页数：按 A4 内容区高度切分（与 PDF 页高一致） */
export function totalPagesFor(height) {
  const h = Number(height) || 0
  return Math.max(1, Math.ceil(h / PAGE.contentHeight))
}

/** 页码范围 → 像素区间（clamp 到文档实际高度，start/end 取整且保证 start<=end） */
export function rangeToPixels({ startPage, endPage, totalPages, totalHeight }) {
  const total = Math.max(1, Math.floor(totalPages) || 1)
  const clampPage = (v, dflt) => {
    const n = Math.floor(Number(v))
    if (!Number.isFinite(n)) return dflt
    return Math.min(Math.max(1, n), total)
  }
  const start = clampPage(startPage, 1)
  const end = Math.max(start, clampPage(endPage, total))
  const top = (start - 1) * PAGE.contentHeight
  const bottom = Math.min(end * PAGE.contentHeight, Math.max(0, Number(totalHeight) || 0))
  return { startPage: start, endPage: end, top, height: Math.max(1, bottom - top) }
}

const MAX_CANVAS_HEIGHT = 32_760
const TARGET_CANVAS_HEIGHT = 16_000

/** 捕获像素比：长文档按高度自适应收缩，既控制内存也不超过浏览器画布上限 */
export function captureRatioFor(height) {
  const h = Math.max(1, Number(height) || 1)
  return Math.max(0.3, Math.min(2, TARGET_CANVAS_HEIGHT / h, MAX_CANVAS_HEIGHT / h))
}

/**
 * 按打印版式捕获长图（PNG 字节）。
 * root 应为 mountPrintRoot() 返回的打印根（宽度为 A4 内容宽度）。
 * 返回 { bytes, totalPages, startPage, endPage, width, height }
 */
export async function captureLongImage({ root, startPage = 1, endPage } = {}) {
  const totalHeight = Math.max(1, Math.round(root.scrollHeight))
  const totalPages = totalPagesFor(totalHeight)
  const range = rangeToPixels({ startPage, endPage: endPage ?? totalPages, totalPages, totalHeight })
  const ratio = captureRatioFor(range.height)

  const canvas = await captureRegion(root, range, ratio)
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas.toBlob failed'))), 'image/png')
  )
  return {
    bytes: new Uint8Array(await blob.arrayBuffer()),
    totalPages,
    startPage: range.startPage,
    endPage: range.endPage,
    width: canvas.width,
    height: canvas.height
  }
}

/**
 * 捕获 root 的 [top, top+height) 区段：
 * 全文档直接截取；指定范围时把 root 临时移入固定高度的裁剪视口并上移，
 * 避免为一张切片生成整篇高度的画布（长文档会超出浏览器画布上限）。
 * 注意：html-to-image 会克隆元素的 fixed 定位，离屏定位（left:-100000px）
 * 会让克隆体被移出 foreignObject 视口得到空白图，捕获期间必须回到文档流。
 */
async function captureRegion(root, { top, height }, ratio) {
  const { toCanvas } = await import('html-to-image')
  const fullHeight = Math.max(1, Math.round(root.scrollHeight))
  const isFull = top === 0 && height >= fullHeight
  const opts = { pixelRatio: ratio, width: PAGE.contentWidth, height, backgroundColor: '#ffffff' }
  const prevStyle = root.getAttribute('style') || ''
  const toFlow = () => {
    root.style.position = 'static'
    root.style.left = 'auto'
    root.style.top = 'auto'
  }
  const restore = () => root.setAttribute('style', prevStyle)

  if (isFull) {
    toFlow()
    try {
      return await toCanvas(root, opts)
    } finally {
      restore()
    }
  }

  const view = document.createElement('div')
  view.style.cssText = [
    `width:${PAGE.contentWidth}px`,
    `height:${height}px`,
    'overflow:hidden',
    'background:#ffffff'
  ].join(';')
  const parent = root.parentNode
  toFlow()
  root.style.transform = `translateY(-${top}px)`
  view.appendChild(root)
  document.body.appendChild(view)
  try {
    return await toCanvas(view, opts)
  } finally {
    restore()
    if (parent) parent.appendChild(root)
    view.remove()
  }
}
