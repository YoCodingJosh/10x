import { useWorkspaceStore } from '@/stores/workspace-store'
import {
  usePersistWorkspacesMutation,
  useWorkspacesQuery,
} from '@/features/workspaces/hooks/use-workspaces'
import { navigateToAgentSession } from '@/features/shell/navigate-to-agent-session'
import {
  firstAttentionSessionIdInWorkspace,
  tabNeedsAttention,
  useAgentNotificationStore,
  workspaceNeedsAttention,
} from '@/stores/agent-notification-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import { FolderOpen, Trash2 } from 'lucide-react'

export function WorkspacesRailList() {
  const { isPending, isError, error } = useWorkspacesQuery()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()
  const attention = useAgentNotificationStore((s) => s.attention)
  const focusedAgentSessionId = useAgentNotificationStore((s) => s.focusedAgentSessionId)
  const byWorkspaceId = useAgentTabsStore((s) => s.byWorkspaceId)

  function activateWorkspace(wId: string) {
    const attentionSid = firstAttentionSessionIdInWorkspace(wId, attention)
    if (attentionSid != null) {
      const colon = attentionSid.indexOf(':')
      if (colon > 0) {
        const tabId = attentionSid.slice(colon + 1)
        useAgentTabsStore.getState().ensureWorkspace(wId)
        const bucket = useAgentTabsStore.getState().byWorkspaceId[wId]
        if (bucket?.tabs.some((t) => t.id === tabId)) {
          navigateToAgentSession(attentionSid)
          return
        }
      }
    }
    setActiveWorkspaceId(wId)
  }

  async function removeWorkspace(id: string) {
    const next = workspaces.filter((w) => w.id !== id)
    await persist.mutateAsync(next)
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(next[0]?.id ?? null)
    }
  }

  return (
    <ScrollArea className="min-h-0 flex-1">
      <div className="p-1">
        {isPending && (
          <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
        )}
        {isError && (
          <p className="px-2 py-3 text-xs text-destructive">
            {error instanceof Error ? error.message : 'Could not load workspaces.'}
          </p>
        )}
        {!isPending && workspaces.length === 0 && (
          <p className="px-2 py-3 text-xs text-muted-foreground">
            Add a repo or worktree folder to scope agents and terminals.
          </p>
        )}
        {workspaces.map((w) => {
          const bucket = byWorkspaceId[w.id]
          const tabs = bucket?.tabs ?? []
          const activeTabId = bucket?.activeTabId ?? null

          return (
            <div
              key={w.id}
              className={cn(
                'group rounded-md px-1 py-0.5',
                w.id === activeWorkspaceId && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
            >
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                  onClick={() => activateWorkspace(w.id)}
                >
                  <FolderOpen className="size-3.5 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{w.label}</span>
                  {workspaceNeedsAttention(w.id, attention, focusedAgentSessionId) && (
                    <span className="size-1.5 shrink-0 rounded-full bg-blue-500" aria-hidden />
                  )}
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="shrink-0 opacity-0 group-hover:opacity-100"
                  title="Remove from list"
                  onClick={(e) => {
                    e.stopPropagation()
                    void removeWorkspace(w.id)
                  }}
                  disabled={persist.isPending}
                >
                  <Trash2 className="size-3.5" />
                </Button>
              </div>

              {tabs.length > 0 ? (
                <ul className="mt-0.5 space-y-0.5 border-l border-border/50 pl-2 ml-3" role="list">
                  {tabs.map((tab) => {
                    const sessionId = `${w.id}:${tab.id}`
                    const isActiveAgent =
                      w.id === activeWorkspaceId && tab.id === activeTabId
                    return (
                      <li key={tab.id}>
                        <button
                          type="button"
                          className={cn(
                            'flex w-full min-w-0 items-center gap-2 rounded-sm px-2 py-1 text-left text-xs',
                            isActiveAgent
                              ? 'bg-background/80 font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                          onClick={() => navigateToAgentSession(sessionId)}
                        >
                          <span className="min-w-0 flex-1 truncate">{tab.label}</span>
                          {tabNeedsAttention(
                            w.id,
                            tab.id,
                            attention,
                            focusedAgentSessionId,
                          ) && (
                            <span
                              className="size-1.5 shrink-0 rounded-full bg-blue-500"
                              aria-hidden
                            />
                          )}
                        </button>
                      </li>
                    )
                  })}
                </ul>
              ) : null}
            </div>
          )
        })}
      </div>
    </ScrollArea>
  )
}
