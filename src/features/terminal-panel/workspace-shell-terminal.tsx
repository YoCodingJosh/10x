/** Stable PTY session ids for terminal panel mounts. */

export function globalShellSessionId(workspaceId: string, shellId: string) {
  return `mux:shell:${workspaceId}:${shellId}`
}

export function worktreeShellSessionId(
  workspaceId: string,
  agentTabId: string,
  shellId: string,
): string {
  return `mux:wt:${workspaceId}:${agentTabId}:${shellId}`
}
