/**
 * Map known-benign git stderr (empty repo / no HEAD) to copy for side panels.
 * Everything else should stay a real error (e.g. red destructive text).
 */

function norm(s: string): string {
  return s.trim().toLowerCase()
}

/** `git log` when the current branch has zero commits. */
export function friendlyMessageForGitLogFailure(stderr: string): string | null {
  const e = norm(stderr)
  if (e.includes('does not have any commits yet')) {
    return 'No commits yet on this branch. Create your first commit to see history here.'
  }
  return null
}

/** `git diff HEAD` / similar when there is no commit yet (no HEAD). */
export function friendlyMessageForWorkingTreeDiffFailure(stderr: string): string | null {
  const e = norm(stderr)
  if (e.includes("ambiguous argument 'head'") && e.includes('unknown revision')) {
    return 'No commits yet, so there is nothing to compare the working tree against. After your first commit, this view will show changes relative to HEAD.'
  }
  if (e.includes("invalid object name 'head'")) {
    return 'No commits yet, so there is nothing to compare the working tree against. After your first commit, this view will show changes relative to HEAD.'
  }
  return null
}
