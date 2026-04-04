import { useLayoutEffect, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { useTerminalScopeStore, type TerminalScope } from '@/stores/terminal-scope-store'
import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import {
  useWorktreeTerminalsStore,
  worktreeTerminalsKey,
} from '@/stores/worktree-terminals-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { EditableAppWideShellLabel } from './editable-app-wide-shell-label'
import { EditableGlobalShellLabel } from './editable-global-shell-label'
import { EditableWorktreeShellLabel } from './editable-worktree-shell-label'
import { ShellTerminal } from './shell-terminal'
import {
  appWideShellSessionId,
  globalShellSessionId,
  worktreeShellSessionId,
} from './workspace-shell-terminal'

export function TerminalPanel() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const visibleWorkspaceId = useVisibleWorkspaceId()
  const active = useActiveWorkspace()
  const byWorkspaceId = useAgentTabsStore((s) => s.byWorkspaceId)
  const byKey = useWorktreeTerminalsStore((s) => s.byKey)
  const activeShellMap = useWorktreeTerminalsStore((s) => s.activeShellId)
  const addShell = useWorktreeTerminalsStore((s) => s.addShell)
  const removeShell = useWorktreeTerminalsStore((s) => s.removeShell)
  const setActiveShell = useWorktreeTerminalsStore((s) => s.setActiveShell)
  const reconcileActiveShell = useWorktreeTerminalsStore((s) => s.reconcileActiveShell)

  const globalByWorkspaceId = useGlobalTerminalsStore((s) => s.byWorkspaceId)
  const globalActiveMap = useGlobalTerminalsStore((s) => s.activeShellId)
  const addGlobalShell = useGlobalTerminalsStore((s) => s.addShell)
  const removeGlobalShell = useGlobalTerminalsStore((s) => s.removeShell)
  const setGlobalActiveShell = useGlobalTerminalsStore((s) => s.setActiveShell)
  const reconcileGlobalActiveShell = useGlobalTerminalsStore((s) => s.reconcileActiveShell)

  const appWideShells = useAppWideTerminalsStore((s) => s.shells)
  const activeAppWideShellId = useAppWideTerminalsStore((s) => s.activeShellId)
  const addAppWideShell = useAppWideTerminalsStore((s) => s.addShell)
  const removeAppWideShell = useAppWideTerminalsStore((s) => s.removeShell)
  const setActiveAppWideShell = useAppWideTerminalsStore((s) => s.setActiveShell)
  const reconcileAppWideActive = useAppWideTerminalsStore((s) => s.reconcileActive)

  const [homeDir, setHomeDir] = useState<string | null>(null)

  const scopeByWorkspace = useTerminalScopeStore((s) => s.scopeByWorkspace)
  const setScopeInStore = useTerminalScopeStore((s) => s.setScope)

  const noWorkspace = workspaces.length === 0
  const visibleId =
    workspaces.length === 0 ? null : (visibleWorkspaceId ?? workspaces[0]!.id)
  const visibleBucket = visibleId ? byWorkspaceId[visibleId] : undefined
  const activeAgentTabId = visibleBucket?.activeTabId ?? null
  const activeAgentTab = visibleBucket?.tabs.find((t) => t.id === activeAgentTabId) ?? null
  const visibleWsRow = visibleId ? workspaces.find((w) => w.id === visibleId) : undefined
  const agentCwd =
    activeAgentTab && visibleWsRow
      ? (activeAgentTab.agentPath ?? visibleWsRow.path)
      : (visibleWsRow?.path ?? '')

  const wtKey =
    visibleId && activeAgentTabId ? worktreeTerminalsKey(visibleId, activeAgentTabId) : null
  const agentShells = wtKey ? (byKey[wtKey] ?? []) : []
  const activeShellId = wtKey ? (activeShellMap[wtKey] ?? null) : null

  const globalShells = visibleId ? (globalByWorkspaceId[visibleId] ?? []) : []
  const activeGlobalShellId = visibleId ? (globalActiveMap[visibleId] ?? null) : null

  const terminalScope: TerminalScope = visibleId
    ? (scopeByWorkspace[visibleId] ?? 'global')
    : 'global'

  /** No workspaces → only global terminals; hide Global/Workspace/Agent chrome. */
  const terminalScopeEffective: TerminalScope = noWorkspace ? 'global' : terminalScope

  function setTerminalScope(next: TerminalScope) {
    if (noWorkspace) return
    if (!visibleId) return
    setScopeInStore(visibleId, next)
  }

  function addGlobalShellAndFocus() {
    if (!visibleId) return
    addGlobalShell(visibleId)
  }

  function addAppWideShellAndFocus() {
    if (visibleId) setScopeInStore(visibleId, 'global')
    addAppWideShell()
  }

  function pickAppWideTab(shellId: string) {
    if (visibleId) setScopeInStore(visibleId, 'global')
    setActiveAppWideShell(shellId)
  }

  const hasAnyAgentShell = Object.values(byKey).some((list) => list.length > 0)
  const hasAnyAppWideShell = appWideShells.length > 0
  const hasAnyWorkspaceProjectShell = workspaces.some(
    (ws) => (globalByWorkspaceId[ws.id]?.length ?? 0) > 0,
  )
  const hasAnyProjectShell = hasAnyAppWideShell || hasAnyWorkspaceProjectShell

  useLayoutEffect(() => {
    void window.mux.app.getHomeDir().then(setHomeDir)
  }, [])

  useLayoutEffect(() => {
    if (!visibleId || !activeAgentTabId) return
    reconcileActiveShell(visibleId, activeAgentTabId)
  }, [visibleId, activeAgentTabId, agentShells, reconcileActiveShell])

  useLayoutEffect(() => {
    if (!visibleId) return
    reconcileGlobalActiveShell(visibleId)
  }, [visibleId, globalShells, reconcileGlobalActiveShell])

  useLayoutEffect(() => {
    reconcileAppWideActive()
  }, [appWideShells, reconcileAppWideActive])

  const projectPath = visibleWsRow?.path ?? ''
  const projectTabCwdHint =
    terminalScopeEffective === 'global' && homeDir
      ? homeDir
      : terminalScopeEffective === 'project' && projectPath.length > 0
        ? projectPath
        : null

  const showingGlobalOrWorkspace =
    terminalScopeEffective === 'global' || terminalScopeEffective === 'project'

  const agentShellLayer = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {/* Keep hosts mounted whenever any agent shell exists, even if the visible workspace has none (workspace switch). */}
      {hasAnyAgentShell ? (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {workspaces.map((ws) => {
            const bucket = byWorkspaceId[ws.id]
            const tabs = bucket?.tabs ?? []
            if (tabs.length === 0) return null
            const isWsVisible = ws.id === visibleId
            return (
              <div
                key={ws.id}
                className={cn(
                  'flex min-h-0 min-w-0 flex-col',
                  isWsVisible
                    ? 'relative z-10 min-h-0 flex-1'
                    : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0',
                )}
                aria-hidden={!isWsVisible}
              >
                {tabs.flatMap((tab) => {
                  const shells = byKey[worktreeTerminalsKey(ws.id, tab.id)] ?? []
                  return shells.map((sh) => {
                    const cwd = tab.agentPath ?? ws.path
                    const isVisibleLayer =
                      ws.id === visibleId &&
                      tab.id === activeAgentTabId &&
                      sh.id === activeShellId
                    return (
                      <div
                        key={sh.id}
                        className={cn(
                          'flex min-h-0 min-w-0 flex-col',
                          isVisibleLayer
                            ? 'relative z-10 min-h-0 flex-1'
                            : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0',
                        )}
                        aria-hidden={!isVisibleLayer}
                      >
                        <ShellTerminal
                          sessionId={worktreeShellSessionId(ws.id, tab.id, sh.id)}
                          cwd={cwd}
                        />
                      </div>
                    )
                  })
                })}
              </div>
            )
          })}
        </div>
      ) : null}

      {noWorkspace ? (
        <div className="absolute inset-0 z-20 flex flex-1 items-center justify-center bg-card/95 p-4 text-center text-xs text-muted-foreground">
          Add a workspace to open agent tabs and shells here.
        </div>
      ) : !activeAgentTabId || !visibleBucket?.tabs.length ? (
        <div className="absolute inset-0 z-20 flex flex-1 items-center justify-center bg-card/95 p-4 text-center text-xs text-muted-foreground">
          Open or create an agent tab to use shells in that tab’s folder.
        </div>
      ) : agentShells.length === 0 ? (
        <div className="absolute inset-0 z-20 flex flex-1 flex-col items-center justify-center gap-2 bg-card/95 p-4 text-center">
          <p className="text-xs text-muted-foreground">No shells for this agent yet.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addShell(visibleId!, activeAgentTabId!)}
          >
            <Plus className="size-3.5" />
            Add shell
          </Button>
        </div>
      ) : null}
    </div>
  )

  const appWideLayerVisible =
    terminalScopeEffective === 'global' &&
    hasAnyAppWideShell &&
    activeAppWideShellId != null &&
    appWideShells.some((s) => s.id === activeAppWideShellId)
  const workspaceProjectLayerVisible =
    terminalScopeEffective === 'project' &&
    globalShells.length > 0 &&
    activeGlobalShellId != null &&
    globalShells.some((s) => s.id === activeGlobalShellId)

  /** When both host trees exist, only the active scope participates in flex layout; the other is out-of-flow. */
  const appWideHostTreePresent = hasAnyAppWideShell && Boolean(homeDir)
  const bothGlobalAndWorkspaceHostTrees = appWideHostTreePresent && hasAnyWorkspaceProjectShell
  const appWideHostsTakeLayoutSpace =
    !bothGlobalAndWorkspaceHostTrees || terminalScopeEffective === 'global'
  const workspaceHostsTakeLayoutSpace =
    !bothGlobalAndWorkspaceHostTrees || terminalScopeEffective === 'project'

  const projectShellLayer = (
    <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
      {hasAnyAppWideShell && homeDir ? (
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            appWideHostsTakeLayoutSpace
              ? 'relative z-[1] min-h-0 flex-1'
              : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0 overflow-hidden',
          )}
          aria-hidden={bothGlobalAndWorkspaceHostTrees && terminalScopeEffective !== 'global'}
        >
          {appWideShells.map((sh) => {
            const isVisibleLayer = terminalScopeEffective === 'global' && sh.id === activeAppWideShellId
            return (
              <div
                key={sh.id}
                className={cn(
                  'flex min-h-0 min-w-0 flex-col',
                  isVisibleLayer
                    ? 'relative z-10 min-h-0 flex-1'
                    : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0',
                )}
                aria-hidden={!isVisibleLayer}
              >
                <ShellTerminal
                  sessionId={appWideShellSessionId(sh.id)}
                  cwd={homeDir}
                />
              </div>
            )
          })}
        </div>
      ) : null}

      {hasAnyWorkspaceProjectShell ? (
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-col',
            workspaceHostsTakeLayoutSpace
              ? 'relative z-[1] min-h-0 flex-1'
              : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0 overflow-hidden',
          )}
          aria-hidden={bothGlobalAndWorkspaceHostTrees && terminalScopeEffective !== 'project'}
        >
          {workspaces.map((ws) => {
            const shells = globalByWorkspaceId[ws.id] ?? []
            if (shells.length === 0) return null
            const activeG = globalActiveMap[ws.id] ?? null
            const isWsVisible = ws.id === visibleId
            return (
              <div
                key={ws.id}
                className={cn(
                  'flex min-h-0 min-w-0 flex-col',
                  isWsVisible
                    ? 'relative z-10 min-h-0 flex-1'
                    : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0',
                )}
                aria-hidden={!isWsVisible}
              >
                {shells.map((sh) => {
                  const isVisibleLayer =
                    terminalScopeEffective === 'project' && ws.id === visibleId && sh.id === activeG
                  return (
                    <div
                      key={sh.id}
                      className={cn(
                        'flex min-h-0 min-w-0 flex-col',
                        isVisibleLayer
                          ? 'relative z-10 min-h-0 flex-1'
                          : 'pointer-events-none invisible absolute inset-0 z-0 min-h-0',
                      )}
                      aria-hidden={!isVisibleLayer}
                    >
                      <ShellTerminal
                        sessionId={globalShellSessionId(ws.id, sh.id)}
                        cwd={ws.path}
                      />
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      ) : null}

      {!hasAnyProjectShell ? (
        terminalScopeEffective === 'global' ? (
          <div className="absolute inset-0 z-20 flex flex-1 flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center">
            <p className="max-w-xs text-xs text-muted-foreground">
              {noWorkspace
                ? 'No global shells yet. Add one for a terminal in your home directory.'
                : 'No global shells yet. These run in your home directory and are shared across workspaces.'}
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => addAppWideShellAndFocus()}
              title="Shell in your home directory, shared across workspaces"
            >
              <Plus className="size-3.5" />
              Add global shell
            </Button>
          </div>
        ) : terminalScopeEffective === 'project' && visibleId ? (
          <div className="absolute inset-0 z-20 flex flex-1 flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center">
            <p className="max-w-xs text-xs text-muted-foreground">
              No workspace shells yet. These run in this workspace’s folder on disk.
            </p>
            <Button type="button" size="sm" variant="outline" onClick={() => addGlobalShellAndFocus()}>
              <Plus className="size-3.5" />
              Add workspace shell
            </Button>
          </div>
        ) : null
      ) : !appWideLayerVisible && !workspaceProjectLayerVisible ? (
        <div className="absolute inset-0 z-20 flex flex-1 flex-col items-center justify-center gap-3 bg-card/95 p-4 text-center">
          {homeDir == null && hasAnyAppWideShell ? (
            <p className="text-xs text-muted-foreground">Resolving home directory…</p>
          ) : terminalScopeEffective === 'global' ? (
            <>
              <p className="max-w-xs text-xs text-muted-foreground">
                No global shell open. Add one for your home directory, or pick a tab above.
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => addAppWideShellAndFocus()}>
                <Plus className="size-3.5" />
                Add global shell
              </Button>
            </>
          ) : terminalScopeEffective === 'project' && visibleId && globalShells.length === 0 ? (
            <>
              <p className="max-w-xs text-xs text-muted-foreground">
                No shell in this workspace’s folder yet.
                {hasAnyAppWideShell ? (
                  <>
                    {' '}
                    Switch to <span className="font-medium text-foreground">Global</span> for home-directory
                    shells, or add a workspace shell here.
                  </>
                ) : null}
              </p>
              <Button type="button" size="sm" variant="outline" onClick={() => addGlobalShellAndFocus()}>
                <Plus className="size-3.5" />
                Add workspace shell
              </Button>
            </>
          ) : (
            <p className="text-xs text-muted-foreground">Select a tab above.</p>
          )}
        </div>
      ) : null}
    </div>
  )

  return (
    <section
      id="mux-terminal-panel"
      data-mux-terminal-scope={terminalScopeEffective}
      className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-t border-border bg-card"
      aria-label="Terminal panel"
    >
      <div className="flex h-8 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="shrink-0">Terminal</span>
          {!noWorkspace ? (
            <div className="flex min-w-0 items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
              <button
                type="button"
                onClick={() => setTerminalScope('global')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  terminalScopeEffective === 'global'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Global
              </button>
              <button
                type="button"
                onClick={() => setTerminalScope('project')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  terminalScopeEffective === 'project'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Workspace
              </button>
              <button
                type="button"
                onClick={() => setTerminalScope('agent')}
                className={cn(
                  'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                  terminalScopeEffective === 'agent'
                    ? 'bg-background text-foreground shadow-sm'
                    : 'text-muted-foreground hover:text-foreground',
                )}
              >
                Agent
              </button>
            </div>
          ) : null}
        </div>
        {noWorkspace ? (
          <span
            className="max-w-[40%] truncate text-[10px] text-foreground/60"
            title="Shells run in your home directory"
          >
            Home
          </span>
        ) : active ? (
          <span className="max-w-[40%] truncate font-mono text-[10px] text-foreground/70" title={active.path}>
            {active.label}
          </span>
        ) : (
          <span className="text-[10px] text-foreground/60">—</span>
        )}
      </div>

      {terminalScopeEffective === 'global' && appWideShells.length > 0 ? (
        <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/80 bg-muted/20 px-2">
          {appWideShells.map((sh) => {
            const tabActive = sh.id === activeAppWideShellId
            return (
              <div key={`g:${sh.id}`} className="flex min-w-0 items-center">
                <button
                  type="button"
                  onClick={() => pickAppWideTab(sh.id)}
                  className={cn(
                    'flex max-w-32 min-w-0 items-center rounded border px-2 py-0.5 text-[11px]',
                    tabActive
                      ? 'border-border bg-background text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <EditableAppWideShellLabel shellId={sh.id} isActive={tabActive} />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 shrink-0 text-muted-foreground"
                  title="Close global shell"
                  onClick={() => removeAppWideShell(sh.id)}
                >
                  <X className="size-2.5" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0"
            title="New global shell (home directory, all workspaces)"
            onClick={() => addAppWideShellAndFocus()}
          >
            <Plus className="size-3" />
          </Button>
          {projectTabCwdHint ? (
            <span
              className="ml-auto truncate font-mono text-[10px] text-foreground/60"
              title={projectTabCwdHint}
            >
              {projectTabCwdHint}
            </span>
          ) : null}
        </div>
      ) : null}

      {terminalScopeEffective === 'project' && visibleId && globalShells.length > 0 ? (
        <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/80 bg-muted/20 px-2">
          {globalShells.map((sh) => {
            const tabActive = sh.id === activeGlobalShellId
            return (
              <div key={`p:${sh.id}`} className="flex min-w-0 items-center">
                <button
                  type="button"
                  onClick={() => {
                    setScopeInStore(visibleId, 'project')
                    setGlobalActiveShell(visibleId, sh.id)
                  }}
                  className={cn(
                    'flex max-w-32 min-w-0 items-center rounded border px-2 py-0.5 text-[11px]',
                    tabActive
                      ? 'border-border bg-background text-foreground'
                      : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  <EditableGlobalShellLabel
                    workspaceId={visibleId}
                    shellId={sh.id}
                    isActive={tabActive}
                  />
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-xs"
                  className="size-6 shrink-0 text-muted-foreground"
                  title="Close workspace shell"
                  onClick={() => removeGlobalShell(visibleId, sh.id)}
                >
                  <X className="size-2.5" />
                </Button>
              </div>
            )
          })}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0"
            title="New workspace shell (this folder)"
            onClick={() => addGlobalShellAndFocus()}
          >
            <Plus className="size-3" />
          </Button>
          {projectTabCwdHint ? (
            <span
              className="ml-auto truncate font-mono text-[10px] text-foreground/60"
              title={projectTabCwdHint}
            >
              {projectTabCwdHint}
            </span>
          ) : null}
        </div>
      ) : null}

      {terminalScopeEffective === 'agent' && visibleId && activeAgentTabId && agentShells.length > 0 ? (
        <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/80 bg-muted/20 px-2">
          {agentShells.map((sh) => (
            <div key={sh.id} className="flex min-w-0 items-center">
              <button
                type="button"
                onClick={() => setActiveShell(visibleId, activeAgentTabId, sh.id)}
                className={cn(
                  'flex max-w-32 min-w-0 items-center rounded border px-2 py-0.5 text-[11px]',
                  sh.id === activeShellId
                    ? 'border-border bg-background text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <EditableWorktreeShellLabel
                  workspaceId={visibleId}
                  agentTabId={activeAgentTabId}
                  shellId={sh.id}
                  isActive={sh.id === activeShellId}
                />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-6 shrink-0 text-muted-foreground"
                title="Close shell"
                onClick={() => removeShell(visibleId, activeAgentTabId, sh.id)}
              >
                <X className="size-2.5" />
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="ghost"
            size="icon-xs"
            className="size-6 shrink-0"
            title="New shell"
            onClick={() => addShell(visibleId, activeAgentTabId)}
          >
            <Plus className="size-3" />
          </Button>
          {agentCwd ? (
            <span className="ml-auto truncate font-mono text-[10px] text-foreground/60" title={agentCwd}>
              {agentCwd}
            </span>
          ) : null}
        </div>
      ) : null}

      {/* Keep layers mounted so switching Global / Workspace / Agent does not unmount PTYs. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            !showingGlobalOrWorkspace && 'hidden',
          )}
          aria-hidden={!showingGlobalOrWorkspace}
        >
          {projectShellLayer}
        </div>
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            terminalScopeEffective !== 'agent' && 'hidden',
          )}
          aria-hidden={terminalScopeEffective !== 'agent'}
        >
          {agentShellLayer}
        </div>
      </div>
    </section>
  )
}
