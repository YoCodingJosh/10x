import { create } from 'zustand'

export type AgentTab = { id: string; label: string }

type Bucket = { tabs: AgentTab[]; activeTabId: string | null }

function newAgentTab(index: number): AgentTab {
  return { id: crypto.randomUUID(), label: `Agent ${index}` }
}

function initialBucket(): Bucket {
  const tab = newAgentTab(1)
  return { tabs: [tab], activeTabId: tab.id }
}

type AgentTabsState = {
  byWorkspaceId: Record<string, Bucket>
  ensureWorkspace: (workspaceId: string) => void
  purgeWorkspace: (workspaceId: string) => void
  pruneToValidWorkspaceIds: (validIds: Set<string>) => void
  setActiveTab: (workspaceId: string, tabId: string) => void
  addTab: (workspaceId: string) => void
  closeTab: (workspaceId: string, tabId: string) => void
  renameTab: (workspaceId: string, tabId: string, label: string) => void
}

export const useAgentTabsStore = create<AgentTabsState>((set, get) => ({
  byWorkspaceId: {},

  ensureWorkspace: (workspaceId) => {
    if (get().byWorkspaceId[workspaceId]) return
    set((s) => ({
      byWorkspaceId: { ...s.byWorkspaceId, [workspaceId]: initialBucket() },
    }))
  },

  purgeWorkspace: (workspaceId) => {
    set((s) => {
      const { [workspaceId]: _removed, ...rest } = s.byWorkspaceId
      return { byWorkspaceId: rest }
    })
  },

  pruneToValidWorkspaceIds: (validIds) => {
    set((s) => {
      const next: Record<string, Bucket> = {}
      for (const id of Object.keys(s.byWorkspaceId)) {
        if (validIds.has(id)) next[id] = s.byWorkspaceId[id]
      }
      return { byWorkspaceId: next }
    })
  },

  setActiveTab: (workspaceId, tabId) => {
    set((s) => {
      const bucket = s.byWorkspaceId[workspaceId]
      if (!bucket?.tabs.some((t) => t.id === tabId)) return s
      return {
        byWorkspaceId: {
          ...s.byWorkspaceId,
          [workspaceId]: { ...bucket, activeTabId: tabId },
        },
      }
    })
  },

  addTab: (workspaceId) => {
    get().ensureWorkspace(workspaceId)
    const bucket = get().byWorkspaceId[workspaceId]
    if (!bucket) return
    const tab = newAgentTab(bucket.tabs.length + 1)
    set((s) => ({
      byWorkspaceId: {
        ...s.byWorkspaceId,
        [workspaceId]: {
          tabs: [...bucket.tabs, tab],
          activeTabId: tab.id,
        },
      },
    }))
  },

  closeTab: (workspaceId, tabId) => {
    const bucket = get().byWorkspaceId[workspaceId]
    if (!bucket || bucket.tabs.length <= 1) return

    const tabs = bucket.tabs.filter((t) => t.id !== tabId)
    const nextActive =
      bucket.activeTabId === tabId ? (tabs[0]?.id ?? null) : bucket.activeTabId

    set((s) => ({
      byWorkspaceId: {
        ...s.byWorkspaceId,
        [workspaceId]: { tabs, activeTabId: nextActive },
      },
    }))
  },

  renameTab: (workspaceId, tabId, label) => {
    const bucket = get().byWorkspaceId[workspaceId]
    if (!bucket) return
    const tab = bucket.tabs.find((t) => t.id === tabId)
    if (!tab) return
    const trimmed = label.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : tab.label

    set((s) => ({
      byWorkspaceId: {
        ...s.byWorkspaceId,
        [workspaceId]: {
          ...bucket,
          tabs: bucket.tabs.map((t) => (t.id === tabId ? { ...t, label: nextLabel } : t)),
        },
      },
    }))
  },
}))
