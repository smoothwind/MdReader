import { app } from 'electron'
import { join } from 'node:path'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'

export const PERF_DEFAULTS = {
  disableHardwareAcceleration: false,
  inProcessGpu: false,
  maxOldSpaceSize: 0
}

const BASE_DISABLED_FEATURES = [
  'MediaRouter',
  'Translate',
  'OptimizationHints',
  'OptimizationGuideModelDownloading'
]

function configPath() {
  return join(app.getPath('userData'), 'config.json')
}

function sanitize(raw) {
  const cfg = { ...PERF_DEFAULTS }
  if (raw && typeof raw === 'object') {
    if (typeof raw.disableHardwareAcceleration === 'boolean') {
      cfg.disableHardwareAcceleration = raw.disableHardwareAcceleration
    }
    if (typeof raw.inProcessGpu === 'boolean') {
      cfg.inProcessGpu = raw.inProcessGpu
    }
    const n = Number(raw.maxOldSpaceSize)
    if (Number.isInteger(n) && n >= 0 && n <= 4096) cfg.maxOldSpaceSize = n
  }
  return cfg
}

export function loadPerfConfig() {
  try {
    return sanitize(JSON.parse(readFileSync(configPath(), 'utf-8')))
  } catch {
    return { ...PERF_DEFAULTS }
  }
}

export function applyPerfConfig(cfg) {
  app.commandLine.appendSwitch('disable-features', BASE_DISABLED_FEATURES.join(','))
  if (cfg.disableHardwareAcceleration) app.disableHardwareAcceleration()
  if (cfg.inProcessGpu) app.commandLine.appendSwitch('in-process-gpu')
  if (cfg.maxOldSpaceSize > 0) {
    app.commandLine.appendSwitch('js-flags', `--max-old-space-size=${cfg.maxOldSpaceSize}`)
  }
}

export async function savePerfConfig(partial) {
  const merged = sanitize({ ...loadPerfConfig(), ...partial })
  await writeFile(configPath(), JSON.stringify(merged, null, 2), 'utf-8')
  return merged
}
