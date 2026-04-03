import { useCallback, useEffect, useState } from 'react'

import { GitQuickActionButton } from '@/features/git/git-quick-action-button'
import { FocusedGitContextLabel } from '@/features/status-bar/focused-git-context-label'
import { StatusDomainIcon } from '@/features/status-bar/status-domain-icon'
import { toastResultOfManualUpdateCheck } from '@/features/updater/update-toasts'
import { useStatusActivityStore } from '@/stores/status-activity-store'
import { cn } from '@/lib/utils'
import { Loader2 } from 'lucide-react'

/**
 * VS Code–style bottom strip for in-flight work. Activities are driven by
 * `useStatusActivityStore` / `runWithStatusActivity` (see `src/lib/status/`).
 */
export function StatusBar() {
  const activities = useStatusActivityStore((s) => s.activities)
  const [version, setVersion] = useState<string | null>(null)

  useEffect(() => {
    void window.mux.updater
      .getAppVersion()
      .then(setVersion)
      .catch(() => setVersion(null))
  }, [])

  const onVersionClick = useCallback(() => {
    void toastResultOfManualUpdateCheck()
  }, [])

  return (
    <footer
      className="flex h-[22px] shrink-0 items-center gap-2 border-t border-border bg-muted/30 px-2 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label="Background tasks"
    >
      <GitQuickActionButton />
      <FocusedGitContextLabel />
      <div className="flex min-w-0 min-h-0 flex-1 items-center justify-end gap-2">
        {activities.length === 0 ? (
          <span className="min-w-0 select-none text-muted-foreground/80">Ready</span>
        ) : (
          <ul className="flex min-w-0 items-center gap-4 overflow-x-auto">
            {activities.map((a) => (
              <li key={a.id} className="flex min-w-0 max-w-[min(40vw,280px)] shrink-0 items-center gap-1.5" title={a.detail ?? a.label}>
                <StatusDomainIcon domain={a.domain} />
                {a.domain === 'sync' ? null : <Loader2 className="size-3 shrink-0 animate-spin opacity-70" aria-hidden />}
                <span className="truncate text-foreground/90">{a.label}</span>
              </li>
            ))}
          </ul>
        )}
        {version ? (
          <button
            type="button"
            onClick={onVersionClick}
            className={cn(
              'shrink-0 cursor-pointer rounded px-1 font-mono text-muted-foreground/70 tabular-nums',
              'transition-colors hover:bg-muted/80 hover:text-foreground',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50',
            )}
            title="Check for updates"
          >
            v{version}
          </button>
        ) : null}
      </div>
    </footer>
  )
}
