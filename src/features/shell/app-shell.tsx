import { ActivityBar } from '@/features/activity-bar/activity-bar'
import { StatusBar } from '@/features/status-bar/status-bar'

import { CenterRightSplit } from './center-right-split'
import { WorkspaceSync } from './workspace-sync'

export function AppShell() {
  return (
    <>
      <WorkspaceSync />
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <CenterRightSplit />
        </div>
        <StatusBar />
      </div>
    </>
  )
}
