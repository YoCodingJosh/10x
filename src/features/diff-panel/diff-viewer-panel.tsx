import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DiffFileBlock } from '@/features/diff-panel/diff-file-block'
import { parseUnifiedDiff } from '@/features/diff-panel/parse-unified-diff'
import { friendlyMessageForWorkingTreeDiffFailure } from '@/features/git/git-friendly-panel-errors'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { cn } from '@/lib/utils'
import { useSidePanelStore } from '@/stores/side-panel-store'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { GitCompare, Loader2, RefreshCw, X } from 'lucide-react'

function countDiffLines(file: { lines: { kind: string }[] }): { add: number; remove: number } {
  let add = 0
  let remove = 0
  for (const l of file.lines) {
    if (l.kind === 'add') add++
    else if (l.kind === 'remove') remove++
  }
  return { add, remove }
}

export type GitDiffMode = 'unstaged' | 'staged' | 'all'

const MODE_LABEL: Record<GitDiffMode, string> = {
  all: 'All local',
  unstaged: 'Unstaged',
  staged: 'Staged',
}

export function DiffViewerPanel() {
  const cwd = useGitCwdForVisibleWorkspace()
  const close = useSidePanelStore((s) => s.close)
  const loadState = useGitFocusedCheckoutStore((s) => s.loadState)
  const [mode, setMode] = useState<GitDiffMode>('all')
  const [text, setText] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [infoMessage, setInfoMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    if (!cwd) {
      setText(null)
      setError(null)
      setInfoMessage(null)
      return
    }
    setLoading(true)
    setError(null)
    setInfoMessage(null)
    try {
      const r = await window.mux.git.diff({ cwd, mode })
      if (!r.ok) {
        setText(null)
        const friendly = friendlyMessageForWorkingTreeDiffFailure(r.error)
        if (friendly) {
          setInfoMessage(friendly)
          setError(null)
        } else {
          setError(r.error)
          setInfoMessage(null)
        }
        return
      }
      setText(r.text)
      setInfoMessage(null)
    } finally {
      setLoading(false)
    }
  }, [cwd, mode])

  useEffect(() => {
    void load()
  }, [load])

  const files = useMemo(() => {
    if (text == null || text === '') return []
    return parseUnifiedDiff(text)
  }, [text])

  const fileStrip = useMemo(
    () =>
      files.map((f, i) => {
        const { add, remove } = countDiffLines(f)
        const base = f.path.replace(/^.*\//, '') || f.path
        return { index: i, path: f.path, short: base, add, remove }
      }),
    [files],
  )

  const scrollToFile = useCallback((index: number) => {
    document.getElementById(`mux-diff-file-${index}`)?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    })
  }, [])

  const emptyMessage =
    !loading && !error && !infoMessage && files.length === 0
      ? mode === 'staged'
        ? 'Nothing staged.'
        : mode === 'unstaged'
          ? 'No unstaged changes.'
          : 'Working tree matches HEAD.'
      : null

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <GitCompare className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            Diff
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Refresh"
            disabled={!cwd || loading}
            onClick={() => void load()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Close diff panel"
            onClick={close}
          >
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap gap-1 border-b border-border/80 px-2 py-1.5">
        {(['all', 'unstaged', 'staged'] as const).map((m) => (
          <Button
            key={m}
            type="button"
            variant={mode === m ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-7 px-2 text-xs',
              mode === m && 'shadow-sm',
            )}
            onClick={() => setMode(m)}
          >
            {MODE_LABEL[m]}
          </Button>
        ))}
      </div>

      {files.length > 1 && (
        <div className="shrink-0 border-b border-border/60 px-2 py-1.5">
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Files ({files.length})
          </p>
          <div className="flex max-h-20 flex-wrap gap-1 overflow-y-auto">
            {fileStrip.map((f) => (
              <Button
                key={f.index}
                type="button"
                variant="outline"
                size="sm"
                className="h-6 max-w-44 gap-1 px-1.5 text-[11px] font-normal"
                title={f.path}
                onClick={() => scrollToFile(f.index)}
              >
                <span className="min-w-0 truncate">{f.short}</span>
                <span className="shrink-0 font-mono text-emerald-600 dark:text-emerald-400">
                  +{f.add}
                </span>
                <span className="shrink-0 font-mono text-rose-600 dark:text-rose-400">
                  −{f.remove}
                </span>
              </Button>
            ))}
          </div>
        </div>
      )}

      <ScrollArea className="min-h-0 flex-1">
        <div className="flex flex-col gap-3 p-2 pb-4">
          {!cwd && (
            <p className="text-sm text-muted-foreground">Select a workspace to view diffs.</p>
          )}
          {cwd && loadState.kind === 'not-repo' && (
            <p className="text-sm text-muted-foreground">Not a git repository for this folder.</p>
          )}
          {cwd && loadState.kind !== 'not-repo' && infoMessage && (
            <p className="text-sm text-muted-foreground">{infoMessage}</p>
          )}
          {cwd && loadState.kind !== 'not-repo' && error && (
            <p className="text-sm text-destructive">{error}</p>
          )}
          {cwd && emptyMessage && (
            <p className="text-sm text-muted-foreground">{emptyMessage}</p>
          )}
          {files.map((f, i) => (
            <DiffFileBlock key={`${f.path}-${i}`} file={f} fileIndex={i} />
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
