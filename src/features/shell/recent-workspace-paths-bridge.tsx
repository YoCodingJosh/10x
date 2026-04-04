import { useEffect } from 'react'

import { touchRecentWorkspacePath } from '@/lib/recent-workspace-paths'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** Records the active workspace path for quick switcher “recent folders”. */
export function RecentWorkspacePathsBridge() {
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const workspaces = useWorkspaceStore((s) => s.workspaces)

  useEffect(() => {
    if (activeWorkspaceId == null) return
    const path = workspaces.find((w) => w.id === activeWorkspaceId)?.path
    if (path) touchRecentWorkspacePath(path)
  }, [activeWorkspaceId, workspaces])

  return null
}
