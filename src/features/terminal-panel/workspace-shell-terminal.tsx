/** Stable PTY session ids for terminal panel mounts. */

/** App-wide terminal (shared across workspaces); cwd is typically the user home directory. */
export function appWideShellSessionId(shellId: string) {
  return `mux:appwide:${shellId}`
}

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
