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
  const setWorkspaces = useWorkspaceStore((s) => s.setWorkspaces)
  const activeId = useWorkspaceStore((s) => s.activeWorkspaceId)
  const setActive = useWorkspaceStore((s) => s.setActiveWorkspaceId)

  useEffect(() => {
    if (!isSuccess || !data) return
    setWorkspaces(data)
    if (activeId === null && data.length > 0) {
      setActive(data[0].id)
    }
    if (activeId !== null && !data.some((w) => w.id === activeId)) {
      setActive(data[0]?.id ?? null)
    }
  }, [isSuccess, data, activeId, setWorkspaces, setActive])
}
