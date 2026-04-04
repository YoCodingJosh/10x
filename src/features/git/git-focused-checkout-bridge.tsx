import { useEffect } from 'react'

import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { useSidePanelStore } from '@/stores/side-panel-store'

/**
 * Single timer for focused-checkout git state. Mount once next to app shell root.
 */
export function GitFocusedCheckoutBridge() {
  const focusCwd = useGitCwdForVisibleWorkspace()
  const loadStateKind = useGitFocusedCheckoutStore((s) => s.loadState.kind)

  useEffect(() => {
    useGitFocusedCheckoutStore.getState().syncFocusCwd(focusCwd)
  }, [focusCwd])

  /** Close diff / history when the focused folder is not a Git repo (or has no cwd). */
  useEffect(() => {
    if (loadStateKind === 'ok' || loadStateKind === 'loading') return
    const panel = useSidePanelStore.getState().active
    if (panel === 'diff' || panel === 'git-graph') {
      useSidePanelStore.getState().close()
    }
  }, [loadStateKind])

  useEffect(() => {
    const tick = () => void useGitFocusedCheckoutStore.getState().tick({ showSpinner: false })
    const interval = setInterval(tick, 4000)
    const onVis = () => {
      if (document.visibilityState === 'visible') tick()
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [])

  return null
}
