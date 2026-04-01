import { create } from 'zustand'

export type WorktreeShellTab = { id: string; label: string }

const KEY_SEP = '::'

export function worktreeTerminalsKey(workspaceId: string, agentTabId: string): string {
  return `${workspaceId}${KEY_SEP}${agentTabId}`
}

type State = {
  /** Shell tab list per (workspace, agent tab). */
  byKey: Record<string, WorktreeShellTab[]>
  /** Active shell id per key. */
  activeShellId: Record<string, string | null>
  addShell: (workspaceId: string, agentTabId: string) => void
  removeShell: (workspaceId: string, agentTabId: string, shellId: string) => void
  renameShell: (workspaceId: string, agentTabId: string, shellId: string, label: string) => void
  setActiveShell: (workspaceId: string, agentTabId: string, shellId: string | null) => void
  reconcileActiveShell: (workspaceId: string, agentTabId: string) => void
  purgeAgentTab: (workspaceId: string, agentTabId: string) => void
  pruneToWorkspaces: (validWorkspaceIds: Set<string>) => void
  purgeWorkspace: (workspaceId: string) => void
}

export const useWorktreeTerminalsStore = create<State>((set, get) => ({
  byKey: {},
  activeShellId: {},

  addShell: (workspaceId, agentTabId) => {
    const key = worktreeTerminalsKey(workspaceId, agentTabId)
    const list = get().byKey[key] ?? []
    const tab: WorktreeShellTab = {
      id: crypto.randomUUID(),
      label: `Shell ${list.length + 1}`,
    }
    const nextList = [...list, tab]
    set((s) => ({
      byKey: { ...s.byKey, [key]: nextList },
      activeShellId: { ...s.activeShellId, [key]: tab.id },
    }))
  },

  renameShell: (workspaceId, agentTabId, shellId, label) => {
    const key = worktreeTerminalsKey(workspaceId, agentTabId)
    const list = get().byKey[key]
    if (!list) return
    const tab = list.find((t) => t.id === shellId)
    if (!tab) return
    const trimmed = label.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : tab.label
    set((s) => ({
      byKey: {
        ...s.byKey,
        [key]: list.map((t) => (t.id === shellId ? { ...t, label: nextLabel } : t)),
      },
    }))
  },

  removeShell: (workspaceId, agentTabId, shellId) => {
    const key = worktreeTerminalsKey(workspaceId, agentTabId)
    const list = get().byKey[key] ?? []
    const nextList = list.filter((t) => t.id !== shellId)
    const prevActive = get().activeShellId[key] ?? null
    let nextActive = prevActive
    if (prevActive === shellId) {
      nextActive = nextList[0]?.id ?? null
    }
    set((s) => {
      const nextByKey = { ...s.byKey }
      if (nextList.length === 0) {
        delete nextByKey[key]
      } else {
        nextByKey[key] = nextList
      }
      const nextActiveShell = { ...s.activeShellId, [key]: nextActive }
      if (nextList.length === 0) {
        delete nextActiveShell[key]
      }
      return { byKey: nextByKey, activeShellId: nextActiveShell }
    })
  },

  setActiveShell: (workspaceId, agentTabId, shellId) => {
    const key = worktreeTerminalsKey(workspaceId, agentTabId)
    set((s) => ({
      activeShellId: { ...s.activeShellId, [key]: shellId },
    }))
  },

  reconcileActiveShell: (workspaceId, agentTabId) => {
    const key = worktreeTerminalsKey(workspaceId, agentTabId)
    const list = get().byKey[key] ?? []
    if (list.length === 0) return
    const active = get().activeShellId[key]
    if (active && list.some((t) => t.id === active)) return
    set((s) => ({
      activeShellId: { ...s.activeShellId, [key]: list[0]!.id },
    }))
  },

  purgeAgentTab: (workspaceId, agentTabId) => {
    const key = worktreeTerminalsKey(workspaceId, agentTabId)
    set((s) => {
      const { [key]: _removed, ...restByKey } = s.byKey
      const { [key]: _a, ...restActive } = s.activeShellId
      return { byKey: restByKey, activeShellId: restActive }
    })
  },

  pruneToWorkspaces: (validWorkspaceIds) => {
    set((s) => {
      const nextByKey: Record<string, WorktreeShellTab[]> = {}
      const nextActive: Record<string, string | null> = {}
      for (const [key, tabs] of Object.entries(s.byKey)) {
        const ws = key.split(KEY_SEP)[0]
        if (ws && validWorkspaceIds.has(ws)) {
          nextByKey[key] = tabs
          if (key in s.activeShellId) {
            nextActive[key] = s.activeShellId[key]!
          }
        }
      }
      return { byKey: nextByKey, activeShellId: nextActive }
    })
  },

  purgeWorkspace: (workspaceId) => {
    const prefix = `${workspaceId}${KEY_SEP}`
    set((s) => {
      const nextByKey: Record<string, WorktreeShellTab[]> = { ...s.byKey }
      const nextActive = { ...s.activeShellId }
      for (const k of Object.keys(nextByKey)) {
        if (k.startsWith(prefix)) {
          delete nextByKey[k]
          delete nextActive[k]
        }
      }
      return { byKey: nextByKey, activeShellId: nextActive }
    })
  },
}))
