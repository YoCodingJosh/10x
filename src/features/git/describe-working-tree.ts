/** Shape returned from `git:workingTreeSummary` (mirrors main process). */
export type GitWorkingTreeSummaryDTO = {
  branchLabel: string
  detached: boolean
  upstreamShort: string | null
  ahead: number
  behind: number
  upstreamGone: boolean
  hasOrigin: boolean
  isMuxWorktree: boolean
  stagedCount: number
  unstagedCount: number
  untrackedCount: number
  conflictCount: number
}

export type WorkingTreePresentation = {
  /** e.g. `main` or `abc1234` (when detached, short hash fragment). */
  branchDisplay: string
  detached: boolean
  /** Ordered lines below the branch (conflicts → changes → remote → clean). */
  rows: { text: string; className: string }[]
}

const destructive = 'text-destructive'
const warn = 'text-amber-600 dark:text-amber-400'
const ok = 'text-emerald-600 dark:text-emerald-400'
const info = 'text-sky-600 dark:text-sky-400'
const behindC = 'text-orange-600 dark:text-orange-400'
const muted = 'text-muted-foreground'

/** Clean, fully synced branch on a Mux worktree: ready to open compare / PR in browser. */
export function summaryEligibleForCreatePrFetch(s: GitWorkingTreeSummaryDTO): boolean {
  return (
    s.isMuxWorktree &&
    s.hasOrigin &&
    !s.detached &&
    s.conflictCount === 0 &&
    s.stagedCount === 0 &&
    s.unstagedCount === 0 &&
    s.untrackedCount === 0 &&
    s.upstreamShort != null &&
    s.ahead === 0 &&
    s.behind === 0 &&
    !s.upstreamGone
  )
}

function upstreamLabel(u: string | null): string {
  if (!u) return 'remote'
  return u.replace(/^refs\/remotes\//, '')
}

/**
 * Turns parsed `git status -sb` data into user-facing copy + Tailwind color classes.
 */
export function presentWorkingTreeSummary(s: GitWorkingTreeSummaryDTO): WorkingTreePresentation {
  const branchDisplay = s.branchLabel
  const detached = s.detached
  const rows: { text: string; className: string }[] = []
  const ul = s.upstreamShort ? upstreamLabel(s.upstreamShort) : null

  if (s.conflictCount > 0) {
    rows.push({
      text:
        s.conflictCount === 1
          ? '1 file in merge conflict — resolve before continuing'
          : `${s.conflictCount} files in merge conflict — resolve before continuing`,
      className: destructive,
    })
    return { branchDisplay, detached, rows }
  }

  const dirtyBits: string[] = []
  if (s.stagedCount > 0) {
    dirtyBits.push(s.stagedCount === 1 ? '1 staged change' : `${s.stagedCount} staged changes`)
  }
  if (s.unstagedCount > 0) {
    dirtyBits.push(
      s.unstagedCount === 1 ? '1 unstaged change' : `${s.unstagedCount} unstaged changes`,
    )
  }
  if (s.untrackedCount > 0) {
    dirtyBits.push(
      s.untrackedCount === 1 ? '1 untracked file' : `${s.untrackedCount} untracked files`,
    )
  }
  const dirty = dirtyBits.length > 0

  if (dirty) {
    rows.push({ text: dirtyBits.join(' · '), className: warn })
  }

  if (s.upstreamGone && ul) {
    rows.push({
      text: `Upstream ${ul} no longer exists on the remote`,
      className: destructive,
    })
  } else if (ul && !s.upstreamGone) {
    if (s.behind > 0 && s.ahead > 0) {
      rows.push({
        text: `Diverged from ${ul} — ${s.ahead} ahead, ${s.behind} behind`,
        className: warn,
      })
    } else if (s.behind > 0) {
      rows.push({
        text: s.behind === 1 ? `1 commit behind ${ul}` : `${s.behind} commits behind ${ul}`,
        className: behindC,
      })
    } else if (s.ahead > 0) {
      rows.push({
        text: s.ahead === 1 ? `1 commit ahead of ${ul}` : `${s.ahead} commits ahead of ${ul}`,
        className: info,
      })
    } else if (!dirty) {
      rows.push({
        text: `Working tree clean — up to date with ${ul}`,
        className: ok,
      })
      return { branchDisplay, detached, rows }
    }
  }

  if (!dirty && !ul && !s.detached) {
    rows.push({
      text: s.hasOrigin
        ? 'Working tree clean — no upstream (push to link this branch to the remote)'
        : 'Working tree clean — no upstream (publish or push to link a remote)',
      className: muted,
    })
    return { branchDisplay, detached, rows }
  }

  if (!dirty && s.detached) {
    rows.push({
      text: 'Working tree clean — detached HEAD',
      className: muted,
    })
    return { branchDisplay, detached, rows }
  }

  if (dirty) {
    rows.push({
      text: 'Uncommitted changes in this checkout',
      className: muted,
    })
  } else if (!rows.some((r) => r.className === ok)) {
    rows.push({ text: 'Working tree clean', className: ok })
  }

  return { branchDisplay, detached, rows }
}
