// 导出工具：dataUrl/blob → 字节、SVG → PNG、统一走 exportSave 对话框

export async function dataUrlToBytes(dataUrl) {
  const blob = await (await fetch(dataUrl)).blob()
  return new Uint8Array(await blob.arrayBuffer())
}

/** SVG 元素 → PNG 字节（viewBox 定尺寸，2x 缩放，可指定背景色） */
export async function svgToPngBytes(svg, background, scale = 2) {
  const vb = (svg.getAttribute('viewBox') || '').split(/[\s,]+/).map(Number)
  const w = vb.length === 4 && vb[2] > 0 ? vb[2] : svg.clientWidth || 600
  const h = vb.length === 4 && vb[3] > 0 ? vb[3] : svg.clientHeight || 400
  const clone = svg.cloneNode(true)
  clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  clone.setAttribute('width', w)
  clone.setAttribute('height', h)
  const xml = new XMLSerializer().serializeToString(clone)
  const img = new Image()
  await new Promise((resolve, reject) => {
    img.onload = resolve
    img.onerror = reject
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml)
  })
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.scale(scale, scale)
  ctx.drawImage(img, 0, 0, w, h)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
  return new Uint8Array(await blob.arrayBuffer())
}

/** 统一导出骨架：保存对话框 + 用户提示，返回是否已导出 */
export async function exportBytes(bytes, name, ext, extName, { notify, okMsg } = {}) {
  try {
    const r = await window.mdreader.exportSave({ data: bytes, name, ext, extName })
    if (!r.canceled) notify?.(okMsg || '已导出')
    return !r.canceled
  } catch (err) {
    notify?.('导出失败：' + (err?.message || err))
    return false
  }
}
