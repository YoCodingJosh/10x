import { useEffect } from 'react'

import { useWorkspaceById } from '@/features/workspaces/hooks/use-workspace-by-id'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { refreshFocusedCheckoutGit } from '@/stores/git-focused-checkout-store'

/**
 * When the visible workspace changes, refresh remote-tracking refs for that folder’s repo.
 * Runs quietly (no status-activity row); failures are ignored (offline, not a repo, no origin).
 */
export function WorkspaceFetchOnChangeBridge() {
  const visibleId = useVisibleWorkspaceId()
  const ws = useWorkspaceById(visibleId ?? '')
  const path = ws?.path

  useEffect(() => {
    if (!visibleId || !path) return

    let cancelled = false
    void (async () => {
      const r = await window.mux.git.fetch(path)
      if (cancelled || !r.ok) return
      await refreshFocusedCheckoutGit()
    })()

    return () => {
      cancelled = true
    }
  }, [visibleId, path])

  return null
}
