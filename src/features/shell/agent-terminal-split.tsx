import { useCallback, useEffect, useRef, useState } from 'react'

import { WorkspaceAgentDesk } from '@/features/agent-sessions/workspace-agent-desk'
import { TerminalPanel } from '@/features/terminal-panel/terminal-panel'

import { SplitSash } from './split-sash'

const STORAGE_KEY = 'mux.agentTerminalSplitFraction'

function readStoredFraction(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return 0.38
    const n = Number(raw)
    if (!Number.isFinite(n)) return 0.38
    return Math.min(0.78, Math.max(0.14, n))
  } catch {
    return 0.38
  }
}

/**
 * Vertical split between agent desk and terminal: flex ratio (like VS Code) + draggable sash.
 * Terminal height = fraction of this column; window resize keeps the ratio.
 */
export function AgentTerminalSplit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [terminalFraction, setTerminalFraction] = useState(readStoredFraction)
  const draggingPointerId = useRef<number | null>(null)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, String(terminalFraction))
    } catch {
      /* ignore */
    }
  }, [terminalFraction])

  const applyFractionFromClientY = useCallback((clientY: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const h = rect.height
    if (h < 1) return
    const terminalPx = rect.bottom - clientY
    const f = terminalPx / h
    setTerminalFraction(Math.min(0.78, Math.max(0.14, f)))
  }, [])

  const onDividerPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    draggingPointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onDividerPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPointerId.current !== e.pointerId) return
      applyFractionFromClientY(e.clientY)
    },
    [applyFractionFromClientY],
  )

  const onDividerPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPointerId.current !== e.pointerId) return
      draggingPointerId.current = null
      applyFractionFromClientY(e.clientY)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [applyFractionFromClientY],
  )

  const agentFlex = 1 - terminalFraction

  return (
    <div
      ref={containerRef}
      className="flex min-h-0 min-w-0 flex-1 flex-col"
    >
      <div
        className="flex min-h-0 min-w-0 flex-col"
        style={{ flex: `${agentFlex} 1 0px`, minHeight: 120 }}
      >
        <WorkspaceAgentDesk />
      </div>
      <SplitSash
        orientation="horizontal"
        aria-label="Resize terminal panel"
        onPointerDown={onDividerPointerDown}
        onPointerMove={onDividerPointerMove}
        onPointerUp={onDividerPointerUp}
        onPointerCancel={onDividerPointerUp}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 0.05 : 0.02
          if (e.key === 'ArrowUp') {
            e.preventDefault()
            setTerminalFraction((f) => Math.min(0.78, f + step))
          } else if (e.key === 'ArrowDown') {
            e.preventDefault()
            setTerminalFraction((f) => Math.max(0.14, f - step))
          }
        }}
      />
      <div
        className="flex min-h-0 min-w-0 flex-col"
        style={{ flex: `${terminalFraction} 1 0px`, minHeight: 120 }}
      >
        <TerminalPanel />
      </div>
    </div>
  )
}
