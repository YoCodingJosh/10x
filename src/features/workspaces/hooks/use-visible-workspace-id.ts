import { useWorkspaceStore } from '@/stores/workspace-store'

/** Same visibility rule as the agent desk: active if valid, else first workspace. */
export function useVisibleWorkspaceId(): string | null {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)

  if (workspaces.length === 0) return null
  if (activeWorkspaceId != null && workspaces.some((w) => w.id === activeWorkspaceId)) {
    return activeWorkspaceId
  }
  return workspaces[0]?.id ?? null
}
