import { contextBridge, ipcRenderer } from 'electron'

const api = {
  store: {
    getWorkspaces: (): Promise<WorkspaceEntry[]> =>
      ipcRenderer.invoke('store:get', 'workspaces'),
    setWorkspaces: (workspaces: WorkspaceEntry[]): Promise<boolean> =>
      ipcRenderer.invoke('store:set', 'workspaces', workspaces),
  },
}

contextBridge.exposeInMainWorld('mux', api)

declare global {
  interface Window {
    mux: typeof api
  }
}
