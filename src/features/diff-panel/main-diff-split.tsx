import { useCallback, useRef } from 'react'

import { CenterRightSplit } from '@/features/shell/center-right-split'
import { SplitSash } from '@/features/shell/split-sash'
import { DiffViewerPanel } from '@/features/diff-panel/diff-viewer-panel'
import { DIFF_PANEL_WIDTH, useDiffPanelStore } from '@/stores/diff-panel-store'

/**
 * Optional left column: diff viewer + vertical sash. Matches workspaces-rail resize behavior.
 */
export function MainDiffSplit() {
  const open = useDiffPanelStore((s) => s.open)
  const widthPx = useDiffPanelStore((s) => s.widthPx)
  const setWidthPx = useDiffPanelStore((s) => s.setWidthPx)
  const containerRef = useRef<HTMLDivElement>(null)
  const draggingPointerId = useRef<number | null>(null)

  const applyWidthFromClientX = useCallback((clientX: number) => {
    const el = containerRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const w = clientX - rect.left
    const maxW = Math.min(DIFF_PANEL_WIDTH.max, rect.width * 0.55)
    const clampedMax = Math.max(DIFF_PANEL_WIDTH.min, maxW)
    setWidthPx(Math.min(clampedMax, Math.max(DIFF_PANEL_WIDTH.min, w)))
  }, [setWidthPx])

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
      {open && (
        <>
          <div
            className="flex min-h-0 min-w-0 shrink-0 flex-col border-r border-border/80 bg-background"
            style={{ width: widthPx, minWidth: DIFF_PANEL_WIDTH.min, maxWidth: DIFF_PANEL_WIDTH.max }}
          >
            <DiffViewerPanel />
          </div>
          <SplitSash
            orientation="vertical"
            aria-label="Resize diff panel"
            onPointerDown={onSashPointerDown}
            onPointerMove={onSashPointerMove}
            onPointerUp={onSashPointerUp}
            onPointerCancel={onSashPointerUp}
            onKeyDown={(e) => {
              const step = e.shiftKey ? 24 : 8
              const cur = useDiffPanelStore.getState().widthPx
              if (e.key === 'ArrowLeft') {
                e.preventDefault()
                setWidthPx(Math.max(DIFF_PANEL_WIDTH.min, cur - step))
              } else if (e.key === 'ArrowRight') {
                e.preventDefault()
                const el = containerRef.current
                const maxW = el
                  ? Math.min(DIFF_PANEL_WIDTH.max, el.getBoundingClientRect().width * 0.55)
                  : DIFF_PANEL_WIDTH.max
                const clampedMax = Math.max(DIFF_PANEL_WIDTH.min, maxW)
                setWidthPx(Math.min(clampedMax, cur + step))
              }
            }}
          />
        </>
      )}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <CenterRightSplit />
      </div>
    </div>
  )
}
