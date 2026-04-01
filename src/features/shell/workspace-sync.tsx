import { useSyncAgentTabsWithWorkspaces } from '@/features/agent-sessions/hooks/use-sync-agent-tabs-with-workspaces'
import { useRecoverMuxWorktreeAgentTabs } from '@/features/workspaces/hooks/use-recover-mux-worktree-agent-tabs'
import { useSyncWorkspacesToStore } from '@/features/workspaces/hooks/use-workspaces'

/** Subscribes workspace query → Zustand; renders nothing. */
export function WorkspaceSync() {
  useSyncWorkspacesToStore()
  useSyncAgentTabsWithWorkspaces()
  useRecoverMuxWorktreeAgentTabs()
  return null
}
