import { useEffect } from 'react'

import { bucketsToPersisted } from '@/lib/persisted-agent-tabs'
import { useAgentTabsStore } from '@/stores/agent-tabs-store'

const DEBOUNCE_MS = 450

/**
 * Debounced write-through of agent tab state to electron-store. Waits until disk hydration has
 * finished so the initial empty store does not clobber saved data.
 */
export function usePersistAgentTabsToDisk() {
  const hydrated = useAgentTabsStore((s) => s.hydratedFromDisk)

  useEffect(() => {
    if (!hydrated) return

    let timeout: ReturnType<typeof setTimeout> | undefined
    let lastSerialized: string | null = null

    const flush = () => {
      const bw = useAgentTabsStore.getState().byWorkspaceId
      const payload = bucketsToPersisted(bw)
      const json = JSON.stringify(payload)
      if (json === lastSerialized) return
      lastSerialized = json
      void window.mux.store.setAgentTabs(payload)
    }

    const unsub = useAgentTabsStore.subscribe((state, prev) => {
      if (state.byWorkspaceId === prev.byWorkspaceId) return
      clearTimeout(timeout)
      timeout = setTimeout(flush, DEBOUNCE_MS)
    })

    return () => {
      unsub()
      clearTimeout(timeout)
      flush()
    }
  }, [hydrated])
}
