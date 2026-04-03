import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Copy, Loader2 } from 'lucide-react'

export type CommitInspectData = {
  hash: string
  shortHash: string
  subject: string
  authorName: string
  dateIso: string
  files: {
    path: string
    status: 'added' | 'modified' | 'deleted' | 'renamed'
    oldPath?: string
    additions: number
    deletions: number
  }[]
}

const STATUS_CLASS: Record<CommitInspectData['files'][number]['status'], string> = {
  added: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400',
  modified: 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
  deleted: 'bg-red-500/15 text-red-600 dark:text-red-400',
  renamed: 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
}

const STATUS_LETTER: Record<CommitInspectData['files'][number]['status'], string> = {
  added: 'A',
  modified: 'M',
  deleted: 'D',
  renamed: 'R',
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0]!.slice(0, 2).toUpperCase()
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase()
}

export function formatRelativeShort(iso: string): string {
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return iso
  let sec = Math.round((Date.now() - t) / 1000)
  if (sec < 0) sec = 0
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const h = Math.floor(min / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 14) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

type Props = {
  loading: boolean
  error: string | null
  data: CommitInspectData | null
}

/**
 * Commit summary layout inspired by AI Elements Commit
 * (https://elements.ai-sdk.dev/components/commit) — hash, author, files, stats.
 */
export function CommitInspector({ loading, error, data }: Props) {
  const [copied, setCopied] = useState(false)

  const copyHash = useCallback(async () => {
    if (!data?.hash) return
    try {
      await navigator.clipboard.writeText(data.hash)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 2000)
    } catch {
      /* ignore */
    }
  }, [data?.hash])

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-1 py-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin shrink-0" />
        Loading commit…
      </div>
    )
  }

  if (error) {
    return <p className="px-1 py-2 text-sm text-destructive">{error}</p>
  }

  if (!data) {
    return null
  }

  return (
    <div className="space-y-3 px-1 py-1">
      <div className="flex flex-wrap items-start gap-3">
        <div
          className="flex size-9 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground"
          aria-hidden
        >
          {initials(data.authorName)}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-sm font-medium leading-snug text-foreground">{data.subject}</p>
          <p className="text-xs text-muted-foreground">
            {data.authorName} · {formatRelativeShort(data.dateIso)}
          </p>
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <code className="rounded bg-muted px-1.5 py-0.5 font-mono text-[11px] text-foreground">
              {data.shortHash}
            </code>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-6"
              title="Copy full hash"
              onClick={() => void copyHash()}
            >
              {copied ? (
                <Check className="size-3.5 text-emerald-600" aria-hidden />
              ) : (
                <Copy className="size-3.5" aria-hidden />
              )}
            </Button>
          </div>
        </div>
      </div>

      <details open className="group rounded-md border border-border/80 bg-muted/10">
        <summary className="cursor-pointer list-none px-2 py-1.5 text-[0.65rem] font-medium uppercase tracking-wide text-muted-foreground marker:hidden [&::-webkit-details-marker]:hidden">
          <span className="select-none">
            Files changed{' '}
            <span className="text-foreground/80">({data.files.length})</span>
          </span>
        </summary>
        <ul className="max-h-40 space-y-0.5 overflow-y-auto border-t border-border/60 px-2 py-1.5">
          {data.files.length === 0 ? (
            <li className="text-xs text-muted-foreground">No file changes.</li>
          ) : (
            data.files.map((f) => (
              <li
                key={f.path + (f.oldPath ?? '')}
                className="flex min-w-0 items-start gap-2 font-mono text-[11px] leading-tight"
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded text-[0.6rem] font-bold',
                    STATUS_CLASS[f.status],
                  )}
                  title={f.status}
                >
                  {STATUS_LETTER[f.status]}
                </span>
                <span className="min-w-0 flex-1 break-all text-foreground">
                  {f.status === 'renamed' && f.oldPath ? (
                    <>
                      <span className="text-muted-foreground">{f.oldPath}</span>
                      <span className="px-1 text-muted-foreground">→</span>
                      {f.path}
                    </>
                  ) : (
                    f.path
                  )}
                </span>
                {(f.additions > 0 || f.deletions > 0) && (
                  <span className="shrink-0 text-[10px] text-muted-foreground tabular-nums">
                    <span className="text-emerald-600 dark:text-emerald-400">+{f.additions}</span>{' '}
                    <span className="text-red-600 dark:text-red-400">−{f.deletions}</span>
                  </span>
                )}
              </li>
            ))
          )}
        </ul>
      </details>
    </div>
  )
}
