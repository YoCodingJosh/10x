/** Stable comparison key so `/a`, `/a/`, ` /a/ ` match for “which checkout is this summary for?”. */
export function normalizeGitCwdKey(p: string | null | undefined): string | null {
  if (p == null) return null
  const t = p.trim()
  if (!t) return null
  return t.replace(/[/\\]+$/, '') || t
}
