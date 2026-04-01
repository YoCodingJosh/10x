import { useEffect, useRef, useState } from 'react'

import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { cn } from '@/lib/utils'

import { useWorkspaceSessionScope } from './workspace-id-context'

export function EditableAgentTabLabel({ tabId }: { tabId: string }) {
  const workspaceId = useWorkspaceSessionScope()
  const label = useAgentTabsStore(
    (s) => s.byWorkspaceId[workspaceId]?.tabs.find((t) => t.id === tabId)?.label ?? '',
  )
  const activeTabId = useAgentTabsStore(
    (s) => s.byWorkspaceId[workspaceId]?.activeTabId ?? null,
  )
  const renameTab = useAgentTabsStore((s) => s.renameTab)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const skipBlurCommit = useRef(false)
  /** Tab was already active when this pointer went down (avoids rename on the click that switches tabs). */
  const wasActiveWhenPressed = useRef(false)

  const isTabActive = activeTabId === tabId

  useEffect(() => {
    if (!editing) setDraft(label)
  }, [label, editing])

  useEffect(() => {
    if (!isTabActive && editing) {
      setEditing(false)
      setDraft(label)
    }
  }, [isTabActive, editing, label])

  function commit() {
    renameTab(workspaceId, tabId, draft)
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        type="text"
        value={draft}
        aria-label="Agent tab name"
        className={cn(
          'h-6 min-w-[8ch] max-w-full flex-1 rounded border border-input bg-background px-1.5 text-xs',
          'text-foreground outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
        )}
        autoFocus
        onChange={(e) => setDraft(e.target.value)}
        onClick={(e) => {
          e.stopPropagation()
        }}
        onPointerDown={(e) => {
          e.stopPropagation()
        }}
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
      className={cn(
        'block min-w-0 truncate text-left',
        isTabActive ? 'cursor-text' : 'cursor-pointer',
      )}
      title={
        isTabActive
          ? 'Click to rename'
          : 'Switch to this tab, then click again here to rename'
      }
      onPointerDownCapture={() => {
        wasActiveWhenPressed.current = activeTabId === tabId
      }}
      onClick={(e) => {
        if (!isTabActive) return
        if (!wasActiveWhenPressed.current) return
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
