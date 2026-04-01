import { useLayoutEffect } from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Button } from '@/components/ui/button'
import type { AgentTab } from '@/stores/agent-tabs-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { cn } from '@/lib/utils'
import { Plus, X } from 'lucide-react'

import { ClaudeSessionPane } from './claude-session-pane'
import { EditableAgentTabLabel } from './editable-agent-tab-label'
import { TabIdProvider } from './tab-id-context'
import { useWorkspaceSessionScope } from './workspace-id-context'

/** Stable fallback so Zustand's getSnapshot is not a new `[]` every subscribe (avoids infinite loop). */
const EMPTY_TABS: readonly AgentTab[] = []

export function AgentSessionsPanel() {
  const workspaceId = useWorkspaceSessionScope()

  const tabs = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.tabs ?? EMPTY_TABS)
  const activeTabId = useAgentTabsStore((s) => s.byWorkspaceId[workspaceId]?.activeTabId ?? null)
  const setActiveTab = useAgentTabsStore((s) => s.setActiveTab)
  const addTab = useAgentTabsStore((s) => s.addTab)
  const closeTab = useAgentTabsStore((s) => s.closeTab)

  const resolvedTabId =
    tabs.length === 0
      ? null
      : activeTabId && tabs.some((t) => t.id === activeTabId)
        ? activeTabId
        : tabs[0]!.id

  useLayoutEffect(() => {
    if (resolvedTabId == null) return
    if (resolvedTabId !== activeTabId) {
      setActiveTab(workspaceId, resolvedTabId)
    }
  }, [workspaceId, activeTabId, resolvedTabId, setActiveTab])

  if (tabs.length === 0 || resolvedTabId == null) return null

  return (
    <Tabs
      value={resolvedTabId}
      onValueChange={(v) => setActiveTab(workspaceId, v)}
      className="flex min-h-0 flex-1 flex-col gap-0"
    >
      <div className="flex h-9 shrink-0 items-center gap-1 border-b border-border bg-muted/30 px-2">
        <TabsList
          variant="line"
          className="h-8 min-w-0 flex-1 flex-nowrap justify-start overflow-x-auto rounded-none bg-transparent p-0"
        >
          {tabs.map((tab) => (
            <TabsTrigger
              key={tab.id}
              value={tab.id}
              asChild
              className="h-8 max-w-44 shrink-0 rounded-md border border-transparent bg-transparent p-0 text-xs shadow-none data-[state=active]:border-border data-[state=active]:bg-background"
            >
              <div className="flex h-full min-w-0 items-stretch">
                <span className="flex min-w-0 flex-1 items-center px-2">
                  <EditableAgentTabLabel tabId={tab.id} />
                </span>
                {tabs.length > 1 ? (
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-xs"
                    className="h-full shrink-0 rounded-none border-l border-border/60"
                    title="Close agent tab"
                    tabIndex={-1}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      closeTab(workspaceId, tab.id)
                    }}
                  >
                    <X className="size-3" />
                  </Button>
                ) : null}
              </div>
            </TabsTrigger>
          ))}
        </TabsList>
        <Button
          type="button"
          variant="outline"
          size="icon-xs"
          className="shrink-0"
          title="New agent tab"
          onClick={() => addTab(workspaceId)}
        >
          <Plus className="size-3.5" />
        </Button>
      </div>

      {tabs.map((tab) => (
        <TabsContent
          key={tab.id}
          value={tab.id}
          forceMount
          className={cn('mt-0 min-h-0 flex-1 overflow-hidden data-[state=inactive]:hidden')}
        >
          <TabIdProvider tabId={tab.id}>
            <ClaudeSessionPane />
          </TabIdProvider>
        </TabsContent>
      ))}
    </Tabs>
  )
}
