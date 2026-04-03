import type { HTMLAttributes } from 'react'

import { cn } from '@/lib/utils'

type SplitSashProps = {
  orientation: 'horizontal' | 'vertical'
  'aria-label': string
  className?: string
} & Pick<HTMLAttributes<HTMLDivElement>, 'onPointerDown' | 'onPointerMove' | 'onPointerUp' | 'onPointerCancel' | 'onKeyDown' | 'tabIndex'>

/**
 * VS Code–style splitter: 1px line, ~5px hit strip for dragging (no knob).
 */
export function SplitSash({ orientation, 'aria-label': ariaLabel, className, ...rest }: SplitSashProps) {
  const horizontal = orientation === 'horizontal'
  return (
    <div
      role="separator"
      aria-orientation={horizontal ? 'horizontal' : 'vertical'}
      aria-label={ariaLabel}
      tabIndex={0}
      className={cn(
        'group relative z-10 shrink-0 outline-none',
        horizontal ? 'flex h-[5px] cursor-row-resize flex-col justify-center' : 'flex w-[5px] cursor-col-resize flex-row justify-center',
        'hover:bg-accent/15 focus-visible:bg-accent/20 focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
        className,
      )}
      {...rest}
    >
      <span
        className={cn(
          'shrink-0 bg-border transition-colors group-hover:bg-muted-foreground/50',
          horizontal ? 'h-px w-full' : 'h-full w-px',
        )}
        aria-hidden
      />
    </div>
  )
}
