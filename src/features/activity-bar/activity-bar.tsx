import { Button } from '@/components/ui/button'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { Code2, FolderOpen, Globe } from 'lucide-react'

export function ActivityBar() {
  const active = useActiveWorkspace()

  async function revealActiveWorkspace() {
    const path = active?.path
    if (!path) return
    const r = await window.mux.shell.openPathInOsFinder(path)
    if (!r.ok) {
      window.alert(r.error)
    }
  }

  async function openActiveInCursor() {
    const path = active?.path
    if (!path) return
    const r = await window.mux.shell.openInCursor(path)
    if (!r.ok) {
      window.alert(r.error)
    }
  }

  async function openGitOriginInBrowser() {
    const path = active?.path
    if (!path) return
    const r = await window.mux.git.openOriginInBrowser(path)
    if (!r.ok) {
      window.alert(r.error)
    }
  }

  return (
    <aside
      className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-2"
      aria-label="Activity bar"
    >
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        title="Open active workspace in Cursor"
        onClick={() => void openActiveInCursor()}
        disabled={!active?.path}
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
    </aside>
  )
}
