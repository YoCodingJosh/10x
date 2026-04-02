import { create } from 'zustand'

/**
 * Tracks which agent sessions need the user's attention (idle / needs-input).
 * Session IDs follow the format `${workspaceId}:${tabId}`.
 *
 * Uses a plain object (not Set) so Zustand/React always see a new slice reference
 * when attention changes — Sets are easy to misuse with shallow selectors.
 */
type AgentNotificationState = {
  attention: Record<string, true>
  _setAttention: (sessionId: string) => void
  _clearAttention: (sessionId: string) => void
}

export const useAgentNotificationStore = create<AgentNotificationState>((set) => ({
  attention: {},

  _setAttention: (sessionId) =>
    set((s) => {
      if (s.attention[sessionId]) return s
      return { attention: { ...s.attention, [sessionId]: true } }
    }),

  _clearAttention: (sessionId) =>
    set((s) => {
      if (!s.attention[sessionId]) return s
      const { [sessionId]: _, ...rest } = s.attention
      return { attention: rest }
    }),
}))

/** Subscribe to main-process agent state broadcasts. Call once at app root. */
export function initAgentNotificationBridge(): () => void {
  return window.mux.agent.onStateChange(({ sessionId, state }) => {
    const store = useAgentNotificationStore.getState()
    if (state === 'idle' || state === 'needs-input') {
      store._setAttention(sessionId)
    } else {
      store._clearAttention(sessionId)
    }
  })
}

/** Returns true when the given workspace+tab session needs attention. */
export function tabNeedsAttention(
  workspaceId: string,
  tabId: string,
  attention: Record<string, true>,
): boolean {
  return attention[`${workspaceId}:${tabId}`] === true
}

/** Returns true when ANY agent tab in the workspace needs attention. */
export function workspaceNeedsAttention(workspaceId: string, attention: Record<string, true>): boolean {
  const prefix = `${workspaceId}:`
  for (const id of Object.keys(attention)) {
    if (id.startsWith(prefix)) return true
  }
  return false
}
