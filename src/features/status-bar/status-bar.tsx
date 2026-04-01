import { GitQuickActionButton } from '@/features/git/git-quick-action-button'
import { FocusedGitContextLabel } from '@/features/status-bar/focused-git-context-label'
import { StatusDomainIcon } from '@/features/status-bar/status-domain-icon'
import { useStatusActivityStore } from '@/stores/status-activity-store'
import { Loader2 } from 'lucide-react'

/**
 * VS Code–style bottom strip for in-flight work. Activities are driven by
 * `useStatusActivityStore` / `runWithStatusActivity` (see `src/lib/status/`).
 */
export function StatusBar() {
  const activities = useStatusActivityStore((s) => s.activities)

  return (
    <footer
      className="flex h-[22px] shrink-0 items-center gap-2 border-t border-border bg-muted/30 px-2 text-[11px] text-muted-foreground"
      role="status"
      aria-live="polite"
      aria-label="Background tasks"
    >
      <GitQuickActionButton />
      <FocusedGitContextLabel />
      <div className="flex-1"></div>
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
    </footer>
  )
}
