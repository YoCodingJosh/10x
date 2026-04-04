import { DiffLineRow } from '@/features/diff-panel/diff-line-row'
import type { ParsedDiffFile } from '@/features/diff-panel/parse-unified-diff'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Check, Copy, FileCode2 } from 'lucide-react'
import { useState } from 'react'

type Props = {
  file: ParsedDiffFile
  /** Anchor for scroll-into-view from the file strip. */
  fileIndex: number
  className?: string
}

export function DiffFileBlock({ file, fileIndex, className }: Props) {
  const [copied, setCopied] = useState(false)

  return (
    <section
      id={`mux-diff-file-${fileIndex}`}
      className={cn(
        'scroll-mt-2 overflow-hidden rounded-lg border border-border/80 bg-card/40 shadow-sm dark:bg-card/25',
        className,
      )}
    >
      <header className="flex items-center gap-2 border-b border-border/60 bg-muted/40 px-2.5 py-1.5 dark:bg-muted/25">
        <FileCode2 className="size-3.5 shrink-0 text-muted-foreground" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-xs font-medium text-foreground">
          {file.path}
        </span>
        <Button
          type="button"
          variant="ghost"
          size="icon-xs"
          className="shrink-0 text-muted-foreground hover:text-foreground"
          title="Copy path"
          onClick={() => {
            void navigator.clipboard.writeText(file.path).then(() => {
              setCopied(true)
              window.setTimeout(() => setCopied(false), 1600)
            })
          }}
        >
          {copied ? <Check className="size-3" aria-hidden /> : <Copy className="size-3" aria-hidden />}
        </Button>
      </header>
      <div className="min-w-0">
        {file.lines.map((line, i) => (
          <DiffLineRow key={i} line={line} />
        ))}
      </div>
    </section>
  )
}
