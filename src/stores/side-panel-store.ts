import { create } from 'zustand'

const STORAGE_KEY = 'mux.sidePanelWidthPx'
const LEGACY_STORAGE_KEY = 'mux.diffPanelWidthPx'
const DEFAULT_WIDTH_PX = 360
const MIN_WIDTH_PX = 220
const MAX_WIDTH_PX = 720

export type SidePanelId = 'diff' | 'git-graph'

function readStoredWidthPx(): number {
  for (const key of [STORAGE_KEY, LEGACY_STORAGE_KEY]) {
    try {
      const raw = localStorage.getItem(key)
      if (raw == null) continue
      const n = Number(raw)
      if (!Number.isFinite(n)) continue
      return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, Math.round(n)))
    } catch {
      /* continue */
    }
  }
  return DEFAULT_WIDTH_PX
}

type SidePanelState = {
  /** Which side panel is visible; `null` means the column is hidden. */
  active: SidePanelId | null
  widthPx: number
  /** Open this panel (closes any other side panel). */
  open: (id: SidePanelId) => void
  /** Toggle this panel: open if closed/different, close if already active. */
  toggle: (id: SidePanelId) => void
  close: () => void
  setWidthPx: (widthPx: number) => void
}

export const useSidePanelStore = create<SidePanelState>((set, get) => ({
  active: null,
  widthPx: readStoredWidthPx(),
  open: (id) => set({ active: id }),
  toggle: (id) =>
    set({
      active: get().active === id ? null : id,
    }),
  close: () => set({ active: null }),
  setWidthPx: (widthPx) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(widthPx))
    } catch {
      /* ignore */
    }
    set({ widthPx })
  },
}))

export const SIDE_PANEL_WIDTH = {
  min: MIN_WIDTH_PX,
  max: MAX_WIDTH_PX,
  default: DEFAULT_WIDTH_PX,
} as const
