import { useLayoutEffect } from 'react'

import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** Ensures tab buckets for each saved workspace and drops orphans (runs before paint). */
export function useSyncAgentTabsWithWorkspaces() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)

  useLayoutEffect(() => {
    const ids = new Set(workspaces.map((w) => w.id))
    const { pruneToValidWorkspaceIds, ensureWorkspace } = useAgentTabsStore.getState()
    pruneToValidWorkspaceIds(ids)
    for (const w of workspaces) ensureWorkspace(w.id)
  }, [workspaces])
}
