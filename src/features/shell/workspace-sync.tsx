import { useSyncAgentTabsWithWorkspaces } from '@/features/agent-sessions/hooks/use-sync-agent-tabs-with-workspaces'
import { useSyncWorkspacesToStore } from '@/features/workspaces/hooks/use-workspaces'

/** Subscribes workspace query → Zustand; renders nothing. */
export function WorkspaceSync() {
  useSyncWorkspacesToStore()
  useSyncAgentTabsWithWorkspaces()
  return null
}
