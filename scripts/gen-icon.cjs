const zlib = require('node:zlib')
const fs = require('node:fs')
const path = require('node:path')

function crc32(buf) {
  if (!crc32.table) {
    crc32.table = []
    for (let n = 0; n < 256; n++) {
      let c = n
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
      crc32.table[n] = c >>> 0
    }
  }
  let c = 0xffffffff
  for (const b of buf) c = crc32.table[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(size, px) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 6
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y++) {
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4)
  }
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0))
  ])
}

function drawMd(size) {
  const px = Buffer.alloc(size * size * 4)
  const s = size / 32
  const set = (x, y, r, g, b, a = 255) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const i = ((y | 0) * size + (x | 0)) * 4
    px[i] = r
    px[i + 1] = g
    px[i + 2] = b
    px[i + 3] = a
  }
  const inBg = (x, y) => {
    const dx = Math.min(x, size - 1 - x)
    const dy = Math.min(y, size - 1 - y)
    const R = 6 * s
    if (dx >= R || dy >= R) return true
    const ddx = R - dx
    const ddy = R - dy
    return ddx * ddx + ddy * ddy <= R * R
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (inBg(x, y)) set(x, y, 0x4c, 0x6e, 0xf5)
    }
  }
  const x0 = 8 * s
  const x1 = 24 * s
  const y0 = 9 * s
  const y1 = 23 * s
  const w = 3 * s
  const cx = (x0 + x1) / 2
  const slopeEnd = y0 + (y1 - y0) * 0.62
  for (let y = Math.floor(y0); y <= Math.ceil(y1); y++) {
    for (let x = Math.floor(x0) - 1; x <= Math.ceil(x1) + 1; x++) {
      let hit = false
      if (y >= y0 && y <= y1) {
        if (x >= x0 && x < x0 + w) hit = true
        if (x <= x1 && x > x1 - w) hit = true
        if (y <= slopeEnd) {
          const t = (y - y0) / (y1 - y0)
          const lx = x0 + w - 1 + t * (cx - (x0 + w - 1))
          const rx = cx + t * (x1 - w + 1 - cx)
          if (Math.abs(x + 0.5 - lx) < w * 0.62 || Math.abs(x + 0.5 - rx) < w * 0.62) hit = true
        }
      }
      if (hit) set(x, y, 255, 255, 255)
    }
  }
  return px
}

function buildIco(bmp32, png256) {
  const head = Buffer.alloc(6)
  head.writeUInt16LE(0, 0)
  head.writeUInt16LE(1, 2)
  head.writeUInt16LE(2, 4)
  const e1 = Buffer.alloc(16)
  e1[0] = 32
  e1[1] = 32
  e1.writeUInt16LE(1, 4)
  e1.writeUInt16LE(32, 6)
  e1.writeUInt32LE(bmp32.length, 8)
  e1.writeUInt32LE(22, 12)
  const e2 = Buffer.alloc(16)
  e2[0] = 0
  e2[1] = 0
  e2.writeUInt16LE(1, 4)
  e2.writeUInt16LE(32, 6)
  e2.writeUInt32LE(png256.length, 8)
  e2.writeUInt32LE(22 + bmp32.length, 12)
  return Buffer.concat([head, e1, e2, bmp32, png256])
}

function bmpFrame(px, S) {
  const header = Buffer.alloc(40)
  header.writeUInt32LE(40, 0)
  header.writeInt32LE(S, 4)
  header.writeInt32LE(S * 2, 8)
  header.writeUInt16LE(1, 12)
  header.writeUInt16LE(32, 14)
  header.writeUInt32LE(0, 16)
  header.writeUInt32LE(S * S * 4 + Math.ceil(S / 8) * S, 20)
  const pix = Buffer.alloc(S * S * 4)
  let o = 0
  for (let y = S - 1; y >= 0; y--) {
    for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4
      pix[o++] = px[i + 2]
      pix[o++] = px[i + 1]
      pix[o++] = px[i]
      pix[o++] = px[i + 3]
    }
  }
  const maskRow = Math.ceil(S / 8)
  const mask = Buffer.alloc(maskRow * S)
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      if (px[(y * S + x) * 4 + 3] === 0) mask[y * maskRow + (x >> 3)] |= 0x80 >> (x & 7)
    }
  }
  return Buffer.concat([header, pix, mask])
}

const root = path.resolve(__dirname, '..')
const px32 = drawMd(32)
const px256 = drawMd(256)
const png32 = encodePng(32, px32)
const png256 = encodePng(256, px256)

fs.writeFileSync(path.join(root, 'resources', 'icon.png'), png256)
fs.writeFileSync(path.join(root, 'resources', 'tray.png'), png32)
fs.writeFileSync(path.join(root, 'build', 'icon.png'), png256)
fs.rmSync(path.join(root, 'build', 'icon.ico'), { force: true })
fs.rmSync(path.join(root, 'resources', 'icon.ico'), { force: true })
console.log('[gen-icon] done: resources/icon.png(256)|tray.png(32), build/icon.png(256)')
