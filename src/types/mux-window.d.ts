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
      git: {
        classify: (
          cwd: string,
        ) => Promise<
          | { isRepo: false }
          | { isRepo: true; toplevel: string; commonDir: string }
        >
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
