import { useCallback } from 'react'

import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'

/**
 * Focused-checkout git line in the workspaces rail. Backed by the single shared poll
 * (`GitFocusedCheckoutBridge` + `useGitFocusedCheckoutStore`).
 */
export function useGitWorkingTreeSummary() {
  const cwd = useGitFocusedCheckoutStore((s) => s.focusCwd)
  const state = useGitFocusedCheckoutStore((s) => s.loadState)
  const refresh = useCallback(
    () => void useGitFocusedCheckoutStore.getState().tick({ showSpinner: true }),
    [],
  )

  return { cwd, state, refresh }
}
