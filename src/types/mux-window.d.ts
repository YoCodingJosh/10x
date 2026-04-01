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
