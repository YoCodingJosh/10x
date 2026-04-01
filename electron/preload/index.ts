import { contextBridge, ipcRenderer } from 'electron'

type WorkspaceEntry = { id: string; path: string; label: string }

const api = {
  store: {
    getWorkspaces: (): Promise<WorkspaceEntry[]> =>
      ipcRenderer.invoke('store:get', 'workspaces'),
    setWorkspaces: (workspaces: WorkspaceEntry[]): Promise<boolean> =>
      ipcRenderer.invoke('store:set', 'workspaces', workspaces),
  },
  dialog: {
    pickWorkspace: (): Promise<string | null> =>
      ipcRenderer.invoke('dialog:pickWorkspace'),
  },
}

contextBridge.exposeInMainWorld('mux', api)
