import { create } from 'zustand'

export type TerminalScope = 'global' | 'project' | 'agent'

const STORAGE_KEY = 'mux.terminalScopeByWorkspace'

function readFromStorage(): Record<string, TerminalScope> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return {}
    const parsed = JSON.parse(raw) as unknown
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) return {}
    const out: Record<string, TerminalScope> = {}
    for (const [k, v] of Object.entries(parsed)) {
      if (v === 'global' || v === 'project' || v === 'agent') {
        out[k] = v
      }
    }
    return out
  } catch {
    return {}
  }
}

function writeToStorage(map: Record<string, TerminalScope>) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* ignore */
  }
}

type State = {
  scopeByWorkspace: Record<string, TerminalScope>
  setScope: (workspaceId: string, scope: TerminalScope) => void
}

export const useTerminalScopeStore = create<State>((set) => ({
  scopeByWorkspace: readFromStorage(),
  setScope: (workspaceId, scope) => {
    set((s) => {
      const merged = { ...s.scopeByWorkspace, [workspaceId]: scope }
      writeToStorage(merged)
      return { scopeByWorkspace: merged }
    })
  },
}))
