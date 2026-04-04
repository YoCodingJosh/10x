import { create } from 'zustand'

/**
 * Tracks which agent sessions need the user's attention (idle / needs-input).
 * Session IDs follow the format `${workspaceId}:${tabId}`.
 *
 * `focusedAgentSessionId` is the active agent tab in the visible workspace (see
 * AgentFocusedSessionBridge). That session never gets a blue dot: we do not add it
 * to `attention`, and helpers ignore it even if the map is stale.
 */
type AgentNotificationState = {
  attention: Record<string, true>
  /** `workspaceId:tabId` for the foreground agent tab, or null if none. */
  focusedAgentSessionId: string | null
  setFocusedAgentSessionId: (sessionId: string | null) => void
  _setAttention: (sessionId: string) => void
  _clearAttention: (sessionId: string) => void
}

export const useAgentNotificationStore = create<AgentNotificationState>((set) => ({
  attention: {},
  focusedAgentSessionId: null,

  setFocusedAgentSessionId: (sessionId) =>
    set((s) => {
      if (s.focusedAgentSessionId === sessionId) return s
      const next = { ...s.attention }
      if (sessionId != null) {
        delete next[sessionId]
      }
      return { focusedAgentSessionId: sessionId, attention: next }
    }),

  _setAttention: (sessionId) =>
    set((s) => {
      if (s.focusedAgentSessionId != null && sessionId === s.focusedAgentSessionId) {
        return s
      }
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
  return window.mux.agent.onStateChange(({ sessionId, state, needsAttention }) => {
    const store = useAgentNotificationStore.getState()
    const focused = store.focusedAgentSessionId
    const show =
      needsAttention ??
      (state === 'idle' || state === 'needs-input')
    if (show && sessionId !== focused) {
      store._setAttention(sessionId)
    } else {
      store._clearAttention(sessionId)
    }
  })
}

/** Returns true when the given workspace+tab session needs attention (never for the focused tab). */
export function tabNeedsAttention(
  workspaceId: string,
  tabId: string,
  attention: Record<string, true>,
  focusedAgentSessionId: string | null,
): boolean {
  const sid = `${workspaceId}:${tabId}`
  if (focusedAgentSessionId != null && sid === focusedAgentSessionId) return false
  return attention[sid] === true
}

/** Returns true when any agent tab in the workspace needs attention (ignores the focused tab). */
export function workspaceNeedsAttention(
  workspaceId: string,
  attention: Record<string, true>,
  focusedAgentSessionId: string | null,
): boolean {
  const prefix = `${workspaceId}:`
  for (const id of Object.keys(attention)) {
    if (!id.startsWith(prefix)) continue
    if (focusedAgentSessionId != null && id === focusedAgentSessionId) continue
    return true
  }
  return false
}

/** First `workspaceId:…` session in `attention` (stable order), or null. */
export function firstAttentionSessionIdInWorkspace(
  workspaceId: string,
  attention: Record<string, true>,
): string | null {
  const prefix = `${workspaceId}:`
  const ids = Object.keys(attention).filter((id) => id.startsWith(prefix)).sort()
  return ids[0] ?? null
}
