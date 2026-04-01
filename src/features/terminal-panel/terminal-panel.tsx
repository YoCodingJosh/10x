import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

import { WorkspaceShellTerminal } from './workspace-shell-terminal'

export function TerminalPanel() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const active = useActiveWorkspace()

  if (workspaces.length === 0) {
    return (
      <section
        className="flex h-[min(40vh,400px)] min-h-[200px] max-h-[55vh] shrink-0 flex-col border-t border-border bg-card"
        aria-label="Terminal panel"
      >
        <div className="flex h-8 shrink-0 items-center border-b border-border px-2 text-xs text-muted-foreground">
          Terminal
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Add a workspace to get a shell in its project folder.
        </div>
      </section>
    )
  }

  const visibleId = visibleWorkspaceId ?? workspaces[0]!.id

  return (
    <section
      className="flex h-[min(40vh,400px)] min-h-[200px] max-h-[55vh] shrink-0 flex-col border-t border-border bg-card"
      aria-label="Terminal panel"
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2 text-xs text-muted-foreground">
        <span>Terminal</span>
        {active ? (
          <span className="truncate font-mono text-[10px] text-foreground/70" title={active.path}>
            {active.label}
          </span>
        ) : (
          <span className="text-[10px] text-foreground/60">—</span>
        )}
      </div>
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        {workspaces.map((ws) => (
          <div
            key={ws.id}
            className={cn(
              'flex min-h-0 min-w-0 flex-1 flex-col',
              ws.id !== visibleId && 'hidden',
            )}
          >
            <WorkspaceShellTerminal workspaceId={ws.id} cwd={ws.path} />
          </div>
        ))}
      </div>
    </section>
  )
}
