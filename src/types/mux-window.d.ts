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
    }
  }
}

export {}
