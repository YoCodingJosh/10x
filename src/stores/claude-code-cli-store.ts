import { create } from 'zustand'

type ClaudeCodeCliState = {
  /** `null` until the first probe from the main process finishes. */
  installed: boolean | null
  refresh: () => Promise<void>
}

export const useClaudeCodeCliStore = create<ClaudeCodeCliState>((set) => ({
  installed: null,
  refresh: async () => {
    const installed = await window.mux.claudeCode.isCliInstalled()
    set({ installed })
  },
}))
