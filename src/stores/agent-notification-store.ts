import { create } from 'zustand'

/** Mirrors main-process `AgentState` for workspace-rail text badges. */
export type AgentSessionActivity = 'running' | 'idle' | 'needs-input'

export type AgentActivityMap = Record<string, AgentSessionActivity>

/** DONE (violet) / PENDING (amber) dots on the Claude tab strip — matches workspace rail badge colors. */
export type AgentAttentionKind = 'idle' | 'needs-input'

export type AgentAttentionMap = Record<string, AgentAttentionKind>

export const agentAttentionDotClass: Record<AgentAttentionKind, string> = {
  /** Matches DONE rail badge (finished, still pinged). */
  idle: 'bg-violet-500',
  /** Matches PENDING rail badge. */
  'needs-input': 'bg-amber-500',
}

export function agentActivityLabel(state: AgentSessionActivity): string {
  switch (state) {
    case 'running':
      return 'RUNNING'
    case 'idle':
      return 'IDLE'
    case 'needs-input':
      return 'PENDING'
  }
}

export function agentActivityBadgeClass(state: AgentSessionActivity): string {
  switch (state) {
    case 'running':
      return 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
    case 'idle':
      return 'bg-emerald-500/15 text-emerald-800 dark:text-emerald-300'
    case 'needs-input':
      return 'bg-amber-500/20 text-amber-950 dark:text-amber-200'
  }
}

/** Workspace rail: DONE (fresh finish, still “pinged”) — violet, distinct from IDLE green. */
export const agentRailDoneBadgeClass = 'bg-violet-800/15 text-violet-900 dark:text-violet-300'

/** Before first user keystroke — CLI boot / waiting for ❯ (not an active agent turn). */
export const agentRailStartingBadgeClass =
  'bg-zinc-500/15 text-zinc-700 dark:text-zinc-300'

type AgentNotificationState = {
  activityBySession: AgentActivityMap
  /** Synced from main; false until the user has typed in that agent PTY. */
  hasReceivedInputBySession: Record<string, boolean>
  /** Synced from main; true only after a real agent→idle completion (not CLI boot idle). */
  hasCompletedTurnBySession: Record<string, boolean>
  attention: AgentAttentionMap
  focusedAgentSessionId: string | null
  setFocusedAgentSessionId: (sessionId: string | null) => void
  _setActivity: (sessionId: string, state: AgentSessionActivity) => void
  _clearActivity: (sessionId: string) => void
  _setHasReceivedInput: (sessionId: string, value: boolean) => void
  _clearHasReceivedInput: (sessionId: string) => void
  _setHasCompletedTurn: (sessionId: string, value: boolean) => void
  _clearHasCompletedTurn: (sessionId: string) => void
  _setAttention: (sessionId: string, kind: AgentAttentionKind) => void
  _clearAttention: (sessionId: string) => void
}

export const useAgentNotificationStore = create<AgentNotificationState>((set) => ({
  activityBySession: {},
  hasReceivedInputBySession: {},
  hasCompletedTurnBySession: {},
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

  _setHasReceivedInput: (sessionId, value) =>
    set((s) => {
      if (s.hasReceivedInputBySession[sessionId] === value) return s
      return { hasReceivedInputBySession: { ...s.hasReceivedInputBySession, [sessionId]: value } }
    }),

  _clearHasReceivedInput: (sessionId) =>
    set((s) => {
      if (!(sessionId in s.hasReceivedInputBySession)) return s
      const { [sessionId]: _, ...rest } = s.hasReceivedInputBySession
      return { hasReceivedInputBySession: rest }
    }),

  _setHasCompletedTurn: (sessionId, value) =>
    set((s) => {
      if (s.hasCompletedTurnBySession[sessionId] === value) return s
      return {
        hasCompletedTurnBySession: { ...s.hasCompletedTurnBySession, [sessionId]: value },
      }
    }),

  _clearHasCompletedTurn: (sessionId) =>
    set((s) => {
      if (!(sessionId in s.hasCompletedTurnBySession)) return s
      const { [sessionId]: _, ...rest } = s.hasCompletedTurnBySession
      return { hasCompletedTurnBySession: rest }
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
      hasReceivedInput?: boolean
      hasCompletedTurn?: boolean
    }
    const store = useAgentNotificationStore.getState()
    if (p.active === false) {
      store._clearActivity(p.sessionId)
      store._clearAttention(p.sessionId)
      store._clearHasReceivedInput(p.sessionId)
      store._clearHasCompletedTurn(p.sessionId)
      return
    }
    if (p.state === 'running' || p.state === 'idle' || p.state === 'needs-input') {
      store._setActivity(p.sessionId, p.state)
    }
    if (typeof p.hasReceivedInput === 'boolean') {
      store._setHasReceivedInput(p.sessionId, p.hasReceivedInput)
    }
    if (typeof p.hasCompletedTurn === 'boolean') {
      store._setHasCompletedTurn(p.sessionId, p.hasCompletedTurn)
    }

    const focused = store.focusedAgentSessionId
    const show = p.needsAttention === true
    if (show && p.sessionId !== focused) {
      const kind: AgentAttentionKind = p.state === 'needs-input' ? 'needs-input' : 'idle'
      store._setAttention(p.sessionId, kind)
    } else {
      store._clearAttention(p.sessionId)
    }
  })
}

export function tabActivity(workspaceId: string, tabId: string, activity: AgentActivityMap): AgentSessionActivity | null {
  const sid = `${workspaceId}:${tabId}`
  return activity[sid] ?? null
}

export function tabHasReceivedInput(
  workspaceId: string,
  tabId: string,
  map: Record<string, boolean>,
): boolean {
  const sid = `${workspaceId}:${tabId}`
  return map[sid] ?? false
}

export function tabHasCompletedTurn(
  workspaceId: string,
  tabId: string,
  map: Record<string, boolean>,
): boolean {
  const sid = `${workspaceId}:${tabId}`
  return map[sid] ?? false
}

/**
 * Workspace rail copy while Claude is idle: DONE while attention still has idle (violet dot on tab strip);
 * IDLE after dismiss/focus — DONE uses violet badge, IDLE stays emerald.
 */
export function workspaceRailIdleLabel(
  workspaceId: string,
  tabId: string,
  attention: AgentAttentionMap,
  hasCompletedTurn: boolean,
): 'DONE' | 'IDLE' {
  const sid = `${workspaceId}:${tabId}`
  if (attention[sid] === 'idle' && hasCompletedTurn) return 'DONE'
  return 'IDLE'
}

export function tabAttentionIndicator(
  workspaceId: string,
  tabId: string,
  attention: AgentAttentionMap,
  focusedAgentSessionId: string | null,
  hasCompletedTurn: boolean,
): AgentAttentionKind | 'none' {
  const sid = `${workspaceId}:${tabId}`
  if (focusedAgentSessionId != null && sid === focusedAgentSessionId) return 'none'
  const k = attention[sid]
  if (k === 'needs-input') return k
  if (k === 'idle' && hasCompletedTurn) return 'idle'
  return 'none'
}

export function firstAttentionSessionIdInWorkspace(
  workspaceId: string,
  attention: AgentAttentionMap,
  hasCompletedTurnBySession: Record<string, boolean>,
): string | null {
  const prefix = `${workspaceId}:`
  const ids = Object.keys(attention)
    .filter((id) => {
      if (!id.startsWith(prefix)) return false
      const k = attention[id]
      if (k === 'needs-input') return true
      if (k === 'idle') return hasCompletedTurnBySession[id] === true
      return false
    })
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
