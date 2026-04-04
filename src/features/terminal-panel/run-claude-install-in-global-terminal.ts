import { appWideShellSessionId } from '@/features/terminal-panel/workspace-shell-terminal'
import { scheduleFocusMuxXtermForTyping } from '@/lib/focus-mux-xterm'
import { CLAUDE_CODE_INSTALL_SHELL_COMMAND } from '@/lib/claude-code-install'
import { useAppWideTerminalsStore } from '@/stores/app-wide-terminals-store'
import { useTerminalScopeStore } from '@/stores/terminal-scope-store'

/** Switches to Global terminal, adds a shared shell, and runs the official installer. */
export function runClaudeCodeInstallInGlobalTerminal(workspaceId?: string | null): void {
  if (workspaceId) {
    useTerminalScopeStore.getState().setScope(workspaceId, 'global')
  }
  const shellId = useAppWideTerminalsStore.getState().addShell('Claude install')
  const sessionId = appWideShellSessionId(shellId)
  useAppWideTerminalsStore
    .getState()
    .queueBootstrapForSession(sessionId, `${CLAUDE_CODE_INSTALL_SHELL_COMMAND}\n`)
  scheduleFocusMuxXtermForTyping('#mux-terminal-panel')
}
