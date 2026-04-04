import { useEffect, useState } from 'react'

import { ActivityBarGitMenu } from './activity-bar-git-menu'
import { activityBarIconButtonClass } from './activity-bar-icon-styles'
import { Button } from '@/components/ui/button'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { SettingsDialog } from '@/features/settings/settings-dialog'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { useSidePanelStore } from '@/stores/side-panel-store'
import { Code2, FolderOpen, GitGraph, GitCompare, Globe, Settings } from 'lucide-react'

export function ActivityBar() {
  const active = useActiveWorkspace()
  const focusedAgentPath = useGitCwdForVisibleWorkspace()
  const activePanel = useSidePanelStore((s) => s.active)
  const toggleSidePanel = useSidePanelStore((s) => s.toggle)
  const gitRepoReady = useGitFocusedCheckoutStore((s) => s.loadState.kind === 'ok')
  const gitLoadStateKind = useGitFocusedCheckoutStore((s) => s.loadState.kind)
  const [activeWorkspaceIsGitRepo, setActiveWorkspaceIsGitRepo] = useState<boolean | null>(null)
  const [settingsOpen, setSettingsOpen] = useState(false)

  const activeWorkspacePath = active?.path ?? null

  useEffect(() => {
    if (!activeWorkspacePath) {
      setActiveWorkspaceIsGitRepo(null)
      return
    }
    let cancelled = false
    void window.mux.git.classify(activeWorkspacePath).then((c) => {
      if (!cancelled) setActiveWorkspaceIsGitRepo(c.isRepo)
    })
    return () => {
      cancelled = true
    }
  }, [activeWorkspacePath, gitLoadStateKind])

  async function revealActiveWorkspace() {
    const path = active?.path
    if (!path) return
    const r = await window.mux.shell.openPathInOsFinder(path)
    if (!r.ok) {
      window.alert(r.error)
    }
  }

  async function openFocusedAgentInCursor() {
    const path = focusedAgentPath
    if (!path) return
    const r = await window.mux.shell.openInCursor(path)
    if (!r.ok) {
      window.alert(r.error)
    }
  }

  async function openGitOriginInBrowser() {
    const path = active?.path
    if (!path) return
    await runWithStatusActivity({ domain: 'git', label: 'Opening remote', detail: path }, async () => {
      const r = await window.mux.git.openOriginInBrowser(path)
      if (!r.ok) window.alert(r.error)
      return r
    })
  }

  return (
    <>
      <SettingsDialog open={settingsOpen} onOpenChange={setSettingsOpen} />
      <aside
        className="flex h-full min-h-0 w-12 shrink-0 flex-col items-center border-r border-border bg-sidebar py-2"
        aria-label="Activity bar"
      >
        <div className="flex flex-col items-center gap-1">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={activityBarIconButtonClass}
            title="Open the focused agent's folder in Cursor (workspace root, or worktree if this tab uses one)"
            onClick={() => void openFocusedAgentInCursor()}
            disabled={!focusedAgentPath}
          >
            <Code2 className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={activityBarIconButtonClass}
            title="Open active workspace folder in the file manager"
            onClick={() => void revealActiveWorkspace()}
            disabled={!active?.path}
          >
            <FolderOpen className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={activityBarIconButtonClass}
            title={
              !activeWorkspacePath
                ? 'Add a workspace to open the remote in your browser'
                : activeWorkspaceIsGitRepo === null
                  ? 'Checking Git…'
                  : activeWorkspaceIsGitRepo === false
                    ? 'This workspace folder is not a Git repository'
                    : 'Open origin remote in the browser (HTTPS)'
            }
            onClick={() => void openGitOriginInBrowser()}
            disabled={!activeWorkspacePath || activeWorkspaceIsGitRepo !== true}
          >
            <Globe className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={activityBarIconButtonClass}
            title={
              gitRepoReady
                ? 'Toggle diff panel (working tree)'
                : 'Diff panel needs a Git repository in the focused folder'
            }
            aria-pressed={activePanel === 'diff'}
            disabled={!gitRepoReady}
            onClick={() => toggleSidePanel('diff')}
          >
            <GitCompare className="size-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={activityBarIconButtonClass}
            title={
              gitRepoReady
                ? 'Toggle git history graph'
                : 'Git history needs a Git repository in the focused folder'
            }
            aria-pressed={activePanel === 'git-graph'}
            disabled={!gitRepoReady}
            onClick={() => toggleSidePanel('git-graph')}
          >
            <GitGraph className="size-4" />
          </Button>
          <ActivityBarGitMenu />
        </div>
        <div className="mt-auto flex flex-col items-center pb-1 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className={activityBarIconButtonClass}
            title="Settings"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="size-4" />
          </Button>
        </div>
      </aside>
    </>
  )
}
