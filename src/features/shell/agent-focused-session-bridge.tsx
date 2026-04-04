import { useLayoutEffect, useMemo } from 'react'

import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useAgentNotificationStore } from '@/stores/agent-notification-store'

/**
 * Keeps the main process in sync with the active agent tab in the visible workspace for dock badge
 * counts and Claude tab-strip dots (idle / needs-input outside the focused tab). OS notifications
 * and sounds still fire when that session becomes idle or needs input.
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
