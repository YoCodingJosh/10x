import { WorkspacesRailFooter } from '@/features/workspaces/workspaces-rail-footer'
import { WorkspacesRailHeader } from '@/features/workspaces/workspaces-rail-header'
import { WorkspacesRailList } from '@/features/workspaces/workspaces-rail-list'

export function WorkspacesRail() {
  return (
    <aside
      className="flex w-60 shrink-0 flex-col border-l border-border bg-sidebar"
      aria-label="Workspaces"
    >
      <WorkspacesRailHeader />
      <WorkspacesRailList />
      <WorkspacesRailFooter />
    </aside>
  )
}
