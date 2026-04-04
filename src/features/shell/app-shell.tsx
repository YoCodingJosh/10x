import { ActivityBar } from '@/features/activity-bar/activity-bar'
import { CommandPaletteRoot } from '@/features/command-palette/command-palette-root'
import { AgentCreateShortcutsBridge } from '@/features/shell/agent-create-shortcuts-bridge'
import { CloseTabShortcutBridge } from '@/features/shell/close-tab-shortcut-bridge'
import { GitFocusedCheckoutBridge } from '@/features/git/git-focused-checkout-bridge'
import { WorkspaceFetchOnChangeBridge } from '@/features/git/workspace-fetch-on-change-bridge'
import { StatusBar } from '@/features/status-bar/status-bar'

import { SidePanelSplit } from '@/features/side-panel/side-panel-split'
import { AgentFocusedSessionBridge } from '@/features/shell/agent-focused-session-bridge'
import { ClaudeCodeCliProbeBridge } from '@/features/shell/claude-code-cli-probe-bridge'
import { UpdateLaunchToastBridge } from '@/features/shell/update-launch-toast-bridge'
import { RecentWorkspacePathsBridge } from '@/features/shell/recent-workspace-paths-bridge'
import { WorkspaceSync } from './workspace-sync'

export function AppShell() {
  return (
    <>
      <RecentWorkspacePathsBridge />
      <ClaudeCodeCliProbeBridge />
      <AgentFocusedSessionBridge />
      <UpdateLaunchToastBridge />
      <WorkspaceSync />
      <GitFocusedCheckoutBridge />
      <WorkspaceFetchOnChangeBridge />
      <CommandPaletteRoot />
      <CloseTabShortcutBridge />
      <AgentCreateShortcutsBridge />
      <div className="flex h-full min-h-0 flex-col overflow-hidden bg-background text-foreground">
        <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden">
          <ActivityBar />
          <SidePanelSplit />
        </div>
        <StatusBar />
      </div>
    </>
  )
}
