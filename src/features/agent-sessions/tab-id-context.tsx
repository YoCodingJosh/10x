import { createContext, useContext, type ReactNode } from 'react'

const TabIdContext = createContext<string | null>(null)

export function TabIdProvider({ tabId, children }: { tabId: string; children: ReactNode }) {
  return <TabIdContext.Provider value={tabId}>{children}</TabIdContext.Provider>
}

export function useAgentTabId() {
  const id = useContext(TabIdContext)
  if (!id) throw new Error('useAgentTabId must be used under TabIdProvider')
  return id
}
