import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'

import { GlobalShellTerminal } from './global-shell-terminal'

export function TerminalPanel() {
  const active = useActiveWorkspace()

  return (
    <section
      className="flex h-[min(40vh,400px)] min-h-[200px] max-h-[55vh] shrink-0 flex-col border-t border-border bg-card"
      aria-label="Terminal panel"
    >
      <div className="flex h-8 shrink-0 items-center justify-between border-b border-border px-2 text-xs text-muted-foreground">
        <span>Terminal</span>
        {active ? (
          <span className="truncate font-mono text-[10px] text-foreground/70" title={active.path}>
            cwd: {active.label}
          </span>
        ) : (
          <span className="text-[10px] text-foreground/60">cwd: home (no workspace)</span>
        )}
      </div>
      <GlobalShellTerminal />
    </section>
  )
}
