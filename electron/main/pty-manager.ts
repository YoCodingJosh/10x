import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import os from 'node:os'
import path from 'node:path'

import { BrowserWindow, ipcMain } from 'electron'
import type { IPty } from 'node-pty'

import fixPath from 'fix-path'

import {
  cleanupAgentSession,
  onAgentInput,
  onAgentOutput,
  registerAgentSession,
} from './notification-manager'

const require = createRequire(import.meta.url)
const pty = require('node-pty') as typeof import('node-pty')

const sessions = new Map<string, IPty>()

const pathSep = process.platform === 'win32' ? ';' : ':'

let cachedPtyEnv: Record<string, string> | null = null

function mergePath(a: string, b: string): string {
  return [...new Set([...a.split(pathSep), ...b.split(pathSep)].filter(Boolean))].join(pathSep)
}

/** Only what zsh needs to find your home + run `printenv`. Not Electron's stripped GUI env. */
function minimalEnvForZshProbe(): NodeJS.ProcessEnv {
  const u = os.userInfo()
  return {
    HOME: os.homedir(),
    USER: u.username,
    LOGNAME: u.username,
    SHELL: '/bin/zsh',
    TERM: 'dumb',
    // Enough for builtins; real PATH comes from your dotfiles after -il
    PATH: '/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin',
    TMPDIR: process.env.TMPDIR || '/tmp',
    ...(process.env.LANG ? { LANG: process.env.LANG } : {}),
  }
}

function parsePrintenv(output: string): Record<string, string> {
  const env: Record<string, string> = {}
  for (const line of output.split('\n')) {
    if (!line) continue
    const i = line.indexOf('=')
    if (i <= 0) continue
    env[line.slice(0, i)] = line.slice(i + 1)
  }
  return env
}

function coerceStringEnv(record: Record<string, string | undefined>): Record<string, string> {
  const out: Record<string, string> = {}
  for (const [k, v] of Object.entries(record)) {
    if (v !== undefined) out[k] = String(v)
  }
  return out
}

/** PATH from a login shell using Electron's polluted env (fallback only). */
function loginShellPathFallback(): string {
  if (process.platform === 'win32') {
    return process.env.Path ?? process.env.PATH ?? ''
  }
  const shell = process.env.SHELL || '/bin/zsh'
  try {
    return execFileSync(shell, ['-lc', 'printf %s "$PATH"'], {
      encoding: 'utf8',
      timeout: 12_000,
      env: coerceStringEnv({ ...process.env, TERM: 'dumb', HOME: os.homedir() }),
    }).trim()
  } catch {
    return process.env.PATH ?? ''
  }
}

/**
 * Full env after an interactive login zsh — same idea as opening Terminal, without inheriting
 * Electron’s GUI-scoped variables that can break dotfile logic.
 */
function captureTerminalLikeEnv(): Record<string, string> {
  if (process.platform === 'win32') {
    fixPath()
    return coerceStringEnv({
      ...process.env,
      Path: mergePath(process.env.Path ?? '', process.env.PATH ?? ''),
    } as Record<string, string | undefined>)
  }

  try {
    const out = execFileSync('/bin/zsh', ['-ilc', 'printenv'], {
      encoding: 'utf8',
      timeout: 25_000,
      maxBuffer: 10 * 1024 * 1024,
      env: minimalEnvForZshProbe(),
    })
    const parsed = parsePrintenv(out)
    if (!parsed.PATH?.trim()) {
      throw new Error('login capture returned empty PATH')
    }
    return coerceStringEnv(parsed)
  } catch {
    fixPath()
    const base = process.env as Record<string, string | undefined>
    const home = os.homedir()
    const mergedPath = mergePath(loginShellPathFallback(), base.PATH ?? base.Path ?? '')
    return coerceStringEnv({
      ...base,
      HOME: base.HOME || home,
      PATH: mergedPath,
    })
  }
}

function ptyEnv(): Record<string, string> {
  if (cachedPtyEnv) {
    return { ...cachedPtyEnv }
  }
  cachedPtyEnv = captureTerminalLikeEnv()
  if (!cachedPtyEnv.HOME) {
    cachedPtyEnv = { ...cachedPtyEnv, HOME: os.homedir() }
  }
  return { ...cachedPtyEnv }
}

/**
 * Spawn `claude` like Terminal: real PATH/node from captured env, then exec via zsh
 * (avoids posix issues with the shim when env was wrong; safe when env is now right).
 */
function spawnClaudePty(cwd: string, cols: number, rows: number, env: Record<string, string>): IPty {
  const options = {
    name: 'xterm-256color' as const,
    cwd,
    cols,
    rows,
    env,
  }

  if (process.platform === 'win32') {
    return pty.spawn('claude', [], options)
  }

  if (existsSync('/bin/zsh')) {
    return pty.spawn('/bin/zsh', ['-ilc', 'exec claude'], options)
  }

  const shell =
    process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/bash'
  return pty.spawn(shell, ['-ilc', 'exec claude'], options)
}

/** Interactive login shell — absolute binaries only (avoids spawnp lookup issues). */
function spawnShellPty(cwd: string, cols: number, rows: number, env: Record<string, string>): IPty {
  const options = {
    name: 'xterm-256color' as const,
    cwd,
    cols,
    rows,
    env,
  }

  if (process.platform === 'win32') {
    const comspec = process.env.COMSPEC
    if (comspec && existsSync(comspec)) {
      return pty.spawn(comspec, [], options)
    }
    const cmd = path.join(process.env.SystemRoot || 'C:\\Windows', 'System32', 'cmd.exe')
    return pty.spawn(cmd, [], options)
  }

  const shell = env.SHELL
  if (shell && existsSync(shell)) {
    if (shell.includes('fish')) {
      return pty.spawn(shell, ['-l'], options)
    }
    if (shell.includes('zsh') || shell.includes('bash')) {
      return pty.spawn(shell, ['-l'], options)
    }
  }
  if (existsSync('/bin/zsh')) {
    return pty.spawn('/bin/zsh', ['-l'], options)
  }
  if (existsSync('/bin/bash')) {
    return pty.spawn('/bin/bash', ['-l'], options)
  }
  throw new Error('No usable shell found (expected /bin/zsh or /bin/bash)')
}

function broadcast(channel: string, ...args: unknown[]) {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) win.webContents.send(channel, ...args)
  }
}

export function killAllPtySessions() {
  for (const proc of sessions.values()) {
    try {
      proc.kill()
    } catch {
      /* ignore */
    }
  }
  sessions.clear()
}

export type PtyCreateOpts = {
  sessionId: string
  cwd: string
  cols: number
  rows: number
  /** @default 'claude' */
  kind?: 'claude' | 'shell'
  /** Human-readable label shown in macOS notifications */
  label?: string
}

/**
 * Returns true for escape sequences that the terminal emulator (xterm.js) sends
 * automatically — not as a result of actual user key presses. These should not
 * be counted as "user has interacted with this session."
 *
 * - \x1b[I  focus-in  (VT focus tracking, enabled by Claude Code's Ink TUI via \x1b[?1004h)
 * - \x1b[O  focus-out (same feature)
 * - \x1b[\d+;\d+R  cursor position report (response to DSR \x1b[6n)
 */
function isAutoTerminalSequence(data: string): boolean {
  let s = data
  if (s.endsWith('\r')) s = s.slice(0, -1)
  if (s.endsWith('\n')) s = s.slice(0, -1)
  if (s === '\x1b[I' || s === '\x1b[O') return true
  if (/^\x1b\[\d+;\d+R$/.test(s)) return true
  return false
}

export function registerPtyIpc() {
  ipcMain.handle('pty:create', async (_event, opts: PtyCreateOpts) => {
    try {
      const { sessionId, cwd: cwdRaw, kind: kindRaw } = opts
      const kind = kindRaw ?? 'claude'
      const cwd = cwdRaw.trim().length > 0 ? cwdRaw : os.homedir()
      const cols = Math.max(2, opts.cols)
      const rows = Math.max(1, opts.rows)

      // Always replace on create. Do not "reuse" an existing PTY: a new xterm has no scrollback;
      // full-screen TUIs like Claude Code will not redraw and you get a blank pane with a cursor.
      const existing = sessions.get(sessionId)
      if (existing) {
        try {
          existing.kill()
        } catch {
          /* ignore */
        }
        sessions.delete(sessionId)
      }

      const env = ptyEnv()
      const proc =
        kind === 'shell' ? spawnShellPty(cwd, cols, rows, env) : spawnClaudePty(cwd, cols, rows, env)

      if (kind !== 'shell') {
        registerAgentSession(sessionId, opts.label ?? sessionId)
      }

      proc.onData((data) => {
        broadcast('pty:data', { sessionId, data })
        if (kind !== 'shell') onAgentOutput(sessionId, data)
      })

      proc.onExit(({ exitCode, signal }) => {
        sessions.delete(sessionId)
        if (kind !== 'shell') cleanupAgentSession(sessionId)
        broadcast('pty:exit', { sessionId, exitCode, signal })
      })

      sessions.set(sessionId, proc)
      return { ok: true as const }
    } catch (err) {
      let message = err instanceof Error ? err.message : String(err)
      if (message.includes('posix_spawn')) {
        message +=
          ' — Rebuild node-pty for this Electron: npm run rebuild:native (or npm install).'
      }
      return { ok: false as const, error: message }
    }
  })

  ipcMain.on('pty:write', (_event, sessionId: unknown, data: unknown) => {
    if (typeof sessionId !== 'string' || typeof data !== 'string') return
    sessions.get(sessionId)?.write(data)
    // Skip focus-in/out sequences that xterm.js sends automatically when Claude Code
    // enables focus tracking (ESC[?1004h). These are not real user keystrokes and would
    // otherwise prematurely mark a fresh session as interacted, defeating the
    // hasReceivedInput guard and triggering blue dots on newly-created agent tabs.
    if (!isAutoTerminalSequence(data)) {
      onAgentInput(sessionId)
    }
  })

  ipcMain.on('pty:resize', (_event, sessionId: unknown, cols: unknown, rows: unknown) => {
    if (typeof sessionId !== 'string' || typeof cols !== 'number' || typeof rows !== 'number') {
      return
    }
    const proc = sessions.get(sessionId)
    if (!proc) return
    try {
      proc.resize(Math.max(2, cols), Math.max(1, rows))
    } catch {
      /* ignore */
    }
  })

  ipcMain.handle('pty:kill', (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return false
    const proc = sessions.get(sessionId)
    if (!proc) return true
    try {
      proc.kill()
    } catch {
      /* ignore */
    }
    sessions.delete(sessionId)
    return true
  })
}
