import { useCallback, useMemo, useState } from 'react'
import { RotateCcw } from 'lucide-react'

import type { SettingsPanelProps } from '@/features/settings/settings-sections'
import { Button } from '@/components/ui/button'
import {
  LAYOUT_DEFAULTS,
  LAYOUT_RESET_EVENT,
  clearPersistedLayoutStorage,
  readPersistedLayoutSnapshot,
} from '@/lib/persisted-layout'
import { useSidePanelStore } from '@/stores/side-panel-store'

function pct(n: number): string {
  return `${Math.round(n * 100)}%`
}

export function LayoutSettingsPanel(_props: SettingsPanelProps) {
  const sidePanelWidthPx = useSidePanelStore((s) => s.widthPx)
  const [layoutRevision, setLayoutRevision] = useState(0)

  const snapshot = useMemo(
    () => readPersistedLayoutSnapshot(),
    [layoutRevision, sidePanelWidthPx],
  )

  const reset = useCallback(() => {
    clearPersistedLayoutStorage()
    useSidePanelStore.getState().resetWidthWithoutPersist()
    window.dispatchEvent(new Event(LAYOUT_RESET_EVENT))
    setLayoutRevision((n) => n + 1)
  }, [])

  const agentShare = 1 - snapshot.agentTerminalFraction
  const terminalShare = snapshot.agentTerminalFraction

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Layout</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Panel sizes are remembered in local storage. Reset restores built-in defaults until you resize
          again.
        </p>
      </div>

      <div className="rounded-lg border border-border bg-card/40 px-4 py-3 text-sm">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Current sizes
        </h3>
        <dl className="mt-3 space-y-2.5">
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-muted-foreground">Workspaces rail</dt>
            <dd className="font-mono text-xs text-foreground">
              {snapshot.workspacesRailWidthPx}px
              <span className="ml-2 font-sans text-muted-foreground">
                {snapshot.workspacesRailIsCustom ? '(saved)' : `(default ${LAYOUT_DEFAULTS.workspacesRailWidthPx}px)`}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-muted-foreground">Agent / terminal split</dt>
            <dd className="font-mono text-xs text-foreground">
              Agent {pct(agentShare)} · Terminal {pct(terminalShare)}
              <span className="ml-2 font-sans text-muted-foreground">
                {snapshot.agentTerminalIsCustom
                  ? '(saved)'
                  : `(default ${pct(1 - LAYOUT_DEFAULTS.agentTerminalFraction)} / ${pct(LAYOUT_DEFAULTS.agentTerminalFraction)})`}
              </span>
            </dd>
          </div>
          <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
            <dt className="text-muted-foreground">Diff / Git graph side panel</dt>
            <dd className="font-mono text-xs text-foreground">
              {sidePanelWidthPx}px
              <span className="ml-2 font-sans text-muted-foreground">
                {snapshot.sidePanelIsCustom ? '(saved)' : `(default ${LAYOUT_DEFAULTS.sidePanelWidthPx}px)`}
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div>
        <Button type="button" variant="outline" size="sm" className="gap-2" onClick={reset}>
          <RotateCcw className="size-3.5" aria-hidden />
          Reset panel sizes to defaults
        </Button>
        <p className="mt-2 text-xs text-muted-foreground">
          Clears saved widths and split ratio. Open diff or graph panels keep their open/closed state.
        </p>
      </div>
    </div>
  )
}
