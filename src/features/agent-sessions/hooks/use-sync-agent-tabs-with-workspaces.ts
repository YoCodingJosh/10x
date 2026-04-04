import { useLayoutEffect, useRef } from 'react'

import { useWorkspacesQuery } from '@/features/workspaces/hooks/use-workspaces'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useWorktreeTerminalsStore } from '@/stores/worktree-terminals-store'

/**
 * Keeps agent tab buckets aligned with the workspace list and loads saved tabs from
 * electron-store once on first successful workspace fetch.
 */
export function useSyncAgentTabsWithWorkspaces() {
  const { data: workspaces, isSuccess } = useWorkspacesQuery()
  const diskHydrateScheduledRef = useRef(false)

  useLayoutEffect(() => {
    if (!isSuccess || workspaces === undefined) return

    const ids = new Set(workspaces.map((w) => w.id))
    useWorktreeTerminalsStore.getState().pruneToWorkspaces(ids)

    if (!diskHydrateScheduledRef.current) {
      diskHydrateScheduledRef.current = true
      void window.mux.store.getAgentTabs().then((raw) => {
        useAgentTabsStore.getState().hydrateFromDisk(ids, raw)
      })
      return
    }

    const { pruneToValidWorkspaceIds, ensureWorkspace } = useAgentTabsStore.getState()
    pruneToValidWorkspaceIds(ids)
    for (const w of workspaces) ensureWorkspace(w.id)
  }, [isSuccess, workspaces])
}
