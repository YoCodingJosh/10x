import { FitAddon } from '@xterm/addon-fit'
import { Terminal } from '@xterm/xterm'
import { useEffect, useRef, useState } from 'react'

import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'

import '@xterm/xterm/css/xterm.css'

function shouldIgnoreExitMessage(exitCode: number, signal?: number, tearingDown = false): boolean {
  if (tearingDown) return true
  if (exitCode === 0 && signal === 1) return true
  return false
}

export type ShellTerminalProps = {
  sessionId: string
  cwd: string
  /** One-time stdin after the shell is ready (e.g. installer command). */
  runAfterSpawn?: string
}

/** Login shell bound to a stable PTY session id; parent can keep instances mounted (hidden) to preserve sessions. */
export function ShellTerminal({ sessionId, cwd, runAfterSpawn }: ShellTerminalProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tearingDownRef = useRef(false)
  const [bootError, setBootError] = useState<string | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

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
        kind: 'shell',
      })

      if (cancelled || tearingDownRef.current) {
        if (created.ok) void window.mux.pty.kill(sessionId)
        return
      }

      if (!created.ok) {
        setBootError(created.error)
        term.writeln(`\r\n\x1b[31mCould not start shell: ${created.error}\x1b[0m`)
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
          `\r\n\x1b[33mShell exited (code ${payload.exitCode}${payload.signal != null ? `, signal ${payload.signal}` : ''}).\x1b[0m`,
        )
      })

      term.onData((data) => {
        window.mux.pty.write(sessionId, data)
      })

      fit.fit()
      window.mux.pty.resize(sessionId, Math.max(term.cols, 2), Math.max(term.rows, 1))

      const queued = useAppWideTerminalsStore.getState().takeBootstrapForSession(sessionId)
      const toRun = queued ?? runAfterSpawn
      if (toRun) {
        const payload = toRun.endsWith('\n') ? toRun : `${toRun}\n`
        window.setTimeout(() => {
          window.mux.pty.write(sessionId, payload)
        }, 250)
      }
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
  }, [sessionId, cwd, runAfterSpawn])

  return (
    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
      <div ref={containerRef} className="mux-terminal-host relative min-h-0 min-w-0 flex-1 basis-0 overflow-hidden px-1" />
      {bootError ? <p className="shrink-0 border-t border-border px-2 py-1 text-[11px] text-destructive">{bootError}</p> : null}
    </div>
  )
}
