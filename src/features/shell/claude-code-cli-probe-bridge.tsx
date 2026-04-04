import { useEffect } from 'react'

import { useClaudeCodeCliStore } from '@/stores/claude-code-cli-store'

/** Probes for the Claude Code CLI once when the renderer loads (matches “on boot”). */
export function ClaudeCodeCliProbeBridge() {
  const refresh = useClaudeCodeCliStore((s) => s.refresh)

  useEffect(() => {
    void refresh()
  }, [refresh])

  return null
}
