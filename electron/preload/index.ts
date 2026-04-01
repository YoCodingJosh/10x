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

type GitRemoteOriginStatus = { isRepo: false } | { isRepo: true; hasOrigin: boolean }

type GitWorkingTreeSummary = {
  branchLabel: string
  detached: boolean
  upstreamShort: string | null
  ahead: number
  behind: number
  upstreamGone: boolean
  hasOrigin: boolean
  isMuxWorktree: boolean
  isOriginDefaultBranch: boolean
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  conflictCount: number
}

type GitWorkingTreeSummaryResult =
  | { isRepo: false }
  | { isRepo: true; summary: GitWorkingTreeSummary }

type CreateWorktreeResult =
  | { ok: true; worktreePath: string; branch: string }
  | { ok: false; error: string }

type RecoverableWorktree = { path: string; label: string }

type RemoveMuxWorktreeResult = { ok: true } | { ok: false; error: string }

type GitOpenOriginResult = { ok: true } | { ok: false; error: string }

type GitSimpleResult = { ok: true } | { ok: false; error: string }

type GithubDeviceStart =
  | {
      ok: true
      userCode: string
      verificationUri: string
      verificationUriComplete: string
      deviceCode: string
      interval: number
      expiresIn: number
    }
  | { ok: false; error: string }

type GithubPoll =
  | { status: 'authorized'; login: string }
  | { status: 'pending' }
  | { status: 'slow_down' }
  | { status: 'error'; error: string }

type GithubStatus = { connected: false } | { connected: true; login: string }

type GithubCreateRepo =
  | { ok: true; clone_url: string; ssh_url: string; html_url: string }
  | { ok: false; error: string }

type ShellResult = { ok: true } | { ok: false; error: string }

type GithubCreatePrContext =
  | { applicable: false }
  | { applicable: true; hasOpenPr: boolean; hasMergedPr: boolean; compareUrl: string }

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
  shell: {
    openExternal: (url: string): Promise<ShellResult> => ipcRenderer.invoke('shell:openExternal', url),
    openPathInOsFinder: (fullPath: string): Promise<ShellResult> =>
      ipcRenderer.invoke('shell:openPathInOsFinder', fullPath),
    openInCursor: (folderPath: string): Promise<ShellResult> =>
      ipcRenderer.invoke('shell:openInCursor', folderPath),
  },
  git: {
    openOriginInBrowser: (cwd: string): Promise<GitOpenOriginResult> =>
      ipcRenderer.invoke('git:openOriginInBrowser', cwd),
    classify: (cwd: string): Promise<GitClassifyResult> =>
      ipcRenderer.invoke('git:classify', cwd),
    remoteOriginStatus: (cwd: string): Promise<GitRemoteOriginStatus> =>
      ipcRenderer.invoke('git:remoteOriginStatus', cwd),
    createWorktree: (args: {
      repoCwd: string
      worktreeName: string
    }): Promise<CreateWorktreeResult> => ipcRenderer.invoke('git:createWorktree', args),
    listRecoverableMuxWorktrees: (repoCwd: string): Promise<RecoverableWorktree[]> =>
      ipcRenderer.invoke('git:listRecoverableMuxWorktrees', repoCwd),
    removeMuxWorktree: (worktreePath: string): Promise<RemoveMuxWorktreeResult> =>
      ipcRenderer.invoke('git:removeMuxWorktree', worktreePath),
    cleanupMergedMuxWorktree: (cwd: string): Promise<RemoveMuxWorktreeResult> =>
      ipcRenderer.invoke('git:cleanupMergedMuxWorktree', cwd),
    init: (cwd: string): Promise<GitSimpleResult> => ipcRenderer.invoke('git:init', cwd),
    addAll: (cwd: string): Promise<GitSimpleResult> => ipcRenderer.invoke('git:addAll', cwd),
    commit: (args: { cwd: string; message: string }): Promise<GitSimpleResult> =>
      ipcRenderer.invoke('git:commit', args),
    push: (cwd: string): Promise<GitSimpleResult> => ipcRenderer.invoke('git:push', cwd),
    pull: (cwd: string): Promise<GitSimpleResult> => ipcRenderer.invoke('git:pull', cwd),
    fetch: (cwd: string): Promise<GitSimpleResult> => ipcRenderer.invoke('git:fetch', cwd),
    workingTreeSummary: (cwd: string): Promise<GitWorkingTreeSummaryResult> =>
      ipcRenderer.invoke('git:workingTreeSummary', cwd),
    addRemote: (args: { cwd: string; remoteName: string; url: string }): Promise<GitSimpleResult> =>
      ipcRenderer.invoke('git:addRemote', args),
  },
  github: {
    deviceStart: (): Promise<GithubDeviceStart> => ipcRenderer.invoke('github:deviceStart'),
    devicePoll: (deviceCode: string): Promise<GithubPoll> =>
      ipcRenderer.invoke('github:devicePoll', deviceCode),
    getStatus: (): Promise<GithubStatus> => ipcRenderer.invoke('github:getStatus'),
    disconnect: (): Promise<{ ok: true }> => ipcRenderer.invoke('github:disconnect'),
    createRepo: (args: {
      name: string
      description?: string
      private?: boolean
    }): Promise<GithubCreateRepo> => ipcRenderer.invoke('github:createRepo', args),
    createRepoAndLink: (args: {
      cwd: string
      name: string
      description?: string
      private?: boolean
    }): Promise<
      | { ok: true; html_url: string; clone_url: string; ssh_url: string }
      | { ok: false; error: string }
    > => ipcRenderer.invoke('github:createRepoAndLink', args),
    openNewRepoPage: (): Promise<{ ok: true }> => ipcRenderer.invoke('github:openNewRepoPage'),
    openOAuthAppSettings: (): Promise<{ ok: true }> =>
      ipcRenderer.invoke('github:openOAuthAppSettings'),
    openDeviceHelp: (): Promise<{ ok: true }> => ipcRenderer.invoke('github:openDeviceHelp'),
    getCreatePrContext: (cwd: string): Promise<GithubCreatePrContext> =>
      ipcRenderer.invoke('github:getCreatePrContext', cwd),
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
