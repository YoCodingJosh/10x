import { useGitWorkingTreeSummary } from '@/features/git/use-git-working-tree-summary'
import { useActiveWorkspace } from '@/features/workspaces/hooks/use-active-workspace'
import { cn } from '@/lib/utils'

export function WorkspacesRailFooter() {
  const activeWorkspace = useActiveWorkspace()
  const { cwd, state } = useGitWorkingTreeSummary()

  if (!activeWorkspace) return null

  return (
    <div className="border-t border-border p-2 text-[11px] leading-snug">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
        Git (focused checkout)
      </div>

      {state.kind === 'idle' ? (
        <p className="mt-1 text-muted-foreground">Select a workspace to inspect Git status.</p>
      ) : state.kind === 'loading' ? (
        <p className="mt-1 text-muted-foreground">Reading repository…</p>
      ) : state.kind === 'not-repo' ? (
        <p className="mt-1 text-muted-foreground">Not a Git repository in this folder.</p>
      ) : (
        <>
          <p className="mt-1 font-medium text-sidebar-foreground">
            {state.presentation.detached
              ? state.presentation.branchDisplay
              : `On ${state.presentation.branchDisplay}`}
          </p>
          {state.presentation.rows.map((row, i) => (
            <p key={i} className={cn('mt-1 text-[11px] leading-snug', row.className)}>
              {row.text}
            </p>
          ))}
        </>
      )}

      {cwd ? (
        <div
          className="mt-2 break-all font-mono text-[10px] text-muted-foreground"
          title={cwd}
        >
          {cwd}
        </div>
      ) : null}
    </div>
  )
}
