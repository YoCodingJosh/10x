import { useEffect } from 'react'

import { scheduleFocusMuxXtermForTyping } from '@/lib/focus-mux-xterm'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useCommandPaletteIntentsStore } from '@/stores/command-palette-intents-store'
import { useGitFocusedCheckoutStore } from '@/stores/git-focused-checkout-store'
import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { useGlobalTerminalsStore } from '@/stores/global-terminals-store'
import { useTerminalScopeStore } from '@/stores/terminal-scope-store'
import { useWorktreeTerminalsStore } from '@/stores/worktree-terminals-store'
import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

import {
  getVisibleWorkspaceId,
  isInsideDialog,
  isNonTerminalTextField,
} from './keyboard-shortcut-guards'

function digitFromKeyEvent(e: KeyboardEvent): number | null {
  const k = e.key
  if (k.length === 1 && k >= '1' && k <= '9') return Number.parseInt(k, 10)
  if (e.code.startsWith('Digit')) {
    const n = Number.parseInt(e.code.slice('Digit'.length), 10)
    return Number.isFinite(n) && n >= 1 && n <= 9 ? n : null
  }
  return null
}

/**
 * ⌘N / Ctrl+N: new agent tab (when workspace path is ready and git summary has loaded).
 * ⌘⇧N / Ctrl+Shift+N: open “Create worktree” dialog when the folder is a Git repo.
 * ⌘T / Ctrl+T: add a terminal shell for the current Global, Workspace, or Agent section of the terminal panel.
 * ⌘1–⌘9 / Ctrl+1–9: focus agent tab by index (1 = leftmost) when it exists.
 */
export function AgentCreateShortcutsBridge() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.key.toLowerCase() !== 'n') return
      if (e.repeat) return

      const activeEl = document.activeElement
      if (isInsideDialog(activeEl)) return
      if (isNonTerminalTextField(activeEl)) return

      const visibleId = getVisibleWorkspaceId()
      if (!visibleId) return
      const ws = useWorkspaceStore.getState().workspaces.find((w) => w.id === visibleId)
      if (!ws?.path) return

      const git = useGitFocusedCheckoutStore.getState()
      if (git.wt === null) return
      if (useClaudeCodeCliStore.getState().installed !== true) return

      if (e.shiftKey) {
        if (!git.wt.isRepo) return
        e.preventDefault()
        useCommandPaletteIntentsStore.getState().requestWorktreeDialog()
        return
      }

      e.preventDefault()
      useCommandPaletteIntentsStore.getState().requestNewAgentTab()
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.key.toLowerCase() !== 't') return
      if (e.shiftKey || e.altKey) return
      if (e.repeat) return

      const activeEl = document.activeElement
      if (isInsideDialog(activeEl)) return
      if (isNonTerminalTextField(activeEl)) return

      const visibleId = getVisibleWorkspaceId()

      const raw = document.getElementById('mux-terminal-panel')?.dataset.muxTerminalScope
      const scope =
        raw === 'agent' ? 'agent' : raw === 'global' ? 'global' : 'project'

      if (scope === 'global') {
        e.preventDefault()
        if (visibleId) {
          useTerminalScopeStore.getState().setScope(visibleId, 'global')
        }
        useAppWideTerminalsStore.getState().addShell()
        scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
        return
      }

      if (scope === 'project') {
        e.preventDefault()
        if (!visibleId) {
          useAppWideTerminalsStore.getState().addShell()
        } else {
          useGlobalTerminalsStore.getState().addShell(visibleId)
        }
        scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
        return
      }

      if (!visibleId) return

      const agentTabId =
        useAgentTabsStore.getState().byWorkspaceId[visibleId]?.activeTabId ?? null
      if (!agentTabId) {
        e.preventDefault()
        return
      }

      e.preventDefault()
      useWorktreeTerminalsStore.getState().addShell(visibleId, agentTabId)
      scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.metaKey && !e.ctrlKey) return
      if (e.shiftKey || e.altKey) return
      if (e.repeat) return

      const digit = digitFromKeyEvent(e)
      if (digit == null) return

      const activeEl = document.activeElement
      if (isInsideDialog(activeEl)) return

      const visibleId = getVisibleWorkspaceId()
      if (!visibleId) return

      const tabs = useAgentTabsStore.getState().byWorkspaceId[visibleId]?.tabs ?? []
      const index = digit - 1
      if (index >= tabs.length) return

      e.preventDefault()
      useAgentTabsStore.getState().setActiveTab(visibleId, tabs[index]!.id)
      scheduleFocusMuxXtermForTyping('#mux-agent-desk')
    }

    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [])

  return null
}
