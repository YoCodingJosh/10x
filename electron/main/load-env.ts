import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

/** Loads optional `APP_ROOT/.env` into `process.env` (keys unset only). */
export function loadEnvFromAppRoot(appRoot: string) {
  const envPath = path.join(appRoot, '.env')
  if (!existsSync(envPath)) return
  try {
    const raw = readFileSync(envPath, 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue
      const eq = trimmed.indexOf('=')
      if (eq <= 0) continue
      const key = trimmed.slice(0, eq).trim()
      let val = trimmed.slice(eq + 1).trim()
      if (
        (val.startsWith('"') && val.endsWith('"')) ||
        (val.startsWith("'") && val.endsWith("'"))
      ) {
        val = val.slice(1, -1)
      }
      if (process.env[key] === undefined) {
        process.env[key] = val
      }
    }
  } catch {
    /* ignore */
  }
}
