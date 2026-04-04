import { BrowserWindow, Notification, app, ipcMain } from 'electron'

// ─── IPC broadcast ────────────────────────────────────────────────────────────

function broadcastAgentState(sessionId: string, session: SessionInfo | null): void {
  if (session == null) {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('agent:state-change', {
          sessionId,
          state: 'running' satisfies AgentState,
          needsAttention: false,
        })
      }
    }
    return
  }
  const { state } = session
  const needsAttention =
    (state === 'idle' || state === 'needs-input') && !session.attentionDismissed
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('agent:state-change', { sessionId, state, needsAttention })
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

// ─── Detection patterns ───────────────────────────────────────────────────────

/** Plan / permission blocks — fairly stable English phrases + Yes/No row. */
const PERMISSIONISH_RE =
  /(don't ask again for)|(tell Claude what to do differently)|\b(allow once|allow always|allow for this session|allow all edits)\b|❯\s*(Yes|No)\b|shift\s*\+\s*tab/i

/**
 * Hints that the UI is waiting for a choice (numbered row, arrows, "pick option", etc.).
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

function needsInputFromBuffer(clean: string): boolean {
  const inspect = clean.slice(-2400)
  if (PERMISSIONISH_RE.test(inspect)) return true
  const lastLines = recentLines(inspect, 22)
  const optionRows = countNumberedOptionLines(lastLines)
  if (optionRows >= 2) return true
  if (optionRows >= 1 && CHOICE_HINT_RE.test(inspect)) return true
  return false
}

/**
 * After 1.5 s of output silence, idle if the prompt (❯) appears anywhere in the
 * recent buffer tail. This is more reliable than requiring ❯ to be the very last
 * bytes, which Ink's cursor-positioning codes often prevent.
 */
function looksIdleFromBuffer(clean: string): boolean {
  return /❯/.test(clean.slice(-1000))
}

// ─── Session state ────────────────────────────────────────────────────────────

type AgentState = 'running' | 'idle' | 'needs-input'

interface SessionInfo {
  state: AgentState
  /** Rolling buffer of last ~32 KB of raw PTY output */
  buffer: string
  /** Combined fallback when workspace/agent are not set */
  label: string
  workspaceLabel: string
  agentLabel: string
  debounceTimer: ReturnType<typeof setTimeout> | null
  /** Suppress "complete" notifications until the user has actually sent input */
  hasReceivedInput: boolean
  /**
   * When true, idle/needs-input does not count for badge, notifications, or needsAttention IPC.
   * Set when the user is viewing that tab as it becomes idle/needs-input, when they switch to it
   * while it already needs attention, or via dismissAgentAttention. Stays true when switching to
   * another tab so a completion seen while focused does not re-surface as a dot later.
   */
  attentionDismissed: boolean
}

/** Milliseconds of PTY silence before we evaluate idle / needs-input state. */
const QUIESCENCE_MS = 1500

const agentSessions = new Map<string, SessionInfo>()

/** `workspaceId:tabId` for the agent tab the user is currently viewing (synced from renderer). */
let focusedAgentSessionId: string | null = null

function setFocusedAgentSession(sessionId: string | null): void {
  const next = sessionId != null && sessionId.length > 0 ? sessionId : null
  const prev = focusedAgentSessionId
  if (prev === next) return
  focusedAgentSessionId = next

  // Do not clear attentionDismissed on the tab we leave. If it went idle/needs-input while
  // focused, it stays dismissed — the user already saw it; switching away must not resurrect a dot.
  if (prev != null) {
    const s = agentSessions.get(prev)
    if (s != null) {
      broadcastAgentState(prev, s)
    }
  }

  if (next != null) {
    const s = agentSessions.get(next)
    if (s != null && (s.state === 'idle' || s.state === 'needs-input')) {
      s.attentionDismissed = true
    }
    if (s != null) {
      broadcastAgentState(next, s)
    }
  }

  updateBadge()
}

// ─── Badge ────────────────────────────────────────────────────────────────────

function updateBadge(): void {
  if (process.platform !== 'darwin') return
  let count = 0
  for (const [id, s] of agentSessions) {
    if (
      id !== focusedAgentSessionId &&
      (s.state === 'idle' || s.state === 'needs-input') &&
      !s.attentionDismissed
    ) {
      count++
    }
  }
  try {
    app.setBadgeCount(count)
  } catch {
    // may fail before app is ready — ignore
  }
}

// ─── Notifications ────────────────────────────────────────────────────────────

function fireNotification(session: SessionInfo, type: 'complete' | 'needs-input'): void {
  if (!Notification.isSupported()) return
  const status = type === 'complete' ? 'Complete' : 'Needs input'
  const ws = session.workspaceLabel.trim()
  const ag = session.agentLabel.trim()
  const body =
    ws.length > 0 && ag.length > 0 ? `${ws} — ${ag} — ${status}` : `${session.label} — ${status}`
  try {
    const notif = new Notification({
      title: app.getName(),
      body,
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
  if (next === 'idle' || next === 'needs-input') {
    session.attentionDismissed = sessionId === focusedAgentSessionId
  }
  updateBadge()
  broadcastAgentState(sessionId, session)
  const isForegroundAgent = sessionId === focusedAgentSessionId
  if (next === 'idle' && !isForegroundAgent) fireNotification(session, 'complete')
  if (next === 'needs-input' && !isForegroundAgent) fireNotification(session, 'needs-input')
}

// ─── Public API ───────────────────────────────────────────────────────────────

export type RegisterAgentSessionLabels = {
  /** Combined human-readable label (fallback for notification body) */
  label: string
  /** Workspace name for notification copy: `workspace — agent — …` */
  notificationWorkspace?: string
  /** Tab / agent name for notification copy */
  notificationAgent?: string
}

/** Call once per PTY session created (claude kind only). */
export function registerAgentSession(sessionId: string, meta: RegisterAgentSessionLabels): void {
  const existing = agentSessions.get(sessionId)
  if (existing != null && existing.debounceTimer !== null) clearTimeout(existing.debounceTimer)

  agentSessions.set(sessionId, {
    state: 'running',
    buffer: '',
    label: meta.label,
    workspaceLabel: meta.notificationWorkspace?.trim() ?? '',
    agentLabel: meta.notificationAgent?.trim() ?? '',
    debounceTimer: null,
    hasReceivedInput: false,
    attentionDismissed: false,
  })
  const created = agentSessions.get(sessionId)
  if (created) {
    broadcastAgentState(sessionId, created)
  }
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
    const needs = needsInputFromBuffer(clean)
    const idle = looksIdleFromBuffer(clean)

    if (session.hasReceivedInput && needs) {
      transitionState(sessionId, session, 'needs-input')
    } else if (session.hasReceivedInput && idle) {
      transitionState(sessionId, session, 'idle')
    } else if (session.state !== 'running' && !needs && !idle) {
      transitionState(sessionId, session, 'running')
    }
  }, QUIESCENCE_MS)
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
    broadcastAgentState(sessionId, info)
  }
}

/** Call when the PTY session exits or is killed. */
export function cleanupAgentSession(sessionId: string): void {
  const info = agentSessions.get(sessionId)
  if (info != null && info.debounceTimer !== null) clearTimeout(info.debounceTimer)
  agentSessions.delete(sessionId)
  updateBadge()
  broadcastAgentState(sessionId, null)
}

/** Renderer: user focused this agent tab — match dock badge to cleared blue dots. */
export function dismissAgentAttention(sessionId: string): void {
  const info = agentSessions.get(sessionId)
  if (!info) return
  if (info.state !== 'idle' && info.state !== 'needs-input') return
  info.attentionDismissed = true
  updateBadge()
  broadcastAgentState(sessionId, info)
}

/** IPC: sync badge when the user views an agent tab (see dismissAgentAttention). */
export function registerAgentAttentionIpc(): void {
  ipcMain.on('agent:dismiss-attention', (_event, sessionId: unknown) => {
    if (typeof sessionId !== 'string') return
    dismissAgentAttention(sessionId)
  })

  ipcMain.on('agent:set-focused-session', (_event, sessionId: unknown) => {
    if (sessionId === null || sessionId === undefined) {
      setFocusedAgentSession(null)
      return
    }
    if (typeof sessionId !== 'string') return
    setFocusedAgentSession(sessionId)
  })
}
