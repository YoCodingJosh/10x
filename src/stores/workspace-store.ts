import { create } from 'zustand'

export type Workspace = { id: string; path: string; label: string }

type WorkspaceState = {
  workspaces: Workspace[]
  activeWorkspaceId: string | null
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspaceId: (id: string | null) => void
}

export const useWorkspaceStore = create<WorkspaceState>((set) => ({
  workspaces: [],
  activeWorkspaceId: null,
  setWorkspaces: (workspaces) => set({ workspaces }),
  setActiveWorkspaceId: (activeWorkspaceId) => set({ activeWorkspaceId }),
}))
