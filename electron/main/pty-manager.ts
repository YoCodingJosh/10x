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

type PosixShellKind = 'fish' | 'zsh' | 'bash' | 'sh'

type PosixShell = {
  path: string
  kind: PosixShellKind
}

function defaultPosixSearchPath(): string {
  return process.platform === 'darwin'
    ? '/usr/bin:/bin:/usr/sbin:/sbin:/opt/homebrew/bin:/usr/local/bin'
    : '/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin'
}

function classifyPosixShell(shellPath: string): PosixShellKind | null {
  const shellName = path.basename(shellPath).toLowerCase()
  if (shellName === 'fish') return 'fish'
  if (shellName === 'zsh') return 'zsh'
  if (shellName === 'bash') return 'bash'
  if (shellName === 'sh' || shellName === 'dash') return 'sh'
  return null
}

// TODO: Make the preferred shell configurable in app settings instead of only deriving it from SHELL and hard-coded fallbacks.
function preferredPosixShell(options?: { includeBasicSh?: boolean }): PosixShell | null {
  const candidates = [process.env.SHELL, '/bin/zsh', '/bin/bash', '/bin/sh']
  for (const candidate of candidates) {
    if (candidate && existsSync(candidate)) {
      const kind = classifyPosixShell(candidate)
      if (!kind) continue
      if (kind === 'sh' && !options?.includeBasicSh) continue
      return { path: candidate, kind }
    }
  }
  return null
}

function shellCommandArgs(shell: PosixShell, command: string): string[] {
  if (shell.kind === 'fish') return ['-lic', command]
  if (shell.kind === 'zsh' || shell.kind === 'bash') return ['-ilc', command]
  return ['-c', command]
}

function interactiveShellArgs(shell: PosixShell): string[] {
  if (shell.kind === 'fish' || shell.kind === 'zsh' || shell.kind === 'bash') {
    return ['-l']
  }
  return []
}

function mergePath(a: string, b: string): string {
  return [...new Set([...a.split(pathSep), ...b.split(pathSep)].filter(Boolean))].join(pathSep)
}

/** Only what the login shell needs to find your home + run `printenv`. */
function minimalEnvForShellProbe(shell: string): NodeJS.ProcessEnv {
  const u = os.userInfo()
  return {
    HOME: os.homedir(),
    USER: u.username,
    LOGNAME: u.username,
    SHELL: shell,
    TERM: 'dumb',
    PATH: defaultPosixSearchPath(),
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
  const shell = preferredPosixShell({ includeBasicSh: true })
  if (!shell) {
    return process.env.PATH ?? ''
  }
  try {
    return execFileSync(shell.path, shellCommandArgs(shell, 'printenv PATH'), {
      encoding: 'utf8',
      timeout: 12_000,
      env: coerceStringEnv({ ...process.env, TERM: 'dumb', HOME: os.homedir(), SHELL: shell.path }),
    }).trim()
  } catch {
    return process.env.PATH ?? ''
  }
}

/**
 * Full env after an interactive login shell — same idea as opening Terminal, without inheriting
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

  const shell = preferredPosixShell()
  if (shell) {
    try {
      const out = execFileSync(shell.path, shellCommandArgs(shell, 'printenv'), {
        encoding: 'utf8',
        timeout: 25_000,
        maxBuffer: 10 * 1024 * 1024,
        env: minimalEnvForShellProbe(shell.path),
      })
      const parsed = parsePrintenv(out)
      if (!parsed.PATH?.trim()) {
        throw new Error('login capture returned empty PATH')
      }
      return coerceStringEnv(parsed)
    } catch {
      // Fall back to the current environment with a repaired PATH.
    }
  }

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
 * Spawn `claude` like Terminal: real PATH/node from captured env, then exec via the user's shell
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

  const shell =
    (env.SHELL && existsSync(env.SHELL)
      ? (() => {
          const kind = classifyPosixShell(env.SHELL)
          return kind ? { path: env.SHELL, kind } : null
        })()
      : null) ?? preferredPosixShell({ includeBasicSh: true })

  if (!shell) {
    throw new Error('No usable shell found for Claude sessions')
  }

  return pty.spawn(shell.path, shellCommandArgs(shell, 'exec claude'), options)
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

  const shell =
    env.SHELL && existsSync(env.SHELL)
      ? (() => {
          const kind = classifyPosixShell(env.SHELL)
          return kind ? { path: env.SHELL, kind } : null
        })()
      : null
  if (shell) {
    return pty.spawn(shell.path, interactiveShellArgs(shell), options)
  }
  const fallbackShell = preferredPosixShell({ includeBasicSh: true })
  if (fallbackShell) {
    return pty.spawn(fallbackShell.path, interactiveShellArgs(fallbackShell), options)
  }
  throw new Error('No usable shell found (expected fish, zsh, bash, or sh)')
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
  /** Human-readable label (combined fallback for notifications) */
  label?: string
  /** With `notificationAgent`, used for `workspace — agent — Complete|Needs input` */
  notificationWorkspace?: string
  notificationAgent?: string
}

/**
 * Strip bytes xterm may inject without a real keypress. They often arrive **bundled** in one
 * `onData` chunk (so an exact full-string match is not enough — that used to false-trigger
 * `onAgentInput`, marking every background tab as “user interacted” and producing bogus DONE).
 *
 * - CSI I / CSI O — focus in/out (\x1b[?1004h)
 * - CSI row;col R — cursor position report (DSR \x1b[6n)
 * - CSI ?… c / CSI >… c — primary / secondary device attribute responses
 *
 * Focus-out uses `(?![A-Za-z])` so we do not eat the `O` in `\x1b[OP` (F1, etc.).
 */
function stripAutomaticTerminalChunks(data: string): string {
  let s = data
  let prev: string
  do {
    prev = s
    s = s.replace(/\x1b\[\d+;\d+R/g, '')
    s = s.replace(/\x1b\[\?[\d;]*c/g, '')
    s = s.replace(/\x1b\[>[\d;]*c/g, '')
    s = s.replace(/\x1b\[I/g, '')
    s = s.replace(/\x1b\[O(?![A-Za-z])/g, '')
  } while (s !== prev)
  return s
}

function shouldCountAsUserPtyWrite(data: string): boolean {
  return stripAutomaticTerminalChunks(data).length > 0
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
        registerAgentSession(sessionId, {
          label: opts.label ?? sessionId,
          notificationWorkspace: opts.notificationWorkspace,
          notificationAgent: opts.notificationAgent,
        })
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
          ' — Rebuild node-pty for this Electron: pnpm run rebuild:native (or pnpm install).'
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
    if (shouldCountAsUserPtyWrite(data)) {
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
