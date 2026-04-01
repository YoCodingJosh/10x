import { useLayoutEffect } from 'react'

import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** Prunes orphaned workspace keys and ensures each workspace has at least one project shell. */
export function useSyncGlobalTerminalsWithWorkspaces() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)

  useLayoutEffect(() => {
    const ids = new Set(workspaces.map((w) => w.id))
    useGlobalTerminalsStore.getState().pruneToWorkspaces(ids)
    for (const w of workspaces) {
      useGlobalTerminalsStore.getState().ensureDefaultShells(w.id)
    }
  }, [workspaces])
}
