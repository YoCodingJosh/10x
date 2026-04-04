import { useWorkspaceStore } from '@/stores/workspace-store'
import {
  usePersistWorkspacesMutation,
  useWorkspacesQuery,
} from '@/features/workspaces/hooks/use-workspaces'
import {
  useAgentNotificationStore,
  workspaceNeedsAttention,
} from '@/stores/agent-notification-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { FolderOpen, Trash2 } from 'lucide-react'

export function WorkspacesRailList() {
  const { isPending, isError, error } = useWorkspacesQuery()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()
  const attention = useAgentNotificationStore((s) => s.attention)
  const focusedAgentSessionId = useAgentNotificationStore((s) => s.focusedAgentSessionId)

  async function removeWorkspace(id: string) {
    const next = workspaces.filter((w) => w.id !== id)
    await persist.mutateAsync(next)
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(next[0]?.id ?? null)
    }
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-1">
        {isPending && (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="px-2 py-3 text-xs text-destructive">
            {error instanceof Error ? error.message : 'Could not load workspaces.'}
          </p>
        )}
        {!isPending && workspaces.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Add a repo or worktree folder to scope agents and terminals.
          </p>
        )}
        {workspaces.map((w) => (
          <div
            key={w.id}
            className={cn(
              'group flex items-center gap-1 rounded-md px-1 py-0.5',
              w.id === activeWorkspaceId && 'bg-sidebar-accent text-sidebar-accent-foreground',
            )}
          >
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
              onClick={() => setActiveWorkspaceId(w.id)}
            >
              <FolderOpen className="size-3.5 shrink-0 opacity-70" />
              <span className="min-w-0 flex-1 truncate">{w.label}</span>
              {workspaceNeedsAttention(w.id, attention, focusedAgentSessionId) && (
                <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
              )}
            </button>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="shrink-0 opacity-0 group-hover:opacity-100"
              title="Remove from list"
              onClick={() => void removeWorkspace(w.id)}
              disabled={persist.isPending}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
