// 生成 Markdown 文档专用图标（区别于应用图标）
// 输出: build/md-file.ico / src-tauri/icons/md-file.ico / assets/md-file-icon.png
// 用法: node scripts/gen-md-file-icon.mjs
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

// ---------- 基础光栅化（256 逻辑坐标，按比例缩放渲染，1px 抗锯齿） ----------

const clamp01 = (v) => Math.max(0, Math.min(1, v))

function covRoundRect(X, Y, k, x, y, w, h, rad) {
  x *= k; y *= k; w *= k; h *= k; rad *= k
  const cx = x + w / 2, cy = y + h / 2
  const dx = Math.abs(X - cx) - (w / 2 - rad)
  const dy = Math.abs(Y - cy) - (h / 2 - rad)
  const ox = Math.max(dx, 0), oy = Math.max(dy, 0)
  const d = Math.sqrt(ox * ox + oy * oy) + Math.min(Math.max(dx, dy), 0) - rad
  return clamp01(0.5 - d)
}

function covSeg(X, Y, k, x1, y1, x2, y2, half) {
  x1 *= k; y1 *= k; x2 *= k; y2 *= k; half *= k
  const vx = x2 - x1, vy = y2 - y1
  const len2 = vx * vx + vy * vy
  let t = len2 ? ((X - x1) * vx + (Y - y1) * vy) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  const d = Math.hypot(X - (x1 + t * vx), Y - (y1 + t * vy))
  return clamp01(half + 0.5 - d)
}

function covTri(X, Y, k, ax, ay, bx, by, cx, cy) {
  ax *= k; ay *= k; bx *= k; by *= k; cx *= k; cy *= k
  const d1 = (X - bx) * (ay - by) - (ax - bx) * (Y - by)
  const d2 = (X - cx) * (by - cy) - (bx - cx) * (Y - cy)
  const d3 = (X - ax) * (cy - ay) - (cx - ax) * (Y - ay)
  const neg = d1 < 0 || d2 < 0 || d3 < 0
  const pos = d1 > 0 || d2 > 0 || d3 > 0
  return !(neg && pos) ? 1 : 0
}

// ---------- 图形定义（256 坐标系，白文档页 + 蓝色 M↓ 徽标） ----------

const C = {
  page: [255, 255, 255, 1],
  pageLine: [215, 221, 229, 1],
  fold: [233, 237, 242, 1],
  badge: [76, 110, 245, 1],
  white: [255, 255, 255, 1]
}

// 渲染函数：返回 {w,h,rgba:Uint8Array}
function render(size) {
  const k = size / 256
  const px = new Uint8ClampedArray(size * size * 4)
  // 绘制层：依次 alpha-over 合成
  const layers = [
    // 文档页（圆角矩形）
    { cov: (X, Y) => covRoundRect(X, Y, k, 24, 16, 152, 224, 12), col: C.page },
    // 页面描边（外环）
    {
      cov: (X, Y) => {
        const o = covRoundRect(X, Y, k, 24, 16, 152, 224, 12)
        const i = covRoundRect(X, Y, k, 24 + 3, 16 + 3, 152 - 6, 224 - 6, 9)
        return Math.max(0, Math.min(o, 1 - i))
      },
      col: C.pageLine
    },
    // 文本示意线
    { cov: (X, Y) => covRoundRect(X, Y, k, 44, 52, 100, 10, 5), col: C.pageLine },
    { cov: (X, Y) => covRoundRect(X, Y, k, 44, 76, 78, 10, 5), col: C.pageLine },
    { cov: (X, Y) => covRoundRect(X, Y, k, 44, 100, 90, 10, 5), col: C.pageLine },
    // M↓ 徽标
    { cov: (X, Y) => covRoundRect(X, Y, k, 118, 148, 120, 76, 14), col: C.badge },
    // M（白色粗线）
    { cov: (X, Y) => covSeg(X, Y, k, 140, 206, 140, 168, 8), col: C.white },
    { cov: (X, Y) => covSeg(X, Y, k, 140, 168, 165, 198, 8), col: C.white },
    { cov: (X, Y) => covSeg(X, Y, k, 165, 198, 190, 168, 8), col: C.white },
    { cov: (X, Y) => covSeg(X, Y, k, 190, 168, 190, 206, 8), col: C.white },
    // ↓ 箭杆 + 箭头
    { cov: (X, Y) => covSeg(X, Y, k, 216, 168, 216, 198, 8), col: C.white },
    { cov: (X, Y) => covTri(X, Y, k, 203, 192, 229, 192, 216, 209), col: C.white }
  ]

  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const X = i + 0.5, Y = j + 0.5
      let r = 0, g = 0, b = 0, a = 0
      for (const l of layers) {
        const ca = l.cov(X, Y)
        if (ca <= 0) continue
        const oa = l.col[3] * ca + a * (1 - l.col[3] * ca)
        r = (l.col[0] * l.col[3] * ca + r * a * (1 - l.col[3] * ca)) / oa
        g = (l.col[1] * l.col[3] * ca + g * a * (1 - l.col[3] * ca)) / oa
        b = (l.col[2] * l.col[3] * ca + b * a * (1 - l.col[3] * ca)) / oa
        a = oa
      }
      const o = (j * size + i) * 4
      px[o] = r; px[o + 1] = g; px[o + 2] = b; px[o + 3] = a * 255
    }
  }
  return { w: size, h: size, rgba: px }
}

// ---------- PNG 编码（RGBA8，无滤波 + zlib） ----------

const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let m = 0; m < 8; m++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function pngChunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([len, body, crc])
}

function pngEncode(img) {
  const { w, h, rgba } = img
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (w * 4 + 1)] = 0
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4
      const di = y * (w * 4 + 1) + 1 + x * 4
      raw[di] = rgba[si]
      raw[di + 1] = rgba[si + 1]
      raw[di + 2] = rgba[si + 2]
      raw[di + 3] = rgba[si + 3]
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', deflateSync(raw, { level: 9 })),
    pngChunk('IEND', Buffer.alloc(0))
  ])
}

// ---------- ICO 打包（≤48px BMP + 64/128/256 PNG） ----------

function bmpEntry(size, img) {
  const { w, h, rgba } = img
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(w, 4)
  header.writeInt32LE(h * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  const xor = Buffer.alloc(w * h * 4)
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const si = ((h - 1 - y) * w + x) * 4
      const di = (y * w + x) * 4
      xor[di] = rgba[si + 2]
      xor[di + 1] = rgba[si + 1]
      xor[di + 2] = rgba[si]
      xor[di + 3] = rgba[si + 3]
    }
  }
  const maskRow = Math.ceil(w / 32) * 4
  const and = Buffer.alloc(maskRow * h)
  return Buffer.concat([header, xor, and])
}

function buildIco() {
  const sizes = [16, 32, 48, 64, 128, 256]
  const entries = []
  const blobs = []
  let offset = 6 + sizes.length * 16
  for (const s of sizes) {
    const img = render(s)
    let blob
    let isPng = false
    if (s >= 64) {
      blob = pngEncode(img)
      isPng = true
    } else {
      blob = bmpEntry(s, img)
    }
    entries.push({ s, blob, isPng, offset })
    blobs.push(blob)
    offset += blob.length
  }
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(sizes.length, 4)
  const dir = []
  for (const e of entries) {
    const d = Buffer.alloc(16)
    d[0] = e.s >= 256 ? 0 : e.s
    d[1] = e.s >= 256 ? 0 : e.s
    d.writeUInt16LE(1, 4)
    d.writeUInt16LE(32, 6)
    d.writeUInt32LE(e.blob.length, 8)
    d.writeUInt32LE(e.offset, 12)
    dir.push(d)
  }
  return Buffer.concat([head, ...dir, ...blobs])
}

// ---------- 输出 ----------

mkdirSync(resolve(ROOT, 'build'), { recursive: true })
mkdirSync(resolve(ROOT, 'src-tauri/icons'), { recursive: true })
mkdirSync(resolve(ROOT, 'assets'), { recursive: true })

const ico = buildIco()
writeFileSync(resolve(ROOT, 'build/md-file.ico'), ico)
writeFileSync(resolve(ROOT, 'src-tauri/icons/md-file.ico'), ico)
writeFileSync(resolve(ROOT, 'assets/md-file-icon.png'), pngEncode(render(256)))
console.log('md-file icon generated:', ico.length, 'bytes')
