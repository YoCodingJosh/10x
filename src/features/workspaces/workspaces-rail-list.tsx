import { useState } from 'react'
import { FolderOpen, Trash2, X } from 'lucide-react'

import { CloseAgentWorktreeDialog } from '@/features/git/close-agent-worktree-dialog'
import {
  usePersistWorkspacesMutation,
  useWorkspacesQuery,
} from '@/features/workspaces/hooks/use-workspaces'
import { navigateToAgentSession } from '@/features/shell/navigate-to-agent-session'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  agentAttentionDotClass,
  firstAttentionSessionIdInWorkspace,
  tabAttentionIndicator,
  useAgentNotificationStore,
  workspaceAttentionIndicator,
} from '@/stores/agent-notification-store'
import type { AgentTab } from '@/stores/agent-tabs-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { refreshFocusedCheckoutGit } from '@/stores/git-focused-checkout-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function WorkspacesRailList() {
  const { isPending, isError, error } = useWorkspacesQuery()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()
  const attention = useAgentNotificationStore((s) => s.attention)
  const focusedAgentSessionId = useAgentNotificationStore((s) => s.focusedAgentSessionId)
  const byWorkspaceId = useAgentTabsStore((s) => s.byWorkspaceId)
  const closeTab = useAgentTabsStore((s) => s.closeTab)

  const [closeWorktreeConfirm, setCloseWorktreeConfirm] = useState<{
    workspaceId: string
    tabId: string
    agentPath: string
    label: string
  } | null>(null)
  /** `workspaceId:tabId` — show close control when pointer is over this agent row. */
  const [hoveredAgentSessionId, setHoveredAgentSessionId] = useState<string | null>(null)

  function requestCloseAgentTab(workspaceId: string, tab: AgentTab) {
    if (!tab.agentPath) {
      closeTab(workspaceId, tab.id)
      return
    }
    setCloseWorktreeConfirm({
      workspaceId,
      tabId: tab.id,
      agentPath: tab.agentPath,
      label: tab.label,
    })
  }

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
    <>
      <CloseAgentWorktreeDialog
        open={closeWorktreeConfirm !== null}
        onOpenChange={(o) => {
          if (!o) setCloseWorktreeConfirm(null)
        }}
        agentLabel={closeWorktreeConfirm?.label ?? ''}
        worktreePath={closeWorktreeConfirm?.agentPath ?? ''}
        onConfirmRemove={async () => {
          const ctx = closeWorktreeConfirm
          if (!ctx) return { ok: false as const, error: 'Nothing to close.' }
          return runWithStatusActivity(
            { domain: 'git', label: 'Removing worktree', detail: ctx.agentPath },
            async () => {
              const r = await window.mux.git.removeMuxWorktree(ctx.agentPath)
              if (r.ok) {
                closeTab(ctx.workspaceId, ctx.tabId)
                void refreshFocusedCheckoutGit()
              }
              return r
            },
          )
        }}
      />
      <ScrollArea className="min-h-0 min-w-0 flex-1">
      <div className="w-full min-w-0 max-w-full p-1">
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
          const workspaceInd = workspaceAttentionIndicator(
            w.id,
            attention,
            focusedAgentSessionId,
          )

          return (
            <div
              key={w.id}
              className={cn(
                'group min-w-0 rounded-md px-1 py-0.5',
                w.id === activeWorkspaceId && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
            >
              <div className="flex min-w-0 items-center gap-1">
                <button
                  type="button"
                  className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                  onClick={() => activateWorkspace(w.id)}
                >
                  <FolderOpen className="size-3.5 shrink-0 opacity-70" />
                  <span className="min-w-0 flex-1 truncate">{w.label}</span>
                  {workspaceInd !== 'none' && (
                    <span
                      className={cn(
                        'size-1.5 shrink-0 rounded-full',
                        agentAttentionDotClass[workspaceInd],
                      )}
                      aria-hidden
                    />
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
                <ul
                  className="mt-0.5 min-w-0 space-y-0.5 border-l border-border/50 pl-2 ml-3"
                  role="list"
                >
                  {tabs.map((tab) => {
                    const sessionId = `${w.id}:${tab.id}`
                    const isActiveAgent =
                      w.id === activeWorkspaceId && tab.id === activeTabId
                    const tabInd = tabAttentionIndicator(
                      w.id,
                      tab.id,
                      attention,
                      focusedAgentSessionId,
                    )
                    return (
                      <li
                        key={tab.id}
                        className="min-w-0"
                        onMouseEnter={() => setHoveredAgentSessionId(sessionId)}
                        onMouseLeave={() => setHoveredAgentSessionId(null)}
                      >
                        <div
                          className={cn(
                            'flex min-h-7 w-full min-w-0 max-w-full items-stretch overflow-hidden rounded-sm text-xs transition-colors',
                            isActiveAgent
                              ? 'bg-background/80 font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          <button
                            type="button"
                            className="flex min-h-7 min-w-0 flex-1 basis-0 items-stretch overflow-hidden text-left"
                            onClick={() => navigateToAgentSession(sessionId)}
                          >
                            <span className="flex min-h-7 min-w-0 flex-1 basis-0 items-center gap-1.5 overflow-hidden px-2 py-1">
                              {tabInd !== 'none' && (
                                <span
                                  className={cn(
                                    'size-1.5 shrink-0 rounded-full',
                                    agentAttentionDotClass[tabInd],
                                  )}
                                  aria-hidden
                                />
                              )}
                              <span
                                className="block min-w-0 flex-1 basis-0 truncate text-left"
                                title={tab.label}
                              >
                                {tab.label}
                              </span>
                            </span>
                          </button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            title="Close agent tab"
                            className={cn(
                              'h-7 w-6 shrink-0 rounded-none rounded-r-sm px-0 text-muted-foreground hover:bg-destructive/15 hover:text-destructive',
                              hoveredAgentSessionId === sessionId
                                ? 'opacity-100'
                                : 'pointer-events-none opacity-0',
                            )}
                            onClick={(e) => {
                              e.stopPropagation()
                              requestCloseAgentTab(w.id, tab)
                            }}
                          >
                            <X className="size-3" />
                          </Button>
                        </div>
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
    </>
  )
}
