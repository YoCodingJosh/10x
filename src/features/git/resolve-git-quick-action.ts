import type { MuxWorktreeGitHubFollowUp } from '@/stores/git-focused-checkout-store'

/** Primary action for the focused checkout quick control (status bar / rail). */
export type GitQuickActionKind =
  | 'init'
  | 'publish'
  | 'pull'
  | 'stage'
  | 'commit'
  | 'push'
  | 'createPr'
  | 'deleteMergedBranch'

type Wt =
  | { isRepo: false }
  | {
      isRepo: true
      summary: {
        isMuxWorktree: boolean
        isOriginDefaultBranch: boolean
        hasOrigin: boolean
        detached: boolean
        upstreamShort: string | null
        ahead: number
        behind: number
        stagedCount: number
        unstagedCount: number
        untrackedCount: number
      }
    }

/**
 * Uses `workingTreeSummary` and optional `muxWorktreeFollowUp` from the focused-checkout store
 * (GitHub PR compare vs cleanup after a merged PR).
 */
export function resolveGitQuickAction(
  wt: Wt | null,
  muxWorktreeFollowUp?: MuxWorktreeGitHubFollowUp | null,
): 'loading' | GitQuickActionKind | 'idle' {
  if (wt === null) return 'loading'
  if (!wt.isRepo) return 'init'

  const s = wt.summary
  if (s.behind > 0) return 'pull'
  /** Unstaged ≠ in the index; offer Stage (add) before Commit. */
  if (s.untrackedCount > 0 || s.unstagedCount > 0) return 'stage'
  if (s.stagedCount > 0) return 'commit'
  if (!s.hasOrigin) return 'publish'
  if (s.ahead > 0) return 'push'
  if (!s.detached && s.upstreamShort == null) return 'push'
  if (muxWorktreeFollowUp?.kind === 'deleteMergedBranch') {
    if (s.isMuxWorktree) return 'deleteMergedBranch'
    return 'idle'
  }
  if (muxWorktreeFollowUp?.kind === 'createPr') {
    if (s.isMuxWorktree && !s.isOriginDefaultBranch) return 'createPr'
    return 'idle'
  }
  return 'idle'
}
