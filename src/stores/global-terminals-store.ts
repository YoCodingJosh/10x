import { create } from 'zustand'

export type GlobalShellTab = { id: string; label: string }

type State = {
  byWorkspaceId: Record<string, GlobalShellTab[]>
  activeShellId: Record<string, string | null>
  addShell: (workspaceId: string) => void
  removeShell: (workspaceId: string, shellId: string) => void
  renameShell: (workspaceId: string, shellId: string, label: string) => void
  setActiveShell: (workspaceId: string, shellId: string | null) => void
  reconcileActiveShell: (workspaceId: string) => void
  pruneToWorkspaces: (validWorkspaceIds: Set<string>) => void
  purgeWorkspace: (workspaceId: string) => void
}

export const useGlobalTerminalsStore = create<State>((set, get) => ({
  byWorkspaceId: {},
  activeShellId: {},

  addShell: (workspaceId) => {
    const list = get().byWorkspaceId[workspaceId] ?? []
    const tab: GlobalShellTab = {
      id: crypto.randomUUID(),
      label: `Shell ${list.length + 1}`,
    }
    const nextList = [...list, tab]
    set((s) => ({
      byWorkspaceId: { ...s.byWorkspaceId, [workspaceId]: nextList },
      activeShellId: { ...s.activeShellId, [workspaceId]: tab.id },
    }))
  },

  removeShell: (workspaceId, shellId) => {
    const list = get().byWorkspaceId[workspaceId] ?? []
    const nextList = list.filter((t) => t.id !== shellId)
    const prevActive = get().activeShellId[workspaceId] ?? null
    let nextActive = prevActive
    if (prevActive === shellId) {
      nextActive = nextList[0]?.id ?? null
    }
    set((s) => {
      const nextByWs = { ...s.byWorkspaceId }
      if (nextList.length === 0) {
        delete nextByWs[workspaceId]
      } else {
        nextByWs[workspaceId] = nextList
      }
      const nextActiveShell = { ...s.activeShellId, [workspaceId]: nextActive }
      if (nextList.length === 0) {
        delete nextActiveShell[workspaceId]
      }
      return { byWorkspaceId: nextByWs, activeShellId: nextActiveShell }
    })
  },

  renameShell: (workspaceId, shellId, label) => {
    const list = get().byWorkspaceId[workspaceId]
    if (!list) return
    const tab = list.find((t) => t.id === shellId)
    if (!tab) return
    const trimmed = label.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : tab.label
    set((s) => ({
      byWorkspaceId: {
        ...s.byWorkspaceId,
        [workspaceId]: list.map((t) => (t.id === shellId ? { ...t, label: nextLabel } : t)),
      },
    }))
  },

  setActiveShell: (workspaceId, shellId) => {
    set((s) => ({
      activeShellId: { ...s.activeShellId, [workspaceId]: shellId },
    }))
  },

  reconcileActiveShell: (workspaceId) => {
    const list = get().byWorkspaceId[workspaceId] ?? []
    if (list.length === 0) return
    const active = get().activeShellId[workspaceId]
    if (active && list.some((t) => t.id === active)) return
    set((s) => ({
      activeShellId: {
        ...s.activeShellId,
        [workspaceId]: list[0]!.id,
      },
    }))
  },

  pruneToWorkspaces: (validWorkspaceIds) => {
    set((s) => {
      const nextByWs: Record<string, GlobalShellTab[]> = {}
      const nextActive: Record<string, string | null> = {}
      for (const [ws, tabs] of Object.entries(s.byWorkspaceId)) {
        if (validWorkspaceIds.has(ws)) {
          nextByWs[ws] = tabs
          if (ws in s.activeShellId) {
            nextActive[ws] = s.activeShellId[ws]!
          }
        }
      }
      return { byWorkspaceId: nextByWs, activeShellId: nextActive }
    })
  },

  purgeWorkspace: (workspaceId) => {
    set((s) => {
      const { [workspaceId]: _removed, ...restByWs } = s.byWorkspaceId
      const { [workspaceId]: _a, ...restActive } = s.activeShellId
      return { byWorkspaceId: restByWs, activeShellId: restActive }
    })
  },
}))
