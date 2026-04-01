import { useEffect, useMemo, useRef, useState } from 'react'

import { GitCommitMessageDialog } from '@/features/git/git-commit-message-dialog'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { normalizeGitCwdKey } from '@/features/git/normalize-git-cwd'
import type { GitQuickActionKind } from '@/features/git/resolve-git-quick-action'
import { resolveGitQuickAction } from '@/features/git/resolve-git-quick-action'
import { PublishGithubDialog } from '@/features/github/publish-github-dialog'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useCommandPaletteIntentsStore } from '@/stores/command-palette-intents-store'
import { refreshFocusedCheckoutGit, useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { cn } from '@/lib/utils'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  GitBranchPlus,
  GitCommitHorizontal,
  GitPullRequestCreateArrow,
  Github,
  Loader2,
  PlusSquare,
  RefreshCw,
  Trash2,
} from 'lucide-react'

const LABEL: Record<GitQuickActionKind, string> = {
  init: 'Initialize',
  publish: 'Publish',
  pull: 'Pull',
  fetch: 'Fetch from origin',
  stage: 'Stage',
  commit: 'Commit',
  push: 'Push',
  createPr: 'Create PR',
  deleteMergedBranch: 'Delete branch',
}

type Props = {
  className?: string
}

/** Status-bar contextual git action; reads shared poll state (no extra IPC beyond summary). */
export function GitQuickActionButton({ className }: Props) {
  const cwd = useGitCwdForVisibleWorkspace()
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const wt = useGitFocusedCheckoutStore((s) => s.wt)
  const wtCwd = useGitFocusedCheckoutStore((s) => s.wtCwd)
  const muxWorktreeFollowUp = useGitFocusedCheckoutStore((s) => s.muxWorktreeFollowUp)
  const wtForAction = useMemo(() => {
    if (!cwd) return null
    return normalizeGitCwdKey(cwd) === normalizeGitCwdKey(wtCwd) ? wt : null
  }, [cwd, wt, wtCwd])
  const effectiveMuxFollowUp = useMemo(() => {
    if (!cwd || normalizeGitCwdKey(cwd) !== normalizeGitCwdKey(wtCwd)) return null
    return muxWorktreeFollowUp
  }, [cwd, wtCwd, muxWorktreeFollowUp])
  const action = useMemo(() => resolveGitQuickAction(wtForAction, effectiveMuxFollowUp), [wtForAction, effectiveMuxFollowUp])

  const [commitOpen, setCommitOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const commitNonce = useCommandPaletteIntentsStore((s) => s.commitNonce)
  const publishNonce = useCommandPaletteIntentsStore((s) => s.publishNonce)
  const prevCommitNonce = useRef(0)
  const prevPublishNonce = useRef(0)

  useEffect(() => {
    if (commitNonce > prevCommitNonce.current) {
      setCommitOpen(true)
    }
    prevCommitNonce.current = commitNonce
  }, [commitNonce])

  useEffect(() => {
    if (publishNonce > prevPublishNonce.current) {
      setPublishOpen(true)
    }
    prevPublishNonce.current = publishNonce
  }, [publishNonce])

  async function runOp(label: string, op: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    if (!cwd) return
    setBusy(true)
    try {
      await runWithStatusActivity({ domain: 'git', label, detail: cwd }, async () => {
        const r = await op()
        if (!r.ok) window.alert(r.error)
        else await refreshFocusedCheckoutGit()
        return r
      })
    } finally {
      setBusy(false)
    }
  }

  if (!cwd) return null

  const disabled = busy || action === 'loading'
  const labelText = action === 'loading' ? 'Git' : LABEL[action]
  const iconOnly = action === 'fetch'
  const titleText = iconOnly ? `${LABEL.fetch} — ${cwd}` : `${labelText}${action !== 'loading' ? ` — ${cwd}` : ''}`

  const iconSz = 'size-3'
  const icon =
    action === 'loading' ? (
      <Loader2 className={cn(iconSz, 'shrink-0 animate-spin opacity-80')} aria-hidden />
    ) : action === 'init' ? (
      <GitBranchPlus className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'publish' ? (
      <Github className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'createPr' ? (
      <GitPullRequestCreateArrow className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'deleteMergedBranch' ? (
      <Trash2 className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'pull' ? (
      <ArrowDownToLine className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'fetch' ? (
      <RefreshCw className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'stage' ? (
      <PlusSquare className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : action === 'commit' ? (
      <GitCommitHorizontal className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    ) : (
      <ArrowUpFromLine className={cn(iconSz, 'shrink-0 opacity-90')} aria-hidden />
    )

  function onClick() {
    if (disabled || !cwd) return
    switch (action) {
      case 'init':
        void runOp('Initializing repository', () => window.mux.git.init(cwd))
        break
      case 'publish':
        setPublishOpen(true)
        break
      case 'pull':
        void runOp('Pulling from upstream', () => window.mux.git.pull(cwd))
        break
      case 'fetch':
        void runOp('Fetching from origin', () => window.mux.git.fetch(cwd))
        break
      case 'stage':
        void runOp('Staging changes', () => window.mux.git.addAll(cwd))
        break
      case 'commit':
        setCommitOpen(true)
        break
      case 'push':
        void runOp('Pushing to origin', () => window.mux.git.push(cwd))
        break
      case 'createPr': {
        if (effectiveMuxFollowUp?.kind !== 'createPr') return
        const url = effectiveMuxFollowUp.compareUrl
        void runWithStatusActivity({ domain: 'github', label: 'Opening pull request', detail: url }, async () => {
          const r = await window.mux.shell.openExternal(url)
          if (!r.ok) window.alert(r.error)
          return r
        })
        break
      }
      case 'deleteMergedBranch': {
        if (!window.confirm('Remove this agent worktree and delete the branch on origin (if it still exists)?')) {
          return
        }
        if (!visibleWorkspaceId || !cwd) return
        void runWithStatusActivity({ domain: 'git', label: 'Cleaning up merged branch', detail: cwd }, async () => {
          const r = await window.mux.git.cleanupMergedMuxWorktree(cwd)
          if (!r.ok) window.alert(r.error)
          else {
            useAgentTabsStore.getState().closeTabByAgentPath(visibleWorkspaceId, cwd)
            await refreshFocusedCheckoutGit()
          }
          return r
        })
        break
      }
    }
  }

  return (
    <>
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        aria-label={iconOnly ? titleText : undefined}
        title={titleText}
        className={cn(
          'ml-0.5 flex h-[18px] shrink-0 items-center rounded-md border-0 border-transparent',
          iconOnly ? 'min-w-[18px] justify-center' : 'max-w-[min(44vw,200px)] min-w-0 gap-1',
          'text-[11px] font-medium text-muted-foreground transition-colors duration-150',
          'hover:text-accent-foreground',
          'disabled:pointer-events-none disabled:opacity-40',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60',
          className,
        )}
      >
        {icon}
        {!iconOnly ? <span className="min-w-0 truncate">{labelText}</span> : null}
      </button>

      <GitCommitMessageDialog
        open={commitOpen}
        onOpenChange={setCommitOpen}
        cwd={cwd}
        onCommit={async (message) => {
          await runOp('Committing', () => window.mux.git.commit({ cwd, message }))
        }}
      />

      <PublishGithubDialog
        open={publishOpen}
        onOpenChange={setPublishOpen}
        gitCwd={cwd}
        onPublished={() => {
          void refreshFocusedCheckoutGit()
        }}
      />
    </>
  )
}
