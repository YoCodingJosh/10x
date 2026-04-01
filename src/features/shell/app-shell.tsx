import { Separator } from '@/components/ui/separator'
import { ActivityBar } from '@/features/activity-bar/activity-bar'
import { WorkspaceAgentDesk } from '@/features/agent-sessions/workspace-agent-desk'
import { TerminalPanel } from '@/features/terminal-panel/terminal-panel'
import { WorkspacesRail } from '@/features/workspaces/workspaces-rail'

import { WorkspaceSync } from './workspace-sync'

export function AppShell() {
  return (
    <>
      <WorkspaceSync />
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <div className="flex min-w-0 flex-1 flex-col">
            <WorkspaceAgentDesk />
            <Separator />
            <TerminalPanel />
          </div>
          <WorkspacesRail />
        </div>
      </div>
    </>
  )
}
