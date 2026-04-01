import { create } from 'zustand'

/**
 * Incrementing nonces so shell-level command palette can trigger dialogs owned by
 * {@link GitQuickActionButton} / {@link AgentSessionsPanel} without prop drilling.
 */
type State = {
  commitNonce: number
  publishNonce: number
  worktreeNonce: number
  newAgentTabNonce: number
  requestCommitDialog: () => void
  requestPublishDialog: () => void
  requestWorktreeDialog: () => void
  requestNewAgentTab: () => void
}

export const useCommandPaletteIntentsStore = create<State>((set) => ({
  commitNonce: 0,
  publishNonce: 0,
  worktreeNonce: 0,
  newAgentTabNonce: 0,
  requestCommitDialog: () => set((s) => ({ commitNonce: s.commitNonce + 1 })),
  requestPublishDialog: () => set((s) => ({ publishNonce: s.publishNonce + 1 })),
  requestWorktreeDialog: () => set((s) => ({ worktreeNonce: s.worktreeNonce + 1 })),
  requestNewAgentTab: () => set((s) => ({ newAgentTabNonce: s.newAgentTabNonce + 1 })),
}))
