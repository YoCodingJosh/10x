import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Plus, X } from 'lucide-react'

import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { useVisibleWorkspaceId } from '@/features/workspaces/hooks/use-visible-workspace-id'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import {
  useWorktreeTerminalsStore,
  worktreeTerminalsKey,
} from '@/stores/worktree-terminals-store'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

import { EditableGlobalShellLabel } from './editable-global-shell-label'
import { EditableWorktreeShellLabel } from './editable-worktree-shell-label'
import { ShellTerminal } from './shell-terminal'
import { globalShellSessionId, worktreeShellSessionId } from './workspace-shell-terminal'

type TerminalScope = 'project' | 'agent'

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

  const [terminalScope, setTerminalScope] = useState<TerminalScope>('project')
  const prevVisibleWs = useRef<string | null>(null)

  useEffect(() => {
    if (visibleWorkspaceId == null) return
    if (prevVisibleWs.current !== null && prevVisibleWs.current !== visibleWorkspaceId) {
      setTerminalScope('project')
    }
    prevVisibleWs.current = visibleWorkspaceId
  }, [visibleWorkspaceId])

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

  useLayoutEffect(() => {
    if (!visibleId || !activeAgentTabId) return
    reconcileActiveShell(visibleId, activeAgentTabId)
  }, [visibleId, activeAgentTabId, agentShells, reconcileActiveShell])

  useLayoutEffect(() => {
    if (!visibleId) return
    reconcileGlobalActiveShell(visibleId)
  }, [visibleId, globalShells, reconcileGlobalActiveShell])

  if (workspaces.length === 0 || visibleId == null) {
    return (
      <section
        className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-card"
        aria-label="Terminal panel"
      >
        <div className="flex h-8 shrink-0 items-center border-b border-border px-2 text-xs text-muted-foreground">
          Terminal
        </div>
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Add a workspace to get a shell in its project folder.
        </div>
      </section>
    )
  }

  const projectPath = visibleWsRow?.path ?? ''

  const agentShellLayer = (
    <>
      {!activeAgentTabId || !visibleBucket?.tabs.length ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-xs text-muted-foreground">
          Open or create an agent tab to use shells in that tab’s folder.
        </div>
      ) : agentShells.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-muted-foreground">No shells for this agent yet.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addShell(visibleId, activeAgentTabId)}
          >
            <Plus className="size-3.5" />
            Add shell
          </Button>
        </div>
      ) : (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {workspaces.map((ws) => {
            const bucket = byWorkspaceId[ws.id]
            const tabs = bucket?.tabs ?? []
            if (tabs.length === 0) return null
            return (
              <div
                key={ws.id}
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col',
                  ws.id !== visibleId && 'hidden',
                )}
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
                          'flex min-h-0 min-w-0 flex-1 flex-col',
                          !isVisibleLayer && 'hidden',
                        )}
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
      )}
    </>
  )

  const projectShellLayer = (
    <>
      {globalShells.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 p-4 text-center">
          <p className="text-xs text-muted-foreground">No project shells yet.</p>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => addGlobalShell(visibleId)}
          >
            <Plus className="size-3.5" />
            Add shell
          </Button>
        </div>
      ) : (
        <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
          {workspaces.map((ws) => {
            const shells = globalByWorkspaceId[ws.id] ?? []
            if (shells.length === 0) return null
            const activeG = globalActiveMap[ws.id] ?? null
            return (
              <div
                key={ws.id}
                className={cn(
                  'flex min-h-0 min-w-0 flex-1 flex-col',
                  ws.id !== visibleId && 'hidden',
                )}
              >
                {shells.map((sh) => {
                  const isVisibleLayer = ws.id === visibleId && sh.id === activeG
                  return (
                    <div
                      key={sh.id}
                      className={cn(
                        'flex min-h-0 min-w-0 flex-1 flex-col',
                        !isVisibleLayer && 'hidden',
                      )}
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
      )}
    </>
  )

  return (
    <section
      className="flex min-h-0 min-w-0 flex-1 flex-col border-t border-border bg-card"
      aria-label="Terminal panel"
    >
      <div className="flex h-8 shrink-0 flex-wrap items-center gap-x-2 gap-y-1 border-b border-border px-2 text-xs text-muted-foreground">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          <span className="shrink-0">Terminal</span>
          <div className="flex min-w-0 items-center gap-0.5 rounded-md border border-border bg-muted/40 p-0.5">
            <button
              type="button"
              onClick={() => setTerminalScope('project')}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                terminalScope === 'project'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Project
            </button>
            <button
              type="button"
              onClick={() => setTerminalScope('agent')}
              className={cn(
                'rounded px-2 py-0.5 text-[11px] font-medium transition-colors',
                terminalScope === 'agent'
                  ? 'bg-background text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground',
              )}
            >
              Agent
            </button>
          </div>
        </div>
        {active ? (
          <span className="max-w-[40%] truncate font-mono text-[10px] text-foreground/70" title={active.path}>
            {active.label}
          </span>
        ) : (
          <span className="text-[10px] text-foreground/60">—</span>
        )}
      </div>

      {terminalScope === 'project' && globalShells.length > 0 ? (
        <div className="flex h-7 shrink-0 items-center gap-0.5 border-b border-border/80 bg-muted/20 px-2">
          {globalShells.map((sh) => (
            <div key={sh.id} className="flex min-w-0 items-center">
              <button
                type="button"
                onClick={() => setGlobalActiveShell(visibleId, sh.id)}
                className={cn(
                  'flex max-w-32 min-w-0 items-center rounded border px-2 py-0.5 text-[11px]',
                  sh.id === activeGlobalShellId
                    ? 'border-border bg-background text-foreground'
                    : 'border-transparent text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                )}
              >
                <EditableGlobalShellLabel
                  workspaceId={visibleId}
                  shellId={sh.id}
                  isActive={sh.id === activeGlobalShellId}
                />
              </button>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="size-6 shrink-0 text-muted-foreground"
                title="Close shell"
                onClick={() => removeGlobalShell(visibleId, sh.id)}
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
            onClick={() => addGlobalShell(visibleId)}
          >
            <Plus className="size-3" />
          </Button>
          {projectPath ? (
            <span
              className="ml-auto truncate font-mono text-[10px] text-foreground/60"
              title={projectPath}
            >
              {projectPath}
            </span>
          ) : null}
        </div>
      ) : null}

      {terminalScope === 'agent' && activeAgentTabId && agentShells.length > 0 ? (
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

      {/* Keep both layers mounted so switching Project ↔ Agent does not unmount PTYs. */}
      <div className="relative flex min-h-0 min-w-0 flex-1 flex-col">
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            terminalScope !== 'project' && 'hidden',
          )}
          aria-hidden={terminalScope !== 'project'}
        >
          {projectShellLayer}
        </div>
        <div
          className={cn(
            'flex min-h-0 min-w-0 flex-1 flex-col',
            terminalScope !== 'agent' && 'hidden',
          )}
          aria-hidden={terminalScope !== 'agent'}
        >
          {agentShellLayer}
        </div>
      </div>
    </section>
  )
}
