import type { AgentTab } from '@/stores/agent-tabs-store'

/**
 * How closing an agent tab should behave when it has an `agentPath` (Mux worktree).
 * - `plain` — main-workspace agent tab; no worktree folder to remove.
 * - `stale` — path is missing or not a Git repo anymore; skip the destructive confirmation modal.
 * - `active` — still a Git checkout; show "Remove agent and worktree?" before `git worktree remove`.
 */
export type AgentWorktreeCloseKind = 'plain' | 'stale' | 'active'

export async function classifyAgentWorktreeClose(tab: AgentTab): Promise<AgentWorktreeCloseKind> {
  if (!tab.agentPath) return 'plain'
  const c = await window.mux.git.classify(tab.agentPath)
  if (!c.isRepo) return 'stale'
  return 'active'
}
