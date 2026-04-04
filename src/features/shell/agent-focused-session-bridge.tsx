import { useLayoutEffect, useMemo } from 'react'

import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useAgentNotificationStore } from '@/stores/agent-notification-store'

/**
 * Keeps the main process in sync with the active agent tab in the visible workspace so it can skip
 * macOS notifications, dock badge counts, and blue-dot attention for that session.
 */
export function AgentFocusedSessionBridge() {
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const bucket = useAgentTabsStore((s) =>
    visibleWorkspaceId ? s.byWorkspaceId[visibleWorkspaceId] : undefined,
  )

  const sessionId = useMemo(() => {
    if (!visibleWorkspaceId) return null
    const tabs = bucket?.tabs ?? []
    if (tabs.length === 0) return null
    const activeTabId = bucket?.activeTabId ?? null
    const resolved =
      activeTabId && tabs.some((t) => t.id === activeTabId) ? activeTabId : tabs[0]!.id
    return `${visibleWorkspaceId}:${resolved}`
  }, [visibleWorkspaceId, bucket?.tabs, bucket?.activeTabId])

  useLayoutEffect(() => {
    useAgentNotificationStore.getState().setFocusedAgentSessionId(sessionId)
    window.mux.agent.setFocusedSession(sessionId)
  }, [sessionId])

  return null
}
