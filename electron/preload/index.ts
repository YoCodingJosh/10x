import { contextBridge, ipcRenderer } from 'electron'

type WorkspaceEntry = { id: string; path: string; label: string }

type PtyCreateOpts = {
  sessionId: string
  cwd: string
  cols: number
  rows: number
  kind?: 'claude' | 'shell'
}

type PtyCreateResult =
  | { ok: true }
  | { ok: false; error: string }

type GitClassifyResult =
  | { isRepo: false }
  | { isRepo: true; toplevel: string; commonDir: string }

type CreateWorktreeResult =
  | { ok: true; worktreePath: string; branch: string }
  | { ok: false; error: string }

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
  git: {
    classify: (cwd: string): Promise<GitClassifyResult> =>
      ipcRenderer.invoke('git:classify', cwd),
    createWorktree: (args: {
      repoCwd: string
      worktreeName: string
    }): Promise<CreateWorktreeResult> => ipcRenderer.invoke('git:createWorktree', args),
  },
  pty: {
    create: (opts: PtyCreateOpts): Promise<PtyCreateResult> =>
      ipcRenderer.invoke('pty:create', opts),
    write: (sessionId: string, data: string): void => ipcRenderer.send('pty:write', sessionId, data),
    resize: (sessionId: string, cols: number, rows: number): void =>
      ipcRenderer.send('pty:resize', sessionId, cols, rows),
    kill: (sessionId: string): Promise<boolean> => ipcRenderer.invoke('pty:kill', sessionId),
    onData: (handler: (payload: { sessionId: string; data: string }) => void): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { sessionId: string; data: string },
      ) => handler(payload)
      ipcRenderer.on('pty:data', listener)
      return () => ipcRenderer.removeListener('pty:data', listener)
    },
    onExit: (
      handler: (payload: {
        sessionId: string
        exitCode: number
        signal?: number
      }) => void,
    ): (() => void) => {
      const listener = (
        _event: Electron.IpcRendererEvent,
        payload: { sessionId: string; exitCode: number; signal?: number },
      ) => handler(payload)
      ipcRenderer.on('pty:exit', listener)
      return () => ipcRenderer.removeListener('pty:exit', listener)
    },
  },
}

contextBridge.exposeInMainWorld('mux', api)
