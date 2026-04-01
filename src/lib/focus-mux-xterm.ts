function isVisibleFocusableButton(btn: HTMLButtonElement): boolean {
  if (btn.disabled) return false
  if (btn.closest('[aria-hidden="true"]')) return false
  const st = window.getComputedStyle(btn)
  if (st.visibility === 'hidden' || st.display === 'none') return false
  const r = btn.getBoundingClientRect()
  return r.width >= 2 && r.height >= 2
}

function focusFirstVisibleButtonIn(scope: Element): boolean {
  const buttons = scope.querySelectorAll('button')
  for (const btn of buttons) {
    if (!(btn instanceof HTMLButtonElement)) continue
    if (!isVisibleFocusableButton(btn)) continue
    btn.focus()
    return true
  }
  return false
}

/** Prefer the active agent tab panel so we don't focus another tab's control. */
function focusFirstVisibleButton(root: Element): boolean {
  if (root.id === 'mux-agent-desk') {
    const activeTab = root.querySelector('[data-slot="tabs-content"][data-state="active"]')
    if (activeTab && focusFirstVisibleButtonIn(activeTab)) return true
  }
  return focusFirstVisibleButtonIn(root)
}

function isFocusableXtermTextarea(ta: HTMLTextAreaElement): boolean {
  if (ta.closest('[aria-hidden="true"]')) return false
  let el: HTMLElement | null = ta
  while (el) {
    const s = window.getComputedStyle(el)
    if (s.visibility === 'hidden' || s.display === 'none') return false
    el = el.parentElement
  }
  const r = ta.getBoundingClientRect()
  return r.width >= 2 && r.height >= 2
}

/**
 * Focus the Claude/shell xterm in the **active** agent tab only. Document order would otherwise
 * hit the first mounted tab’s PTY (forceMount), not the selected tab.
 */
function focusVisibleXtermInActiveAgentTab(root: Element): boolean {
  const panels = root.querySelectorAll('[data-slot="tabs-content"][data-state="active"]')
  for (const panel of panels) {
    if (!(panel instanceof HTMLElement)) continue
    if (panel.closest('[aria-hidden="true"]')) continue
    const pst = window.getComputedStyle(panel)
    if (pst.visibility === 'hidden' || pst.display === 'none') continue
    if (panel.getBoundingClientRect().width < 2) continue

    const ta = panel.querySelector<HTMLTextAreaElement>('textarea.xterm-helper-textarea')
    if (!ta || !isFocusableXtermTextarea(ta)) continue
    ta.focus()
    return true
  }
  return false
}

/** Focus the visible shell’s xterm in the terminal panel (project or agent scope layers). */
function focusVisibleXtermInTerminalPanel(root: Element): boolean {
  const textareas = root.querySelectorAll<HTMLTextAreaElement>('textarea.xterm-helper-textarea')
  for (const ta of textareas) {
    if (!isFocusableXtermTextarea(ta)) continue
    ta.focus()
    return true
  }
  return false
}

function tryFocusXtermForTyping(root: Element | null): boolean {
  if (!root) return false
  if (root.id === 'mux-agent-desk') return focusVisibleXtermInActiveAgentTab(root)
  if (root.id === 'mux-terminal-panel') return focusVisibleXtermInTerminalPanel(root)
  return false
}

const TYPING_FOCUS_MAX_ATTEMPTS = 48

/**
 * Retry until the xterm helper textarea exists (PTY mounts async) and focus it so keyboard input
 * goes to the shell. Does **not** fall back to tab buttons or other chrome.
 */
export function scheduleFocusMuxXtermForTyping(rootSelector: string): void {
  let attempts = 0
  const tick = () => {
    attempts += 1
    const root = document.querySelector(rootSelector)
    if (tryFocusXtermForTyping(root)) return
    if (attempts < TYPING_FOCUS_MAX_ATTEMPTS) {
      requestAnimationFrame(tick)
    }
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(tick)
  })
}

/**
 * After React updates, focus xterm if possible; otherwise a panel button so ⌘W still targets the panel.
 * Prefer {@link scheduleFocusMuxXtermForTyping} when the user should type into the PTY.
 */
export function scheduleFocusVisibleMuxXterm(rootSelector: string): void {
  const run = () => {
    const root = document.querySelector(rootSelector)
    if (!root) return

    if (root.id === 'mux-agent-desk') {
      if (focusVisibleXtermInActiveAgentTab(root)) return
      focusFirstVisibleButton(root)
      return
    }

    if (root.id === 'mux-terminal-panel') {
      if (focusVisibleXtermInTerminalPanel(root)) return
      focusFirstVisibleButton(root)
      return
    }

    const textareas = root.querySelectorAll<HTMLTextAreaElement>('textarea.xterm-helper-textarea')
    for (const ta of textareas) {
      if (!isFocusableXtermTextarea(ta)) continue
      ta.focus()
      return
    }
    focusFirstVisibleButton(root)
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}
