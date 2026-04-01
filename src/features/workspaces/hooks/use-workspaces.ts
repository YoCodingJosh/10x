import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'

import type { Workspace } from '@/stores/workspace-store'
import { useWorkspaceStore } from '@/stores/workspace-store'

export const workspacesQueryKey = ['workspaces'] as const

export function useWorkspacesQuery() {
  return useQuery({
    queryKey: workspacesQueryKey,
    queryFn: () => window.mux.store.getWorkspaces(),
  })
}

export function usePersistWorkspacesMutation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (workspaces: Workspace[]) => window.mux.store.setWorkspaces(workspaces),
    onSuccess: (_, workspaces) => {
      queryClient.setQueryData(workspacesQueryKey, workspaces)
      useWorkspaceStore.getState().setWorkspaces(workspaces)
    },
  })
}

export function useSyncWorkspacesToStore() {
  const { data, isSuccess } = useWorkspacesQuery()
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId)

  useEffect(() => {
    if (!isSuccess || !data) return

    let nextActive = activeId
    if (data.length === 0) {
      nextActive = null
    } else if (nextActive === null || !data.some((w) => w.id === nextActive)) {
      nextActive = data[0]!.id
    }

    // One setState so we never render with workspaces loaded but activeWorkspaceId still null
    // (that hid every column: `ws.id !== null` → all `hidden` → blank main area).
    useWorkspaceStore.setState({
      workspaces: data,
      activeWorkspaceId: nextActive,
    })
  }, [isSuccess, data, activeId])
}
