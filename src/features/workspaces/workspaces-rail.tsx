import { WorkspacesRailFooter } from '@/features/workspaces/workspaces-rail-footer'
import { WorkspacesRailHeader } from '@/features/workspaces/workspaces-rail-header'
import { WorkspacesRailList } from '@/features/workspaces/workspaces-rail-list'
import { cn } from '@/lib/utils'

type WorkspacesRailProps = {
  /** When set, width is controlled (e.g. sash). Otherwise uses default `w-60`. */
  widthPx?: number
}

export function WorkspacesRail({ widthPx }: WorkspacesRailProps) {
  return (
    <aside
      style={widthPx != null ? { width: widthPx, minWidth: 180 } : undefined}
      className={cn(
        'flex shrink-0 flex-col bg-sidebar',
        widthPx == null && 'w-60 border-l border-border',
      )}
      aria-label="Workspaces"
    >
      <WorkspacesRailHeader />
      <WorkspacesRailList />
      <WorkspacesRailFooter />
    </aside>
  )
}
