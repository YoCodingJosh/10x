import { useEffect, useRef, useState } from 'react'

import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { cn } from '@/lib/utils'

import { useOptionalWorkspaceSessionScope } from './workspace-id-context'

export function EditableAgentTabLabel({
  tabId,
  workspaceId: workspaceIdProp,
  isTabActive: isTabActiveProp,
}: {
  tabId: string
  /** When set (e.g. workspaces rail), label resolves and renames in this workspace without context. */
  workspaceId?: string
  /**
   * When set, only this row shows text cursor / rename-on-second-click (focused workspace + active tab).
   * Omit in agent panel where the scoped workspace is always the one on screen.
   */
  isTabActive?: boolean
}) {
  const workspaceIdFromContext = useOptionalWorkspaceSessionScope()
  const workspaceId = workspaceIdProp ?? workspaceIdFromContext
  if (workspaceId == null || workspaceId === '') {
    throw new Error(
      'EditableAgentTabLabel requires workspaceId prop or WorkspaceIdProvider',
    )
  }
  const scopedWorkspaceId = workspaceId

  const label = useAgentTabsStore(
    (s) =>
      s.byWorkspaceId[scopedWorkspaceId]?.tabs.find((t) => t.id === tabId)?.label ?? '',
  )
  const activeTabId = useAgentTabsStore(
    (s) => s.byWorkspaceId[scopedWorkspaceId]?.activeTabId ?? null,
  )
  const renameTab = useAgentTabsStore((s) => s.renameTab)

  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(label)
  const skipBlurCommit = useRef(false)
  /** Tab was already active when this pointer went down (avoids rename on the click that switches tabs). */
  const wasActiveWhenPressed = useRef(false)

  const isTabActive = isTabActiveProp ?? activeTabId === tabId

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
    renameTab(scopedWorkspaceId, tabId, draft)
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
        wasActiveWhenPressed.current = isTabActive
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
