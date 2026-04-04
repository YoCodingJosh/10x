import { useEffect, useLayoutEffect, useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { CloseAgentWorktreeDialog } from '@/features/git/close-agent-worktree-dialog'
import { WorktreeNameDialog } from '@/features/git/worktree-name-dialog'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useWorkspaceById } from '@/features/workspaces/hooks/use-workspace-by-id'
import { runClaudeCodeInstallInGlobalTerminal } from '@/features/terminal-panel/run-claude-install-in-global-terminal'
import { runWithStatusActivity } from '@/lib/status/run-with-status-activity'
import type { AgentTab } from '@/stores/agent-tabs-store'
import { useAgentTabCloseIntentStore } from '@/stores/agent-tab-close-intent-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'
import { useCommandPaletteIntentsStore } from '@/stores/command-palette-intents-store'
import { refreshFocusedCheckoutGit, useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import {
  tabNeedsAttention,
  useAgentNotificationStore,
} from '@/stores/agent-notification-store'
import { cn } from '@/lib/utils'
import { GitBranchPlus, Plus, X } from 'lucide-react'

import { ClaudeSessionPane } from './claude-session-pane'
import { EditableAgentTabLabel } from './editable-agent-tab-label'
import { TabIdProvider } from './tab-id-context'
import { useWorkspaceSessionScope } from './workspace-id-context'

/** Stable fallback so Zustand's getSnapshot is not a new `[]` every subscribe (avoids infinite loop). */
const EMPTY_TABS: readonly AgentTab[] = []

/** Last palette `worktreeNonce` applied to the visible workspace (module-level so hidden panels don’t consume it). */
let lastWorktreePaletteNonceHandled = 0

/** Last `newAgentTabNonce` from keyboard / palette (same visibility guard as worktree). */
let lastNewAgentTabNonceHandled = 0

export function AgentSessionsPanel() {
  const workspaceId = useWorkspaceSessionScope()
  const workspace = useWorkspaceById(workspaceId)
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const isVisiblePanel = visibleWorkspaceId === workspaceId
  const storeWt = useGitFocusedCheckoutStore((s) => s.wt)

  const tabs = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.tabs ?? EMPTY_TABS)
  const activeTabId = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.activeTabId ?? null)
  const setActiveTab = useAgentTabsStore((s) => s.setActiveTab)
  const addTab = useAgentTabsStore((s) => s.addTab)
  const closeTab = useAgentTabsStore((s) => s.closeTab)

  const closeIntent = useAgentTabCloseIntentStore((s) => s.intent)
  const clearCloseIntent = useAgentTabCloseIntentStore((s) => s.clearIntent)

  const attention = useAgentNotificationStore((s) => s.attention)
  const focusedAgentSessionId = useAgentNotificationStore((s) => s.focusedAgentSessionId)

  const [worktreeOpen, setWorktreeOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [worktreeDialogFirst, setWorktreeDialogFirst] = useState(true)
  const [closeWorktreeConfirm, setCloseWorktreeConfirm] = useState<{
    tabId: string
    agentPath: string
    label: string
  } | null>(null)

  const [hiddenRepoKind, setHiddenRepoKind] = useState<'loading' | 'git' | 'plain'>('loading')

  const worktreeNonce = useCommandPaletteIntentsStore((s) => s.worktreeNonce)
  const newAgentTabNonce = useCommandPaletteIntentsStore((s) => s.newAgentTabNonce)
  const claudeInstalled = useClaudeCodeCliStore((s) => s.installed)

  useEffect(() => {
    if (workspaceId !== visibleWorkspaceId) return
    if (worktreeNonce <= lastWorktreePaletteNonceHandled) return
    lastWorktreePaletteNonceHandled = worktreeNonce
    if (useClaudeCodeCliStore.getState().installed !== true) return
    setWorktreeDialogFirst(tabs.length === 0)
    setWorktreeOpen(true)
  }, [worktreeNonce, workspaceId, visibleWorkspaceId, tabs.length])

  useEffect(() => {
    if (workspaceId !== visibleWorkspaceId) return
    if (newAgentTabNonce <= lastNewAgentTabNonceHandled) return
    lastNewAgentTabNonceHandled = newAgentTabNonce
    if (useClaudeCodeCliStore.getState().installed !== true) return
    useAgentTabsStore.getState().addTab(workspaceId)
  }, [newAgentTabNonce, workspaceId, visibleWorkspaceId])

  useEffect(() => {
    if (worktreeOpen) setCreateError(null)
  }, [worktreeOpen])

  useEffect(() => {
    if (isVisiblePanel) return
    if (!workspace?.path) {
      setHiddenRepoKind('plain')
      return
    }
    let cancelled = false
    setHiddenRepoKind('loading')
    void window.mux.git.classify(workspace.path).then((c) => {
      if (cancelled) return
      setHiddenRepoKind(c.isRepo ? 'git' : 'plain')
    })
    return () => {
      cancelled = true
    }
  }, [isVisiblePanel, workspace?.path])

  const repoKind: 'loading' | 'git' | 'plain' = isVisiblePanel
    ? storeWt === null
      ? 'loading'
      : storeWt.isRepo
        ? 'git'
        : 'plain'
    : hiddenRepoKind

  function openGitWorktreeDialog() {
    setWorktreeDialogFirst(tabs.length === 0)
    setWorktreeOpen(true)
  }

  function startPlainAgent() {
    addTab(workspaceId)
  }

  async function initializeGitInWorkspace() {
    const root = workspace?.path
    if (!root) return
    await runWithStatusActivity(
      { domain: 'git', label: 'Initializing repository', detail: root },
      async () => {
        const r = await window.mux.git.init(root)
        if (!r.ok) {
          window.alert(r.error)
          return r
        }
        void refreshFocusedCheckoutGit()
        return r
      },
    )
  }

  const canCreateAgents = claudeInstalled === true
  const newAgentPlusDisabled = !workspace?.path || repoKind === 'loading' || !canCreateAgents

  const resolvedTabId =
    tabs.length === 0
      ? null
      : activeTabId && tabs.some((t) => t.id === activeTabId)
        ? activeTabId
        : tabs[0]!.id

  useLayoutEffect(() => {
    if (resolvedTabId == null) return
    if (resolvedTabId !== activeTabId) {
      setActiveTab(workspaceId, resolvedTabId)
    }
  }, [workspaceId, activeTabId, resolvedTabId, setActiveTab])

  function requestCloseTab(tab: AgentTab) {
    if (!tab.agentPath) {
      closeTab(workspaceId, tab.id)
      return
    }
    setCloseWorktreeConfirm({
      tabId: tab.id,
      agentPath: tab.agentPath,
      label: tab.label,
    })
  }

  useEffect(() => {
    if (!closeIntent) return
    if (closeIntent.workspaceId !== workspaceId) return
    if (resolvedTabId == null || closeIntent.tabId !== resolvedTabId) {
      clearCloseIntent()
      return
    }
    const tab = tabs.find((t) => t.id === closeIntent.tabId)
    clearCloseIntent()
    if (!tab) return
    requestCloseTab(tab)
  }, [closeIntent, workspaceId, resolvedTabId, tabs, clearCloseIntent, requestCloseTab])

  async function confirmWorktree(worktreeName: string): Promise<boolean> {
    const repoPath = workspace?.path
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
        addTab(workspaceId, {
          agentPath: result.worktreePath,
          label: worktreeName.trim(),
        })
        void refreshFocusedCheckoutGit()
        return true
      },
    )
  }

  const emptyState = (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      {!workspace?.path ? (
        <p className="text-sm text-muted-foreground">Select a workspace to run agents.</p>
      ) : repoKind === 'loading' ? (
        <p className="text-sm text-muted-foreground">Checking folder…</p>
      ) : !canCreateAgents ? (
        claudeInstalled === null ? (
          <p className="text-sm text-muted-foreground">Checking for Claude Code…</p>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Install Claude Code</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                Agent tabs need the <span className="font-medium text-foreground">claude</span> CLI. We’ll open
                a <span className="font-medium text-foreground">global</span> terminal and run the official
                installer. When it finishes, use <span className="font-medium">Check again</span>.
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-2">
              <Button
                type="button"
                size="sm"
                onClick={() => {
                  runClaudeCodeInstallInGlobalTerminal(workspaceId)
                }}
              >
                Install Claude Code
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => void useClaudeCodeCliStore.getState().refresh()}
              >
                Check again
              </Button>
            </div>
          </>
        )
      ) : repoKind === 'git' ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Git repository</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Run Claude in the{' '}
              <span className="font-medium text-foreground">main checkout</span>, or
              add an isolated worktree under{' '}
              <code className="rounded bg-muted px-1 font-mono text-xs">~/10x-worktrees</code> when you
              want a parallel tree.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" onClick={() => startPlainAgent()}>
              Start agent
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => openGitWorktreeDialog()}
            >
              <GitBranchPlus className="size-3.5" />
              Create worktree
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No Git repo</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Claude will run in this folder. Initialize Git to unlock worktrees, or start an agent in the
              folder as-is.
            </p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button type="button" size="sm" onClick={() => startPlainAgent()}>
              Start agent
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="gap-2"
              onClick={() => void initializeGitInWorkspace()}
            >
              <GitBranchPlus className="size-3.5" />
              Initialize Git repository
            </Button>
          </div>
        </>
      )}
    </div>
  )

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
                closeTab(workspaceId, ctx.tabId)
                void refreshFocusedCheckoutGit()
              }
              return r
            },
          )
        }}
      />
      <WorktreeNameDialog
        open={worktreeOpen}
        onOpenChange={setWorktreeOpen}
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
      {tabs.length === 0 || resolvedTabId == null ? (
        emptyState
      ) : (
        <Tabs
          value={resolvedTabId}
          onValueChange={(v) => setActiveTab(workspaceId, v)}
          className="flex min-h-0 flex-1 flex-col gap-0"
        >
          <div className="flex h-9 min-h-9 max-h-9 shrink-0 items-center gap-1 overflow-hidden border-b border-border bg-muted/30 px-2">
            <TabsList
              variant="line"
              className="h-8 max-h-8 min-h-8 min-w-0 flex-1 flex-nowrap items-center justify-start overflow-x-auto overflow-y-hidden rounded-none bg-transparent p-0"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  asChild
                  className="h-8 max-h-8 flex-none shrink-0 rounded-md border border-transparent bg-transparent p-0 text-xs shadow-none data-[state=active]:border-border data-[state=active]:bg-background"
                >
                  <div className="flex h-8 max-h-8 min-h-0 min-w-0 max-w-44 items-stretch overflow-hidden">
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 px-2">
                      {tabNeedsAttention(workspaceId, tab.id, attention, focusedAgentSessionId) && (
                        <span className="size-1.5 shrink-0 rounded-full bg-blue-500" />
                      )}
                      <EditableAgentTabLabel tabId={tab.id} />
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-xs"
                      className="h-full shrink-0 rounded-none border-l border-border/60"
                      title="Close agent tab"
                      tabIndex={-1}
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        requestCloseTab(tab)
                      }}
                    >
                      <X className="size-3" />
                    </Button>
                  </div>
                </TabsTrigger>
              ))}
            </TabsList>
            {repoKind === 'git' && workspace?.path ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-xs"
                    className="shrink-0"
                    title="New agent tab"
                    disabled={newAgentPlusDisabled}
                  >
                    <Plus className="size-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onSelect={() => startPlainAgent()}>
                    Start agent on main
                  </DropdownMenuItem>
                  <DropdownMenuItem onSelect={() => openGitWorktreeDialog()}>
                    Create worktree…
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="icon-xs"
                className="shrink-0"
                title="New agent tab"
                disabled={newAgentPlusDisabled}
                onClick={() => startPlainAgent()}
              >
                <Plus className="size-3.5" />
              </Button>
            )}
          </div>

          {tabs.map((tab) => (
            <TabsContent
              key={tab.id}
              value={tab.id}
              forceMount
              className={cn('mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden')}
            >
              <TabIdProvider tabId={tab.id}>
                <ClaudeSessionPane />
              </TabIdProvider>
            </TabsContent>
          ))}
        </Tabs>
      )}
    </>
  )
}
