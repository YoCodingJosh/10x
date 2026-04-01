import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'

export function WorkspacesRailFooter() {
  const activeWorkspace = useActiveWorkspace()
  if (!activeWorkspace) return null

  return (
    <div className="border-t border-border p-2 text-[11px] leading-snug text-muted-foreground">
      <div className="font-medium text-sidebar-foreground">Active path</div>
      <div className="mt-1 break-all font-mono">{activeWorkspace.path}</div>
    </div>
  )
}
