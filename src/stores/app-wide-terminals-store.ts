import { create } from 'zustand'

export type AppWideShellTab = { id: string; label: string }

type State = {
  /** Shared across all workspaces; cwd is the user home directory. */
  shells: AppWideShellTab[]
  activeShellId: string | null
  bootstrapOnceBySessionId: Record<string, string>
  addShell: (label?: string) => string
  removeShell: (shellId: string) => void
  renameShell: (shellId: string, label: string) => void
  setActiveShell: (shellId: string) => void
  reconcileActive: () => void
  queueBootstrapForSession: (sessionId: string, text: string) => void
  takeBootstrapForSession: (sessionId: string) => string | undefined
}

export const useAppWideTerminalsStore = create<State>((set, get) => ({
  shells: [],
  activeShellId: null,
  bootstrapOnceBySessionId: {},

  addShell: (label) => {
    const list = get().shells
    const tab: AppWideShellTab = {
      id: crypto.randomUUID(),
      label: label?.trim() || `Global ${list.length + 1}`,
    }
    set({
      shells: [...list, tab],
      activeShellId: tab.id,
    })
    return tab.id
  },

  removeShell: (shellId) => {
    const prev = get()
    const list = prev.shells.filter((t) => t.id !== shellId)
    const nextActive =
      list.length === 0 ? null : prev.activeShellId === shellId ? (list[0]?.id ?? null) : prev.activeShellId
    set({
      shells: list,
      activeShellId: nextActive,
    })
  },

  renameShell: (shellId, label) => {
    const list = get().shells
    const tab = list.find((t) => t.id === shellId)
    if (!tab) return
    const trimmed = label.trim()
    const nextLabel = trimmed.length > 0 ? trimmed : tab.label
    set({
      shells: list.map((t) => (t.id === shellId ? { ...t, label: nextLabel } : t)),
    })
  },

  setActiveShell: (shellId) => {
    if (!get().shells.some((t) => t.id === shellId)) return
    set({ activeShellId: shellId })
  },

  reconcileActive: () => {
    const list = get().shells
    if (list.length === 0) {
      set({ activeShellId: null })
      return
    }
    const active = get().activeShellId
    if (active && list.some((t) => t.id === active)) return
    set({ activeShellId: list[0]!.id })
  },

  queueBootstrapForSession: (sessionId, text) => {
    set((s) => ({
      bootstrapOnceBySessionId: { ...s.bootstrapOnceBySessionId, [sessionId]: text },
    }))
  },

  takeBootstrapForSession: (sessionId) => {
    const raw = get().bootstrapOnceBySessionId[sessionId]
    if (raw === undefined) return undefined
    set((s) => {
      const { [sessionId]: _, ...rest } = s.bootstrapOnceBySessionId
      return { bootstrapOnceBySessionId: rest }
    })
    return raw
  },
}))
