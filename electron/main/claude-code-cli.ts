import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ipcMain } from 'electron'

import fixPath from 'fix-path'

const PROBE_TIMEOUT_MS = 12_000

/**
 * Whether the Claude Code CLI (`claude`) is available with the same PATH rules GUI apps use
 * after `fix-path` (macOS), plus the standard native-installer location.
 */
export function isClaudeCodeCliInstalled(): boolean {
  try {
    fixPath()
  } catch {
    /* fix-path can throw in minimal environments */
  }

  const home = os.homedir()
  const localInstaller =
    process.platform === 'win32'
      ? path.join(home, '.local', 'bin', 'claude.exe')
      : path.join(home, '.local', 'bin', 'claude')
  if (existsSync(localInstaller)) {
    return true
  }

  try {
    if (process.platform === 'win32') {
      const comspec = process.env.ComSpec || 'cmd.exe'
      execFileSync(comspec, ['/d', '/s', '/c', 'where claude'], {
        stdio: 'ignore',
        timeout: PROBE_TIMEOUT_MS,
        windowsHide: true,
        env: process.env,
      })
    } else {
      execFileSync('/bin/sh', ['-c', 'command -v claude'], {
        stdio: 'ignore',
        timeout: PROBE_TIMEOUT_MS,
        env: process.env,
      })
    }
    return true
  } catch {
    return false
  }
}

export function registerClaudeCodeCliIpc() {
  ipcMain.handle('claudeCode:isCliInstalled', () => isClaudeCodeCliInstalled())
}
