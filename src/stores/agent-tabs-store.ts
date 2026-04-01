import { create } from 'zustand'

import { normalizeGitCwdKey } from '@/features/git/normalize-git-cwd'
import { scheduleFocusVisibleMuxXterm } from '@/lib/focus-mux-xterm'
import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import { useTerminalScopeStore } from '@/stores/terminal-scope-store'
import { useWorktreeTerminalsStore } from '@/stores/worktree-terminals-store'

export type AgentTab = {
  id: string
  label: string
  /** Git worktree path when this agent runs outside `workspace.path`. */
  agentPath?: string
}

type Bucket = { tabs: AgentTab[]; activeTabId: string | null }

function newAgentTab(index: number): AgentTab {
  return { id: crypto.randomUUID(), label: `Agent ${index}` }
}

function initialBucket(): Bucket {
  return { tabs: [], activeTabId: null }
}

type AgentTabsState = {
  byWorkspaceId: Record<string, Bucket>
  ensureWorkspace: (workspaceId: string) => void
  purgeWorkspace: (workspaceId: string) => void
  pruneToValidWorkspaceIds: (validIds: Set<string>) => void
  setActiveTab: (workspaceId: string, tabId: string) => void
  addTab: (
    workspaceId: string,
    opts?: { agentPath?: string; label?: string; skipAgentFocus?: boolean },
  ) => void
  closeTab: (workspaceId: string, tabId: string) => void
  /** Close the agent tab whose worktree path matches (e.g. after removing the worktree on disk). */
  closeTabByAgentPath: (workspaceId: string, agentPath: string) => boolean
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
    useWorktreeTerminalsStore.getState().purgeWorkspace(workspaceId)
    useGlobalTerminalsStore.getState().purgeWorkspace(workspaceId)
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

  addTab: (workspaceId, opts) => {
    get().ensureWorkspace(workspaceId)
    const bucket = get().byWorkspaceId[workspaceId]
    if (!bucket) return
    const tab = newAgentTab(Math.max(1, bucket.tabs.length + 1))
    if (opts?.label?.trim()) {
      tab.label = opts.label.trim()
    }
    if (opts?.agentPath) {
      tab.agentPath = opts.agentPath
    }

    if (!opts?.skipAgentFocus) {
      useTerminalScopeStore
        .getState()
        .setScope(workspaceId, opts?.agentPath ? 'agent' : 'project')
    }

    set((s) => ({
      byWorkspaceId: {
        ...s.byWorkspaceId,
        [workspaceId]: {
          tabs: [...bucket.tabs, tab],
          activeTabId: tab.id,
        },
      },
    }))

    // Skip when restoring worktree tabs in the background so we don’t steal focus on startup.
    if (!opts?.skipAgentFocus) {
      scheduleFocusVisibleMuxXterm('#mux-agent-desk')
    }
  },

  closeTab: (workspaceId, tabId) => {
    const bucket = get().byWorkspaceId[workspaceId]
    if (!bucket) return

    useWorktreeTerminalsStore.getState().purgeAgentTab(workspaceId, tabId)

    const tabs = bucket.tabs.filter((t) => t.id !== tabId)
    const closedIndex = bucket.tabs.findIndex((t) => t.id === tabId)
    let nextActive: string | null
    if (bucket.activeTabId === tabId) {
      if (closedIndex <= 0) {
        nextActive = tabs[0]?.id ?? null
      } else {
        nextActive = tabs[closedIndex - 1]!.id
      }
    } else {
      nextActive = bucket.activeTabId
    }

    set((s) => ({
      byWorkspaceId: {
        ...s.byWorkspaceId,
        [workspaceId]: { tabs, activeTabId: nextActive },
      },
    }))

    scheduleFocusVisibleMuxXterm('#mux-agent-desk')
  },

  closeTabByAgentPath: (workspaceId, agentPath) => {
    const key = normalizeGitCwdKey(agentPath)
    if (!key) return false
    const bucket = get().byWorkspaceId[workspaceId]
    if (!bucket) return false
    const tab = bucket.tabs.find(
      (t) => t.agentPath != null && normalizeGitCwdKey(t.agentPath) === key,
    )
    if (!tab) return false
    get().closeTab(workspaceId, tab.id)
    return true
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
