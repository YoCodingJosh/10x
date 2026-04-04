import { create } from 'zustand'

/** Idle = agent finished (Glass sound); needs-input = waiting on user (Sosumi). */
export type AgentAttentionKind = 'idle' | 'needs-input'

export type AgentAttentionMap = Record<string, AgentAttentionKind>

/** Tailwind classes for status dots — use everywhere we show agent attention. */
export const agentAttentionDotClass: Record<AgentAttentionKind, string> = {
  idle: 'bg-emerald-500',
  'needs-input': 'bg-sky-400',
}

/**
 * Tracks which agent sessions need the user's attention (idle / needs-input).
 * Session IDs follow the format `${workspaceId}:${tabId}`.
 *
 * `focusedAgentSessionId` is the active agent tab in the visible workspace (see
 * AgentFocusedSessionBridge). That session never gets a dot: we do not add it
 * to `attention`, and helpers ignore it even if the map is stale.
 */
type AgentNotificationState = {
  attention: AgentAttentionMap
  /** `workspaceId:tabId` for the foreground agent tab, or null if none. */
  focusedAgentSessionId: string | null
  setFocusedAgentSessionId: (sessionId: string | null) => void
  _setAttention: (sessionId: string, kind: AgentAttentionKind) => void
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

  _setAttention: (sessionId, kind) =>
    set((s) => {
      if (s.focusedAgentSessionId != null && sessionId === s.focusedAgentSessionId) {
        return s
      }
      if (s.attention[sessionId] === kind) return s
      return { attention: { ...s.attention, [sessionId]: kind } }
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
      const kind: AgentAttentionKind =
        state === 'needs-input' ? 'needs-input' : 'idle'
      store._setAttention(sessionId, kind)
    } else {
      store._clearAttention(sessionId)
    }
  })
}

/** Dot kind for one tab, or none (never for the focused tab). */
export function tabAttentionIndicator(
  workspaceId: string,
  tabId: string,
  attention: AgentAttentionMap,
  focusedAgentSessionId: string | null,
): AgentAttentionKind | 'none' {
  const sid = `${workspaceId}:${tabId}`
  if (focusedAgentSessionId != null && sid === focusedAgentSessionId) return 'none'
  const k = attention[sid]
  if (k === 'idle' || k === 'needs-input') return k
  return 'none'
}

/**
 * Workspace rail dot: any `needs-input` → that (blue); else any `idle` → green; else none.
 */
export function workspaceAttentionIndicator(
  workspaceId: string,
  attention: AgentAttentionMap,
  focusedAgentSessionId: string | null,
): AgentAttentionKind | 'none' {
  let hasIdle = false
  const prefix = `${workspaceId}:`
  for (const [id, kind] of Object.entries(attention)) {
    if (!id.startsWith(prefix)) continue
    if (focusedAgentSessionId != null && id === focusedAgentSessionId) continue
    if (kind === 'needs-input') return 'needs-input'
    if (kind === 'idle') hasIdle = true
  }
  if (hasIdle) return 'idle'
  return 'none'
}

/** First session in this workspace to open when activating the workspace (needs-input before idle). */
export function firstAttentionSessionIdInWorkspace(
  workspaceId: string,
  attention: AgentAttentionMap,
): string | null {
  const prefix = `${workspaceId}:`
  const ids = Object.keys(attention)
    .filter((id) => id.startsWith(prefix))
    .sort((a, b) => {
      const ka = attention[a]!
      const kb = attention[b]!
      const pa = ka === 'needs-input' ? 0 : 1
      const pb = kb === 'needs-input' ? 0 : 1
      if (pa !== pb) return pa - pb
      return a.localeCompare(b)
    })
  return ids[0] ?? null
}
