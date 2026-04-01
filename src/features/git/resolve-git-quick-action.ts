/** Primary action for the focused checkout quick control (status bar / rail). */
export type GitQuickActionKind = 'init' | 'publish' | 'pull' | 'stage' | 'commit' | 'push'

type Wt =
  | { isRepo: false }
  | {
      isRepo: true
      summary: {
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
 * Uses `workingTreeSummary` only (includes `hasOrigin`, upstream, detached).
 * Local changes win over Publish; Push is offered when `origin` exists but there is no upstream
 * yet (first push links the branch), not only when `ahead > 0`.
 */
export function resolveGitQuickAction(wt: Wt | null): 'loading' | GitQuickActionKind | 'idle' {
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
  return 'idle'
}
