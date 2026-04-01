import { useWorkspaceStore } from '@/stores/workspace-store'

export function useWorkspaceById(workspaceId: string) {
  return useWorkspaceStore((s) => s.workspaces.find((w) => w.id === workspaceId) ?? null)
}
