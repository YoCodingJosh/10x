import { useState } from 'react'

import { ActivityBarGitMenu } from './activity-bar-git-menu'
import { Button } from '@/components/ui/button'
import { useGitCwdForVisibleWorkspace } from '@/features/git/use-git-cwd-for-visible-workspace'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { SettingsDialog } from '@/features/settings/settings-dialog'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { useDiffPanelStore } from '@/stores/diff-panel-store'
import { cn } from '@/lib/utils'
import { Code2, FolderOpen, GitCompare, Globe, Settings } from 'lucide-react'

export function ActivityBar() {
  const active = useActiveWorkspace()
  const focusedAgentPath = useGitCwdForVisibleWorkspace()
  const diffOpen = useDiffPanelStore((s) => s.open)
  const toggleDiffPanel = useDiffPanelStore((s) => s.toggle)
  const [settingsOpen, setSettingsOpen] = useState(false)

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
    await runWithStatusActivity(
      { domain: 'git', label: 'Opening remote', detail: path },
      async () => {
        const r = await window.mux.git.openOriginInBrowser(path)
        if (!r.ok) window.alert(r.error)
        return r
      },
    )
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
        title="Open origin remote in the browser (HTTPS)"
        onClick={() => void openGitOriginInBrowser()}
        disabled={!active?.path}
      >
        <Globe className="size-4" />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Toggle diff panel (working tree)"
        aria-pressed={diffOpen}
        className={cn(diffOpen && 'bg-accent text-accent-foreground')}
        onClick={() => toggleDiffPanel()}
      >
        <GitCompare className="size-4" />
      </Button>
      <ActivityBarGitMenu />
        </div>
        <div className="mt-auto flex flex-col items-center pb-1 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
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
