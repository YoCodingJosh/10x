import { scheduleFocusMuxXtermForTyping } from '@/lib/focus-mux-xterm'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** `workspaceId` and tab UUIDs do not contain `:`, so the first colon is the separator. */
function parseAgentSessionId(sessionId: string): { workspaceId: string; tabId: string } | null {
  const i = sessionId.indexOf(':')
  if (i <= 0 || i === sessionId.length - 1) return null
  return { workspaceId: sessionId.slice(0, i), tabId: sessionId.slice(i + 1) }
}

/**
 * Activate the workspace and agent tab for `workspaceId:tabId`. Optionally focuses the agent PTY.
 */
export function navigateToAgentSession(sessionId: string, opts?: { focusXterm?: boolean }): void {
  const parsed = parseAgentSessionId(sessionId)
  if (parsed == null) return
  const { workspaceId, tabId } = parsed

  useWorkspaceStore.getState().setActiveWorkspaceId(workspaceId)
  useAgentTabsStore.getState().ensureWorkspace(workspaceId)

  const bucket = useAgentTabsStore.getState().byWorkspaceId[workspaceId]
  if (!bucket?.tabs.some((t) => t.id === tabId)) return

  useAgentTabsStore.getState().setActiveTab(workspaceId, tabId)

  if (opts?.focusXterm !== false) {
    scheduleFocusMuxXtermForTyping('#mux-agent-desk')
  }
}

/** Subscribe to main-process notification clicks. Call once at app root (Electron only). */
export function initAgentSessionNavigateBridge(): void {
  if (typeof window.mux?.agent?.onNavigateToSession !== 'function') return
  window.mux.agent.onNavigateToSession(({ sessionId }) => {
    navigateToAgentSession(sessionId)
  })
}
