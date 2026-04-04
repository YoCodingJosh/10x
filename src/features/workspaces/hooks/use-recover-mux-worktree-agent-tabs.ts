import { useLayoutEffect, useMemo } from 'react'

import { useAgentTabsStore } from '@/stores/agent-tabs-store'
import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

/**
 * After reload, recreate agent tabs for 10x worktrees under ~/10x-worktrees that still exist
 * but are not yet represented by a tab (in-memory state was lost).
 */
export function useRecoverMuxWorktreeAgentTabs() {
  const workspaces = useWorkspaceStore((s) => s.workspaces)
  const claudeInstalled = useClaudeCodeCliStore((s) => s.installed)
  const signature = useMemo(
    () => workspaces.map((w) => `${w.id}:${w.path}`).join('|'),
    [workspaces],
  )

  useLayoutEffect(() => {
    if (workspaces.length === 0) return
    if (claudeInstalled !== true) return

    let cancelled = false

    void (async () => {
      const wsList = useWorkspaceStore.getState().workspaces

      for (const w of wsList) {
        if (cancelled) return

        try {
          const classified = await window.mux.git.classify(w.path)
          if (!classified.isRepo) continue

          const candidates = await window.mux.git.listRecoverableMuxWorktrees(w.path)
          if (candidates.length === 0 || cancelled) continue

          const bucket = useAgentTabsStore.getState().byWorkspaceId[w.id]
          const existing = new Set(
            (bucket?.tabs ?? [])
              .map((t) => t.agentPath)
              .filter((p): p is string => Boolean(p)),
          )

          for (const wt of candidates) {
            if (cancelled) return
            if (existing.has(wt.path)) continue

            useAgentTabsStore.getState().addTab(w.id, {
              agentPath: wt.path,
              label: wt.label,
              skipAgentFocus: true,
            })
            existing.add(wt.path)
          }
        } catch {
          /* ignore per workspace */
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [signature, workspaces.length, claudeInstalled])
}
