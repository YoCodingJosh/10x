import { useLayoutEffect } from 'react'

import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** Drops project-terminal state for workspaces that no longer exist. Does not create shells. */
export function useSyncGlobalTerminalsWithWorkspaces() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)

  useLayoutEffect(() => {
    const ids = new Set(workspaces.map((w) => w.id))
    useGlobalTerminalsStore.getState().pruneToWorkspaces(ids)
  }, [workspaces])
}
