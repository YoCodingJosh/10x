import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/** Checkout for the visible workspace: active agent tab worktree, else workspace root. */
export function useGitCwdForVisibleWorkspace(): string | null {
  const visibleId = useVisibleWorkspaceId()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const byWorkspaceId = useAgentTabsStore((s) => s.byWorkspaceId)

  if (!visibleId) return null
  const ws = workspaces.find((w) => w.id === visibleId)
  if (!ws?.path) return null
  const bucket = byWorkspaceId[visibleId]
  const activeTabId = bucket?.activeTabId ?? null
  const activeTab = bucket?.tabs.find((t) => t.id === activeTabId) ?? null
  return activeTab ? (activeTab.agentPath ?? ws.path) : ws.path
}
