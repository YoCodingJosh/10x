import { create } from 'zustand'

type Intent = {
  nonce: number
  workspaceId: string
  tabId: string
}

type State = {
  intent: Intent | null
  /** Keyboard shortcut requested closing the active agent tab for this workspace. */
  requestCloseActiveAgentTab: (workspaceId: string, tabId: string) => void
  clearIntent: () => void
}

let nonce = 0

export const useAgentTabCloseIntentStore = create<State>((set) => ({
  intent: null,
  requestCloseActiveAgentTab: (workspaceId, tabId) => {
    nonce += 1
    set({ intent: { nonce, workspaceId, tabId } })
  },
  clearIntent: () => set({ intent: null }),
}))
