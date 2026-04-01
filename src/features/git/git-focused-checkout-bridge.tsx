import { useEffect } from 'react'

import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'

/**
 * Single timer for focused-checkout git state. Mount once next to app shell root.
 */
export function GitFocusedCheckoutBridge() {
  const focusCwd = useGitCwdForVisibleWorkspace()

  useEffect(() => {
    useGitFocusedCheckoutStore.getState().syncFocusCwd(focusCwd)
  }, [focusCwd])

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
