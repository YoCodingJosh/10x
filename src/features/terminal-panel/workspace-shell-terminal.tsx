import { ShellTerminal } from './shell-terminal'

export function workspaceShellSessionId(workspaceId: string) {
  return `mux:shell:${workspaceId}`
}

type Props = {
  workspaceId: string
  cwd: string
}

/** One global (project) shell per workspace; session id is stable across workspace switches. */
export function WorkspaceShellTerminal({ workspaceId, cwd }: Props) {
  return <ShellTerminal sessionId={workspaceShellSessionId(workspaceId)} cwd={cwd} />
}

export function worktreeShellSessionId(
  workspaceId: string,
  agentTabId: string,
  shellId: string,
): string {
  return `mux:wt:${workspaceId}:${agentTabId}:${shellId}`
}
