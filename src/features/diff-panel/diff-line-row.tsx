import type { DiffLine } from '@/features/diff-panel/parse-unified-diff'
import type { SyntaxToken } from '@/features/diff-panel/use-diff-syntax-highlight'
import { cn } from '@/lib/utils'

type Props = {
  line: DiffLine
  tokens?: SyntaxToken[] | null
}

// Shiki FontStyle bit flags
const ITALIC = 1
const BOLD = 2
const UNDERLINE = 4

function tokenStyle(t: SyntaxToken): React.CSSProperties {
  const s: React.CSSProperties = {}
  if (t.color) s.color = t.color
  if (t.fontStyle & ITALIC) s.fontStyle = 'italic'
  if (t.fontStyle & BOLD) s.fontWeight = 'bold'
  if (t.fontStyle & UNDERLINE) s.textDecoration = 'underline'
  return s
}

function diffMarker(line: DiffLine) {
  return line.text[0] ?? ''
}

function renderCodeBody(line: DiffLine, tokens: SyntaxToken[] | null | undefined) {
  if (!tokens) {
    return line.text.slice(1)
  }

  return (
    <>
      {tokens.map((t, i) => (
        <span key={i} style={tokenStyle(t)}>
          {t.content}
        </span>
      ))}
    </>
  )
}

/** Fixed gutter for +/- / space so markers do not shift code; body uses pre-wrap to keep indent. */
function GutteredCodeLine({
  line,
  tokens,
  rowClassName,
}: {
  line: DiffLine
  tokens: SyntaxToken[] | null | undefined
  rowClassName: string
}) {
  const marker = diffMarker(line)
  return (
    <div className={cn('flex min-w-0', rowClassName)}>
      <span
        className="inline-block w-[2ch] shrink-0 select-none text-center font-mono"
        aria-hidden={marker === ' '}
      >
        {marker === ' ' ? '\u00a0' : marker}
      </span>
      <div className="min-w-0 flex-1 whitespace-pre-wrap break-all [tab-size:4] font-mono">
        {renderCodeBody(line, tokens)}
      </div>
    </div>
  )
}

export function DiffLineRow({ line, tokens }: Props) {
  const base =
    'border-l-2 pl-2 pr-3 py-px font-mono text-[11px] leading-relaxed tracking-tight'

  switch (line.kind) {
    case 'add':
      return (
        <GutteredCodeLine
          line={line}
          tokens={tokens}
          rowClassName={cn(
            base,
            'border-emerald-500/45 bg-emerald-500/[0.09] text-emerald-950 dark:border-emerald-400/35 dark:bg-emerald-500/10 dark:text-emerald-100',
          )}
        />
      )
    case 'remove':
      return (
        <GutteredCodeLine
          line={line}
          tokens={tokens}
          rowClassName={cn(
            base,
            'border-rose-500/45 bg-rose-500/[0.09] text-rose-950 dark:border-rose-400/35 dark:bg-rose-500/10 dark:text-rose-100',
          )}
        />
      )
    case 'hunk':
      return (
        <div
          className={cn(
            base,
            'break-all border-border bg-muted/60 text-muted-foreground dark:bg-muted/40',
          )}
        >
          {line.text}
        </div>
      )
    case 'meta':
      return (
        <div className={cn(base, 'break-all border-transparent text-muted-foreground/90')}>
          {line.text}
        </div>
      )
    default:
      return (
        <GutteredCodeLine
          line={line}
          tokens={tokens}
          rowClassName={cn(base, 'border-transparent text-foreground/90')}
        />
      )
  }
}
