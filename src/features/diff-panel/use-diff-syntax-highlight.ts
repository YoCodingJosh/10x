import { useEffect, useState } from 'react'

import { getLangForPath } from '@/features/diff-panel/diff-lang-map'
import type { ParsedDiffFile } from '@/features/diff-panel/parse-unified-diff'
import { getShikiHighlighter } from '@/lib/shiki-highlighter'

export type SyntaxToken = {
  content: string
  color: string
  fontStyle: number
}

/** Per-line token arrays, indexed by DiffLine position. null = use plain text. */
export type HighlightMap = (SyntaxToken[] | null)[]

export function useDiffSyntaxHighlight(file: ParsedDiffFile): HighlightMap | null {
  const [highlights, setHighlights] = useState<HighlightMap | null>(null)

  useEffect(() => {
    const lang = getLangForPath(file.path)
    if (!lang) {
      setHighlights(null)
      return
    }

    let cancelled = false

    getShikiHighlighter()
      .then((highlighter) => {
        if (cancelled) return

        // Map code lines back to their diff line index
        const diffIndices: number[] = []
        const codeLines: string[] = []

        for (let i = 0; i < file.lines.length; i++) {
          const line = file.lines[i]!
          if (line.kind === 'add' || line.kind === 'remove' || line.kind === 'context') {
            // Strip the leading +/- / space diff marker
            codeLines.push(line.text.length > 0 ? line.text.slice(1) : '')
            diffIndices.push(i)
          }
        }

        if (codeLines.length === 0) {
          if (!cancelled) setHighlights(null)
          return
        }

        try {
          const { tokens } = highlighter.codeToTokens(codeLines.join('\n'), {
            lang,
            theme: 'github-dark',
          })

          const map: HighlightMap = new Array(file.lines.length).fill(null)

          for (let ci = 0; ci < tokens.length; ci++) {
            const diffIdx = diffIndices[ci]
            if (diffIdx === undefined) continue
            map[diffIdx] = tokens[ci]!.map((t) => ({
              content: t.content,
              color: t.color ?? '',
              fontStyle: t.fontStyle ?? 0,
            }))
          }

          if (!cancelled) setHighlights(map)
        } catch {
          // Unknown language or tokenization failure — fall back to plain text
          if (!cancelled) setHighlights(null)
        }
      })
      .catch(() => {
        if (!cancelled) setHighlights(null)
      })

    return () => {
      cancelled = true
    }
  }, [file])

  return highlights
}
