import { useLayoutEffect, useMemo } from 'react'

import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'

/**
 * Keeps the main process in sync with the agent tab the user is actually viewing so it can skip
 * macOS notifications when that session becomes idle or needs input.
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
    window.mux.agent.setFocusedSession(sessionId)
  }, [sessionId])

  return null
}
