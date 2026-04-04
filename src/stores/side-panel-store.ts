import { create } from 'zustand'

import {
  LAYOUT_DEFAULTS,
  LAYOUT_KEYS,
  readPersistedSidePanelWidth,
} from '@/lib/persisted-layout'

const DEFAULT_WIDTH_PX = LAYOUT_DEFAULTS.sidePanelWidthPx
const MIN_WIDTH_PX = LAYOUT_DEFAULTS.sidePanelMinPx
const MAX_WIDTH_PX = LAYOUT_DEFAULTS.sidePanelMaxPx

export type SidePanelId = 'diff' | 'git-graph'

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
  /** Restore default width without writing localStorage (used after layout reset). */
  resetWidthWithoutPersist: () => void
}

export const useSidePanelStore = create<SidePanelState>((set, get) => ({
  active: null,
  widthPx: readPersistedSidePanelWidth(),
  open: (id) => set({ active: id }),
  toggle: (id) =>
    set({
      active: get().active === id ? null : id,
    }),
  close: () => set({ active: null }),
  setWidthPx: (widthPx) => {
    try {
      localStorage.setItem(LAYOUT_KEYS.sidePanel, String(widthPx))
    } catch {
      /* ignore */
    }
    set({ widthPx })
  },
  resetWidthWithoutPersist: () => set({ widthPx: DEFAULT_WIDTH_PX }),
}))

export const SIDE_PANEL_WIDTH = {
  min: MIN_WIDTH_PX,
  max: MAX_WIDTH_PX,
  default: DEFAULT_WIDTH_PX,
} as const
