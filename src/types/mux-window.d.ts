declare global {
  interface Window {
    mux: {
      app: {
        getHomeDir: () => Promise<string>
      }
      store: {
        getWorkspaces: () => Promise<{ id: string; path: string; label: string }[]>
        setWorkspaces: (workspaces: { id: string; path: string; label: string }[]) => Promise<boolean>
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
        openOriginInBrowser: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        classify: (cwd: string) => Promise<{ isRepo: false } | { isRepo: true; toplevel: string; commonDir: string }>
        remoteOriginStatus: (cwd: string) => Promise<{ isRepo: false } | { isRepo: true; hasOrigin: boolean }>
        createWorktree: (args: {
          repoCwd: string
          worktreeName: string
        }) => Promise<{ ok: true; worktreePath: string; branch: string } | { ok: false; error: string }>
        listRecoverableMuxWorktrees: (repoCwd: string) => Promise<{ path: string; label: string }[]>
        removeMuxWorktree: (worktreePath: string) => Promise<{ ok: true } | { ok: false; error: string }>
        cleanupMergedMuxWorktree: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        init: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        addAll: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        commit: (args: { cwd: string; message: string }) => Promise<{ ok: true } | { ok: false; error: string }>
        push: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        pull: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
        fetch: (cwd: string) => Promise<{ ok: true } | { ok: false; error: string }>
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
                isOriginDefaultBranch: boolean
                stagedCount: number
                unstagedCount: number
                untrackedCount: number
                conflictCount: number
              }
            }
        >
        addRemote: (args: { cwd: string; remoteName: string; url: string }) => Promise<{ ok: true } | { ok: false; error: string }>
        diff: (args: {
          cwd: string
          mode: 'unstaged' | 'staged' | 'all'
        }) => Promise<{ ok: true; text: string } | { ok: false; error: string }>
        logGraph: (cwd: string) => Promise<
          | {
              ok: true
              commits: {
                hash: string
                parents: string[]
                subject: string
                authorName: string
                dateIso: string
                refs: string
              }[]
            }
          | { ok: false; error: string }
        >
        commitInspect: (args: { cwd: string; hash: string }) => Promise<
          | {
              ok: true
              hash: string
              shortHash: string
              subject: string
              authorName: string
              dateIso: string
              files: {
                path: string
                status: 'added' | 'modified' | 'deleted' | 'renamed'
                oldPath?: string
                additions: number
                deletions: number
              }[]
            }
          | { ok: false; error: string }
        >
        commitDiff: (args: {
          cwd: string
          hash: string
        }) => Promise<{ ok: true; text: string } | { ok: false; error: string }>
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
        devicePoll: (
          deviceCode: string,
        ) => Promise<
          { status: 'authorized'; login: string } | { status: 'pending' } | { status: 'slow_down' } | { status: 'error'; error: string }
        >
        getStatus: () => Promise<{ connected: false } | { connected: true; login: string }>
        disconnect: () => Promise<{ ok: true }>
        createRepo: (args: {
          name: string
          description?: string
          private?: boolean
        }) => Promise<{ ok: true; clone_url: string; ssh_url: string; html_url: string } | { ok: false; error: string }>
        createRepoAndLink: (args: {
          cwd: string
          name: string
          description?: string
          private?: boolean
        }) => Promise<{ ok: true; html_url: string; clone_url: string; ssh_url: string } | { ok: false; error: string }>
        openNewRepoPage: () => Promise<{ ok: true }>
        openOAuthAppSettings: () => Promise<{ ok: true }>
        openDeviceHelp: () => Promise<{ ok: true }>
        getCreatePrContext: (
          cwd: string,
        ) => Promise<{ applicable: false } | { applicable: true; hasOpenPr: boolean; hasMergedPr: boolean; compareUrl: string }>
      }
      claudeCode: {
        /** Resolves after probing PATH (and common install locations) from the main process. */
        isCliInstalled: () => Promise<boolean>
      }
      agent: {
        onStateChange: (
          handler: (payload: { sessionId: string; state: string; needsAttention?: boolean }) => void,
        ) => () => void
        /** Tell the main process the user focused this agent tab (keeps dock badge in sync with blue dots). */
        dismissAttention: (sessionId: string) => void
        /** Active agent tab in the visible workspace (`workspaceId:tabId`); suppresses OS notifications, dock badge, and tab dots for that session. */
        setFocusedSession: (sessionId: string | null) => void
      }
      pty: {
        create: (opts: {
          sessionId: string
          cwd: string
          cols: number
          rows: number
          kind?: 'claude' | 'shell'
          label?: string
          notificationWorkspace?: string
          notificationAgent?: string
        }) => Promise<{ ok: true } | { ok: false; error: string }>
        write: (sessionId: string, data: string) => void
        resize: (sessionId: string, cols: number, rows: number) => void
        kill: (sessionId: string) => Promise<boolean>
        onData: (handler: (payload: { sessionId: string; data: string }) => void) => () => void
        onExit: (handler: (payload: { sessionId: string; exitCode: number; signal?: number }) => void) => () => void
      }
      updater: {
        getAppVersion: () => Promise<string>
        checkForUpdates: () => Promise<
          | { ok: true; isPackaged: false; currentVersion: string }
          | {
              ok: true
              isPackaged: true
              currentVersion: string
              updateAvailable: boolean
              latestVersion?: string
            }
          | { ok: false; currentVersion: string; error: string }
        >
        downloadUpdate: () => Promise<{ ok: true } | { ok: false; error: string }>
        quitAndInstall: () => Promise<{ ok: true } | { ok: false; error: string }>
        onDownloadProgress: (
          handler: (payload: { percent: number; transferred: number; total: number }) => void,
        ) => () => void
        onUpdateDownloaded: (handler: () => void) => () => void
        onError: (handler: (payload: { message: string }) => void) => () => void
      }
    }
  }
}

export {}
