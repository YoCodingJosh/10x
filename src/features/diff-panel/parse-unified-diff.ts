export type DiffLineKind = 'meta' | 'hunk' | 'add' | 'remove' | 'context'

export type DiffLine = { kind: DiffLineKind; text: string }

export type ParsedDiffFile = {
  path: string
  lines: DiffLine[]
}

function extractPathFromDiffGit(line: string): string | null {
  const m = /^diff --git a\/(.+?) b\/(.+)$/.exec(line)
  if (!m) return null
  const b = m[2]!
  if (b === '/dev/null') return m[1] ?? 'unknown'
  return b
}

/**
 * Split `git diff --no-color` output into per-file blocks with line kinds for styling.
 */
export function parseUnifiedDiff(raw: string): ParsedDiffFile[] {
  const lines = raw.split(/\r?\n/)
  const files: ParsedDiffFile[] = []
  let current: ParsedDiffFile | null = null

  const flush = () => {
    if (current != null && current.lines.length > 0) {
      files.push(current)
    }
    current = null
  }

  for (const line of lines) {
    if (line.startsWith('diff --git ')) {
      flush()
      const path = extractPathFromDiffGit(line) ?? 'unknown'
      current = { path, lines: [{ kind: 'meta', text: line }] }
      continue
    }
    if (current == null) {
      continue
    }

    if (line.startsWith('+++ ')) {
      const m = /^\+\+\+ b\/(.+)$/.exec(line)
      if (m?.[1]) {
        current.path = m[1]!
      }
      current.lines.push({ kind: 'meta', text: line })
      continue
    }

    if (line.startsWith('@@')) {
      current.lines.push({ kind: 'hunk', text: line })
      continue
    }
    if (line.startsWith('+') && !line.startsWith('+++')) {
      current.lines.push({ kind: 'add', text: line })
      continue
    }
    if (line.startsWith('-') && !line.startsWith('---')) {
      current.lines.push({ kind: 'remove', text: line })
      continue
    }
    if (line.startsWith('\\')) {
      current.lines.push({ kind: 'meta', text: line })
      continue
    }
    current.lines.push({ kind: 'context', text: line })
  }

  flush()
  return files
}
