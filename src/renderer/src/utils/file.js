export const IMAGE_RE = /\.(png|jpe?g|gif|webp|svg|bmp)$/i

export const MD_EXT_RE = /\.(md|markdown|mdown|mkd)$/i

export function stripMdExt(name) {
  return name.replace(MD_EXT_RE, '')
}

export function base64ToUint8Array(b64) {
  const bin = atob(b64)
  const out = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}
