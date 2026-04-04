import type { AgentTab } from '@/stores/agent-tabs-store'

/** Shape stored in electron-store (JSON-serializable). */
export type PersistedAgentTab = {
  id: string
  label: string
  agentPath?: string
}

export type PersistedAgentBucket = {
  tabs: PersistedAgentTab[]
  activeTabId: string | null
}

export type PersistedAgentTabsByWorkspace = Record<string, PersistedAgentBucket>

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0
}

function sanitizeTab(raw: unknown): PersistedAgentTab | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (!isNonEmptyString(o.id) || !isNonEmptyString(o.label)) return null
  const tab: PersistedAgentTab = { id: o.id.trim(), label: o.label.trim() }
  if (typeof o.agentPath === 'string' && o.agentPath.trim().length > 0) {
    tab.agentPath = o.agentPath.trim()
  }
  return tab
}

function sanitizeBucket(raw: unknown): PersistedAgentBucket | null {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return null
  const o = raw as Record<string, unknown>
  if (!Array.isArray(o.tabs)) return null
  const seen = new Set<string>()
  const tabs: PersistedAgentTab[] = []
  for (const t of o.tabs) {
    const st = sanitizeTab(t)
    if (!st || seen.has(st.id)) continue
    seen.add(st.id)
    tabs.push(st)
  }
  let activeTabId: string | null = null
  if (o.activeTabId === null) {
    activeTabId = null
  } else if (isNonEmptyString(o.activeTabId)) {
    const id = o.activeTabId.trim()
    activeTabId = tabs.some((t) => t.id === id) ? id : tabs[0]?.id ?? null
  } else {
    activeTabId = tabs[0]?.id ?? null
  }
  return { tabs, activeTabId }
}

/** Parse root value from disk; ignores unknown workspace keys (caller filters by valid ids). */
export function parsePersistedAgentTabsRoot(raw: unknown): PersistedAgentTabsByWorkspace {
  if (raw == null || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: PersistedAgentTabsByWorkspace = {}
  for (const [workspaceId, bucket] of Object.entries(raw)) {
    if (!isNonEmptyString(workspaceId)) continue
    const b = sanitizeBucket(bucket)
    if (b) out[workspaceId.trim()] = b
  }
  return out
}

export function bucketsToPersisted(
  byWorkspaceId: Record<string, { tabs: AgentTab[]; activeTabId: string | null }>,
): PersistedAgentTabsByWorkspace {
  const out: PersistedAgentTabsByWorkspace = {}
  for (const [wid, bucket] of Object.entries(byWorkspaceId)) {
    out[wid] = {
      tabs: bucket.tabs.map((t) => ({
        id: t.id,
        label: t.label,
        ...(t.agentPath ? { agentPath: t.agentPath } : {}),
      })),
      activeTabId: bucket.activeTabId,
    }
  }
  return out
}
