import { useWorkspacesQuery, useSyncWorkspacesToStore, usePersistWorkspacesMutation } from '@/hooks/use-workspaces'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useWorkspaceStore } from '@/stores/workspace-store'
import { cn } from '@/lib/utils'
import { Bot, FolderOpen, Plus, SquareTerminal, Trash2 } from 'lucide-react'

function workspaceLabelFromPath(dir: string) {
  const parts = dir.split(/[/\\]/).filter(Boolean)
  return parts[parts.length - 1] ?? dir
}

export default function App() {
  const { isPending, isError, error } = useWorkspacesQuery()
  useSyncWorkspacesToStore()

  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const activeWorkspaceId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActiveWorkspaceId = useWorkspaceStore((s) => s.setActiveWorkspaceId)

  const persist = usePersistWorkspacesMutation()

  const activeWorkspace = workspaces.find((w) => w.id === activeWorkspaceId) ?? null

  async function handleAddWorkspace() {
    const dir = await window.mux.dialog.pickWorkspace()
    if (!dir) return
    const next = [
      ...workspaces,
      {
        id: crypto.randomUUID(),
        path: dir,
        label: workspaceLabelFromPath(dir),
      },
    ]
    await persist.mutateAsync(next)
    setActiveWorkspaceId(next[next.length - 1].id)
  }

  async function handleRemoveWorkspace(id: string) {
    const next = workspaces.filter((w) => w.id !== id)
    await persist.mutateAsync(next)
    if (activeWorkspaceId === id) {
      setActiveWorkspaceId(next[0]?.id ?? null)
    }
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
      <div className="flex min-h-0 flex-1">
        <aside
          className="flex w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-sidebar py-2"
          aria-label="Activity bar"
        >
          <Button type="button" variant="ghost" size="icon-sm" title="Agents">
            <Bot className="size-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon-sm" title="Terminal">
            <SquareTerminal className="size-4" />
          </Button>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <Tabs defaultValue="session-1" className="flex min-h-0 flex-1 flex-col gap-0">
            <div className="flex h-9 shrink-0 items-center border-b border-border bg-muted/30 px-2">
              <TabsList variant="line" className="h-8 w-full min-w-0 rounded-none bg-transparent p-0">
                <TabsTrigger value="session-1" className="rounded-md text-xs">
                  Claude 1
                </TabsTrigger>
                <TabsTrigger value="session-2" className="rounded-md text-xs">
                  Claude 2
                </TabsTrigger>
              </TabsList>
            </div>
            <TabsContent
              value="session-1"
              className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <AgentPlaceholder
                title="Claude Code"
                workspace={activeWorkspace}
              />
            </TabsContent>
            <TabsContent
              value="session-2"
              className="mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden"
            >
              <AgentPlaceholder
                title="Claude Code (second session)"
                workspace={activeWorkspace}
              />
            </TabsContent>
          </Tabs>

          <Separator />

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
        </div>

        <aside
          className="flex w-60 shrink-0 flex-col border-l border-border bg-sidebar"
          aria-label="Workspaces"
        >
          <div className="flex h-9 items-center justify-between gap-2 border-b border-border px-2">
            <span className="truncate text-xs font-medium tracking-wide text-muted-foreground uppercase">
              Workspaces
            </span>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              title="Add folder"
              onClick={() => void handleAddWorkspace()}
              disabled={persist.isPending}
            >
              <Plus className="size-3.5" />
            </Button>
          </div>

          <ScrollArea className="min-h-0 flex-1">
            <div className="p-1">
              {isPending && (
                <p className="px-2 py-3 text-xs text-muted-foreground">Loading…</p>
              )}
              {isError && (
                <p className="px-2 py-3 text-xs text-destructive">
                  {error instanceof Error ? error.message : 'Could not load workspaces.'}
                </p>
              )}
              {!isPending && workspaces.length === 0 && (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Add a repo or worktree folder to scope agents and terminals.
                </p>
              )}
              {workspaces.map((w) => (
                <div
                  key={w.id}
                  className={cn(
                    'group flex items-center gap-1 rounded-md px-1 py-0.5',
                    w.id === activeWorkspaceId && 'bg-sidebar-accent text-sidebar-accent-foreground',
                  )}
                >
                  <button
                    type="button"
                    className="flex min-w-0 flex-1 items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm"
                    onClick={() => setActiveWorkspaceId(w.id)}
                  >
                    <FolderOpen className="size-3.5 shrink-0 opacity-70" />
                    <span className="truncate">{w.label}</span>
                  </button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="shrink-0 opacity-0 group-hover:opacity-100"
                    title="Remove from list"
                    onClick={() => void handleRemoveWorkspace(w.id)}
                    disabled={persist.isPending}
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          </ScrollArea>

          {activeWorkspace && (
            <div className="border-t border-border p-2 text-[11px] leading-snug text-muted-foreground">
              <div className="font-medium text-sidebar-foreground">Active path</div>
              <div className="mt-1 break-all font-mono">{activeWorkspace.path}</div>
            </div>
          )}
        </aside>
      </div>
    </div>
  )
}

function AgentPlaceholder({
  title,
  workspace,
}: {
  title: string
  workspace: { path: string; label: string } | null
}) {
  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {title}
        {workspace ? (
          <span className="ml-2 font-mono text-[11px] text-foreground/80">
            — {workspace.label}
          </span>
        ) : (
          <span className="ml-2 text-amber-200/80">— pick a workspace</span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <p>
          Interactive <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">claude</code>{' '}
          sessions will run here (PTY).
        </p>
        {workspace && (
          <p className="max-w-md text-xs">
            Working directory:{' '}
            <span className="font-mono text-foreground/90">{workspace.path}</span>
          </p>
        )}
      </div>
    </div>
  )
}
