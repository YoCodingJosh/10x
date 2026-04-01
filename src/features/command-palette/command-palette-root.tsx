import { useCallback, useEffect, useState } from 'react'

import { CommandPaletteDialog } from './command-palette-dialog'
import { useCommandPaletteActions } from './use-command-palette-actions'

/**
 * Global command palette (⌘K / Ctrl+K). Mount once under the app shell.
 */
export function CommandPaletteRoot() {
  const [open, setOpen] = useState(false)
  const { items, run } = useCommandPaletteActions()

  const toggle = useCallback(() => {
    setOpen((o) => !o)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target
      const inField =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t instanceof HTMLElement && t.isContentEditable)
      if (inField && !open) return
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        toggle()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, toggle])

  const onSelect = useCallback(
    async (id: string) => {
      await run(id)
    },
    [run],
  )

  return <CommandPaletteDialog open={open} onOpenChange={setOpen} items={items} onSelect={onSelect} />
}
