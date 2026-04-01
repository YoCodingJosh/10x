import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'

import { AgentSessionsPanel } from './agent-sessions-panel'
import { WorkspaceIdProvider } from './workspace-id-context'

export function WorkspaceAgentDesk() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const visibleWorkspaceId = useVisibleWorkspaceId()

  if (workspaces.length === 0) {
    return (
      <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-2 bg-background p-8 text-center text-sm text-muted-foreground">
        <p>Add a workspace to open agent tabs.</p>
      </div>
    )
  }

  const visibleId = visibleWorkspaceId ?? workspaces[0]!.id

  return (
    <div id="mux-agent-desk" className="relative flex min-h-0 flex-1 flex-col">
      {workspaces.map((ws) => (
        <div
          key={ws.id}
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            ws.id !== visibleId && 'hidden',
          )}
        >
          <WorkspaceIdProvider workspaceId={ws.id}>
            <AgentSessionsPanel />
          </WorkspaceIdProvider>
        </div>
      ))}
    </div>
  )
}
