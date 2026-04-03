import { ActivityBar } from '@/features/activity-bar/activity-bar'
import { CommandPaletteRoot } from '@/features/command-palette/command-palette-root'
import { AgentCreateShortcutsBridge } from '@/features/shell/agent-create-shortcuts-bridge'
import { CloseTabShortcutBridge } from '@/features/shell/close-tab-shortcut-bridge'
import { GitFocusedCheckoutBridge } from '@/features/git/git-focused-checkout-bridge'
import { WorkspaceFetchOnChangeBridge } from '@/features/git/workspace-fetch-on-change-bridge'
import { StatusBar } from '@/features/status-bar/status-bar'

import { MainDiffSplit } from '@/features/diff-panel/main-diff-split'
import { WorkspaceSync } from './workspace-sync'

export function AppShell() {
  return (
    <>
      <WorkspaceSync />
      <GitFocusedCheckoutBridge />
      <WorkspaceFetchOnChangeBridge />
      <CommandPaletteRoot />
      <CloseTabShortcutBridge />
      <AgentCreateShortcutsBridge />
      <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 flex-1">
          <ActivityBar />
          <MainDiffSplit />
        </div>
        <StatusBar />
      </div>
    </>
  )
}
