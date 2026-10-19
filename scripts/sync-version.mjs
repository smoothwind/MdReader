// 以 package.json 版本为单一事实来源，同步到 tauri.conf.json 与 Cargo.toml
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const { version } = JSON.parse(readFileSync(resolve(root, 'package.json'), 'utf-8'))

const confPath = resolve(root, 'src-tauri/tauri.conf.json')
const conf = readFileSync(confPath, 'utf-8')
writeFileSync(confPath, conf.replace(/("version":\s*")[^"]+(")/, `$1${version}$2`))

const cargoPath = resolve(root, 'src-tauri/Cargo.toml')
const cargo = readFileSync(cargoPath, 'utf-8')
writeFileSync(cargoPath, cargo.replace(/(^version\s*=\s*")[^"]+(")/m, `$1${version}$2`))

console.log(`[sync-version] ${version} -> tauri.conf.json, Cargo.toml`)
