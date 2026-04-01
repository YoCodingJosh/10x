import { useCallback, useEffect, useState } from 'react'

import {
  presentWorkingTreeSummary,
  type WorkingTreePresentation,
} from '@/features/git/describe-working-tree'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'

type LoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'not-repo' }
  | { kind: 'ok'; presentation: WorkingTreePresentation }

/** Polls `git status` for the checkout tied to the focused workspace / active agent tab. */
export function useGitWorkingTreeSummary() {
  const cwd = useGitCwdForVisibleWorkspace()
  const [state, setState] = useState<LoadState>({ kind: 'idle' })

  const fetchSummary = useCallback(async (showSpinner: boolean) => {
    if (!cwd) {
      setState({ kind: 'idle' })
      return
    }
    if (showSpinner) {
      setState({ kind: 'loading' })
    }
    const r = await window.mux.git.workingTreeSummary(cwd)
    if (!r.isRepo) {
      setState({ kind: 'not-repo' })
      return
    }
    setState({
      kind: 'ok',
      presentation: presentWorkingTreeSummary(r.summary),
    })
  }, [cwd])

  useEffect(() => {
    let cancelled = false
    async function tick(showSpinner: boolean) {
      if (!cwd) {
        setState({ kind: 'idle' })
        return
      }
      if (showSpinner) {
        setState({ kind: 'loading' })
      }
      const r = await window.mux.git.workingTreeSummary(cwd)
      if (cancelled) return
      if (!r.isRepo) {
        setState({ kind: 'not-repo' })
        return
      }
      setState({
        kind: 'ok',
        presentation: presentWorkingTreeSummary(r.summary),
      })
    }
    void tick(true)
    const interval = setInterval(() => void tick(false), 4000)
    const onVis = () => {
      if (document.visibilityState === 'visible') void tick(false)
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [cwd])

  const refresh = useCallback(() => void fetchSummary(true), [fetchSummary])

  return { cwd, state, refresh }
}
