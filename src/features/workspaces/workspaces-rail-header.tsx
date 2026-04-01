import { useWorkspaceStore } from '@/stores/workspace-store'
import { workspaceLabelFromPath } from '@/features/workspaces/lib/label-from-path'
import { usePersistWorkspacesMutation } from '@/features/workspaces/hooks/use-workspaces'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'

export function WorkspacesRailHeader() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()

  async function addWorkspace() {
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
    setActiveWorkspaceId(next[next.length - 1].id)
  }

  return (
    <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-2">
      <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
        Workspaces
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        title="Add folder"
        onClick={() => void addWorkspace()}
        disabled={persist.isPending}
      >
        <Plus className="size-3.5" />
      </Button>
    </div>
  )
}
