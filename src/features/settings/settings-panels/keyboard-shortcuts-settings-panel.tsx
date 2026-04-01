import type { SettingsPanelProps } from '@/features/settings/settings-sections'

function isMacPlatform(): boolean {
  if (typeof navigator === 'undefined') return true
  return /Mac|iPhone|iPod|iPad/i.test(navigator.platform) || /Mac OS X/.test(navigator.userAgent)
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[11px] font-medium text-foreground shadow-sm">
      {children}
    </kbd>
  )
}

function ShortcutRow({ keys, detail }: { keys: React.ReactNode; detail: string }) {
  return (
    <div className="flex flex-col gap-1 border-b border-border/60 py-3 last:border-b-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-1">{keys}</div>
      <p className="min-w-0 flex-1 text-sm text-muted-foreground">{detail}</p>
    </div>
  )
}

export function KeyboardShortcutsSettingsPanel(_props: SettingsPanelProps) {
  const mac = isMacPlatform()
  const mod = mac ? '⌘' : 'Ctrl'

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-foreground">Keyboard shortcuts</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Shortcuts use <Kbd>{mod}</Kbd> as the main modifier on this system.
        </p>
      </div>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">General</h3>
        <div className="rounded-lg border border-border bg-card/40 px-3">
          <ShortcutRow
            keys={
              <>
                <Kbd>{mod}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>K</Kbd>
              </>
            }
            detail="Open the command palette."
          />
        </div>
      </section>

      <section className="space-y-1">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Agents & terminals</h3>
        <div className="rounded-lg border border-border bg-card/40 px-3">
          <ShortcutRow
            keys={
              <>
                <Kbd>{mod}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>N</Kbd>
              </>
            }
            detail="Open a new agent tab when the workspace folder is ready."
          />
          <ShortcutRow
            keys={
              <>
                <Kbd>{mod}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>⇧</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>N</Kbd>
              </>
            }
            detail="Open the create worktree dialog (Git repository required)."
          />
          <ShortcutRow
            keys={
              <>
                <Kbd>{mod}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>T</Kbd>
              </>
            }
            detail="Add a new shell in the terminal panel for whichever side is selected — Project or Agent."
          />
          <ShortcutRow
            keys={
              <>
                <Kbd>{mod}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>1</Kbd>
                <span className="text-muted-foreground"> … </span>
                <Kbd>9</Kbd>
              </>
            }
            detail="Switch to agent tab 1–9 by position (left to right) and focus it."
          />
          <ShortcutRow
            keys={
              <>
                <Kbd>{mod}</Kbd>
                <span className="text-muted-foreground">+</span>
                <Kbd>W</Kbd>
              </>
            }
            detail="With focus in the bottom terminal: close the active shell. With focus in the agent area: close the active agent tab (worktree tabs ask for confirmation). Otherwise: close the window after confirmation."
          />
        </div>
      </section>
    </div>
  )
}
