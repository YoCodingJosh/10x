import { create } from 'zustand'

/** Mirrors main-process `AgentState` for workspace-rail text badges. */
export type AgentSessionActivity = 'running' | 'idle' | 'needs-input'

export type AgentActivityMap = Record<string, AgentSessionActivity>

/** Idle / needs-input dots on the Claude tab strip (not the workspace rail). */
export type AgentAttentionKind = 'idle' | 'needs-input'

export type AgentAttentionMap = Record<string, AgentAttentionKind>

export const agentAttentionDotClass: Record<AgentAttentionKind, string> = {
  idle: 'bg-emerald-500',
  'needs-input': 'bg-sky-400',
}

export function agentActivityLabel(state: AgentSessionActivity): string {
  switch (state) {
    case 'running':
      return 'RUNNING'
    case 'idle':
      return 'IDLE'
    case 'needs-input':
      return 'INPUT'
  }
}

export function agentActivityBadgeClass(state: AgentSessionActivity): string {
  switch (state) {
    case 'running':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'idle':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
    case 'needs-input':
      return 'bg-sky-400/25 text-sky-900 dark:text-sky-100'
  }
}

/** Workspace rail: DONE (fresh finish, still “pinged”) — distinct from dismissed IDLE green. */
export const agentRailDoneBadgeClass =
  'bg-purple-500/15 text-purple-900 dark:text-purple-200'

type AgentNotificationState = {
  activityBySession: AgentActivityMap
  attention: AgentAttentionMap
  focusedAgentSessionId: string | null
  setFocusedAgentSessionId: (sessionId: string | null) => void
  _setActivity: (sessionId: string, state: AgentSessionActivity) => void
  _clearActivity: (sessionId: string) => void
  _setAttention: (sessionId: string, kind: AgentAttentionKind) => void
  _clearAttention: (sessionId: string) => void
}

export const useAgentNotificationStore = create<AgentNotificationState>((set) => ({
  activityBySession: {},
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

  _setActivity: (sessionId, state) =>
    set((s) => {
      if (s.activityBySession[sessionId] === state) return s
      return { activityBySession: { ...s.activityBySession, [sessionId]: state } }
    }),

  _clearActivity: (sessionId) =>
    set((s) => {
      if (!s.activityBySession[sessionId]) return s
      const { [sessionId]: _, ...rest } = s.activityBySession
      return { activityBySession: rest }
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

export function initAgentNotificationBridge(): () => void {
  return window.mux.agent.onStateChange((payload) => {
    const p = payload as {
      sessionId: string
      state: string
      needsAttention?: boolean
      active?: boolean
    }
    const store = useAgentNotificationStore.getState()
    if (p.active === false) {
      store._clearActivity(p.sessionId)
      store._clearAttention(p.sessionId)
      return
    }
    if (p.state === 'running' || p.state === 'idle' || p.state === 'needs-input') {
      store._setActivity(p.sessionId, p.state)
    }

    const focused = store.focusedAgentSessionId
    const show =
      p.needsAttention ?? (p.state === 'idle' || p.state === 'needs-input')
    if (show && p.sessionId !== focused) {
      const kind: AgentAttentionKind =
        p.state === 'needs-input' ? 'needs-input' : 'idle'
      store._setAttention(p.sessionId, kind)
    } else {
      store._clearAttention(p.sessionId)
    }
  })
}

export function tabActivity(
  workspaceId: string,
  tabId: string,
  activity: AgentActivityMap,
): AgentSessionActivity | null {
  const sid = `${workspaceId}:${tabId}`
  return activity[sid] ?? null
}

/**
 * Workspace rail copy while Claude is idle: DONE while attention still has idle (green dot phase);
 * IDLE after dismiss/focus — DONE uses purple badge, IDLE stays emerald.
 */
export function workspaceRailIdleLabel(
  workspaceId: string,
  tabId: string,
  attention: AgentAttentionMap,
): 'DONE' | 'IDLE' {
  const sid = `${workspaceId}:${tabId}`
  return attention[sid] === 'idle' ? 'DONE' : 'IDLE'
}

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
