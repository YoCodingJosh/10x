import { useCallback, useMemo } from 'react'

import { workspaceLabelFromPath } from '@/features/workspaces/lib/label-from-path'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { usePersistWorkspacesMutation } from '@/features/workspaces/hooks/use-workspaces'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useCommandPaletteIntentsStore } from '@/stores/command-palette-intents-store'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { normalizeGitCwdKey } from '@/features/git/normalize-git-cwd'

import type { CommandPaletteItem } from './command-palette-types'

type RunCommand = (id: string) => void | Promise<void>

/**
 * Builds palette rows + runner for the current focused workspace / checkout.
 */
export function useCommandPaletteActions(): {
  items: CommandPaletteItem[]
  run: RunCommand
} {
  const cwd = useGitCwdForVisibleWorkspace()
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const active = useActiveWorkspace()
  const wt = useGitFocusedCheckoutStore((s) => s.wt)
  const wtCwd = useGitFocusedCheckoutStore((s) => s.wtCwd)
  const muxFollowUp = useGitFocusedCheckoutStore((s) => s.muxWorktreeFollowUp)
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const persist = usePersistWorkspacesMutation()
  const requestCommit = useCommandPaletteIntentsStore((s) => s.requestCommitDialog)
  const requestPublish = useCommandPaletteIntentsStore((s) => s.requestPublishDialog)
  const requestWorktree = useCommandPaletteIntentsStore((s) => s.requestWorktreeDialog)

  const wtAligned =
    cwd && wtCwd && normalizeGitCwdKey(cwd) === normalizeGitCwdKey(wtCwd) ? wt : null

  const items = useMemo((): CommandPaletteItem[] => {
    const out: CommandPaletteItem[] = [
      {
        id: 'shell.cursor',
        section: 'shell',
        label: 'Open focused folder in Cursor',
        keywords: 'code editor ide',
      },
      {
        id: 'shell.finder',
        section: 'shell',
        label: 'Open active workspace in file manager',
        keywords: 'files explorer reveal',
      },
      {
        id: 'shell.origin',
        section: 'shell',
        label: 'Open Git origin in browser',
        keywords: 'remote github https',
      },
      {
        id: 'workspace.add',
        section: 'workspace',
        label: 'Add workspace folder',
        keywords: 'folder project',
      },
    ]

    if (visibleWorkspaceId) {
      out.push(
        {
          id: 'agent.new',
          section: 'agent',
          label: 'New agent tab',
          keywords: 'claude tab',
        },
        {
          id: 'agent.worktree',
          section: 'agent',
          label: 'Create agent worktree…',
          keywords: 'git branch 10x',
        },
      )
    }

    if (!cwd) {
      return out
    }

    if (!wtAligned?.isRepo) {
      out.push({
        id: 'git.init',
        section: 'git',
        label: 'Initialize Git repository',
        keywords: 'create repo',
      })
      return out
    }

    const s = wtAligned.summary

    out.push({
      id: 'git.fetch',
      section: 'git',
      label: 'Fetch',
      keywords: 'pull remote origin',
    })

    if (!s.hasOrigin) {
      out.push({
        id: 'git.publish',
        section: 'git',
        label: 'Publish to GitHub…',
        keywords: 'remote origin create repo',
      })
      return out
    }

    if (s.behind > 0) {
      out.push({ id: 'git.pull', section: 'git', label: 'Pull', keywords: 'merge upstream' })
    }
    if (s.untrackedCount > 0 || s.unstagedCount > 0) {
      out.push({ id: 'git.stage', section: 'git', label: 'Stage all', keywords: 'add' })
    }
    if (s.stagedCount > 0) {
      out.push({ id: 'git.commit', section: 'git', label: 'Commit…', keywords: 'message' })
    }
    if (s.ahead > 0 || (!s.detached && s.upstreamShort == null)) {
      out.push({ id: 'git.push', section: 'git', label: 'Push', keywords: 'origin upload' })
    }

    if (
      muxFollowUp?.kind === 'createPr' &&
      s.isMuxWorktree &&
      !s.isOriginDefaultBranch
    ) {
      out.push({
        id: 'git.pr',
        section: 'git',
        label: 'Create pull request',
        keywords: 'github pr compare',
      })
    }

    if (muxFollowUp?.kind === 'deleteMergedBranch' && s.isMuxWorktree) {
      out.push({
        id: 'git.deleteMerged',
        section: 'git',
        label: 'Delete merged branch & remove worktree',
        keywords: 'cleanup merged pr',
      })
    }

    return out
  }, [cwd, wtAligned, muxFollowUp, visibleWorkspaceId])

  const run = useCallback(
    async (id: string) => {
      switch (id) {
        case 'shell.cursor': {
          if (!cwd) {
            window.alert('No focused folder. Add a workspace and select an agent tab.')
            return
          }
          const r = await window.mux.shell.openInCursor(cwd)
          if (!r.ok) window.alert(r.error)
          return
        }
        case 'shell.finder': {
          const p = active?.path
          if (!p) return
          const r = await window.mux.shell.openPathInOsFinder(p)
          if (!r.ok) window.alert(r.error)
          return
        }
        case 'shell.origin': {
          const p = active?.path
          if (!p) return
          await runWithStatusActivity(
            { domain: 'git', label: 'Opening remote', detail: p },
            async () => {
              const r = await window.mux.git.openOriginInBrowser(p)
              if (!r.ok) window.alert(r.error)
              return r
            },
          )
          return
        }
        case 'workspace.add': {
          const dir = await window.mux.dialog.pickWorkspace()
          if (!dir) return
          const next = [
            ...workspaces,
            {
              id: crypto.randomUUID(),
              path: dir,
              label: workspaceLabelFromPath(dir),
            },
          ]
          await persist.mutateAsync(next)
          useWorkspaceStore.getState().setActiveWorkspaceId(next[next.length - 1]!.id)
          return
        }
        case 'agent.new': {
          if (!visibleWorkspaceId) return
          useAgentTabsStore.getState().addTab(visibleWorkspaceId)
          return
        }
        case 'agent.worktree': {
          requestWorktree()
          return
        }
        default:
          break
      }

      if (!cwd) return

      const runGit = (label: string, op: () => Promise<{ ok: true } | { ok: false; error: string }>) =>
        runWithStatusActivity({ domain: 'git', label, detail: cwd }, async () => {
          const r = await op()
          if (!r.ok) window.alert(r.error)
          else await useGitFocusedCheckoutStore.getState().tick({ showSpinner: false })
          return r
        })

      switch (id) {
        case 'git.init':
          await runGit('Initializing repository', () => window.mux.git.init(cwd))
          return
        case 'git.fetch':
          await runGit('Fetching from origin', () => window.mux.git.fetch(cwd))
          return
        case 'git.pull':
          await runGit('Pulling from upstream', () => window.mux.git.pull(cwd))
          return
        case 'git.stage':
          await runGit('Staging changes', () => window.mux.git.addAll(cwd))
          return
        case 'git.commit':
          requestCommit()
          return
        case 'git.push':
          await runGit('Pushing to origin', () => window.mux.git.push(cwd))
          return
        case 'git.publish':
          requestPublish()
          return
        case 'git.pr': {
          const follow = useGitFocusedCheckoutStore.getState().muxWorktreeFollowUp
          if (follow?.kind !== 'createPr') return
          const url = follow.compareUrl
          await runWithStatusActivity(
            { domain: 'github', label: 'Opening pull request', detail: url },
            async () => {
              const r = await window.mux.shell.openExternal(url)
              if (!r.ok) window.alert(r.error)
              return r
            },
          )
          return
        }
        case 'git.deleteMerged': {
          if (
            !window.confirm(
              'Remove this agent worktree and delete the branch on origin (if it still exists)?',
            )
          ) {
            return
          }
          if (!visibleWorkspaceId) return
          await runWithStatusActivity(
            { domain: 'git', label: 'Cleaning up merged branch', detail: cwd },
            async () => {
              const r = await window.mux.git.cleanupMergedMuxWorktree(cwd)
              if (!r.ok) window.alert(r.error)
              else {
                useAgentTabsStore.getState().closeTabByAgentPath(visibleWorkspaceId, cwd)
                await useGitFocusedCheckoutStore.getState().tick({ showSpinner: false })
              }
              return r
            },
          )
          return
        }
        default:
          return
      }
    },
    [
      cwd,
      active?.path,
      workspaces,
      persist,
      visibleWorkspaceId,
      requestCommit,
      requestPublish,
      requestWorktree,
    ],
  )

  return { items, run }
}
