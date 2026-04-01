import { create } from 'zustand'

import {
  presentWorkingTreeSummary,
  type WorkingTreePresentation,
} from '@/features/git/describe-working-tree'
import { normalizeGitCwdKey } from '@/features/git/normalize-git-cwd'

type WtResult = Awaited<ReturnType<typeof window.mux.git.workingTreeSummary>>

export type GitFocusedCheckoutLoadState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'not-repo' }
  | { kind: 'ok'; presentation: WorkingTreePresentation }

type GitFocusedCheckoutState = {
  /** Checkout we poll: visible workspace root or active tab worktree path. */
  focusCwd: string | null
  /** Last raw result from `workingTreeSummary` (for quick-action resolution). */
  wt: WtResult | null
  /** `cwd` that `wt` was fetched for (compare with `useGitCwdForVisibleWorkspace()`). */
  wtCwd: string | null
  loadState: GitFocusedCheckoutLoadState
  /** Call when `useGitCwdForVisibleWorkspace` changes. */
  syncFocusCwd: (cwd: string | null) => void
  /** Single IPC poll; use from interval, visibility, or after git mutations. */
  tick: (opts?: { showSpinner?: boolean }) => Promise<void>
}

/**
 * Invalidate slower in-flight summary results (e.g. 4s timer tick started before a git mutation,
 * finishing after a refresh and overwriting fresh `hasOrigin` with stale data).
 */
let focusedCheckoutGitTickSerial = 0

export const useGitFocusedCheckoutStore = create<GitFocusedCheckoutState>((set, get) => ({
  focusCwd: null,
  wt: null,
  wtCwd: null,
  loadState: { kind: 'idle' },

  syncFocusCwd(cwd) {
    if (normalizeGitCwdKey(get().focusCwd) === normalizeGitCwdKey(cwd)) return
    set({
      focusCwd: cwd,
      wt: null,
      wtCwd: null,
      loadState: !cwd ? { kind: 'idle' } : { kind: 'loading' },
    })
    void get().tick({ showSpinner: true })
  },

  tick: async (opts) => {
    const cwd = get().focusCwd
    if (!cwd) {
      set({ wt: null, wtCwd: null, loadState: { kind: 'idle' } })
      return
    }
    const cwdKey = normalizeGitCwdKey(cwd)
    const serial = ++focusedCheckoutGitTickSerial
    if (opts?.showSpinner) {
      set({ loadState: { kind: 'loading' } })
    }
    const r = await window.mux.git.workingTreeSummary(cwd)
    if (normalizeGitCwdKey(get().focusCwd) !== cwdKey) return
    if (serial !== focusedCheckoutGitTickSerial) return

    set({ wt: r, wtCwd: cwd })
    if (!r.isRepo) {
      set({ loadState: { kind: 'not-repo' } })
      return
    }
    set({
      loadState: {
        kind: 'ok',
        presentation: presentWorkingTreeSummary(r.summary),
      },
    })
  },
}))

/** Refresh focused-checkout state after a local git mutation (no loading flash). */
export function refreshFocusedCheckoutGit() {
  return useGitFocusedCheckoutStore.getState().tick({ showSpinner: false })
}
