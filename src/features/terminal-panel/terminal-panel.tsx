export function TerminalPanel() {
  return (
    <section
      className="flex h-44 shrink-0 flex-col border-t border-border bg-card"
      aria-label="Terminal panel"
    >
      <div className="flex h-8 items-center border-b border-border px-2 text-xs text-muted-foreground">
        Terminal
      </div>
      <div className="flex flex-1 items-center justify-center p-4 text-center text-sm text-muted-foreground">
        Shell sessions will mount here (xterm + node-pty).
      </div>
    </section>
  )
}
