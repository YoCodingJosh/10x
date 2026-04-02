import { BrowserWindow, Notification, app } from 'electron'

// ─── IPC broadcast ────────────────────────────────────────────────────────────

function broadcastAgentState(sessionId: string, state: AgentState): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('agent:state-change', { sessionId, state })
    }
  }
}

// ─── ANSI stripping ───────────────────────────────────────────────────────────

const ANSI_CSI_RE = /\x1b\[[0-?]*[ -/]*[@-~]/g
const ANSI_OSC_RE = /\x1b\][^\x07\x1b]*(?:\x07|\x1b\\)/g
const ANSI_ESC_RE = /\x1b[@-_]/g

function stripAnsi(str: string): string {
  return str.replace(ANSI_OSC_RE, '').replace(ANSI_CSI_RE, '').replace(ANSI_ESC_RE, '')
}

// ─── Detection patterns (Claude Code ≈ Ink TUI) ───────────────────────────────

/** Plan / permission blocks — fairly stable English phrases + Yes/No row. */
const PERMISSIONISH_RE =
  /(don't ask again for)|(tell Claude what to do differently)|\b(allow once|allow always|allow for this session|allow all edits)\b|❯\s*(Yes|No)\b|shift\s*\+\s*tab/i

/**
 * Hints that the UI is waiting for a choice (numbered row, arrows, “pick option”, etc.).
 * Claude Code menus are usually 1. 2. 3. — not Y/n.
 */
const CHOICE_HINT_RE =
  /(choose|select|pick)\s+(an?\s+)?(option|answer|choice)|\benter\s*[\[(]?\d|\btype\s+(\d|a\s+number)|\bpress\s+\d|\b\d+\s*[-–]\s*\d+\s+(to|for)\b|↑\s*\/?\s*↓|\buse arrow keys\b|\besc(?:ape)?\s+to\s+cancel\b|\bj\/k\b\s+to\b|\breturn\b.*\bconfirm\b|\btab\s+to\s+amend\b|cancel\s*·\s*tab/i

/**
 * Numbered / column-style option rows. Claude Code often draws the selection as `> 1. Yes`
 * (cursor before the number), which plain `^\d` misses.
 */
const NUMBERED_OPTION_LINE_RE =
  /^[\s>›❯]*\d+(\.\s+|\)\s+|[│┃┆┊┇╎║]\s+|›\s+)\S/

function countNumberedOptionLines(chunk: string): number {
  let n = 0
  for (const line of chunk.split(/\r?\n/)) {
    if (NUMBERED_OPTION_LINE_RE.test(line)) n++
  }
  return n
}

function recentLines(chunk: string, maxLines: number): string {
  const lines = chunk.split(/\r?\n/)
  return lines.slice(Math.max(0, lines.length - maxLines)).join('\n')
}

/**
 * True when the *visible* end of the buffer is clearly the main REPL line (idle),
 * so we ignore numbered lists that scrolled into the ring buffer.
 *
 * Ink often paints a bare `>` line beneath a numbered confirm menu — that must *not*
 * count as the main REPL or we suppress needs-input entirely.
 */
function atMainReplPrompt(clean: string): boolean {
  const end = clean.slice(-220).trimEnd()
  const recent = recentLines(clean.slice(-1400), 16)
  const menuStillVisible = countNumberedOptionLines(recent) >= 2

  if (/(?:\r?\n|^)[>›]\s*$/.test(end)) {
    if (menuStillVisible) return false
    return true
  }

  if (/(?:\r?\n|^)❯\s*$/.test(end)) {
    const tail = clean.slice(-1400)
    if (PERMISSIONISH_RE.test(tail)) return false
    const lastLines = recentLines(tail, 14)
    if (countNumberedOptionLines(lastLines) >= 2) return false
    return true
  }

  return false
}

function needsInputFromBuffer(clean: string): boolean {
  if (atMainReplPrompt(clean)) return false

  const inspect = clean.slice(-2400)
  if (PERMISSIONISH_RE.test(inspect)) return true

  const lastLines = recentLines(inspect, 22)
  const optionRows = countNumberedOptionLines(lastLines)
  if (optionRows >= 2) return true
  if (optionRows >= 1 && CHOICE_HINT_RE.test(inspect)) return true

  return false
}

function looksIdleFromBuffer(clean: string): boolean {
  if (!atMainReplPrompt(clean)) return false
  const end = clean.slice(-400).trimEnd()
  return /(?:\r?\n|^)[>›]\s*$/.test(end) || /(?:\r?\n|^)❯\s*$/.test(end)
}

// ─── Session state ────────────────────────────────────────────────────────────

type AgentState = 'running' | 'idle' | 'needs-input'

interface SessionInfo {
  state: AgentState
  /** Rolling buffer of last ~32 KB of raw PTY output */
  buffer: string
  label: string
  debounceTimer: ReturnType<typeof setTimeout> | null
  /** Suppress "complete" notifications until the user has actually sent input */
  hasReceivedInput: boolean
}

const agentSessions = new Map<string, SessionInfo>()

// ─── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(): void {
  if (process.platform !== 'darwin') return
  let count = 0
  for (const s of agentSessions.values()) {
    if (s.state === 'idle' || s.state === 'needs-input') count++
  }
  try {
    app.setBadgeCount(count)
  } catch {
    // may fail before app is ready — ignore
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

function fireNotification(label: string, type: 'complete' | 'needs-input'): void {
  if (!Notification.isSupported()) return
  try {
    const notif = new Notification({
      title: type === 'complete' ? 'Agent finished' : 'Agent needs input',
      body: label,
      sound: type === 'complete' ? 'Glass' : 'Sosumi',
      silent: false,
    })
    notif.show()
  } catch {
    // ignore — Notification may not be available in all contexts
  }
}

function transitionState(sessionId: string, session: SessionInfo, next: AgentState): void {
  if (session.state === next) return
  session.state = next
  updateBadge()
  broadcastAgentState(sessionId, next)
  if (next === 'idle') fireNotification(session.label, 'complete')
  if (next === 'needs-input') fireNotification(session.label, 'needs-input')
}

// ─── Public API ───────────────────────────────────────────────────────────────

/** Call once per PTY session created (claude kind only). */
export function registerAgentSession(sessionId: string, label: string): void {
  const existing = agentSessions.get(sessionId)
  if (existing != null && existing.debounceTimer !== null) clearTimeout(existing.debounceTimer)

  agentSessions.set(sessionId, {
    state: 'running',
    buffer: '',
    label,
    debounceTimer: null,
    hasReceivedInput: false,
  })
  broadcastAgentState(sessionId, 'running')
}

/** Feed raw PTY output into the detector. */
export function onAgentOutput(sessionId: string, data: string): void {
  const info = agentSessions.get(sessionId)
  if (!info) return

  info.buffer = (info.buffer + data).slice(-32_768)

  if (info.debounceTimer !== null) clearTimeout(info.debounceTimer)

  info.debounceTimer = setTimeout(() => {
    const session = agentSessions.get(sessionId)
    if (!session) return
    session.debounceTimer = null

    const clean = stripAnsi(session.buffer)
    /** Avoid startup false positives for idle; menus can appear before first local keystroke is tracked. */
    const sessionWarm = session.hasReceivedInput || clean.length > 800
    const needs = needsInputFromBuffer(clean)
    const idle = looksIdleFromBuffer(clean)

    if (sessionWarm && needs) {
      transitionState(sessionId, session, 'needs-input')
    } else if (session.hasReceivedInput && idle) {
      transitionState(sessionId, session, 'idle')
    } else if (session.state !== 'running' && !needs && !idle) {
      transitionState(sessionId, session, 'running')
    }
  }, 380)
}

/** Call when the user sends input to the agent (marks session as actively running). */
export function onAgentInput(sessionId: string): void {
  const info = agentSessions.get(sessionId)
  if (!info) return
  info.hasReceivedInput = true
  if (info.state !== 'running') {
    info.state = 'running'
    info.buffer = ''
    updateBadge()
    broadcastAgentState(sessionId, 'running')
  }
}

/** Call when the PTY session exits or is killed. */
export function cleanupAgentSession(sessionId: string): void {
  const info = agentSessions.get(sessionId)
  if (info != null && info.debounceTimer !== null) clearTimeout(info.debounceTimer)
  agentSessions.delete(sessionId)
  updateBadge()
  broadcastAgentState(sessionId, 'running')
}
