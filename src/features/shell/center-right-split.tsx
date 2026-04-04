import { useCallback, useEffect, useRef, useState } from 'react'

import { WorkspacesRail } from '@/features/workspaces/workspaces-rail'
import {
  LAYOUT_DEFAULTS,
  LAYOUT_KEYS,
  LAYOUT_RESET_EVENT,
  readPersistedWorkspacesRailWidth,
} from '@/lib/persisted-layout'

import { AgentTerminalSplit } from './agent-terminal-split'
import { SplitSash } from './split-sash'

const MIN_WIDTH_PX = LAYOUT_DEFAULTS.workspacesRailMinPx
const MAX_WIDTH_PX = LAYOUT_DEFAULTS.workspacesRailMaxPx

/**
 * Main column + workspaces rail with a vertical sash (VS Code–style thin line).
 */
export function CenterRightSplit() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [rightWidthPx, setRightWidthPx] = useState(readPersistedWorkspacesRailWidth)
  const draggingPointerId = useRef<number | null>(null)
  const skipNextPersistRef = useRef(false)

  useEffect(() => {
    if (skipNextPersistRef.current) {
      skipNextPersistRef.current = false
      return
    }
    try {
      localStorage.setItem(LAYOUT_KEYS.workspacesRail, String(rightWidthPx))
    } catch {
      /* ignore */
    }
  }, [rightWidthPx])

  useEffect(() => {
    const onReset = () => {
      skipNextPersistRef.current = true
      setRightWidthPx(LAYOUT_DEFAULTS.workspacesRailWidthPx)
    }
    window.addEventListener(LAYOUT_RESET_EVENT, onReset)
    return () => window.removeEventListener(LAYOUT_RESET_EVENT, onReset)
  }, [])

  const applyWidthFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = rect.right - clientX
    const maxW = Math.min(MAX_WIDTH_PX, rect.width * 0.55)
    const clampedMax = Math.max(MIN_WIDTH_PX, maxW)
    setRightWidthPx(Math.min(clampedMax, Math.max(MIN_WIDTH_PX, w)))
  }, [])

  const onSashPointerDown = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    draggingPointerId.current = e.pointerId
    e.currentTarget.setPointerCapture(e.pointerId)
  }, [])

  const onSashPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPointerId.current !== e.pointerId) return
      applyWidthFromClientX(e.clientX)
    },
    [applyWidthFromClientX],
  )

  const onSashPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (draggingPointerId.current !== e.pointerId) return
      draggingPointerId.current = null
      applyWidthFromClientX(e.clientX)
      try {
        e.currentTarget.releasePointerCapture(e.pointerId)
      } catch {
        /* ignore */
      }
    },
    [applyWidthFromClientX],
  )

  return (
    <div ref={containerRef} className="flex min-h-0 min-w-0 flex-1 flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <AgentTerminalSplit />
      </div>
      <SplitSash
        orientation="vertical"
        aria-label="Resize workspaces panel"
        onPointerDown={onSashPointerDown}
        onPointerMove={onSashPointerMove}
        onPointerUp={onSashPointerUp}
        onPointerCancel={onSashPointerUp}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 24 : 8
          if (e.key === 'ArrowLeft') {
            e.preventDefault()
            setRightWidthPx((w) => Math.max(MIN_WIDTH_PX, w - step))
          } else if (e.key === 'ArrowRight') {
            e.preventDefault()
            setRightWidthPx((w) => {
              const el = containerRef.current
              const maxW = el
                ? Math.min(MAX_WIDTH_PX, el.getBoundingClientRect().width * 0.55)
                : MAX_WIDTH_PX
              return Math.min(Math.max(MIN_WIDTH_PX, maxW), w + step)
            })
          }
        }}
      />
      <WorkspacesRail widthPx={rightWidthPx} />
    </div>
  )
}
