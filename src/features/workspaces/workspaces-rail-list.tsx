import { useCallback, useEffect, useMemo, useState } from 'react'
import { FolderOpen, Plus, Trash2, X } from 'lucide-react'

import { classifyAgentWorktreeClose } from '@/features/git/classify-agent-worktree-close'
import { CloseAgentWorktreeDialog } from '@/features/git/close-agent-worktree-dialog'
import { WorktreeNameDialog } from '@/features/git/worktree-name-dialog'
import {
  usePersistWorkspacesMutation,
  useWorkspacesQuery,
} from '@/features/workspaces/hooks/use-workspaces'
import { navigateToAgentSession } from '@/features/shell/navigate-to-agent-session'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'
import {
  firstAttentionSessionIdInWorkspace,
  tabActivity,
  tabHasCompletedTurn,
  tabHasReceivedInput,
  useAgentNotificationStore,
  workspaceRailIdleLabel,
} from '@/stores/agent-notification-store'
import { AgentActivityBadge } from '@/features/agent-sessions/agent-activity-badge'
import { EditableAgentTabLabel } from '@/features/agent-sessions/editable-agent-tab-label'
import type { AgentTab } from '@/stores/agent-tabs-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'
import { refreshFocusedCheckoutGit } from '@/stores/git-focused-checkout-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export function WorkspacesRailList() {
  const { isPending, isError, error } = useWorkspacesQuery()
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)
  const persist = usePersistWorkspacesMutation()
  const activityBySession = useAgentNotificationStore((s) => s.activityBySession)
  const hasReceivedInputBySession = useAgentNotificationStore((s) => s.hasReceivedInputBySession)
  const hasCompletedTurnBySession = useAgentNotificationStore((s) => s.hasCompletedTurnBySession)
  const attention = useAgentNotificationStore((s) => s.attention)
  const byWorkspaceId = useAgentTabsStore((s) => s.byWorkspaceId)
  const closeTab = useAgentTabsStore((s) => s.closeTab)
  const addTab = useAgentTabsStore((s) => s.addTab)
  const claudeInstalled = useClaudeCodeCliStore((s) => s.installed)

  const [repoKindById, setRepoKindById] = useState<
    Record<string, 'loading' | 'git' | 'plain'>
  >({})

  const workspacePathSig = useMemo(
    () =>
      workspaces
        .map((w) => `${w.id}\0${w.path}`)
        .sort()
        .join('\n'),
    [workspaces],
  )

  useEffect(() => {
    let cancelled = false
    setRepoKindById(() => {
      const next: Record<string, 'loading' | 'git' | 'plain'> = {}
      for (const w of workspaces) {
        next[w.id] = w.path ? 'loading' : 'plain'
      }
      return next
    })
    for (const w of workspaces) {
      if (!w.path) continue
      const id = w.id
      const path = w.path
      void window.mux.git.classify(path).then((c) => {
        if (cancelled) return
        setRepoKindById((prev) => ({ ...prev, [id]: c.isRepo ? 'git' : 'plain' }))
      })
    }
    return () => {
      cancelled = true
    }
  }, [workspacePathSig])

  const [worktreeOpen, setWorktreeOpen] = useState(false)
  const [worktreeCtx, setWorktreeCtx] = useState<{ workspaceId: string } | null>(null)
  const [worktreeDialogFirst, setWorktreeDialogFirst] = useState(true)
  const [createError, setCreateError] = useState<string | null>(null)

  useEffect(() => {
    if (worktreeOpen) setCreateError(null)
  }, [worktreeOpen])

  const [closeWorktreeConfirm, setCloseWorktreeConfirm] = useState<{
    workspaceId: string
    tabId: string
    agentPath: string
    label: string
  } | null>(null)
  /** `workspaceId:tabId` — show close control when pointer is over this agent row. */
  const [hoveredAgentSessionId, setHoveredAgentSessionId] = useState<string | null>(null)

  const requestCloseAgentTab = useCallback(
    async (workspaceId: string, tab: AgentTab) => {
      const kind = await classifyAgentWorktreeClose(tab)
      if (kind === 'plain') {
        closeTab(workspaceId, tab.id)
        return
      }
      if (kind === 'stale') {
        void runWithStatusActivity(
          { domain: 'git', label: 'Removing worktree', detail: tab.agentPath! },
          async () => {
            const r = await window.mux.git.removeMuxWorktree(tab.agentPath!)
            if (r.ok) {
              closeTab(workspaceId, tab.id)
              void refreshFocusedCheckoutGit()
            }
            return r
          },
        )
        return
      }
      setCloseWorktreeConfirm({
        workspaceId,
        tabId: tab.id,
        agentPath: tab.agentPath!,
        label: tab.label,
      })
    },
    [closeTab],
  )

  function activateWorkspace(wId: string) {
    const attentionSid = firstAttentionSessionIdInWorkspace(wId, attention, hasCompletedTurnBySession)
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

  const startAgentOnMain = useCallback(
    (workspaceId: string) => {
      if (claudeInstalled !== true) return
      setActiveWorkspaceId(workspaceId)
      addTab(workspaceId)
    },
    [addTab, claudeInstalled, setActiveWorkspaceId],
  )

  const openWorktreeDialogForWorkspace = useCallback(
    (workspaceId: string) => {
      if (claudeInstalled !== true) return
      const tabs = byWorkspaceId[workspaceId]?.tabs ?? []
      setWorktreeDialogFirst(tabs.length === 0)
      setWorktreeCtx({ workspaceId })
      setWorktreeOpen(true)
    },
    [byWorkspaceId, claudeInstalled],
  )

  const confirmWorktree = useCallback(
    async (worktreeName: string): Promise<boolean> => {
      const ctx = worktreeCtx
      if (!ctx) return false
      const w = workspaces.find((x) => x.id === ctx.workspaceId)
      const repoPath = w?.path
      if (!repoPath) return false
      return runWithStatusActivity(
        { domain: 'git', label: 'Creating worktree', detail: worktreeName.trim() },
        async () => {
          const result = await window.mux.git.createWorktree({
            repoCwd: repoPath,
            worktreeName,
          })
          if (!result.ok) {
            setCreateError(result.error)
            return false
          }
          setActiveWorkspaceId(ctx.workspaceId)
          addTab(ctx.workspaceId, {
            agentPath: result.worktreePath,
            label: worktreeName.trim(),
          })
          void refreshFocusedCheckoutGit()
          return true
        },
      )
    },
    [addTab, setActiveWorkspaceId, worktreeCtx, workspaces],
  )

  return (
    <>
      <WorktreeNameDialog
        open={worktreeOpen}
        onOpenChange={(o) => {
          setWorktreeOpen(o)
          if (!o) setWorktreeCtx(null)
        }}
        title={worktreeDialogFirst ? 'Create a worktree' : 'New agent worktree'}
        description={
          worktreeDialogFirst
            ? 'Pick a short name. 10x creates a dedicated checkout under ~/10x-worktrees for this agent tab.'
            : 'Pick a short name for another isolated checkout. Each tab keeps its own worktree.'
        }
        confirmLabel={worktreeDialogFirst ? 'Create worktree' : 'Create and open tab'}
        error={createError}
        onConfirm={confirmWorktree}
      />
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
          return (
            <div
              key={w.id}
              className={cn(
                'group min-w-0 rounded-md px-1 py-0.5',
                w.id === activeWorkspaceId && 'bg-sidebar-accent text-sidebar-accent-foreground',
              )}
            >
              <div className="grid min-w-0 max-w-full grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-1">
                <button
                  type="button"
                  className="grid min-h-9 min-w-0 w-full max-w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0"
                  onClick={() => activateWorkspace(w.id)}
                >
                  <FolderOpen className="size-3.5 shrink-0 opacity-70" />
                  <span className="min-w-0 truncate" title={w.label}>
                    {w.label}
                  </span>
                </button>
                {(() => {
                  const rk = repoKindById[w.id]
                  const addDisabled =
                    !w.path || rk === 'loading' || rk === undefined || claudeInstalled !== true
                  const addTitle =
                    claudeInstalled !== true
                      ? 'Claude Code CLI required'
                      : rk === 'loading'
                        ? 'Checking folder…'
                        : 'New agent tab'
                  if (rk === 'git' && w.path) {
                    return (
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0 opacity-0 group-hover:opacity-100"
                            title={addTitle}
                            disabled={addDisabled}
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Plus className="size-3.5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                          <DropdownMenuItem
                            onSelect={() => {
                              startAgentOnMain(w.id)
                            }}
                          >
                            Start agent on main
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onSelect={() => {
                              openWorktreeDialogForWorkspace(w.id)
                            }}
                          >
                            Create worktree…
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    )
                  }
                  return (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="shrink-0 opacity-0 group-hover:opacity-100"
                      title={addTitle}
                      disabled={addDisabled}
                      onClick={(e) => {
                        e.stopPropagation()
                        startAgentOnMain(w.id)
                      }}
                    >
                      <Plus className="size-3.5" />
                    </Button>
                  )
                })()}
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
                    const tabAct = tabActivity(w.id, tab.id, activityBySession)
                    const tabHri = tabHasReceivedInput(w.id, tab.id, hasReceivedInputBySession)
                    const tabHct = tabHasCompletedTurn(w.id, tab.id, hasCompletedTurnBySession)
                    return (
                      <li
                        key={tab.id}
                        className="min-w-0"
                        onMouseEnter={() => setHoveredAgentSessionId(sessionId)}
                        onMouseLeave={() => setHoveredAgentSessionId(null)}
                      >
                        <div
                          className={cn(
                            'grid min-h-7 w-full min-w-0 max-w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-1.5 overflow-hidden rounded-sm pl-2 pr-0 text-xs transition-colors',
                            isActiveAgent
                              ? 'bg-background/80 font-medium text-foreground'
                              : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                          )}
                        >
                          <div className="flex min-w-0 shrink justify-end self-center">
                            <AgentActivityBadge
                              state={tabAct}
                              hasReceivedInput={tabHri}
                              railIdleText={
                                tabAct === 'idle'
                                  ? workspaceRailIdleLabel(w.id, tab.id, attention, tabHct)
                                  : undefined
                              }
                            />
                          </div>
                          <button
                            type="button"
                            className="min-h-7 min-w-0 w-full max-w-full bg-transparent py-1 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:ring-offset-0"
                            onClick={() => navigateToAgentSession(sessionId)}
                          >
                            <EditableAgentTabLabel
                              tabId={tab.id}
                              workspaceId={w.id}
                              isTabActive={isActiveAgent}
                            />
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
                              void requestCloseAgentTab(w.id, tab)
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
