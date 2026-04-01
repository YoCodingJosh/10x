import { useWorkspaceById } from '@/features/workspaces/hooks/use-workspace-by-id'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'

import { useAgentTabId } from './tab-id-context'
import { useWorkspaceSessionScope } from './workspace-id-context'

export function ClaudeSessionPane() {
  const tabId = useAgentTabId()
  const workspaceId = useWorkspaceSessionScope()
  const workspace = useWorkspaceById(workspaceId)
  const tab = useAgentTabsStore(
    (s) => s.byWorkspaceId[workspaceId]?.tabs.find((t) => t.id === tabId) ?? null,
  )

  return (
    <div className="flex h-full flex-col bg-background">
      <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
        {tab?.label ?? 'Agent'}
        {workspace ? (
          <span className="ml-2 font-mono text-[11px] text-foreground/80">
            — {workspace.label}
          </span>
        ) : (
          <span className="ml-2 text-amber-200/80">— workspace missing</span>
        )}
      </div>
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm text-muted-foreground">
        <p>
          Interactive{' '}
          <code className="rounded bg-muted px-1 py-0.5 font-mono text-xs">claude</code> will attach
          here (PTY). This pane stays mounted while the workspace column is hidden so session state can
          survive focus switches.
        </p>
        {workspace && (
          <p className="max-w-md text-xs">
            <span className="font-mono text-foreground/90">{workspace.path}</span>
          </p>
        )}
      </div>
    </div>
  )
}
