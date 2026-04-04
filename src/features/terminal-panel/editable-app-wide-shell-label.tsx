import { useEffect, useRef, useState } from 'react'

import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { cn } from '@/lib/utils'

export function EditableAppWideShellLabel({
  shellId,
  isActive,
}: {
  shellId: string
  isActive: boolean
}) {
  const label = useAppWideTerminalsStore((s) => s.shells.find((t) => t.id === shellId)?.label ?? '')
  const renameShell = useAppWideTerminalsStore((s) => s.renameShell)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const skipBlurCommit = useRef(false)

  useEffect(() => {
    if (!editing) setDraft(label)
  }, [label, editing])

  useEffect(() => {
    if (!isActive && editing) {
      setEditing(false)
      setDraft(label)
    }
  }, [isActive, editing, label])

  function commit() {
    renameShell(shellId, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        aria-label="Global shell name"
        className={cn(
          'h-5 min-w-[6ch] max-w-full flex-1 rounded border border-input bg-background px-1 text-[11px]',
          'text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            skipBlurCommit.current = true
            setDraft(label)
            setEditing(false)
          }
        }}
        onBlur={() => {
          if (skipBlurCommit.current) {
            skipBlurCommit.current = false
            return
          }
          commit()
        }}
      />
    )
  }

  return (
    <span
      className="block min-w-0 max-w-24 truncate text-left"
      title={isActive ? 'Click to rename' : 'Select shell, then click to rename'}
      onClick={(e) => {
        if (!isActive) return
        e.stopPropagation()
        e.preventDefault()
        setDraft(label)
        setEditing(true)
      }}
    >
      {label}
    </span>
  )
}
