import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef, useState } from 'react'

import { CLAUDE_CODE_INSTALL_URL } from '@/lib/claude-code-install'
import { useWorkspaceById } from '@/features/workspaces/hooks/use-workspace-by-id'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'

import '@xterm/xterm/css/xterm.css'

import { useAgentTabId } from './tab-id-context'
import { useWorkspaceSessionScope } from './workspace-id-context'

function sessionKey(workspaceId: string, tabId: string) {
  return `${workspaceId}:${tabId}`
}

function shouldIgnoreExitMessage(exitCode: number, signal?: number, tearingDown = false): boolean {
  if (tearingDown) return true
  if (exitCode === 0 && signal === 1) return true
  return false
}

/** PTY + xterm live here only so `sessionId` never appears in the parent render path (React Compiler–safe). */
function ClaudeAgentTerminal({
  workspaceId,
  tabId,
  cwd,
  label,
  notificationWorkspace,
  notificationAgent,
}: {
  workspaceId: string
  tabId: string
  cwd: string
  label: string
  notificationWorkspace: string
  notificationAgent: string
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tearingDownRef = useRef(false)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const sessionId = sessionKey(workspaceId, tabId)
    tearingDownRef.current = false
    setBootError(null)

    let cancelled = false

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 13,
      fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
      theme: {
        background: '#141414',
        foreground: '#e4e4e7',
        cursor: '#fafafa',
        cursorAccent: '#141414',
        selectionBackground: '#3f3f46',
      },
    })

    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(container)
    fit.fit()

    const ro = new ResizeObserver(() => {
      const el = containerRef.current
      if (!el) return
      const { width, height } = el.getBoundingClientRect()
      if (width < 2 || height < 2) return
      fit.fit()
      window.mux.pty.resize(sessionId, Math.max(term.cols, 2), Math.max(term.rows, 1))
    })
    ro.observe(container)

    let unsubData: (() => void) | undefined
    let unsubExit: (() => void) | undefined

    void (async () => {
      const cols = Math.max(term.cols, 2)
      const rows = Math.max(term.rows, 1)

      const created = await window.mux.pty.create({
        sessionId,
        cwd,
        cols,
        rows,
        kind: 'claude',
        label,
        notificationWorkspace,
        notificationAgent,
      })

      if (cancelled || tearingDownRef.current) {
        if (created.ok) void window.mux.pty.kill(sessionId)
        return
      }

      if (!created.ok) {
        setBootError(created.error)
        term.writeln(`\r\n\x1b[31mCould not start Claude Code: ${created.error}\x1b[0m`)
        term.writeln(`\r\nInstall the CLI (${CLAUDE_CODE_INSTALL_URL}) and ensure \`claude\` is on your PATH.`)
        return
      }

      unsubData = window.mux.pty.onData((payload) => {
        if (payload.sessionId !== sessionId) return
        term.write(payload.data)
      })

      unsubExit = window.mux.pty.onExit((payload) => {
        if (payload.sessionId !== sessionId) return
        if (shouldIgnoreExitMessage(payload.exitCode, payload.signal, tearingDownRef.current)) return
        term.writeln(
          `\r\n\x1b[33mProcess exited (code ${payload.exitCode}${payload.signal != null ? `, signal ${payload.signal}` : ''}).\x1b[0m`,
        )
      })

      term.onData((data) => {
        window.mux.pty.write(sessionId, data)
      })

      fit.fit()
      window.mux.pty.resize(sessionId, Math.max(term.cols, 2), Math.max(term.rows, 1))
    })()

    return () => {
      tearingDownRef.current = true
      cancelled = true
      ro.disconnect()
      unsubData?.()
      unsubExit?.()
      void window.mux.pty.kill(sessionId)
      term.dispose()
      container.replaceChildren()
    }
  }, [workspaceId, tabId, cwd, label, notificationWorkspace, notificationAgent])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div ref={containerRef} className="mux-terminal-host relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden px-1" />
      {bootError ? <p className="shrink-0 border-t border-border px-2 py-1 text-[11px] text-destructive">{bootError}</p> : null}
    </div>
  )
}

export function ClaudeSessionPane() {
  const tabId = useAgentTabId()
  const workspaceId = useWorkspaceSessionScope()
  const workspace = useWorkspaceById(workspaceId)
  const tab = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.tabs.find((t) => t.id === tabId) ?? null)
  const notificationAgent = tab?.label ?? 'Agent'
  const notificationWorkspace = workspace?.label ?? 'Workspace'

  return (
    <div className="flex h-full min-h-0 flex-col bg-background">
      <div className="shrink-0 border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {tab?.label ?? 'Agent'}
        {workspace ? (
          <span className="ml-2 font-mono text-[11px] text-foreground/80">— {workspace.label}</span>
        ) : (
          <span className="ml-2 text-amber-200/80">— add a workspace to run Claude</span>
        )}
      </div>
      {!workspace?.path ? (
        <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
          Select or add a workspace folder — Claude Code runs with that directory as{' '}
          <code className="mx-1 rounded bg-muted px-1 font-mono text-xs">cwd</code>.
        </div>
      ) : (
        <ClaudeAgentTerminal
          workspaceId={workspaceId}
          tabId={tabId}
          cwd={tab?.agentPath ?? workspace.path}
          label={`${notificationAgent} · ${workspace.label}`}
          notificationWorkspace={notificationWorkspace}
          notificationAgent={notificationAgent}
        />
      )}
    </div>
  )
}
