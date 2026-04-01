declare global {
  interface Window {
    mux: {
      store: {
        getWorkspaces: () => Promise<
          { id: string; path: string; label: string }[]
        >
        setWorkspaces: (
          workspaces: { id: string; path: string; label: string }[],
        ) => Promise<boolean>
      }
      dialog: {
        pickWorkspace: () => Promise<string | null>
      }
      shell: {
        openExternal: (url: string) => Promise<{ ok: true } | { ok: false; error: string }>
        openPathInOsFinder: (fullPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
        openInCursor: (folderPath: string) => Promise<{ ok: true } | { ok: false; error: string }>
      }
      git: {
        openOriginInBrowser: (
          cwd: string,
        ) => Promise<{ ok: true } | { ok: false; error: string }>
        classify: (
          cwd: string,
        ) => Promise<
          | { isRepo: false }
          | { isRepo: true; toplevel: string; commonDir: string }
        >
        remoteOriginStatus: (
          cwd: string,
        ) => Promise<{ isRepo: false } | { isRepo: true; hasOrigin: boolean }>
        createWorktree: (args: {
          repoCwd: string
          worktreeName: string
        }) => Promise<
          | { ok: true; worktreePath: string; branch: string }
          | { ok: false; error: string }
        >
        listRecoverableMuxWorktrees: (repoCwd: string) => Promise<{ path: string; label: string }[]>
        removeMuxWorktree: (
          worktreePath: string,
        ) => Promise<{ ok: true } | { ok: false; error: string }>
        init: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        addAll: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        commit: (args: {
          cwd: string
          message: string
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        push: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        pull: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        workingTreeSummary: (cwd: string) => Promise<
          | { isRepo: false }
          | {
              isRepo: true
              summary: {
                branchLabel: string
                detached: boolean
                upstreamShort: string | null
                ahead: number
                behind: number
                upstreamGone: boolean
                hasOrigin: boolean
                isMuxWorktree: boolean
                stagedCount: number
                unstagedCount: number
                untrackedCount: number
                conflictCount: number
              }
            }
        >
        addRemote: (args: {
          cwd: string
          remoteName: string
          url: string
        }) => Promise<{ ok: true } | { ok: false; error: string }>
      }
      github: {
        deviceStart: () => Promise<
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
        >
        devicePoll: (deviceCode: string) => Promise<
          | { status: 'authorized'; login: string }
          | { status: 'pending' }
          | { status: 'slow_down' }
          | { status: 'error'; error: string }
        >
        getStatus: () => Promise<{ connected: false } | { connected: true; login: string }>
        disconnect: () => Promise<{ ok: true }>
        createRepo: (args: {
          name: string
          description?: string
          private?: boolean
        }) => Promise<
          | { ok: true; clone_url: string; ssh_url: string; html_url: string }
          | { ok: false; error: string }
        >
        createRepoAndLink: (args: {
          cwd: string
          name: string
          description?: string
          private?: boolean
        }) => Promise<
          | { ok: true; html_url: string; clone_url: string; ssh_url: string }
          | { ok: false; error: string }
        >
        openNewRepoPage: () => Promise<{ ok: true }>
        openOAuthAppSettings: () => Promise<{ ok: true }>
        openDeviceHelp: () => Promise<{ ok: true }>
        getCreatePrContext: (
          cwd: string,
        ) => Promise<
          | { applicable: false }
          | { applicable: true; hasOpenPr: boolean; compareUrl: string }
        >
      }
      pty: {
        create: (opts: {
          sessionId: string
          cwd: string
          cols: number
          rows: number
          kind?: 'claude' | 'shell'
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        write: (sessionId: string, data: string) => void
        resize: (sessionId: string, cols: number, rows: number) => void
        kill: (sessionId: string) => Promise<boolean>
        onData: (handler: (payload: { sessionId: string; data: string }) => void) => () => void
        onExit: (
          handler: (payload: {
            sessionId: string
            exitCode: number
            signal?: number
          }) => void,
        ) => () => void
      }
    }
  }
}

export {}
