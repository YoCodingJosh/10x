import { normalizeGitCwdKey } from '@/features/git/normalize-git-cwd'

const STORAGE_KEY = 'mux.recentWorkspacePaths'
const MAX_PATHS = 14

function parseList(raw: string | null): string[] {
  if (raw == null) return []
  try {
    const v = JSON.parse(raw) as unknown
    if (!Array.isArray(v)) return []
    return v.filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
  } catch {
    return []
  }
}

/** Paths recently used as the active workspace (most recent first). */
export function readRecentWorkspacePaths(): string[] {
  if (typeof localStorage === 'undefined') return []
  return parseList(localStorage.getItem(STORAGE_KEY))
}

/** Remember a folder path for the quick switcher (deduped, capped). */
export function touchRecentWorkspacePath(path: string): void {
  if (typeof localStorage === 'undefined') return
  const key = normalizeGitCwdKey(path)
  if (key == null) return
  const prev = parseList(localStorage.getItem(STORAGE_KEY))
  const next = [key, ...prev.filter((p) => normalizeGitCwdKey(p) !== key)].slice(0, MAX_PATHS)
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    /* ignore quota */
  }
}
