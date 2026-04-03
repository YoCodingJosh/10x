import { DiffLineRow } from '@/features/diff-panel/diff-line-row'
import type { ParsedDiffFile } from '@/features/diff-panel/parse-unified-diff'
import { cn } from '@/lib/utils'
import { FileCode2 } from 'lucide-react'

type Props = {
  file: ParsedDiffFile
  className?: string
}

export function DiffFileBlock({ file, className }: Props) {
  return (
    <section
      className={cn(
        'scroll-mt-2 overflow-hidden rounded-lg border border-border/80 bg-card/40 shadow-sm dark:bg-card/25',
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-2.5 py-1.5 dark:bg-muted/25">
        <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 truncate font-mono text-xs font-medium text-foreground">
          {file.path}
        </span>
      </header>
      <div className="min-w-0">
        {file.lines.map((line, i) => (
          <DiffLineRow key={i} line={line} />
        ))}
      </div>
    </section>
  )
}
