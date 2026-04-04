import { useEffect } from 'react'

import { useAgentTabCloseIntentStore } from '@/stores/agent-tab-close-intent-store'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import { useWorktreeTerminalsStore, worktreeTerminalsKey } from '@/stores/worktree-terminals-store'
import { scheduleFocusMuxXtermForTyping } from '@/lib/focus-mux-xterm'

import {
  getVisibleWorkspaceId,
  isInsideDialog,
  isNonTerminalTextField,
} from './keyboard-shortcut-guards'

const CLOSE_WINDOW_CONFIRM =
  'Close this window? This will end all running terminal sessions and agent processes.'

/**
 * ⌘W / Ctrl+W: close the focused terminal shell, or the active agent tab (worktree removal modal only
 * when the checkout is still a Git worktree).
 * Otherwise intercepts the shortcut so the app does not quit immediately — asks for confirmation first.
 */
export function CloseTabShortcutBridge() {
  const requestCloseActiveAgentTab = useAgentTabCloseIntentStore((s) => s.requestCloseActiveAgentTab)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.key.toLowerCase() !== 'w') return
      if (e.repeat) return

      const activeEl = document.activeElement
      if (isInsideDialog(activeEl)) return

      const inTerminalPanel = activeEl?.closest('#mux-terminal-panel') != null
      const inAgentDesk = activeEl?.closest('#mux-agent-desk') != null

      if (inTerminalPanel) {
        if (isNonTerminalTextField(activeEl)) return
        e.preventDefault()
        const visibleId = getVisibleWorkspaceId()
        const panel = document.getElementById('mux-terminal-panel')
        const raw = panel?.dataset.muxTerminalScope
        const scope =
          raw === 'agent' ? 'agent' : raw === 'global' ? 'global' : 'project'

        const closeAppWideActive = () => {
          const aw = useAppWideTerminalsStore.getState()
          const active = aw.activeShellId
          if (aw.shells.length > 0 && active) {
            aw.removeShell(active)
            scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
          }
        }

        if (!visibleId || scope === 'global') {
          closeAppWideActive()
          return
        }

        if (scope === 'project') {
          const g = useGlobalTerminalsStore.getState()
          const shells = g.byWorkspaceId[visibleId] ?? []
          const active = g.activeShellId[visibleId] ?? null
          if (shells.length > 0 && active) {
            g.removeShell(visibleId, active)
            scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
          }
          return
        }

        const agentState = useAgentTabsStore.getState().byWorkspaceId[visibleId]
        const agentTabId = agentState?.activeTabId ?? null
        if (!agentTabId) return

        const wt = useWorktreeTerminalsStore.getState()
        const key = worktreeTerminalsKey(visibleId, agentTabId)
        const shells = wt.byKey[key] ?? []
        const active = wt.activeShellId[key] ?? null
        if (shells.length > 0 && active) {
          wt.removeShell(visibleId, agentTabId, active)
          scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
        }
        return
      }

      if (inAgentDesk) {
        if (isNonTerminalTextField(activeEl)) return
        e.preventDefault()
        const visibleId = getVisibleWorkspaceId()
        if (!visibleId) return

        const bucket = useAgentTabsStore.getState().byWorkspaceId[visibleId]
        const tabId = bucket?.activeTabId ?? null
        const tabs = bucket?.tabs ?? []
        if (!tabId || !tabs.some((t) => t.id === tabId)) return

        requestCloseActiveAgentTab(visibleId, tabId)
        return
      }

      e.preventDefault()
      if (window.confirm(CLOSE_WINDOW_CONFIRM)) {
        window.close()
      }
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [requestCloseActiveAgentTab])

  return null
}
