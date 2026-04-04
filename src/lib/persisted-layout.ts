/**
 * Single source for layout-related localStorage keys and defaults (workspaces rail, agent/terminal
 * split, diff/git-graph side panel). Used by shell components and Settings → Layout.
 */

export const LAYOUT_KEYS = {
  workspacesRail: 'mux.workspacesRailWidthPx',
  agentTerminalSplit: 'mux.agentTerminalSplitFraction',
  sidePanel: 'mux.sidePanelWidthPx',
  sidePanelLegacy: 'mux.diffPanelWidthPx',
} as const

export const LAYOUT_DEFAULTS = {
  workspacesRailWidthPx: 240,
  workspacesRailMinPx: 180,
  workspacesRailMaxPx: 560,
  /** Lower panel (terminal) share of the agent column height. */
  agentTerminalFraction: 0.38,
  agentTerminalFractionMin: 0.14,
  agentTerminalFractionMax: 0.78,
  sidePanelWidthPx: 360,
  sidePanelMinPx: 220,
  sidePanelMaxPx: 720,
} as const

/** Dispatched on window after persisted layout keys are cleared; shell splits reset live state. */
export const LAYOUT_RESET_EVENT = 'mux-layout-reset'

export function readPersistedWorkspacesRailWidth(): number {
  try {
    const raw = localStorage.getItem(LAYOUT_KEYS.workspacesRail)
    if (raw == null) return LAYOUT_DEFAULTS.workspacesRailWidthPx
    const n = Number(raw)
    if (!Number.isFinite(n)) return LAYOUT_DEFAULTS.workspacesRailWidthPx
    return Math.min(
      LAYOUT_DEFAULTS.workspacesRailMaxPx,
      Math.max(LAYOUT_DEFAULTS.workspacesRailMinPx, Math.round(n)),
    )
  } catch {
    return LAYOUT_DEFAULTS.workspacesRailWidthPx
  }
}

export function readPersistedAgentTerminalFraction(): number {
  try {
    const raw = localStorage.getItem(LAYOUT_KEYS.agentTerminalSplit)
    if (raw == null) return LAYOUT_DEFAULTS.agentTerminalFraction
    const n = Number(raw)
    if (!Number.isFinite(n)) return LAYOUT_DEFAULTS.agentTerminalFraction
    return Math.min(
      LAYOUT_DEFAULTS.agentTerminalFractionMax,
      Math.max(LAYOUT_DEFAULTS.agentTerminalFractionMin, n),
    )
  } catch {
    return LAYOUT_DEFAULTS.agentTerminalFraction
  }
}

export function readPersistedSidePanelWidth(): number {
  for (const key of [LAYOUT_KEYS.sidePanel, LAYOUT_KEYS.sidePanelLegacy] as const) {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      return Math.min(
        LAYOUT_DEFAULTS.sidePanelMaxPx,
        Math.max(LAYOUT_DEFAULTS.sidePanelMinPx, Math.round(n)),
      )
    } catch {
      /* continue */
    }
  }
  return LAYOUT_DEFAULTS.sidePanelWidthPx
}

function hasStoredValue(key: string): boolean {
  try {
    return localStorage.getItem(key) != null
  } catch {
    return false
  }
}

export type PersistedLayoutSnapshot = {
  workspacesRailWidthPx: number
  workspacesRailIsCustom: boolean
  agentTerminalFraction: number
  agentTerminalIsCustom: boolean
  sidePanelWidthPx: number
  sidePanelIsCustom: boolean
}

export function readPersistedLayoutSnapshot(): PersistedLayoutSnapshot {
  return {
    workspacesRailWidthPx: readPersistedWorkspacesRailWidth(),
    workspacesRailIsCustom: hasStoredValue(LAYOUT_KEYS.workspacesRail),
    agentTerminalFraction: readPersistedAgentTerminalFraction(),
    agentTerminalIsCustom: hasStoredValue(LAYOUT_KEYS.agentTerminalSplit),
    sidePanelWidthPx: readPersistedSidePanelWidth(),
    sidePanelIsCustom:
      hasStoredValue(LAYOUT_KEYS.sidePanel) || hasStoredValue(LAYOUT_KEYS.sidePanelLegacy),
  }
}

/** Remove all layout keys from localStorage (does not update React state — use reset event + store). */
export function clearPersistedLayoutStorage(): void {
  for (const key of Object.values(LAYOUT_KEYS)) {
    try {
      localStorage.removeItem(key)
    } catch {
      /* ignore */
    }
  }
}
