import type { DiffLine } from '@/features/diff-panel/parse-unified-diff'
import { cn } from '@/lib/utils'

type Props = {
  line: DiffLine
}

export function DiffLineRow({ line }: Props) {
  const t = line.text
  const base =
    'break-all border-l-2 pl-2 pr-3 py-px font-mono text-[11px] leading-relaxed tracking-tight'

  switch (line.kind) {
    case 'add':
      return (
        <div
          className={cn(
            base,
            'border-emerald-500/45 bg-emerald-500/[0.09] text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-100',
          )}
        >
          {t}
        </div>
      )
    case 'remove':
      return (
        <div
          className={cn(
            base,
            'border-rose-500/45 bg-rose-500/[0.09] text-rose-950 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-100',
          )}
        >
          {t}
        </div>
      )
    case 'hunk':
      return (
        <div
          className={cn(
            base,
            'border-border bg-muted/60 text-muted-foreground dark:bg-muted/40',
          )}
        >
          {t}
        </div>
      )
    case 'meta':
      return (
        <div className={cn(base, 'border-transparent text-muted-foreground/90')}>{t}</div>
      )
    default:
      return (
        <div className={cn(base, 'border-transparent text-foreground/90')}>{t}</div>
      )
  }
}
