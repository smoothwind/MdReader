import { cpSync, existsSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(dirname(fileURLToPath(import.meta.url)))
const src = join(root, 'node_modules', 'vditor', 'dist')
const dest = join(root, 'src', 'renderer', 'public', 'vditor', 'dist')

if (!existsSync(src)) {
  console.error('[copy-vditor] vditor dist not found:', src)
  process.exit(1)
}

rmSync(dest, { recursive: true, force: true })
cpSync(src, dest, { recursive: true })
console.log('[copy-vditor] copied vditor dist ->', dest)
