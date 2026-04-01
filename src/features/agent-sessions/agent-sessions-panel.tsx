import { useEffect, useLayoutEffect, useState } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import { CloseAgentWorktreeDialog } from '@/features/git/close-agent-worktree-dialog'
import { WorktreeNameDialog } from '@/features/git/worktree-name-dialog'
import { useWorkspaceById } from '@/features/workspaces/hooks/use-workspace-by-id'
import type { AgentTab } from '@/stores/agent-tabs-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { cn } from '@/lib/utils'
import { GitBranchPlus, Plus, X } from 'lucide-react'

import { ClaudeSessionPane } from './claude-session-pane'
import { EditableAgentTabLabel } from './editable-agent-tab-label'
import { TabIdProvider } from './tab-id-context'
import { useWorkspaceSessionScope } from './workspace-id-context'

/** Stable fallback so Zustand's getSnapshot is not a new `[]` every subscribe (avoids infinite loop). */
const EMPTY_TABS: readonly AgentTab[] = []

export function AgentSessionsPanel() {
  const workspaceId = useWorkspaceSessionScope()
  const workspace = useWorkspaceById(workspaceId)

  const tabs = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.tabs ?? EMPTY_TABS)
  const activeTabId = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.activeTabId ?? null)
  const setActiveTab = useAgentTabsStore((s) => s.setActiveTab)
  const addTab = useAgentTabsStore((s) => s.addTab)
  const closeTab = useAgentTabsStore((s) => s.closeTab)

  const [worktreeOpen, setWorktreeOpen] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [worktreeDialogFirst, setWorktreeDialogFirst] = useState(true)
  const [closeWorktreeConfirm, setCloseWorktreeConfirm] = useState<{
    tabId: string
    agentPath: string
    label: string
  } | null>(null)

  const [repoKind, setRepoKind] = useState<'loading' | 'git' | 'plain'>('loading')

  useEffect(() => {
    if (worktreeOpen) setCreateError(null)
  }, [worktreeOpen])

  useEffect(() => {
    if (!workspace?.path) {
      setRepoKind('plain')
      return
    }
    let cancelled = false
    setRepoKind('loading')
    void window.mux.git.classify(workspace.path).then((c) => {
      if (cancelled) return
      setRepoKind(c.isRepo ? 'git' : 'plain')
    })
    return () => {
      cancelled = true
    }
  }, [workspace?.path])

  function openGitWorktreeDialog() {
    setWorktreeDialogFirst(tabs.length === 0)
    setWorktreeOpen(true)
  }

  async function requestNewAgentTab() {
    if (!workspace?.path) {
      addTab(workspaceId)
      return
    }
    const classified = await window.mux.git.classify(workspace.path)
    if (!classified.isRepo) {
      addTab(workspaceId)
      return
    }
    openGitWorktreeDialog()
  }

  function startPlainAgent() {
    addTab(workspaceId)
  }

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

  async function confirmWorktree(worktreeName: string): Promise<boolean> {
    if (!workspace?.path) return false
    const result = await window.mux.git.createWorktree({
      repoCwd: workspace.path,
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
    return true
  }

  const emptyState = (
    <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-4 bg-background p-8 text-center">
      {!workspace?.path ? (
        <p className="text-sm text-muted-foreground">Select a workspace to run agents.</p>
      ) : repoKind === 'loading' ? (
        <p className="text-sm text-muted-foreground">Checking folder…</p>
      ) : repoKind === 'git' ? (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">Git repository</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Each Claude tab uses its own worktree under{' '}
              <code className="rounded bg-muted px-1 font-mono text-xs">~/10x-worktrees</code>. Create
              one to get started.
            </p>
          </div>
          <Button
            type="button"
            size="sm"
            className="gap-2"
            onClick={() => openGitWorktreeDialog()}
          >
            <GitBranchPlus className="size-3.5" />
            Create worktree
          </Button>
        </>
      ) : (
        <>
          <div className="space-y-1">
            <p className="text-sm font-medium text-foreground">No Git repo</p>
            <p className="max-w-sm text-sm text-muted-foreground">
              Claude will run in this folder. You can initialize Git anytime; new tabs will then use
              worktrees.
            </p>
          </div>
          <Button type="button" size="sm" onClick={() => startPlainAgent()}>
            Start agent
          </Button>
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
          const r = await window.mux.git.removeMuxWorktree(ctx.agentPath)
          if (r.ok) {
            closeTab(workspaceId, ctx.tabId)
          }
          return r
        }}
      />
      <WorktreeNameDialog
        open={worktreeOpen}
        onOpenChange={setWorktreeOpen}
        title={worktreeDialogFirst ? 'Create a worktree' : 'New agent worktree'}
        description={
          worktreeDialogFirst
            ? 'Pick a short name. Mux creates a dedicated checkout under ~/10x-worktrees for this agent tab.'
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
          <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-2">
            <TabsList
              variant="line"
              className="h-8 min-w-0 flex-1 flex-nowrap justify-start overflow-x-auto rounded-none bg-transparent p-0"
            >
              {tabs.map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  asChild
                  className="h-8 max-w-44 shrink-0 rounded-md border border-transparent bg-transparent p-0 text-xs shadow-none data-[state=active]:border-border data-[state=active]:bg-background"
                >
                  <div className="flex h-full min-w-0 items-stretch">
                    <span className="flex min-w-0 flex-1 items-center px-2">
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
            <Button
              type="button"
              variant="outline"
              size="icon-xs"
              className="shrink-0"
              title="New agent tab"
              onClick={() => void requestNewAgentTab()}
            >
              <Plus className="size-3.5" />
            </Button>
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
