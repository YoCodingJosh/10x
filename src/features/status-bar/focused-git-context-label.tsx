import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'

/**
 * Compact line for the status bar: current branch / worktree context for the Git quick action.
 */
export function FocusedGitContextLabel() {
  const cwd = useGitFocusedCheckoutStore((s) => s.focusCwd)
  const loadState = useGitFocusedCheckoutStore((s) => s.loadState)
  const wt = useGitFocusedCheckoutStore((s) => s.wt)

  if (!cwd) {
    return <span className="min-w-0 max-w-[min(42vw,320px)] shrink truncate text-muted-foreground/90">No folder</span>
  }

  if (loadState.kind === 'loading' || wt === null) {
    return <span className="min-w-0 max-w-[min(42vw,320px)] shrink truncate text-muted-foreground/90">Git…</span>
  }

  if (loadState.kind === 'not-repo') {
    return <span className="min-w-0 max-w-[min(42vw,320px)] shrink truncate text-muted-foreground/90">Not a Git repo</span>
  }

  if (loadState.kind !== 'ok' || !wt.isRepo) {
    return <span className="min-w-0 shrink truncate text-muted-foreground/90">—</span>
  }

  const { branchLabel, isMuxWorktree } = wt.summary
  const branch = branchLabel || '—'
  const suffix = isMuxWorktree ? ' · worktree' : ''

  return (
    <span className="min-w-0 max-w-[min(42vw,320px)] shrink truncate font-medium text-foreground/90" title={cwd}>
      {branch}
      {suffix}
    </span>
  )
}
