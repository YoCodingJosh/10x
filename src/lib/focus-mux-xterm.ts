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
    if (!ta) continue
    const st = window.getComputedStyle(ta)
    if (st.visibility === 'hidden' || st.display === 'none') continue
    const r = ta.getBoundingClientRect()
    if (r.width < 2 || r.height < 2) continue
    ta.focus()
    return true
  }
  return false
}

/**
 * After React/Zustand updates, focus the first visible xterm helper textarea under `rootSelector`.
 * Skips layers hidden with aria-hidden / CSS so we don't focus a background workspace's PTY.
 * If there is no xterm (e.g. last shell closed), focuses a visible button in the same root so ⌘W
 * still hits the panel instead of falling through to the window close shortcut.
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

    const textareas = root.querySelectorAll<HTMLTextAreaElement>('textarea.xterm-helper-textarea')
    for (const ta of textareas) {
      if (ta.closest('[aria-hidden="true"]')) continue
      const st = window.getComputedStyle(ta)
      if (st.visibility === 'hidden' || st.display === 'none') continue
      const r = ta.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) continue
      ta.focus()
      return
    }
    focusFirstVisibleButton(root)
  }
  requestAnimationFrame(() => {
    requestAnimationFrame(run)
  })
}
