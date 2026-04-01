import { useWorkspaceStore } from '@/stores/workspace-store'

export function useActiveWorkspace() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  return workspaces.find((w) => w.id === activeWorkspaceId) ?? null
}
