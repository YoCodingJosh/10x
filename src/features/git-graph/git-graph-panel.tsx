import { useCallback, useEffect, useMemo, useState } from 'react'

import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { CommitInspector, formatRelativeShort, type CommitInspectData } from '@/features/git-graph/commit-inspector'
import { DiffFileBlock } from '@/features/diff-panel/diff-file-block'
import { parseUnifiedDiff } from '@/features/diff-panel/parse-unified-diff'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { cn } from '@/lib/utils'
import { useSidePanelStore } from '@/stores/side-panel-store'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { GitBranch, Loader2, RefreshCw, X } from 'lucide-react'

type LogCommit = {
  hash: string
  parents: string[]
  subject: string
  authorName: string
  dateIso: string
  refs: string
}

export function GitGraphPanel() {
  const cwd = useGitCwdForVisibleWorkspace()
  const close = useSidePanelStore((s) => s.close)
  const loadState = useGitFocusedCheckoutStore((s) => s.loadState)

  const [commits, setCommits] = useState<LogCommit[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)

  const [inspect, setInspect] = useState<CommitInspectData | null>(null)
  const [inspectLoading, setInspectLoading] = useState(false)
  const [inspectError, setInspectError] = useState<string | null>(null)

  const [diffText, setDiffText] = useState<string | null>(null)
  const [diffLoading, setDiffLoading] = useState(false)
  const [diffError, setDiffError] = useState<string | null>(null)

  const loadLog = useCallback(async () => {
    if (!cwd) {
      setCommits([])
      setError(null)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const r = await window.mux.git.logGraph(cwd)
      if (!r.ok) {
        setCommits([])
        setError(r.error)
        return
      }
      setCommits(r.commits)
      setSelectedIndex(null)
      setInspect(null)
      setInspectError(null)
      setDiffText(null)
      setDiffError(null)
    } finally {
      setLoading(false)
    }
  }, [cwd])

  useEffect(() => {
    void loadLog()
  }, [loadLog])

  const selectedCommit =
    selectedIndex != null && selectedIndex >= 0 && selectedIndex < commits.length
      ? commits[selectedIndex]!
      : null
  const selectedHash = selectedCommit?.hash ?? null

  useEffect(() => {
    if (!cwd || !selectedHash) {
      setInspect(null)
      setInspectError(null)
      setDiffText(null)
      setDiffError(null)
      setInspectLoading(false)
      setDiffLoading(false)
      return
    }

    let cancelled = false
    setInspectLoading(true)
    setDiffLoading(true)
    setInspectError(null)
    setDiffError(null)

    void (async () => {
      const [ins, diff] = await Promise.all([
        window.mux.git.commitInspect({ cwd, hash: selectedHash }),
        window.mux.git.commitDiff({ cwd, hash: selectedHash }),
      ])
      if (cancelled) return

      if (!ins.ok) {
        setInspect(null)
        setInspectError(ins.error)
      } else {
        setInspect({
          hash: ins.hash,
          shortHash: ins.shortHash,
          subject: ins.subject,
          authorName: ins.authorName,
          dateIso: ins.dateIso,
          files: ins.files,
        })
        setInspectError(null)
      }
      setInspectLoading(false)

      if (!diff.ok) {
        setDiffText(null)
        setDiffError(diff.error)
      } else {
        setDiffText(diff.text)
        setDiffError(null)
      }
      setDiffLoading(false)
    })()

    return () => {
      cancelled = true
    }
  }, [cwd, selectedHash])

  const diffFiles = useMemo(() => {
    if (diffText == null || diffText === '') return []
    return parseUnifiedDiff(diffText)
  }, [diffText])

  const onPickCommit = useCallback(
    (index: number) => {
      if (index < 0 || index >= commits.length) return
      setSelectedIndex((prev) => (prev === index ? null : index))
    },
    [commits.length],
  )

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col bg-background">
      <div className="flex h-9 shrink-0 items-center justify-between gap-2 border-b border-border px-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <GitBranch className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
          <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
            History
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            title="Refresh"
            disabled={!cwd || loading}
            onClick={() => void loadLog()}
          >
            {loading ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <RefreshCw className="size-3.5" />
            )}
          </Button>
          <Button type="button" variant="ghost" size="icon-xs" title="Close panel" onClick={close}>
            <X className="size-3.5" />
          </Button>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 flex-col gap-0">
        <div className="flex min-h-0 flex-1 flex-col border-b border-border/80">
          <div className="shrink-0 border-b border-border/60 px-2 py-1">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Commits
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="space-y-0.5 p-2 pb-3">
              {!cwd && (
                <p className="text-sm text-muted-foreground">Select a workspace.</p>
              )}
              {cwd && loadState.kind === 'not-repo' && (
                <p className="text-sm text-muted-foreground">Not a git repository.</p>
              )}
              {cwd && loadState.kind !== 'not-repo' && error && (
                <p className="text-sm text-destructive">{error}</p>
              )}
              {cwd && loadState.kind !== 'not-repo' && !error && commits.length === 0 && !loading && (
                <p className="text-sm text-muted-foreground">No commits.</p>
              )}
              {commits.map((c, i) => {
                const active = selectedIndex === i
                return (
                  <button
                    key={c.hash}
                    type="button"
                    className={cn(
                      'flex w-full min-w-0 flex-col gap-0.5 rounded-md border border-transparent px-2 py-1.5 text-left transition-colors',
                      'hover:border-border hover:bg-muted/50',
                      active && 'border-border bg-accent/80',
                    )}
                    onClick={() => onPickCommit(i)}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="shrink-0 font-mono text-[10px] text-muted-foreground">
                        {c.hash.slice(0, 7)}
                      </span>
                      {c.refs.trim() ? (
                        <span className="min-w-0 truncate text-[10px] text-sky-600 dark:text-sky-400">
                          {c.refs}
                        </span>
                      ) : null}
                    </div>
                    <span className="line-clamp-2 text-xs font-medium leading-snug text-foreground">
                      {c.subject}
                    </span>
                    <span className="truncate text-[10px] text-muted-foreground">
                      {c.authorName} · {formatRelativeShort(c.dateIso)}
                    </span>
                  </button>
                )
              })}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 flex-[1.15] flex-col border-b border-border/80">
          <div className="shrink-0 border-b border-border/60 px-2 py-1">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Commit
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="px-2 pb-3">
              {selectedHash == null && (
                <p className="py-3 text-sm text-muted-foreground">Select a commit to inspect.</p>
              )}
              {selectedHash != null && (
                <CommitInspector
                  loading={inspectLoading}
                  error={inspectError}
                  data={inspect}
                />
              )}
            </div>
          </ScrollArea>
        </div>

        <div className="flex min-h-0 flex-[1.25] flex-col">
          <div className="shrink-0 border-b border-border/60 px-2 py-1">
            <p className="text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground">
              Diff
            </p>
          </div>
          <ScrollArea className="min-h-0 flex-1">
            <div className="flex flex-col gap-3 p-2 pb-4">
              {selectedHash == null && (
                <p className="text-sm text-muted-foreground">Select a commit to view the diff.</p>
              )}
              {selectedHash != null && diffLoading && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="size-4 animate-spin" />
                  Loading diff…
                </div>
              )}
              {selectedHash != null && !diffLoading && diffError && (
                <p className="text-sm text-destructive">{diffError}</p>
              )}
              {selectedHash != null && !diffLoading && !diffError && diffFiles.length === 0 && (
                <p className="text-sm text-muted-foreground">No file changes in this commit.</p>
              )}
              {diffFiles.map((f, i) => (
                <DiffFileBlock key={`${f.path}-${i}`} file={f} />
              ))}
            </div>
          </ScrollArea>
        </div>
      </div>
    </div>
  )
}
