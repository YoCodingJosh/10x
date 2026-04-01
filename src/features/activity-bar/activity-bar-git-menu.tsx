import { useCallback, useState } from 'react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { summaryEligibleForCreatePrFetch } from '@/features/git/describe-working-tree'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { PublishGithubDialog } from '@/features/github/publish-github-dialog'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { refreshFocusedCheckoutGit } from '@/stores/git-focused-checkout-store'
import { cn } from '@/lib/utils'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranch,
  GitBranchPlus,
  GitCommitHorizontal,
  GitPullRequestCreateArrow,
  Github,
  PlusSquare,
  RefreshCw,
  Trash2,
} from 'lucide-react'

export function ActivityBarGitMenu() {
  const gitCwd = useGitCwdForVisibleWorkspace()
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const [menuOpen, setMenuOpen] = useState(false)
  const [isRepo, setIsRepo] = useState<boolean | null>(null)
  const [hasOrigin, setHasOrigin] = useState<boolean | null>(null)
  /** Mux worktree GitHub follow-up: open PR or clean up after merge */
  const [prFollowUpMenu, setPrFollowUpMenu] = useState<
    { kind: 'createPr'; compareUrl: string } | { kind: 'deleteMerged' } | null
  >(null)
  const [busy, setBusy] = useState(false)
  const [commitOpen, setCommitOpen] = useState(false)
  const [commitMessage, setCommitMessage] = useState('')
  const [publishOpen, setPublishOpen] = useState(false)

  const refreshRepoState = useCallback(async () => {
    if (!gitCwd) {
      setIsRepo(null)
      setHasOrigin(null)
      setPrFollowUpMenu(null)
      return
    }
    setPrFollowUpMenu(null)
    const wt = await window.mux.git.workingTreeSummary(gitCwd)
    if (!wt.isRepo) {
      setIsRepo(false)
      setHasOrigin(null)
      return
    }
    setIsRepo(true)
    setHasOrigin(wt.summary.hasOrigin)
    if (!wt.summary.hasOrigin) return

    const pr = await window.mux.github.getCreatePrContext(gitCwd)
    if (pr.applicable && !pr.hasOpenPr) {
      if (pr.hasMergedPr) {
        if (wt.summary.isMuxWorktree) setPrFollowUpMenu({ kind: 'deleteMerged' })
      } else if (summaryEligibleForCreatePrFetch(wt.summary)) {
        setPrFollowUpMenu({ kind: 'createPr', compareUrl: pr.compareUrl })
      }
    }
  }, [gitCwd])

  const onMenuOpenChange = useCallback(
    (open: boolean) => {
      setMenuOpen(open)
      if (open && gitCwd) {
        void runWithStatusActivity(
          { domain: 'git', label: 'Inspecting repository', detail: gitCwd },
          refreshRepoState,
        )
      }
    },
    [gitCwd, refreshRepoState],
  )

  async function runGitOp(
    label: string,
    op: () => Promise<{ ok: true } | { ok: false; error: string }>,
  ) {
    setBusy(true)
    try {
      await runWithStatusActivity(
        { domain: 'git', label, detail: gitCwd ?? undefined },
        async () => {
          const r = await op()
          if (!r.ok) window.alert(r.error)
          else {
            await refreshRepoState()
            void refreshFocusedCheckoutGit()
          }
          return r
        },
      )
    } finally {
      setBusy(false)
    }
  }

  function submitCommit() {
    if (!gitCwd) return
    const msg = commitMessage.trim()
    if (!msg) return
    setCommitOpen(false)
    setCommitMessage('')
    void runGitOp('Committing', () => window.mux.git.commit({ cwd: gitCwd, message: msg }))
  }

  async function runMergedBranchCleanup() {
    if (!gitCwd || !visibleWorkspaceId) return
    if (
      !window.confirm(
        'Remove this agent worktree and delete the branch on origin (if it still exists)?',
      )
    ) {
      return
    }
    setBusy(true)
    try {
      await runWithStatusActivity(
        { domain: 'git', label: 'Cleaning up merged branch', detail: gitCwd },
        async () => {
          const r = await window.mux.git.cleanupMergedMuxWorktree(gitCwd)
          if (!r.ok) window.alert(r.error)
          else {
            useAgentTabsStore.getState().closeTabByAgentPath(visibleWorkspaceId, gitCwd)
            await refreshRepoState()
            void refreshFocusedCheckoutGit()
          }
          return r
        },
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu open={menuOpen} onOpenChange={onMenuOpenChange}>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            title="Git (stage, commit, fetch, pull, push, publish)"
            disabled={!gitCwd}
            aria-label="Git actions"
          >
            <GitBranch className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent side="right" align="start" className="min-w-52">
          {gitCwd ? (
            <p
              className="mb-1 truncate px-2 py-1 font-mono text-[10px] text-muted-foreground"
              title={gitCwd}
            >
              {gitCwd}
            </p>
          ) : null}

          {isRepo === null && gitCwd ? (
            <div className="px-2 py-1.5 text-xs text-muted-foreground">Checking Git…</div>
          ) : null}

          {!gitCwd ? null : isRepo === false ? (
            <DropdownMenuItem
              disabled={busy}
              className="gap-2"
              onSelect={(e) => {
                e.preventDefault()
                void runGitOp('Initializing repository', () => window.mux.git.init(gitCwd))
              }}
            >
              <GitBranchPlus className="size-3.5 shrink-0 opacity-70" aria-hidden />
              Initialize Git repository
            </DropdownMenuItem>
          ) : isRepo && hasOrigin != null ? (
            <>
              <DropdownMenuItem
                disabled={busy}
                className="gap-2"
                onSelect={(e) => {
                  e.preventDefault()
                  void runGitOp('Staging changes', () => window.mux.git.addAll(gitCwd))
                }}
              >
                <PlusSquare className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Stage all
              </DropdownMenuItem>
              <DropdownMenuItem
                disabled={busy}
                className="gap-2"
                onSelect={(e) => {
                  e.preventDefault()
                  setMenuOpen(false)
                  setCommitMessage('')
                  setCommitOpen(true)
                }}
              >
                <GitCommitHorizontal className="size-3.5 shrink-0 opacity-70" aria-hidden />
                Commit
              </DropdownMenuItem>
              {hasOrigin ? (
                <>
                  <DropdownMenuItem
                    disabled={busy}
                    className="gap-2"
                    onSelect={(e) => {
                      e.preventDefault()
                      void runGitOp('Fetching from origin', () => window.mux.git.fetch(gitCwd))
                    }}
                  >
                    <RefreshCw className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    Fetch
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busy}
                    className="gap-2"
                    onSelect={(e) => {
                      e.preventDefault()
                      void runGitOp('Pulling from upstream', () => window.mux.git.pull(gitCwd))
                    }}
                  >
                    <ArrowDownToLine className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    Pull
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={busy}
                    className="gap-2"
                    onSelect={(e) => {
                      e.preventDefault()
                      void runGitOp('Pushing to origin', () => window.mux.git.push(gitCwd))
                    }}
                  >
                    <ArrowUpFromLine className="size-3.5 shrink-0 opacity-70" aria-hidden />
                    Push
                  </DropdownMenuItem>
                  {prFollowUpMenu?.kind === 'createPr' ? (
                    <DropdownMenuItem
                      disabled={busy}
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault()
                        setMenuOpen(false)
                        void window.mux.shell.openExternal(prFollowUpMenu.compareUrl).then((r) => {
                          if (!r.ok) window.alert(r.error)
                        })
                      }}
                    >
                      <GitPullRequestCreateArrow className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      Create pull request…
                    </DropdownMenuItem>
                  ) : prFollowUpMenu?.kind === 'deleteMerged' ? (
                    <DropdownMenuItem
                      disabled={busy}
                      className="gap-2"
                      onSelect={(e) => {
                        e.preventDefault()
                        setMenuOpen(false)
                        void runMergedBranchCleanup()
                      }}
                    >
                      <Trash2 className="size-3.5 shrink-0 opacity-70" aria-hidden />
                      Delete branch & remove worktree…
                    </DropdownMenuItem>
                  ) : null}
                </>
              ) : (
                <DropdownMenuItem
                  disabled={busy}
                  className="gap-2"
                  onSelect={(e) => {
                    e.preventDefault()
                    setMenuOpen(false)
                    setPublishOpen(true)
                  }}
                >
                  <Github className="size-3.5 shrink-0 opacity-70" aria-hidden />
                  Publish to GitHub…
                </DropdownMenuItem>
              )}
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>

      <PublishGithubDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        gitCwd={gitCwd}
        onPublished={() => {
          void refreshRepoState()
          void refreshFocusedCheckoutGit()
        }}
      />

      <Dialog open={commitOpen} onOpenChange={setCommitOpen}>
        <DialogContent className="gap-3">
          <DialogTitle>Commit</DialogTitle>
          <DialogDescription className="text-xs">
            Staged changes will be committed in the folder shown in the Git menu. Use “Stage all” first if you
            want everything included.
          </DialogDescription>
          <textarea
            className={cn(
              'min-h-[88px] w-full resize-y rounded-md border border-border bg-background px-2 py-1.5 text-sm',
              'outline-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
            placeholder="Commit message"
            value={commitMessage}
            onChange={(e) => setCommitMessage(e.target.value)}
            autoFocus
          />
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setCommitOpen(false)}>
              Cancel
            </Button>
            <Button type="button" onClick={() => submitCommit()} disabled={!commitMessage.trim()}>
              Commit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
