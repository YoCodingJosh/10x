import { createContext, useContext, type ReactNode } from 'react'

const WorkspaceIdContext = createContext<string | null>(null)

export function WorkspaceIdProvider({
  workspaceId,
  children,
}: {
  workspaceId: string
  children: ReactNode
}) {
  return (
    <WorkspaceIdContext.Provider value={workspaceId}>{children}</WorkspaceIdContext.Provider>
  )
}

export function useWorkspaceSessionScope() {
  const id = useContext(WorkspaceIdContext)
  if (!id) throw new Error('useWorkspaceSessionScope must be used under WorkspaceIdProvider')
  return id
}
