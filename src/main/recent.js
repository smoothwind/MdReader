import { app } from 'electron'
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { join, dirname } from 'node:path'

const MAX_ITEMS = 12

export class RecentFiles {
  constructor() {
    this.file = join(app.getPath('userData'), 'recent-files.json')
    this.items = []
  }

  async load() {
    try {
      const list = JSON.parse(await readFile(this.file, 'utf-8'))
      this.items = Array.isArray(list) ? list.filter((x) => typeof x === 'string') : []
    } catch {
      this.items = []
    }
  }

  async push(p) {
    this.items = [p, ...this.items.filter((x) => x !== p)].slice(0, MAX_ITEMS)
    await this.persist()
  }

  async persist() {
    try {
      await mkdir(dirname(this.file), { recursive: true })
      await writeFile(this.file, JSON.stringify(this.items, null, 2), 'utf-8')
    } catch {
      /* ignore */
    }
  }
}
