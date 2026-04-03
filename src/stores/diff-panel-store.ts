import { create } from 'zustand'

const STORAGE_KEY = 'mux.diffPanelWidthPx'
const DEFAULT_WIDTH_PX = 360
const MIN_WIDTH_PX = 220
const MAX_WIDTH_PX = 720

function readStoredWidthPx(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw == null) return DEFAULT_WIDTH_PX
    const n = Number(raw)
    if (!Number.isFinite(n)) return DEFAULT_WIDTH_PX
    return Math.min(MAX_WIDTH_PX, Math.max(MIN_WIDTH_PX, Math.round(n)))
  } catch {
    return DEFAULT_WIDTH_PX
  }
}

type DiffPanelState = {
  open: boolean
  widthPx: number
  toggle: () => void
  setOpen: (open: boolean) => void
  setWidthPx: (widthPx: number) => void
}

export const useDiffPanelStore = create<DiffPanelState>((set) => ({
  open: false,
  widthPx: readStoredWidthPx(),
  toggle: () => set((s) => ({ open: !s.open })),
  setOpen: (open) => set({ open }),
  setWidthPx: (widthPx) => {
    try {
      localStorage.setItem(STORAGE_KEY, String(widthPx))
    } catch {
      /* ignore */
    }
    set({ widthPx })
  },
}))

export const DIFF_PANEL_WIDTH = {
  min: MIN_WIDTH_PX,
  max: MAX_WIDTH_PX,
  default: DEFAULT_WIDTH_PX,
} as const
