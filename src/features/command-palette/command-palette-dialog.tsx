import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

import type { CommandPaletteItem } from './command-palette-types'

const SECTION_LABEL: Record<CommandPaletteItem['section'], string> = {
  go: 'Go to',
  shell: 'Shell',
  workspace: 'Workspace',
  agent: 'Agent',
  git: 'Git',
}

type Props = {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: CommandPaletteItem[]
  onSelect: (id: string) => void
}

export function CommandPaletteDialog({ open, onOpenChange, items, onSelect }: Props) {
  const [query, setQuery] = useState('')
  const [highlight, setHighlight] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return items
    return items.filter((it) => {
      const hay = `${it.label} ${it.keywords ?? ''}`.toLowerCase()
      return hay.includes(q)
    })
  }, [items, query])

  const grouped = useMemo(() => {
    const order: CommandPaletteItem['section'][] = ['go', 'shell', 'workspace', 'agent', 'git']
    const map = new Map<CommandPaletteItem['section'], CommandPaletteItem[]>()
    for (const it of filtered) {
      const list = map.get(it.section) ?? []
      list.push(it)
      map.set(it.section, list)
    }
    const rows: { section: CommandPaletteItem['section']; items: CommandPaletteItem[] }[] = []
    for (const sec of order) {
      const list = map.get(sec)
      if (list?.length) rows.push({ section: sec, items: list })
    }
    return rows
  }, [filtered])

  const indexedRows = useMemo(() => {
    let i = 0
    return grouped.flatMap((g) =>
      g.items.map((item) => ({
        section: g.section,
        item,
        index: i++,
      })),
    )
  }, [grouped])

  const flatIds = useMemo(() => indexedRows.map((r) => r.item.id), [indexedRows])

  useEffect(() => {
    setHighlight(0)
  }, [query, items])

  useEffect(() => {
    if (open) {
      setQuery('')
      setHighlight(0)
      queueMicrotask(() => inputRef.current?.focus())
    }
  }, [open])

  const pick = useCallback(
    (id: string) => {
      onSelect(id)
      onOpenChange(false)
    },
    [onSelect, onOpenChange],
  )

  const move = useCallback(
    (delta: number) => {
      if (flatIds.length === 0) return
      setHighlight((h) => (h + delta + flatIds.length) % flatIds.length)
    },
    [flatIds.length],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-lg gap-0 overflow-hidden p-0 sm:max-w-lg"
        onCloseAutoFocus={(e) => e.preventDefault()}
      >
        <DialogTitle className="sr-only">Command palette</DialogTitle>
        <DialogDescription className="sr-only">
          Type to filter commands. Arrow keys to move, Enter to run.
        </DialogDescription>
        <input
          ref={inputRef}
          type="text"
          placeholder="Search workspaces, agents, folders, commands…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault()
              move(1)
            }
            if (e.key === 'ArrowUp') {
              e.preventDefault()
              move(-1)
            }
            if (e.key === 'Enter' && flatIds[highlight] != null) {
              e.preventDefault()
              pick(flatIds[highlight]!)
            }
          }}
          className={cn(
            'w-full border-0 border-b border-border bg-transparent px-3 py-2.5 text-sm',
            'outline-none placeholder:text-muted-foreground',
          )}
          autoComplete="off"
          autoCorrect="off"
          spellCheck={false}
        />
        <div className="max-h-[min(50vh,360px)] overflow-y-auto p-1">
          {indexedRows.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">No matching commands</p>
          ) : (
            grouped.map(({ section, items: secItems }) => (
              <div key={section} className="mb-2 last:mb-0">
                <div className="px-2 py-1 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                  {SECTION_LABEL[section]}
                </div>
                <ul className="space-y-0.5">
                  {secItems.map((it) => {
                    const row = indexedRows.find((r) => r.item.id === it.id)!
                    const idx = row.index
                    const active = idx === highlight
                    return (
                      <li key={it.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full rounded-md px-2 py-1.5 text-left text-xs',
                            active ? 'bg-accent text-accent-foreground' : 'hover:bg-muted/80',
                          )}
                          onClick={() => pick(it.id)}
                          onMouseEnter={() => setHighlight(idx)}
                        >
                          {it.label}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
